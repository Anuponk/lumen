-- #960/#1010: a report carries the sanitized sync journal. Disposable fixture
-- (invented identities), rolled back.
begin;
do $$
declare
  player constant uuid := '00000000-0000-4000-8000-000000961001';
  admin constant uuid := '00000000-0000-4000-8000-000000961002';
  guest constant text := 'guest-961-journal';
  x jsonb; y jsonb; j jsonb;
begin
  assert has_function_privilege('anon', 'public.lumen_send_feedback_v3(text,text,text,jsonb,text,jsonb)', 'execute'), 'guests can report';
  assert not has_function_privilege('anon', 'public.lumen_admin_feedback_journal(bigint)', 'execute'), 'anon cannot read journals';
  assert not has_function_privilege('authenticated', 'lumen_commands.sanitize_feedback_journal(jsonb)', 'execute'), 'sanitizer is private';

  perform set_config('request.jwt.claim.sub', '', true);
  j := jsonb_build_array(
    jsonb_build_object('at', '2026-11-23T19:55:19.763Z', 'event', 'legacy_victory_pending', 'durable', true, 'stage', 'baseline', 'errorCode', 'UNKNOWN'),
    jsonb_build_object('at', '2026-11-23T19:55:35.918Z', 'event', 'outbox_state_summary', 'wallet', jsonb_build_object('pending', 3, 'pausedReview', 3, 'deep', jsonb_build_object('x', 1))),
    jsonb_build_object('event', 'flush_failed', 'email', 'player@example.com', 'note', repeat('x', 200), 'bad key', 1, 'list', jsonb_build_array(1, 2)),
    jsonb_build_object('no_event', true),
    '"not an object"'::jsonb);
  x := public.lumen_send_feedback_v3(guest, 'bug', 'Je dois recommencer la grille', '{"surface":"menu"}'::jsonb, 'journal-ref-0001', j);
  assert x ->> 'status' = 'received' and (x ->> 'journal')::boolean, 'report and journal received';
  y := (select f.journal from lumen.feedback f where f.id = (x ->> 'id')::bigint);
  assert jsonb_array_length(y) = 3, 'non-object and event-less entries are dropped';
  assert y -> 0 = jsonb_build_object('at', '2026-11-23T19:55:19.763Z', 'event', 'legacy_victory_pending', 'durable', true, 'stage', 'baseline', 'errorCode', 'UNKNOWN'), 'codes and counters kept';
  assert y -> 1 -> 'wallet' = '{"pending":3,"pausedReview":3}'::jsonb, 'one nested level of scalars only';
  assert y -> 2 = '{"event":"flush_failed"}'::jsonb, 'free text, emails, lists and bad keys are dropped';

  -- A retried draft never rewrites the stored journal.
  y := public.lumen_send_feedback_v3(guest, 'bug', 'Je dois recommencer la grille', '{}'::jsonb, 'journal-ref-0001', '[{"event":"other"}]'::jsonb);
  assert (y ->> 'duplicate')::boolean and y ->> 'id' = x ->> 'id';
  assert (select jsonb_array_length(f.journal) from lumen.feedback f where f.id = (x ->> 'id')::bigint) = 3, 'duplicate keeps the first journal';

  -- No journal: same v2 contract, journal stays null.
  y := public.lumen_send_feedback_v3(guest, 'idea', 'Une idée de constellation');
  assert not (y ->> 'journal')::boolean and (select f.journal is null from lumen.feedback f where f.id = (y ->> 'id')::bigint);

  -- Oversized journal is refused as a whole, the report itself is kept.
  y := public.lumen_send_feedback_v3(guest, 'bug', 'Journal trop gros', '{}'::jsonb, null,
        (select jsonb_agg(jsonb_build_object('event', 'e' || g, 'a', repeat('a', 60), 'b', repeat('b', 60), 'c', repeat('c', 60), 'd', repeat('d', 60), 'e', repeat('e', 60), 'f', repeat('f', 60), 'g', repeat('g', 60), 'h', repeat('h', 60), 'i', repeat('i', 60), 'k', repeat('k', 60), 'l', repeat('l', 60), 'm', repeat('m', 60), 'n', repeat('n', 60), 'o', repeat('o', 60), 'p', repeat('p', 60), 'q', repeat('q', 60), 'r', repeat('r', 60), 's', repeat('s', 60), 't', repeat('t', 60), 'u', repeat('u', 60), 'v', repeat('v', 60), 'w', repeat('w', 60))) from generate_series(1, 60) g));
  assert y ->> 'status' = 'received' and not (y ->> 'journal')::boolean, 'oversized journal dropped, report kept';
  assert jsonb_array_length(lumen_commands.sanitize_feedback_journal((select jsonb_agg(jsonb_build_object('event', 'e' || g)) from generate_series(1, 90) g))) = 60, 'at most 60 entries';

  -- Only administrators read a journal.
  insert into lumen.internal_capabilities(user_id, capability) values (admin, 'analytics_cockpit');
  perform set_config('request.jwt.claim.sub', player::text, true);
  begin perform public.lumen_admin_feedback_journal((x ->> 'id')::bigint); raise exception 'player read a journal';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  assert jsonb_array_length(public.lumen_admin_feedback_journal((x ->> 'id')::bigint)) = 3;
  begin perform public.lumen_admin_feedback_journal(-1); raise exception 'missing report found';
  exception when no_data_found then null; end;
end $$;
rollback;
