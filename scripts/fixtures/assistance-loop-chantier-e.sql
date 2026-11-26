-- Chantier E (#959 #960 #1020 #708 #848): linked diagnostics, replies, player
-- health and native versions. Disposable database only, invented identities.
do $$begin
 if current_database()<>'lumen_test' then raise exception 'Disposable assistance fixture requires lumen_test';end if;
end $$;
-- Hosted Supabase grants anon EXECUTE on new public functions: the explicit revokes
-- of the migration must hold anyway. Applied twice: additive and idempotent.
alter default privileges in schema public grant execute on functions to anon,authenticated;
\ir ../../supabase/migrations/20261126200000_assistance_loop_chantier_e.sql
\ir ../../supabase/migrations/20261126200000_assistance_loop_chantier_e.sql
alter default privileges in schema public revoke execute on functions from anon,authenticated;

begin;
do $$
declare
  player constant uuid := '00000000-0000-4000-8000-00000000e001';
  other constant uuid := '00000000-0000-4000-8000-00000000e002';
  admin constant uuid := '00000000-0000-4000-8000-00000000e003';
  guest constant text := 'guest-e-device-0001';
  guest_ref constant text := 'guestRefSecret0001abcd';
  own_case uuid; foreign_case uuid; capture uuid := gen_random_uuid();
  x jsonb; y jsonb; q jsonb; mine jsonb; bug_id bigint; guest_id bigint; f lumen.feedback;
  client uuid := gen_random_uuid(); session uuid := gen_random_uuid(); row lumen_commands.outbox_health%rowtype;
  -- The technical-retention columns exist only where that migration ran first.
  retention boolean := exists (select 1 from information_schema.columns where table_schema = 'lumen' and table_name = 'feedback' and column_name = 'privacy_closed_at');
  flag boolean;
begin
  -- Privileges: players and guests report, read and reply to their own reports only.
  assert has_function_privilege('anon', 'public.lumen_send_feedback_v4(text,text,text,jsonb,text,jsonb,jsonb,uuid,uuid)', 'execute');
  assert has_function_privilege('anon', 'public.lumen_my_feedback(text,text[],boolean,boolean)', 'execute');
  assert has_function_privilege('anon', 'public.lumen_feedback_reply(bigint,text,text,text,text[])', 'execute');
  assert not has_function_privilege('anon', 'public.lumen_admin_feedback_inbox(integer,text,text,text,bigint,integer)', 'execute');
  assert not has_function_privilege('anon', 'public.lumen_admin_feedback_detail(bigint)', 'execute');
  assert not has_function_privilege('anon', 'public.lumen_admin_feedback_reply(bigint,text,text,boolean)', 'execute');
  assert not has_function_privilege('anon', 'public.lumen_admin_player_health(text[])', 'execute');
  assert not has_function_privilege('anon', 'public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text,text)', 'execute');
  assert not has_function_privilege('authenticated', 'lumen_commands.sanitize_feedback_snapshot(jsonb)', 'execute');
  assert not has_function_privilege('authenticated', 'lumen_commands.feedback_owned(lumen.feedback,text,text[])', 'execute');

  insert into auth.users(id) values (player), (other), (admin) on conflict do nothing;
  insert into lumen.users(user_id) values (player), (other) on conflict do nothing;
  insert into lumen.profiles(user_id, nickname) values (player, 'Etoile E') on conflict do nothing;
  insert into lumen.internal_capabilities(user_id, capability) values (admin, 'analytics_cockpit');
  insert into lumen_commands.support_cases(user_id) values (player) returning id into own_case;
  insert into lumen_commands.support_cases(user_id) values (other) returning id into foreign_case;

  -- #960: a signed-in bug keeps journal, sanitized snapshot and its own support references.
  perform set_config('request.jwt.claim.sub', player::text, true);
  x := public.lumen_send_feedback_v4('player-e-anon-01', 'bug', 'La grille se bloque', '{"surface":"quest"}'::jsonb,
         'playerRefSecret00001', '[{"event":"flush_failed"}]'::jsonb,
         jsonb_build_object('board', '0120/0003/1000/0000', 'surface', 'quest', 'note', 'free text: <b>', 'email', 'a@b.c',
           'attempt', jsonb_build_object('state', 'PAUSED', 'elapsed_s', 83, 'deep', jsonb_build_object('x', 1)),
           'list', jsonb_build_array(1, 2), 'Bad-Key', 1),
         own_case, capture);
  bug_id := (x ->> 'id')::bigint;
  assert (x ->> 'journal')::boolean and (x ->> 'snapshot')::boolean and (x ->> 'support')::boolean, 'bug keeps journal, snapshot, support';
  select * into f from lumen.feedback where id = bug_id;
  assert f.snapshot = '{"board":"0120/0003/1000/0000","surface":"quest","attempt":{"state":"PAUSED","elapsed_s":83}}'::jsonb,
    'snapshot: allowlisted shape only (no free text, email, list, deep object or bad key) ' || f.snapshot::text;
  assert f.support_case_id = own_case and f.support_capture_id = capture and f.user_id = player;
  assert lumen_commands.sanitize_feedback_snapshot(jsonb_build_object('board', '01x/2')) = '{}'::jsonb, 'malformed board dropped';
  assert lumen_commands.sanitize_feedback_snapshot(jsonb_build_object('a', repeat('x', 65))) = '{}'::jsonb, 'long strings dropped';

  -- A retried draft changes nothing; a foreign support case is never linked.
  y := public.lumen_send_feedback_v4('player-e-anon-01', 'bug', 'La grille se bloque', '{}'::jsonb, 'playerRefSecret00001', null, '{"surface":"other"}'::jsonb, foreign_case, gen_random_uuid());
  assert (y ->> 'duplicate')::boolean and (select snapshot ->> 'surface' from lumen.feedback where id = bug_id) = 'quest';
  y := public.lumen_send_feedback_v4('player-e-anon-01', 'bug', 'Autre bug', '{}'::jsonb, 'playerRefSecret00002', null, null, foreign_case, gen_random_uuid());
  assert not (y ->> 'support')::boolean and (select support_case_id is null from lumen.feedback where id = (y ->> 'id')::bigint), 'foreign case ignored';

  -- Questions and suggestions never keep journal or snapshot.
  y := public.lumen_send_feedback_v4('player-e-anon-01', 'question', 'Comment marche le chrono ?', '{}'::jsonb, 'playerRefSecret00003', '[{"event":"x"}]'::jsonb, '{"surface":"menu"}'::jsonb);
  assert (select journal is null and snapshot is null from lumen.feedback where id = (y ->> 'id')::bigint), 'question minimal';

  -- Guest: no support reference even with a case id; readable on the sending device only.
  perform set_config('request.jwt.claim.sub', '', true);
  y := public.lumen_send_feedback_v4(guest, 'idea', 'Une idée', '{}'::jsonb, guest_ref, null, null, own_case, gen_random_uuid());
  guest_id := (y ->> 'id')::bigint;
  assert (public.lumen_my_feedback(guest, array[guest_ref]) -> 'items' -> 0 ->> 'id')::bigint = guest_id, 'guest reads on its device';
  assert jsonb_array_length(public.lumen_my_feedback(guest, array['wrongRefSecret00001']) -> 'items') = 0, 'wrong reference';
  assert jsonb_array_length(public.lumen_my_feedback('another-device-01', array[guest_ref]) -> 'items') = 0, 'reference alone is not enough';
  assert jsonb_array_length(public.lumen_my_feedback(guest, null) -> 'items') = 0, 'no reference, nothing';
  -- Short legacy references are never accepted as a secret.
  update lumen.feedback set client_ref = 'short001' where id = guest_id;
  assert jsonb_array_length(public.lumen_my_feedback(guest, array['short001']) -> 'items') = 0, 'short reference refused';
  update lumen.feedback set client_ref = guest_ref where id = guest_id;

  -- Players see only their own reports.
  perform set_config('request.jwt.claim.sub', other::text, true);
  assert jsonb_array_length(public.lumen_my_feedback() -> 'items') = 0, 'other player sees nothing';
  begin perform public.lumen_feedback_reply(bug_id, 'Je réponds', 'otherMsgRef0001'); raise exception 'cross-account reply';
  exception when no_data_found then null; end;
  -- Administrators only.
  begin perform public.lumen_admin_feedback_inbox(); raise exception 'non-admin inbox';
  exception when insufficient_privilege then null; end;
  begin perform public.lumen_admin_feedback_detail(bug_id); raise exception 'non-admin detail';
  exception when insufficient_privilege then null; end;
  begin perform public.lumen_admin_feedback_reply(bug_id, 'x y', 'adminMsgRef0001'); raise exception 'non-admin reply';
  exception when insufficient_privilege then null; end;
  begin perform public.lumen_admin_player_health(array['u:' || player]); raise exception 'non-admin health';
  exception when insufficient_privilege then null; end;

  -- #1020: inbox, detail, answer, read state, reopening.
  perform set_config('request.jwt.claim.sub', admin::text, true);
  q := public.lumen_admin_feedback_inbox(30, null, null, null, null, 2);
  assert jsonb_array_length(q -> 'items') = 2 and (q ->> 'next_before') is not null, 'paged';
  assert (q -> 'counts' ->> 'all')::int >= 4 and (q -> 'counts' ->> 'action')::int >= 4;
  assert not (q -> 'items' -> 0 ? 'journal') and not (q -> 'items' -> 0 ? 'thread'), 'list carries no heavy payload';
  q := public.lumen_admin_feedback_inbox(30, null, 'bug', 'u:' || player);
  assert jsonb_array_length(q -> 'items') = 2 and q -> 'items' -> 1 ->> 'player_label' = 'Etoile E';
  y := public.lumen_admin_feedback_detail(bug_id);
  assert y -> 'capture' ->> 'state' = 'pending' and jsonb_array_length(y -> 'journal') = 1 and y ->> 'player_key' = 'u:' || player;
  update lumen.feedback set created_at = now() - interval '2 hours' where id = bug_id;
  assert public.lumen_admin_feedback_detail(bug_id) -> 'capture' ->> 'state' = 'failed', 'no capture after an hour';
  insert into lumen_commands.support_captures(id, case_id, bytes, sha256, code) values (capture, own_case, 306133, 'x', 'manual');
  y := public.lumen_admin_feedback_detail(bug_id);
  assert y -> 'capture' ->> 'state' = 'received' and (y -> 'capture' ->> 'bytes')::int = 306133, 'capture linked by reference';
  update lumen_commands.support_cases set purged_at = now() where id = own_case;
  assert public.lumen_admin_feedback_detail(bug_id) -> 'capture' ->> 'state' = 'deleted', 'purged dossier';
  assert public.lumen_admin_feedback_detail(guest_id) -> 'capture' ->> 'state' = 'none';

  y := public.lumen_admin_feedback_reply(bug_id, 'Merci, corrigé dans la prochaine version.', 'adminMsgRef0001');
  assert y ->> 'status' = 'answered';
  y := public.lumen_admin_feedback_reply(bug_id, 'Merci, corrigé dans la prochaine version.', 'adminMsgRef0001');
  assert (y ->> 'duplicate')::boolean and (select jsonb_array_length(thread) from lumen.feedback where id = bug_id) = 1, 'no duplicate answer';
  perform public.lumen_admin_feedback_reply(guest_id, 'Bonne idée !', 'adminMsgRef0002', true);
  assert (select status = 'closed' from lumen.feedback where id = guest_id), 'answer and resolve';
  if retention then
    execute 'select privacy_closed_at is not null from lumen.feedback where id = $1' into flag using guest_id;
    assert flag, 'resolving starts the 180-day retention clock';
  end if;

  perform set_config('request.jwt.claim.sub', player::text, true);
  mine := public.lumen_my_feedback(null, null, true);
  assert (mine ->> 'unread')::int = 1 and jsonb_array_length(mine -> 'items') = 0, 'summary: count only';
  mine := public.lumen_my_feedback(null, null, false, true);
  assert (mine -> 'items' -> 2 ->> 'unread')::boolean and mine -> 'items' -> 2 -> 'thread' -> 0 ->> 'by' = 'admin'
     and not (mine -> 'items' -> 2 -> 'thread' -> 0 ? 'ref'), 'shown unread, internal reference hidden';
  assert (public.lumen_my_feedback(null, null, true) ->> 'unread')::int = 0, 'marked read';
  assert (select status from lumen.feedback where id = bug_id) = 'answered', 'reading is not resolving';
  y := public.lumen_feedback_reply(bug_id, 'Toujours bloqué après mise à jour', 'playerMsgRef0001');
  assert y ->> 'status' = 'reviewed';
  y := public.lumen_feedback_reply(bug_id, 'Toujours bloqué après mise à jour', 'playerMsgRef0001');
  assert (y ->> 'duplicate')::boolean, 'idempotent player reply';

  perform set_config('request.jwt.claim.sub', '', true);
  y := public.lumen_feedback_reply(guest_id, 'Merci, autre idée', 'guestMsgRef0001', guest, array[guest_ref]);
  assert y ->> 'status' = 'reviewed', 'a player reply reopens';
  if retention then
    execute 'select privacy_closed_at is null from lumen.feedback where id = $1' into flag using guest_id;
    assert flag, 'reopened, retention clock stopped';
  end if;
  for i in 2..5 loop perform public.lumen_feedback_reply(guest_id, 'Encore ' || i, 'guestMsgRef000' || i, guest, array[guest_ref]); end loop;
  begin perform public.lumen_feedback_reply(guest_id, 'Trop', 'guestMsgRef0009', guest, array[guest_ref]); raise exception 'no rate limit';
  exception when raise_exception then
    if sqlerrm <> 'rate_limited' then raise; end if;
  end;

  -- #848: the native version is kept per device; browser observations never erase it.
  perform set_config('request.jwt.claim.sub', player::text, true);
  perform public.lumen_record_outbox_health(player, client, session, now() - interval '1 hour', 1, 'android-pwa', 'confirmed', 0, 0, null, '1.11.1+790 5138e16', 512, 5, null, '1.0.1+2');
  select * into row from lumen_commands.outbox_health where user_id = player and client_id = client;
  assert row.native_version = '1.0.1+2' and row.native_observed_at is not null;
  perform public.lumen_record_outbox_health(player, client, session, now() - interval '1 hour', 2, 'android-web', 'pending', 2, 0, now(), '1.11.1+791 abcdef0', 512, 5, null);
  perform public.lumen_record_outbox_health(player, client, session, now() - interval '1 hour', 3, 'android-web', 'pending', 2, 0, now(), '1.11.1+791 abcdef0', 512, 5, null, null);
  select * into row from lumen_commands.outbox_health where user_id = player and client_id = client;
  assert row.native_version = '1.0.1+2' and row.app_version = '1.11.1+791 abcdef0', 'web update keeps the native version';
  begin
    perform public.lumen_record_outbox_health(player, client, session, now() - interval '1 hour', 4, 'android-web', 'pending', 2, 0, now(), '1.11.1+791 abcdef0', 512, 5, null, 'Chrome 120');
    raise exception 'invented native version stored';
  exception when invalid_parameter_value then null; end;

  -- #708: one read gives the facts of the player table.
  insert into lumen_commands.canonical_receipts(user_id, operation_id, request, outcome, recorded_at) values (player, 'e-op-1', '{}', '{}', now() - interval '3 hours');
  insert into lumen_commands.legacy_receipts(user_id, operation_id, request, outcome, recorded_at) values (player, 'e-op-2', '{}', '{}', now() - interval '1 day');
  insert into public.lumen_sync_health(user_id, event, reason, recorded_at) values (other, 'hydration_failed', 'cas', now() - interval '20 days');
  insert into public.lumen_sync_health(user_id, event, reason, recorded_at) values (player, 'hydration_failed', 'network', now() - interval '1 day');
  perform set_config('request.jwt.claim.sub', admin::text, true);
  y := public.lumen_admin_player_health(array['u:' || player, 'u:' || other, 'not-a-key']);
  assert (y -> 'players' -> ('u:' || player) ->> 'game_at')::timestamptz > now() - interval '4 hours', 'last completed quest';
  assert jsonb_array_length(y -> 'players' -> ('u:' || player) -> 'devices') = 1
     and y -> 'players' -> ('u:' || player) -> 'devices' -> 0 ->> 'native_version' = '1.0.1+2';
  assert y -> 'players' -> ('u:' || player) -> 'hydration' = 'null'::jsonb, 'a network failure is not an incident';
  assert y -> 'players' -> ('u:' || other) -> 'hydration' ->> 'reason' = 'cas', 'an old unresolved failure stays visible';
  assert (y -> 'players' -> ('u:' || player) -> 'reports' ->> 'open')::int >= 2;
  assert (select count(*) from jsonb_object_keys(y -> 'players')) = 2, 'malformed keys ignored';
end $$;
rollback;
