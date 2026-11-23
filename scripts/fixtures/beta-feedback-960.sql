-- #960: beta reports v2 on the migrated schema, with negative authorization
-- tests. Disposable fixture (invented identities), rolled back.
begin;
do $$
declare
  player constant uuid := '00000000-0000-4000-8000-000000960001';
  admin constant uuid := '00000000-0000-4000-8000-000000960002';
  guest constant text := 'guest-960-abcdef';
  x jsonb; y jsonb; n integer; i integer; row_ctx jsonb; first_id bigint;
begin
  -- Access: anyone may report; only administrators read and triage.
  assert has_function_privilege('anon', 'public.lumen_send_feedback_v2(text,text,text,jsonb,text)', 'execute'), 'guests can report';
  assert not has_function_privilege('anon', 'public.lumen_admin_feedback_v2(integer)', 'execute'), 'anon cannot read reports';
  assert not has_function_privilege('anon', 'public.lumen_admin_feedback_set_status(bigint,text)', 'execute'), 'anon cannot triage';
  assert not has_table_privilege('anon', 'lumen.feedback', 'select'), 'no direct table read';

  -- Validation.
  perform set_config('request.jwt.claim.sub', '', true);
  begin perform public.lumen_send_feedback_v2(guest, 'rule', 'Une question'); raise exception 'legacy kind accepted';
  exception when invalid_parameter_value then if sqlerrm <> 'invalid_kind' then raise; end if; end;
  begin perform public.lumen_send_feedback_v2(guest, 'bug', '  a '); raise exception 'empty message accepted';
  exception when invalid_parameter_value then if sqlerrm <> 'message_required' then raise; end if; end;
  begin perform public.lumen_send_feedback_v2('short', 'bug', 'Grille figée'); raise exception 'short reporter accepted';
  exception when invalid_parameter_value then if sqlerrm <> 'invalid_reporter' then raise; end if; end;
  begin perform public.lumen_send_feedback_v2(guest, 'bug', 'Grille figée', '{}'::jsonb, 'bad ref!'); raise exception 'bad reference accepted';
  exception when invalid_parameter_value then if sqlerrm <> 'invalid_reference' then raise; end if; end;

  -- Guest bug report: receipt, allowlisted context only, bounded strings.
  x := public.lumen_send_feedback_v2(guest, 'bug', '  La grille ne répond plus  ', jsonb_build_object(
        'app_version', '1.11.1+760', 'platform', 'android-twa', 'browser', repeat('Chrome ', 40), 'screen', '360x640',
        'locale', 'fr', 'surface', 'quest', 'quest_id', 'base-q012', 'quest_ordinal', 12, 'puzzle_id', 12,
        'session_id', 'sess-960', 'offline', false, 'in_quest', true,
        'access_token', 'secret', 'email', 'player@example.com', 'board', jsonb_build_array(1, 2), 'password', 'x'),
       'draft-960-a');
  assert x ->> 'status' = 'received' and (x ->> 'duplicate')::boolean is false and (x ->> 'id') is not null, 'receipt';
  first_id := (x ->> 'id')::bigint;
  select context into row_ctx from lumen.feedback where id = first_id;
  assert not (row_ctx ?| array['access_token', 'email', 'board', 'password']), 'secrets and free state never stored: ' || row_ctx::text;
  assert length(row_ctx ->> 'browser') = 120, 'strings bounded';
  assert (select user_id is null and kind = 'bug' and message = 'La grille ne répond plus' and puzzle_id = 12
            and status = 'new' and app_version = '1.11.1+760' and anonymous_id = guest
          from lumen.feedback where id = first_id), 'stored row';

  -- Idempotent retry of the same draft.
  y := public.lumen_send_feedback_v2(guest, 'bug', 'La grille ne répond plus', '{}'::jsonb, 'draft-960-a');
  assert (y ->> 'id')::bigint = first_id and (y ->> 'duplicate')::boolean, 'retry returns the same receipt';
  assert (select count(*) from lumen.feedback where client_ref = 'draft-960-a') = 1, 'no duplicate row';

  -- Signed-in question and suggestion; legacy kinds remain valid rows.
  perform set_config('request.jwt.claim.sub', player::text, true);
  x := public.lumen_send_feedback_v2('device-960-player', 'question', 'Comment marche la Maîtrise ?');
  assert (select user_id = player and kind = 'question' from lumen.feedback where id = (x ->> 'id')::bigint), 'question linked to the account';
  x := public.lumen_send_feedback_v2('device-960-player', 'idea', 'Un mode nuit plus sombre', '"not an object"'::jsonb);
  assert (select kind = 'idea' and context = '{}'::jsonb from lumen.feedback where id = (x ->> 'id')::bigint), 'suggestion, non-object context ignored';
  insert into lumen.feedback(anonymous_id, kind, message) values ('legacy-960-xx', 'rule', 'ancien retour');

  -- Rate limit: 10 reports per hour per reporter or account.
  for i in 1..8 loop perform public.lumen_send_feedback_v2('device-960-player', 'bug', 'Rapport ' || i); end loop;
  begin perform public.lumen_send_feedback_v2('device-960-other', 'bug', 'Encore un rapport'); raise exception 'rate limit bypassed by a new device';
  exception when raise_exception then if sqlerrm <> 'rate_limited' then raise; end if; end;

  -- Administrators only.
  begin perform * from public.lumen_admin_feedback_v2(30); raise exception 'player read reports';
  exception when insufficient_privilege then null; end;
  begin perform public.lumen_admin_feedback_set_status(first_id, 'reviewed'); raise exception 'player triaged';
  exception when insufficient_privilege then null; end;
  insert into lumen.internal_capabilities(user_id, capability) values (admin, 'analytics_cockpit');
  insert into lumen.profiles(user_id, nickname) values (player, 'Lyra960') on conflict (user_id) do update set nickname = excluded.nickname;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  select count(*) into n from public.lumen_admin_feedback_v2(30) r where r.kind in ('question', 'idea') and r.player_label = 'Lyra960';
  assert n = 2, 'admin sees kinds and nicknames';
  assert (select r.context ->> 'screen' = '360x640' and r.status = 'new' from public.lumen_admin_feedback_v2(30) r where r.id = first_id), 'admin sees context and status';
  assert public.lumen_admin_feedback_set_status(first_id, 'reviewed') ->> 'status' = 'reviewed', 'triage';
  begin perform public.lumen_admin_feedback_set_status(first_id, 'done'); raise exception 'invalid status accepted';
  exception when invalid_parameter_value then if sqlerrm <> 'invalid_status' then raise; end if; end;
  begin perform public.lumen_admin_feedback_set_status(-1, 'closed'); raise exception 'missing report updated';
  exception when no_data_found then if sqlerrm <> 'feedback_not_found' then raise; end if; end;
end $$;
rollback;
