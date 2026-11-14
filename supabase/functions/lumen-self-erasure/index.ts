// #316 — Minimal authenticated Lumen-only account erasure.
// The Edge derives the target from verified Auth, never from request JSON.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
Deno.serve(async (request) => {
  const headers = {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'access-control-allow-origin': 'https://lumen.nopuna.fr',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  const origin = request.headers.get('origin');
  if (origin && origin !== 'https://lumen.nopuna.fr')
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers });
  if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return new Response(JSON.stringify({ error: 'authentication_required' }), { status: 401, headers });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key || !serviceKey) return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers });
  try {
    const body = await request.json();
    if (body?.confirmation !== 'SUPPRIMER') return new Response(JSON.stringify({ error: 'confirmation_required' }), { status: 400, headers });
    const client = createClient(url, key, { global: { headers: { Authorization: 'Bearer ' + token } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401, headers });
    // Privileged credentials remain server-side and are never sent to the browser.
    const operator = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await operator.rpc('lumen_self_erase', { p_user_id: user.id, p_confirmation: 'SUPPRIMER' });
    if (error || data?.status !== 'erased' || data?.barrier !== 'active' || data?.authDeleted !== false) {
      console.error('Lumen erasure failed:', error?.code || 'acknowledgement_missing');
      return new Response(JSON.stringify({ error: 'erasure_not_completed' }), { status: 409, headers });
    }
    // Owner decision (2026-11-14): delete the sign-in account too, only after the
    // Lumen barrier exists and when no other application uses it. Any doubt or
    // failure keeps the account; the Lumen erasure itself is already complete.
    let accountDeleted = false;
    const { data: deletable, error: checkError } = await operator.rpc('lumen_account_deletable', { p_user_id: user.id });
    if (!checkError && deletable === true) {
      const { error: deleteError } = await operator.auth.admin.deleteUser(user.id);
      accountDeleted = !deleteError;
      if (deleteError) console.error('Sign-in account kept:', deleteError.status || 'delete_failed');
    }
    return new Response(JSON.stringify({ status: 'erased', scope: 'lumen', details: data?.status, accountDeleted }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_request' }), { status: 400, headers });
  }
});
