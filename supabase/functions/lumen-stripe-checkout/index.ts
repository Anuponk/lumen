// #730 — Stripe Checkout for the web/PWA (TEST MODE ONLY). Player session required.
// mode "checkout": the server reserves the purchase (lumen_stripe_checkout_begin: test
//   account, active product, catalogue price, ownership, one checkout in flight, rate
//   limit), creates a one-off Checkout Session with that price and returns its URL.
// mode "status":   after the Stripe return, read the session back from Stripe and record
//   it (same path as the webhook). The return URL itself never grants anything.
// mode "restore":  « Restaurer mes achats » — re-read the player's recent sessions.
// Secrets (Edge Function secrets only): STRIPE_SECRET_KEY (sk_test_/rk_test_ only).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { LUMEN_ORIGIN, stripeTestKey, stripeRequest, syncStripeSession } from '../_shared/lumen-stripe.ts';

function productLabel(productId, kind) {
  if (kind === 'sky') return 'Lumen · Tout le vrai ciel';
  const n = /^real-adventure-(\d{1,3})$/.exec(productId);
  return 'Lumen · Aventure ' + (n ? Number(n[1]) : productId);
}

Deno.serve(async (request) => {
  const headers = {
    'content-type': 'application/json', 'cache-control': 'no-store',
    'access-control-allow-origin': LUMEN_ORIGIN,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS', vary: 'Origin',
  };
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const origin = request.headers.get('origin');
  if (origin && origin !== LUMEN_ORIGIN) return reply(403, { error: 'origin_not_allowed' });
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const rawKey = Deno.env.get('STRIPE_SECRET_KEY') || '';
  const key = stripeTestKey(rawKey);
  if (!key) {
    if (/^(sk|rk)_live_/.test(rawKey)) console.error('Lumen Stripe: live key refused (test phase)');
    return reply(503, { error: 'unavailable' });
  }
  if (!url || !anonKey || !serviceKey) return reply(503, { error: 'unavailable' });
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, { error: 'authentication_required' });
  let body;
  try { body = await request.json(); } catch { return reply(400, { error: 'invalid_request' }); }
  const mode = body?.mode || 'checkout';
  if (!['checkout', 'status', 'restore'].includes(mode)) return reply(400, { error: 'invalid_request' });
  const client = createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user?.id) return reply(401, { error: 'invalid_session' });
  const operator = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    if (mode === 'status' || mode === 'restore') {
      const sessionId = mode === 'status' ? body?.sessionId : null;
      if (mode === 'status' && (typeof sessionId !== 'string' || !/^cs_test_[A-Za-z0-9]{1,190}$/.test(sessionId))) return reply(400, { error: 'invalid_request' });
      const { data: sessions, error } = await operator.rpc('lumen_stripe_sessions_for_user', { p_user: user.id, p_session_id: sessionId });
      if (error) throw Error('lookup_failed');
      if (mode === 'status' && !sessions?.length) return reply(404, { error: 'unknown_session' });
      const results = [];
      for (const s of sessions || []) {
        const synced = await syncStripeSession({ fetchImpl: fetch, key, operator, sessionId: s.session_id, expectUser: user.id });
        if (synced.http >= 500) return reply(503, { error: 'unavailable' });
        results.push({ productId: s.product_id, status: synced.http === 200 ? synced.body.status : 'error', adventures: synced.body.adventures });
      }
      return mode === 'status' ? reply(200, results[0]) : reply(200, { results });
    }

    const productId = body?.productId;
    if (typeof productId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(productId)) return reply(400, { error: 'invalid_request' });
    // #732: express request for immediate access and waiver of the withdrawal right.
    if (body?.waiver !== true) return reply(400, { error: 'waiver_required' });
    const waiverAt = new Date().toISOString();
    const { data: begin, error: beginError } = await operator.rpc('lumen_stripe_checkout_begin', { p_user: user.id, p_product: productId, p_waiver_at: waiverAt });
    if (beginError) throw Error('reservation_failed');
    const result = begin?.result;
    if (result === 'reuse') return reply(200, { url: begin.url, reused: true });
    if (result === 'busy') return reply(409, { error: 'checkout_in_progress' });
    if (result === 'rate_limited') return reply(429, { error: 'rate_limited' });
    if (result === 'not_eligible') return reply(403, { error: 'not_eligible' });
    if (result === 'unknown_product') return reply(400, { error: 'unknown_product' });
    if (result === 'already_owned' || result === 'sky_after_single') return reply(409, { error: result });
    if (result !== 'reserved' || !Number.isInteger(begin.amount_cents) || begin.amount_cents <= 0 || !/^[A-Z]{3}$/.test(begin.currency || '')) throw Error('reservation_invalid');

    // Best effort: the previous unpaid session of this account can no longer be paid.
    if (begin.superseded) await stripeRequest(fetch, key, 'POST', '/checkout/sessions/' + encodeURIComponent(begin.superseded) + '/expire').catch(() => null);

    const meta = { lumen_user_id: user.id, lumen_product_id: begin.product_id, lumen_reservation: begin.reservation_id };
    const params = {
      mode: 'payment', locale: 'fr', client_reference_id: user.id,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': begin.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': begin.amount_cents,
      'line_items[0][price_data][product_data][name]': productLabel(begin.product_id, begin.kind),
      success_url: LUMEN_ORIGIN + '/?lumen_checkout=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: LUMEN_ORIGIN + '/?lumen_checkout=cancel',
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      'custom_text[submit][message]': 'Accès immédiat demandé : tu as renoncé à ton droit de rétractation de 14 jours pour ce contenu numérique.',
    };
    for (const [k, v] of Object.entries(meta)) { params['metadata[' + k + ']'] = v; params['payment_intent_data[metadata][' + k + ']'] = v; }
    const created = await stripeRequest(fetch, key, 'POST', '/checkout/sessions', params, 'lumen-checkout-' + begin.reservation_id);
    const session = created.data || {};
    if (!created.ok || session.livemode !== false || typeof session.id !== 'string' || !session.id.startsWith('cs_test_')
      || typeof session.url !== 'string' || !session.url.startsWith('https://checkout.stripe.com/')) {
      await operator.rpc('lumen_stripe_checkout_release', { p_reservation: begin.reservation_id });
      console.error('Lumen Stripe checkout creation failed:', created.status, session?.error?.code || '');
      return reply(502, { error: 'stripe_unavailable' });
    }
    const { error: attachError } = await operator.rpc('lumen_stripe_checkout_attach', {
      p_reservation: begin.reservation_id, p_session_id: session.id, p_url: session.url,
      p_expires_at: new Date(1000 * Number(session.expires_at)).toISOString(),
    });
    if (attachError) throw Error('attach_failed');
    return reply(200, { url: session.url });
  } catch (error) {
    console.error('Lumen Stripe checkout failed:', error?.message || 'unknown');
    return reply(503, { error: 'unavailable' });
  }
});
