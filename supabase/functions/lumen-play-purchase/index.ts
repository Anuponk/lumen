// #729 — Google Play purchase verifier. The player is derived from verified Auth, the
// purchase from Google's Play Developer API; the browser never decides what is paid.
// mode "verify" (player session): check the token with Google, record it (#728), then
// acknowledge it (an unacknowledged purchase is refunded by Google after 3 days).
// mode "voided" (operator secret): replay Google's voided purchases as refunds.
// Secrets (Edge Function secrets, never in the client):
//   LUMEN_PLAY_SERVICE_ACCOUNT  service-account JSON with androidpublisher access
//   LUMEN_PLAY_PACKAGE          defaults to com.nopuna.lumen
//   LUMEN_PLAY_CRON_SECRET      shared secret for the "voided" mode
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const ORIGIN = 'https://lumen.nopuna.fr';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/';
const PLAY_REGION_EUR = 'FR'; // Distribution is France-only (android/PLAY.md); other regions never count towards the EUR cap.

function b64url(bytes) {
  let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256hex(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
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
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const packageName = Deno.env.get('LUMEN_PLAY_PACKAGE') || 'com.nopuna.lumen';
  let account = null;
  try { account = JSON.parse(Deno.env.get('LUMEN_PLAY_SERVICE_ACCOUNT') || 'null'); } catch { account = null; }
  if (!url || !key || !serviceKey || !account?.client_email || !account?.private_key) return reply(503, { error: 'unavailable' });
  let body;
  try { body = await request.json(); } catch { return reply(400, { error: 'invalid_request' }); }
  const operator = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const play = async (path, init = {}) => {
    const access = await googleAccessToken(account, fetch);
    const response = await fetch(API + encodeURIComponent(packageName) + path, { ...init, headers: { authorization: 'Bearer ' + access, 'content-type': 'application/json' } });
    const text = await response.text();
    return { ok: response.ok, status: response.status, data: text ? JSON.parse(text) : {} };
  };
  try {
    if (body?.mode === 'voided') {
      const secret = Deno.env.get('LUMEN_PLAY_CRON_SECRET');
      if (!secret || request.headers.get('x-lumen-cron') !== secret) return reply(401, { error: 'unauthorized' });
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
          const { error: recordError } = await operator.rpc('lumen_record_purchase', {
            p_provider: 'play', p_provider_ref: ref, p_user_id: original.user_id, p_product_id: original.product_id,
            p_amount_cents: original.amount_cents, p_currency: original.currency, p_status: 'refunded', p_purchased_at: original.purchased_at,
          });
          if (recordError) throw Error('record_failed');
          refunded++;
        }
        pageToken = listed.data.tokenPagination?.nextPageToken || '';
      } while (pageToken);
      return reply(200, { status: 'synced', seen, refunded, unknown });
    }

    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return reply(401, { error: 'authentication_required' });
    const productId = body?.productId, purchaseToken = body?.purchaseToken;
    if (typeof productId !== 'string' || !/^[a-z0-9_]{1,64}$/.test(productId) || typeof purchaseToken !== 'string' || purchaseToken.length < 1 || purchaseToken.length > 4096)
      return reply(400, { error: 'invalid_request' });
    const client = createClient(url, key, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return reply(401, { error: 'invalid_session' });
    // Keep canonical internal IDs in the purchase ledger; Google uses underscore SKUs.
    const internalProductId = /^real_adventure_0[2-9]$/.test(productId) || productId === 'real_sky_all'
      ? productId.replaceAll('_', '-') : null;
    if (!internalProductId) return reply(400, { error: 'unknown_product' });
    const { data: product, error: productError } = await operator.rpc('lumen_store_price', { p_product_id: internalProductId });
    if (productError) throw Error('catalogue_unavailable');
    if (!product?.active) return reply(400, { error: 'unknown_product' });

    const path = '/purchases/products/' + encodeURIComponent(productId) + '/tokens/' + encodeURIComponent(purchaseToken);
    const checked = await play(path);
    if (checked.status === 404 || checked.status === 400) return reply(400, { error: 'invalid_purchase' });
    if (!checked.ok) return reply(502, { error: 'google_unavailable' });
    const purchase = checked.data;
    if (purchase.purchaseState === 2) return reply(202, { status: 'pending' });
    if (purchase.purchaseState !== 0) return reply(409, { status: 'not_paid' });
    const ref = await sha256hex(purchaseToken);
    const eur = !purchase.regionCode || purchase.regionCode === PLAY_REGION_EUR;
    const { data: recorded, error: recordError } = await operator.rpc('lumen_record_purchase', {
      p_provider: 'play', p_provider_ref: ref, p_user_id: user.id, p_product_id: internalProductId,
      p_amount_cents: eur ? product.price_cents : 0, p_currency: eur ? product.currency : 'XXX', p_status: 'paid',
      p_purchased_at: purchase.purchaseTimeMillis ? new Date(Number(purchase.purchaseTimeMillis)).toISOString() : null,
    });
    if (recordError) {
      if (/identity conflict/.test(recordError.message || '')) return reply(409, { error: 'purchase_owned_elsewhere' });
      throw Error('record_failed');
    }
    let acknowledged = purchase.acknowledgementState === 1;
    if (!acknowledged) {
      const ack = await play(path + ':acknowledge', { method: 'POST', body: '{}' });
      acknowledged = ack.ok;
      if (!ack.ok) console.error('Lumen Play acknowledge failed:', ack.status);
    }
    return reply(200, { status: 'paid', acknowledged, adventures: recorded?.adventures || [] });
  } catch (error) {
    console.error('Lumen Play purchase failed:', error?.message || 'unknown');
    return reply(503, { error: 'unavailable' });
  }
});
