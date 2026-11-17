// #730 — Stripe webhook (TEST MODE ONLY). Deploy with --no-verify-jwt: Stripe has no
// Supabase session; authenticity comes from the Stripe-Signature HMAC over the RAW body.
// The event only says "look again": the current state is always read back from Stripe
// with the secret key, then recorded through lumen_stripe_record_session, whose
// monotonic rank makes duplicates and out-of-order deliveries harmless.
// 2xx = processed or deliberately ignored; 5xx = temporary, Stripe retries.
// Secrets: STRIPE_SECRET_KEY (sk_test_/rk_test_ only), STRIPE_WEBHOOK_SECRET (whsec_...).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { stripeTestKey, stripeRequest, verifyStripeSignature, syncStripeSession } from '../_shared/lumen-stripe.ts';

const SESSION_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'];
const CHARGE_EVENTS = ['charge.refunded', 'charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed', 'charge.dispute.funds_withdrawn', 'charge.dispute.funds_reinstated'];

Deno.serve(async (request) => {
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const rawKey = Deno.env.get('STRIPE_SECRET_KEY') || '', secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
  const key = stripeTestKey(rawKey);
  if (!key && /^(sk|rk)_live_/.test(rawKey)) console.error('Lumen Stripe: live key refused (test phase)');
  if (!key || !secret || !url || !serviceKey) return reply(503, { error: 'unavailable' }); // configuration: Stripe retries
  const raw = await request.text();
  if (raw.length > 512 * 1024) return reply(413, { error: 'too_large' });
  const signature = await verifyStripeSignature(raw, request.headers.get('stripe-signature'), secret, Math.floor(Date.now() / 1000));
  if (!signature.ok) return reply(signature.reason === 'secret' ? 503 : 400, { error: 'invalid_signature' });
  let event;
  try { event = JSON.parse(raw); } catch { return reply(400, { error: 'invalid_payload' }); }
  if (event?.livemode !== false) {
    console.error('Lumen Stripe: live event refused (test phase)');
    return reply(400, { error: 'live_event_refused' });
  }
  const type = String(event?.type || ''), object = event?.data?.object || {};
  if (!SESSION_EVENTS.includes(type) && !CHARGE_EVENTS.includes(type)) return reply(200, { status: 'ignored' });
  const operator = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    let sessionId = SESSION_EVENTS.includes(type) ? object.id : null;
    if (!sessionId) {
      const intent = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
      if (typeof intent !== 'string' || !/^pi_[A-Za-z0-9_]{1,190}$/.test(intent)) return reply(200, { status: 'ignored' });
      const { data: known, error } = await operator.rpc('lumen_stripe_session_by_payment_intent', { p_payment_intent: intent });
      if (error) throw Error('lookup_failed');
      sessionId = known;
      if (!sessionId) {
        const listed = await stripeRequest(fetch, key, 'GET', '/checkout/sessions', { payment_intent: intent, limit: 1 });
        if (!listed.ok) return reply(503, { error: 'stripe_unavailable' });
        sessionId = listed.data?.data?.[0]?.id || null;
      }
      if (!sessionId) return reply(200, { status: 'ignored' }); // not a Lumen Checkout payment
    }
    const synced = await syncStripeSession({ fetchImpl: fetch, key, operator, sessionId });
    if (synced.http === 409) console.error('Lumen Stripe: session conflict for event', type);
    return reply(synced.http, { status: synced.body.status || 'error' });
  } catch (error) {
    console.error('Lumen Stripe webhook failed:', error?.message || 'unknown');
    return reply(503, { error: 'unavailable' });
  }
});
