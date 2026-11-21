// #729 — Google Play purchase verifier. The player is derived from verified Auth, the
// purchase from Google's Play Developer API; the browser never decides what is paid.
// mode "verify" (player session): check the token with Google, record it (#728), then
// acknowledge it (an unacknowledged purchase is refunded by Google after 3 days).
// modes "acknowledge" and "voided" (operator secret): retry acknowledgements and reconcile refunds.
// mode "readiness" (operator secret): read-only check of Google access, permissions, ledger and RTDN setup.
// POST /rtdn: authenticated Google Pub/Sub push, using the same purchase verifier.
// Secrets (Edge Function secrets, never in the client):
//   LUMEN_PLAY_SERVICE_ACCOUNT  service-account JSON with androidpublisher access
//   LUMEN_PLAY_PACKAGE          defaults to com.nopuna.lumen
//   LUMEN_PLAY_CRON_SECRET      shared secret for the "voided" mode
//   LUMEN_PLAY_RECOVERY_ORDERS  optional JSON map of independently reconciled order IDs to Auth UUIDs
//   LUMEN_PLAY_RTDN_AUDIENCE, LUMEN_PLAY_RTDN_EMAIL, LUMEN_PLAY_RTDN_SUBSCRIPTION  push identity
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.12';
const ORIGIN = 'https://lumen.nopuna.fr';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/';
const PLAY_CAP_REGION = 'FR';
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const bindingPattern = /^[0-9a-f]{64}$/;
// #865: Play SKUs sold by Lumen (Play Console forbids hyphens; the ledger keeps hyphens).
const playSkuPattern = /^(real_adventure_0[2-9]|real_sky_all|real_sky_upgrade_[1-4])$/;

function parseNotification(data) {
  if (typeof data !== 'string' || data.length > 16384) return null;
  try {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data), character => character.charCodeAt(0))));
  } catch {
    return null;
  }
}

function readSettlement(money) {
  if (typeof money?.currencyCode !== 'string'
    || !/^[A-Z]{3}$/.test(money.currencyCode)) return null;
  const units = money.units ?? '0';
  const nanos = money.nanos ?? 0;
  if (typeof units !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(units)
    || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1_000_000_000) return null;
  return { amount: units + '.' + String(nanos).padStart(9, '0'), currency: money.currencyCode };
}

function b64url(bytes) {
  let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function purchasePath(productId, token) {
  return '/purchases/products/' + encodeURIComponent(productId) + '/tokens/' + encodeURIComponent(token);
}
async function googleAccessToken(account, fetchImpl) {
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({
    iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  });
  const pem = String(account.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const response = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(8000),
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + unsigned + '.' + b64url(signature),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw Error('google_auth_failed');
  return body.access_token;
}

Deno.serve(async (request) => {
  const headers = {
    'content-type': 'application/json', 'cache-control': 'no-store',
    'access-control-allow-origin': ORIGIN,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-lumen-cron',
    'access-control-allow-methods': 'POST, OPTIONS', vary: 'Origin',
  };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const origin = request.headers.get('origin');
  if (origin && origin !== ORIGIN) return reply(403, { error: 'origin_not_allowed' });
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const isRtdn = new URL(request.url).pathname.endsWith('/lumen-play-purchase/rtdn');
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const subscription = Deno.env.get('LUMEN_PLAY_RTDN_SUBSCRIPTION');
  if (isRtdn) {
    const audience = Deno.env.get('LUMEN_PLAY_RTDN_AUDIENCE');
    const email = Deno.env.get('LUMEN_PLAY_RTDN_EMAIL');
    if (!audience || !email || !subscription) return reply(503, { error: 'rtdn_unavailable' });
    if (!token) return reply(401, { error: 'authentication_required' });
    try {
      const { payload } = await jwtVerify(token, googleKeys, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'], audience,
        algorithms: ['RS256'], requiredClaims: ['iss', 'aud', 'exp', 'iat', 'sub'],
      });
      if (payload.email !== email || payload.email_verified !== true) return reply(403, { error: 'rtdn_identity' });
    } catch {
      return reply(401, { error: 'rtdn_identity' });
    }
  }
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const packageName = Deno.env.get('LUMEN_PLAY_PACKAGE') || 'com.nopuna.lumen';
  let account = null;
  try { account = JSON.parse(Deno.env.get('LUMEN_PLAY_SERVICE_ACCOUNT') || 'null'); } catch { account = null; }
  if (!url || !key || !serviceKey || !account?.client_email || !account?.private_key) return reply(503, { error: 'unavailable' });
  let body;
  try { body = await request.json(); } catch { return reply(400, { error: 'invalid_request' }); }
  const operator = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let accessToken;
  const play = async (path, init = {}) => {
    const access = await (accessToken ??= googleAccessToken(account, fetch));
    const response = await fetch(API + encodeURIComponent(packageName) + path, { ...init, signal: AbortSignal.timeout(8000), headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' } });
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch { throw Error('google_invalid_response'); }
    }
    return { ok: response.ok, status: response.status, data };
  };
  const refund = async (ref, original) => {
    const { error } = await operator.rpc('lumen_record_purchase', {
      p_provider: 'play', p_provider_ref: ref, p_user_id: original.user_id, p_product_id: original.product_id,
      p_amount_cents: original.amount_cents, p_currency: original.currency, p_status: 'refunded', p_purchased_at: original.purchased_at,
    });
    if (error) throw Error('refund_failed');
  };
  const claimAcknowledgements = async (purchaseId = null) => {
    const { data, error } = await operator.rpc('lumen_claim_play_acknowledgements', { p_purchase_id: purchaseId });
    if (error || !Array.isArray(data)) throw Error('ack_claim_failed');
    return data;
  };
  const acknowledge = async (job, verifiedPurchase) => {
    try {
      const path = purchasePath(job.product_id.replaceAll('-', '_'), job.purchase_token);
      if (!verifiedPurchase) {
        const checked = await play(path);
        if (!checked.ok) {
          console.error('Lumen Play ack verification failed:', checked.status);
          return false;
        }
        verifiedPurchase = checked.data;
        if (verifiedPurchase.purchaseState === 1) {
          const ref = await sha256hex(job.purchase_token);
          const { data: original, error } = await operator.rpc('lumen_purchase_by_ref', {
            p_provider: 'play', p_provider_ref: ref,
          });
          if (error) throw Error('lookup_failed');
          if (original?.status === 'paid') await refund(ref, original);
          return false;
        }
      }
      if (verifiedPurchase.purchaseState !== 0) return false;
      if (verifiedPurchase.acknowledgementState !== 1) {
        const ack = await play(path + ':acknowledge', { method: 'POST', body: '{}' });
        if (!ack.ok) {
          console.error('Lumen Play acknowledge failed:', ack.status);
          return false;
        }
      }
      const { error } = await operator.rpc('lumen_complete_play_acknowledgement', {
        p_purchase_id: job.purchase_id, p_attempt: job.attempt,
      });
      if (error) throw Error('ack_completion_failed');
      return true;
    } catch {
      console.error('Lumen Play acknowledgement retry required');
      return false;
    }
  };
  try {
    if (isRtdn) {
      if (body?.subscription !== subscription) return reply(403, { error: 'rtdn_subscription' });
      const delivered = new Response(null, { status: 204, headers });
      const notification = parseNotification(body?.message?.data);
      if (!notification || notification.packageName !== packageName) return delivered;
      if (notification.testNotification) {
        console.info('Lumen Play RTDN test notification accepted');
        return delivered;
      }
      const oneTime = notification.oneTimeProductNotification;
      const voided = notification.voidedPurchaseNotification;
      let result;
      if (oneTime && [1, 2].includes(oneTime.notificationType)
        && typeof oneTime.sku === 'string' && playSkuPattern.test(oneTime.sku)) {
        result = await verify(oneTime.sku, oneTime.purchaseToken, null, oneTime.notificationType === 2);
      } else if (voided?.productType === 2 && voided.refundType === 1
        && typeof voided.purchaseToken === 'string' && voided.purchaseToken.length >= 1
        && voided.purchaseToken.length <= 4096 && typeof voided.orderId === 'string' && voided.orderId) {
        const ref = await sha256hex(voided.purchaseToken);
        const { data: original, error } = await operator.rpc('lumen_purchase_by_ref', {
          p_provider: 'play', p_provider_ref: ref,
        });
        if (error) throw Error('lookup_failed');
        if (!original) return reply(503, { error: 'rtdn_receipt_pending' });
        if (original.status === 'refunded') return delivered;
        result = await verify(original.product_id.replaceAll('-', '_'), voided.purchaseToken, null, true, voided.orderId);
      } else {
        return delivered;
      }
      const outcome = await result.json();
      // Only retain messages that may succeed after a provider or database retry.
      if (result.status >= 500 || result.status === 202 || outcome.error === 'invalid_purchase') {
        console.warn('Lumen Play RTDN deferred');
        return reply(503, { error: 'rtdn_retry' });
      }
      if (outcome.error === 'purchase_account_unverified' || outcome.error === 'purchase_owned_elsewhere') {
        console.warn('Lumen Play RTDN requires account reconciliation');
      }
      return delivered;
    }
    if (body?.mode === 'voided' || body?.mode === 'acknowledge' || body?.mode === 'readiness') {
      const secret = Deno.env.get('LUMEN_PLAY_CRON_SECRET');
      if (!secret || request.headers.get('x-lumen-cron') !== secret) return reply(401, { error: 'unauthorized' });
      if (body.mode === 'readiness') {
        // #833: operator pre-activation probe. No purchase, no write, no token or secret
        // in the reply. Licence-test purchases never call orders.get, so this is the only
        // check of that permission before a real sale. 400/404 on synthetic identifiers
        // prove the API answered for this package; 401/403 point to a missing permission.
        const status = async (path) => { try { return (await play(path)).status; } catch { return 'error'; } };
        let googleAuth = true;
        try { await (accessToken ??= googleAccessToken(account, fetch)); } catch { googleAuth = false; }
        const checks = { googleAuth, products: null, orders: null, voided: null };
        if (googleAuth) {
          checks.products = await status(purchasePath('real_adventure_02', 'lumen-readiness-probe'));
          checks.orders = await status('/orders/' + encodeURIComponent('GPA.0000-0000-0000-00000'));
          checks.voided = await status('/purchases/voidedpurchases?maxResults=1');
        }
        const { error: ledgerError } = await operator.rpc('lumen_purchase_by_ref', { p_provider: 'play', p_provider_ref: '0'.repeat(64) });
        const reachable = (value) => value === 400 || value === 404;
        const result = {
          ...checks, ledger: !ledgerError,
          rtdnConfigured: !!(subscription && Deno.env.get('LUMEN_PLAY_RTDN_AUDIENCE') && Deno.env.get('LUMEN_PLAY_RTDN_EMAIL')),
          packageName,
        };
        return reply(200, {
          status: 'readiness', ...result,
          ready: googleAuth && reachable(checks.products) && reachable(checks.orders) && checks.voided === 200
            && result.ledger && result.rtdnConfigured,
        });
      }
      if (body.mode === 'acknowledge') {
        const { error } = await operator.rpc('lumen_prune_play_acknowledgements');
        if (error) throw Error('ack_prune_failed');
        const jobs = await claimAcknowledgements();
        const results = await Promise.all(jobs.map(job => acknowledge(job)));
        const acknowledged = results.filter(Boolean).length;
        return reply(200, { status: 'synced', acknowledged, retry: results.length - acknowledged });
      }
      let pageToken = '', refunded = 0, unknown = 0, seen = 0;
      do {
        const listed = await play('/purchases/voidedpurchases?maxResults=1000' + (pageToken ? '&token=' + encodeURIComponent(pageToken) : ''));
        if (!listed.ok) return reply(502, { error: 'google_unavailable' });
        for (const item of listed.data.voidedPurchases || []) {
          seen++;
          const ref = await sha256hex(String(item.purchaseToken || ''));
          const { data: original, error } = await operator.rpc('lumen_purchase_by_ref', { p_provider: 'play', p_provider_ref: ref });
          if (error) throw Error('lookup_failed');
          if (!original) { unknown++; continue; }
          if (original.status === 'refunded') continue;
          await refund(ref, original);
          refunded++;
        }
        pageToken = listed.data.tokenPagination?.nextPageToken || '';
      } while (pageToken);
      return reply(200, { status: 'synced', seen, refunded, unknown });
    }

    if (body?.mode !== 'verify') return reply(400, { error: 'invalid_request' });
    if (!token) return reply(401, { error: 'authentication_required' });
    const client = createClient(url, key, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return reply(401, { error: 'invalid_session' });
    return await verify(body?.productId, body?.purchaseToken, user.id);
  } catch {
    console.error('Lumen Play verification unavailable');
    return reply(503, { error: 'unavailable' });
  }

  async function verify(productId, purchaseToken, userId, refundOnly = false, expectedOrderId = null) {
    if (typeof productId !== 'string' || !/^[a-z0-9_]{1,64}$/.test(productId)
      || typeof purchaseToken !== 'string' || purchaseToken.length < 1 || purchaseToken.length > 4096) {
      return reply(400, { error: 'invalid_request' });
    }
    // Keep canonical internal IDs in the purchase ledger; Google uses underscore SKUs.
    const internalProductId = playSkuPattern.test(productId) ? productId.replaceAll('_', '-') : null;
    const skyUpgrade = internalProductId?.startsWith('real-sky-upgrade-') === true;
    if (!internalProductId) return reply(400, { error: 'unknown_product' });
    const path = purchasePath(productId, purchaseToken);
    const checked = await play(path);
    if (checked.status === 404 || checked.status === 400) return reply(400, { error: 'invalid_purchase' });
    if (!checked.ok) return reply(502, { error: 'google_unavailable' });
    const purchase = checked.data;
    if (purchase.purchaseState === 2) return reply(202, { status: 'pending' });
    if (purchase.purchaseState !== 0 && purchase.purchaseState !== 1) return reply(502, { error: 'google_invalid_response' });
    const ref = await sha256hex(purchaseToken);
    const { data: original, error: lookupError } = await operator.rpc('lumen_purchase_by_ref', {
      p_provider: 'play', p_provider_ref: ref,
    });
    if (lookupError) throw Error('lookup_failed');
    // #878: a refunded purchase grants nothing on any account. Say so instead of asking
    // to reconnect to the account that held it; nothing is recorded or acknowledged.
    if (original?.status === 'refunded' && original.product_id === internalProductId && userId && original.user_id !== userId) {
      return reply(409, { status: 'not_paid' });
    }
    if (original && ((userId && original.user_id !== userId) || original.product_id !== internalProductId)) {
      return reply(409, { error: 'purchase_owned_elsewhere' });
    }
    if (expectedOrderId && purchase.orderId && purchase.orderId !== expectedOrderId) {
      return reply(409, { error: 'order_conflict' });
    }
    const denyUnpaid = async () => {
      if (original && original.status !== 'refunded') await refund(ref, original);
      return reply(409, original ? { status: 'not_paid', revoked: true } : { status: 'not_paid' });
    };
    if (purchase.purchaseState === 1) return await denyUnpaid();
    if (original?.status === 'refunded') return await denyUnpaid();

    const testPurchase = purchase.purchaseType === 0;
    const accountBinding = purchase.obfuscatedExternalAccountId;
    if (refundOnly && !original) return reply(409, { status: 'not_paid' });
    if (!userId) {
      userId = original?.user_id;
      if (!userId && typeof accountBinding === 'string' && bindingPattern.test(accountBinding)) {
        const { data: owner, error } = await operator.rpc('lumen_play_account_by_binding', { p_account_binding: accountBinding });
        if (error) throw Error('binding_lookup_failed');
        userId = owner;
      }
      if (!userId) return reply(409, { error: 'purchase_account_unverified' });
    }
    if (!refundOnly && accountBinding != null && accountBinding !== await sha256hex('lumen-play:' + userId)) {
      return reply(409, { error: 'purchase_owned_elsewhere' });
    }
    let settlement = null;
    // Check real orders on replay too, when Google supplied an order ID.
    if ((!testPurchase || refundOnly) && (!original || purchase.orderId)) {
      if (purchase.quantity != null && purchase.quantity !== 1) return reply(409, { error: 'unsupported_quantity' });
      if (typeof purchase.orderId !== 'string' || !purchase.orderId) return reply(202, { status: 'pending' });
      const order = await play('/orders/' + encodeURIComponent(purchase.orderId));
      if (order.status === 404) return reply(202, { status: 'pending' });
      if (!order.ok) return reply(502, { error: 'google_unavailable' });
      const { orderId, purchaseToken: orderToken, lineItems } = order.data;
      if (orderId !== purchase.orderId || orderToken !== purchaseToken
        || !Array.isArray(lineItems) || lineItems.length !== 1 || lineItems[0]?.productId !== productId) {
        return reply(502, { error: 'unverified_order_identity' });
      }
      if (order.data.state === 'REFUNDED' || order.data.state === 'CANCELED') return await denyUnpaid();
      if (refundOnly) return reply(202, { status: 'pending' });
      if (['PENDING', 'PENDING_REFUND'].includes(order.data.state)) return reply(202, { status: 'pending' });
      if (order.data.state !== 'PROCESSED') return reply(409, { status: 'not_paid' });
      settlement = readSettlement(lineItems[0].total);
      if (!settlement) return reply(502, { error: 'unverified_order_total' });
    }
    if (refundOnly) return reply(202, { status: 'pending' });
    if (!original && skyUpgrade) {
      // #865: the tier is checked again once paid. An outdated tier is neither recorded
      // nor acknowledged, so Google refunds it automatically (never a silent grant).
      const { data: eligible, error } = await operator.rpc('lumen_sky_upgrade_eligible', { p_user: userId, p_product: internalProductId });
      if (error) throw Error('eligibility_failed');
      if (eligible !== true) return reply(409, { error: 'offer_not_eligible' });
    }
    if (!original && accountBinding == null) {
      // The current TWA does not pass an account binding. Allow only orders the
      // operator has independently reconciled, after reading the real settlement.
      const recovery = JSON.parse(Deno.env.get('LUMEN_PLAY_RECOVERY_ORDERS') || '{}');
      const owner = settlement && Object.hasOwn(recovery, purchase.orderId) && recovery[purchase.orderId];
      if (!owner) return reply(409, { error: 'purchase_account_unverified' });
      if (owner !== userId) return reply(409, { error: 'purchase_owned_elsewhere' });
    }
    const { data: recorded, error: recordError } = await operator.rpc('lumen_record_play_purchase_with_ack', {
      p_provider_ref: ref, p_user_id: userId, p_product_id: internalProductId,
      p_settled_amount: original ? null : settlement?.amount ?? null,
      p_settled_currency: original ? null : settlement?.currency ?? null,
      // #865: an upgrade never feeds the historical € credit; the rule counts distinct adventures.
      p_counts_toward_cap: skyUpgrade ? false : testPurchase ? !purchase.regionCode || purchase.regionCode === PLAY_CAP_REGION
        : settlement?.currency === 'EUR' && (!purchase.regionCode || purchase.regionCode === PLAY_CAP_REGION),
      p_test_purchase: testPurchase,
      p_purchased_at: purchase.purchaseTimeMillis ? new Date(Number(purchase.purchaseTimeMillis)).toISOString() : null,
      p_purchase_token: purchase.acknowledgementState === 1 ? null : purchaseToken,
      p_acknowledged: purchase.acknowledgementState === 1,
    });
    if (recordError) {
      if (/identity conflict/.test(recordError.message || '')) return reply(409, { error: 'purchase_owned_elsewhere' });
      if (/unknown product/.test(recordError.message || '')) return reply(400, { error: 'unknown_product' });
      throw Error('record_failed');
    }
    if (recorded?.status !== 'paid') return reply(409, { status: 'not_paid' });
    let acknowledged = purchase.acknowledgementState === 1 || recorded.acknowledged === true;
    if (!acknowledged) {
      try {
        const [job] = await claimAcknowledgements(recorded.purchase_id);
        if (job) acknowledged = await acknowledge(job, purchase);
      } catch {
        console.error('Lumen Play acknowledgement claim failed');
      }
    }
    return reply(200, { status: 'paid', acknowledged, adventures: recorded?.adventures || [] });
  }
});
