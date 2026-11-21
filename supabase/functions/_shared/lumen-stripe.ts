// #730 — shared Stripe helpers for lumen-stripe-checkout and lumen-stripe-webhook.
// The Stripe mode comes from the key: sk_test_/rk_test_ (test) or sk_live_/rk_live_ (live).
// Events and Checkout Sessions must be in that same mode; real sales also require the
// server switch lumen_commands.feature_flags 'stripe_live' (checked by the SQL gateway).
// No Stripe SDK: plain fetch + WebCrypto, so the handlers run in synthetic tests.
// Never log keys, signatures, tokens, card data or e-mail addresses.
export const LUMEN_ORIGIN = 'https://lumen.nopuna.fr';
export const STRIPE_API = 'https://api.stripe.com/v1';
export const STRIPE_VERSION = '2024-06-20';
export const SIGNATURE_TOLERANCE_SECONDS = 300;

// Returns {key, live} for a Stripe secret or restricted key, or null.
export function stripeKey(value) {
  const m = typeof value === 'string' ? /^(sk|rk)_(test|live)_[A-Za-z0-9]{8,}$/.exec(value) : null;
  return m ? { key: value, live: m[2] === 'live' } : null;
}
export function sessionIdPattern(live) {
  return live ? /^cs_live_[A-Za-z0-9]{1,190}$/ : /^cs_test_[A-Za-z0-9]{1,190}$/;
}

export function formBody(params) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null) out.append(key, String(value));
  return out.toString();
}

// Returns {ok, status, data}. Network failures are thrown: the caller answers 5xx.
export async function stripeRequest(fetchImpl, key, method, path, params = null, idempotencyKey = null) {
  const headers = { authorization: 'Bearer ' + key, 'stripe-version': STRIPE_VERSION };
  let url = STRIPE_API + path, body;
  if (params && method === 'GET') url += (url.includes('?') ? '&' : '?') + formBody(params);
  else if (params) { body = formBody(params); headers['content-type'] = 'application/x-www-form-urlencoded'; }
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const response = await fetchImpl(url, { method, headers, body });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  return { ok: response.ok, status: response.status, data };
}

function hex(bytes) { return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
// Stripe-Signature: t=<unix>,v1=<hex hmac-sha256 of "t.rawBody">[,v1=...]. Raw body only.
export async function verifyStripeSignature(rawBody, header, secret, nowSeconds) {
  if (typeof secret !== 'string' || !secret.startsWith('whsec_')) return { ok: false, reason: 'secret' };
  if (typeof header !== 'string' || header.length > 2048) return { ok: false, reason: 'missing' };
  let timestamp = null; const signatures = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=', 2).map((s) => (s || '').trim());
    if (k === 't' && /^\d{1,12}$/.test(v)) timestamp = Number(v);
    if (k === 'v1' && /^[0-9a-f]{64}$/.test(v)) signatures.push(v);
  }
  if (timestamp === null || !signatures.length) return { ok: false, reason: 'missing' };
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return { ok: false, reason: 'expired' };
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + rawBody)));
  return signatures.some((s) => sameText(s, expected)) ? { ok: true } : { ok: false, reason: 'mismatch' };
}

const OPEN_DISPUTES = ['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'];
// Current truth of one Checkout Session, read back from Stripe with the secret key.
// Returns {kind:'retry'} on a Stripe/network failure (the caller answers 5xx),
// {kind:'invalid', reason} when the session is not a Lumen payment of the key's mode, or
// {kind:'state', record:{...}} ready for lumen_stripe_record_session, or {kind:'open'}.
export async function readStripeSession(fetchImpl, key, sessionId, live = false) {
  if (typeof sessionId !== 'string' || !sessionIdPattern(live).test(sessionId)) return { kind: 'invalid', reason: 'session_id' };
  const read = await stripeRequest(fetchImpl, key, 'GET', '/checkout/sessions/' + encodeURIComponent(sessionId), { 'expand[]': 'payment_intent.latest_charge' });
  if (read.status === 404) return { kind: 'invalid', reason: 'not_found' };
  if (!read.ok) return { kind: 'retry' };
  const s = read.data || {};
  if (s.livemode !== live) return { kind: 'invalid', reason: 'livemode' };
  if (s.mode !== 'payment' || s.id !== sessionId) return { kind: 'invalid', reason: 'mode' };
  const user = s.metadata?.lumen_user_id, product = s.metadata?.lumen_product_id;
  if (typeof user !== 'string' || typeof product !== 'string' || s.client_reference_id !== user) return { kind: 'invalid', reason: 'metadata' };
  const intent = s.payment_intent && typeof s.payment_intent === 'object' ? s.payment_intent : null;
  const charge = intent?.latest_charge && typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
  const base = {
    p_session_id: sessionId, p_user: user, p_product: product, p_amount_cents: s.amount_total,
    p_currency: String(s.currency || '').toUpperCase(), p_livemode: live, p_dispute_closed: false,
    p_payment_intent: intent?.id || (typeof s.payment_intent === 'string' ? s.payment_intent : null),
    p_purchased_at: new Date(1000 * Number(charge?.created || s.created || 0)).toISOString(),
  };
  if (s.status === 'expired') return { kind: 'state', record: { ...base, p_status: 'expired' } };
  if (s.status !== 'complete') return { kind: 'open' };
  if (s.payment_status !== 'paid') {
    // Delayed payment methods: processing stays pending; anything else has failed.
    return { kind: 'state', record: { ...base, p_status: intent?.status === 'processing' ? 'pending' : 'failed' } };
  }
  if (charge && (charge.refunded === true || (charge.amount > 0 && charge.amount_refunded >= charge.amount)))
    return { kind: 'state', record: { ...base, p_status: 'refunded' } };
  if (charge?.disputed === true) {
    const listed = await stripeRequest(fetchImpl, key, 'GET', '/disputes', { payment_intent: base.p_payment_intent, limit: 10 });
    if (!listed.ok) return { kind: 'retry' };
    const dispute = [...(listed.data?.data || [])].sort((a, b) => (b.created || 0) - (a.created || 0))[0];
    if (!dispute || OPEN_DISPUTES.includes(dispute.status)) return { kind: 'state', record: { ...base, p_status: 'disputed' } };
    if (dispute.status === 'lost') return { kind: 'state', record: { ...base, p_status: 'disputed', p_dispute_closed: true } };
    return { kind: 'state', record: { ...base, p_status: 'paid', p_dispute_closed: true } }; // won, warning_closed
  }
  // A partial refund (goodwill gesture) keeps the access; a full refund withdraws it.
  return { kind: 'state', record: { ...base, p_status: 'paid' } };
}

// Read the truth from Stripe and record it. Returns {http, body} for the caller.
export async function syncStripeSession({ fetchImpl, key, operator, sessionId, expectUser = null, live = false }) {
  const truth = await readStripeSession(fetchImpl, key, sessionId, live);
  if (truth.kind === 'retry') return { http: 503, body: { error: 'stripe_unavailable' } };
  if (truth.kind === 'invalid') return { http: truth.reason === 'livemode' ? 400 : 200, body: { status: 'ignored', reason: truth.reason } };
  if (truth.kind === 'open') return { http: 200, body: { status: 'open' } };
  if (expectUser && truth.record.p_user !== expectUser) return { http: 404, body: { error: 'unknown_session' } };
  const { data, error } = await operator.rpc('lumen_stripe_record_session', truth.record);
  if (error) {
    if (/identity conflict|live mode|invalid mode/.test(error.message || '')) return { http: 409, body: { error: 'session_conflict' } };
    return { http: 503, body: { error: 'record_failed' } };
  }
  if (data?.result === 'unknown_session') return { http: 200, body: { status: 'ignored', reason: 'unknown_session' } };
  return { http: 200, body: { status: data?.result === 'stale' ? data.status : truth.record.p_status, adventures: data?.adventures || [] } };
}
