-- Chantier E (#959 #960 #1020 #708 #848): assistance loop, linked diagnostics,
-- player health and observed versions. Additive and idempotent; no new table.
--
--  * #960  A report keeps references (never copies) to the full support capture
--          (support_case_id, support_capture_id) and a bounded technical snapshot
--          taken at the exact moment of the report (state of the board, attempt,
--          sync, storage). Journal and snapshot are kept for bugs only.
--  * #1020 The exchange lives in the same row (thread, at most 30 messages of
--          2 000 characters), so account erasure and the 180-day retention of
--          closed reports apply unchanged. Status gains 'answered'; reading
--          (player_read_at) is distinct from processing (status).
--          Players read their own reports only: signed-in by auth.uid(), guests on
--          the sending device by (anonymous_id, secret client_ref).
--  * #708  lumen_admin_player_health: one bounded read for the whole player table
--          (devices, last completed quest, receipts, unresolved hydration, versions,
--          reports); the health verdict is computed by the client from these facts.
--  * #848  outbox_health gains the Android native version observed on that device
--          (written only on change by the existing reporter, never by the outbox,
--          wallet or profile). A browser session never erases it.
--
-- Rollback: drop the functions created here (sanitize_feedback_snapshot,
-- lumen_send_feedback_v4, lumen_my_feedback, lumen_feedback_reply,
-- lumen_admin_feedback_inbox, lumen_admin_feedback_detail, lumen_admin_feedback_reply,
-- lumen_admin_player_health, the 15-argument record_outbox_health pair), restore the
-- previous lumen_admin_feedback_set_status body (20261122240000) and status
-- constraint, then drop the new columns. Player progress, receipts, wallet and
-- purchases are never read for writing here.
begin;
set local lock_timeout = '5s';

-- ─── #960/#1020: columns on the existing report row ────────────────────────────
alter table lumen.feedback
  add column if not exists snapshot jsonb,
  add column if not exists support_case_id uuid,
  add column if not exists support_capture_id uuid,
  add column if not exists thread jsonb not null default '[]'::jsonb,
  add column if not exists answered_at timestamptz,
  add column if not exists player_read_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table lumen.feedback drop constraint if exists feedback_status_check;
alter table lumen.feedback add constraint feedback_status_check
  check (status = any (array['new','reviewed','answered','fixed','closed']));
alter table lumen.feedback drop constraint if exists feedback_thread_bounds;
alter table lumen.feedback add constraint feedback_thread_bounds
  check (jsonb_typeof(thread) = 'array' and jsonb_array_length(thread) <= 30 and octet_length(thread::text) <= 80000);

create index if not exists lumen_feedback_user_idx on lumen.feedback(user_id, created_at desc) where user_id is not null;
create index if not exists lumen_feedback_created_idx on lumen.feedback(created_at desc, id desc);

-- Bounded snapshot: allowlisted key names, scalar values, one nested level of
-- scalars, and the board as a digit string. No free text, list or deep object.
create or replace function lumen_commands.sanitize_feedback_snapshot(p jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_out jsonb := '{}'::jsonb; v_key text; v_value jsonb; v_sub text; v_subvalue jsonb; v_nested jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return null; end if;
  for v_key, v_value in select key, value from jsonb_each(p) limit 32 loop
    if v_key !~ '^[a-z][a-z0-9_]{0,31}$' then continue; end if;
    if v_key = 'board' then
      if jsonb_typeof(v_value) = 'string' and (v_value #>> '{}') ~ '^[0-9]{1,20}(/[0-9]{1,20}){0,19}$' then
        v_out := v_out || jsonb_build_object('board', v_value);
      end if;
    elsif jsonb_typeof(v_value) in ('number', 'boolean') then
      v_out := v_out || jsonb_build_object(v_key, v_value);
    elsif jsonb_typeof(v_value) = 'string' and (v_value #>> '{}') ~ '^[A-Za-z0-9_:.+ -]{0,64}$' then
      v_out := v_out || jsonb_build_object(v_key, v_value);
    elsif jsonb_typeof(v_value) = 'object' then
      v_nested := '{}'::jsonb;
      for v_sub, v_subvalue in select key, value from jsonb_each(v_value) limit 24 loop
        if v_sub ~ '^[a-z][a-z0-9_]{0,31}$' and (jsonb_typeof(v_subvalue) in ('number', 'boolean')
           or (jsonb_typeof(v_subvalue) = 'string' and (v_subvalue #>> '{}') ~ '^[A-Za-z0-9_:.+ -]{0,64}$')) then
          v_nested := v_nested || jsonb_build_object(v_sub, v_subvalue);
        end if;
      end loop;
      v_out := v_out || jsonb_build_object(v_key, v_nested);
    end if;
  end loop;
  if octet_length(v_out::text) > 8192 then return null; end if;
  return v_out;
end $$;
revoke all on function lumen_commands.sanitize_feedback_snapshot(jsonb) from public, anon, authenticated;

-- Same contract as v3 (validation, idempotent reference, hourly limit, allowlisted
-- context). Bugs also keep the journal, the snapshot and the support references;
-- a reference is kept only when the support case belongs to the caller.
create or replace function public.lumen_send_feedback_v4(
  p_anonymous_id text, p_kind text, p_message text,
  p_context jsonb default '{}'::jsonb, p_client_ref text default null, p_journal jsonb default null,
  p_snapshot jsonb default null, p_support_case_id uuid default null, p_support_capture_id uuid default null)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_result jsonb; v_bug boolean := p_kind = 'bug'; v_snapshot jsonb; v_case uuid;
begin
  v_result := public.lumen_send_feedback_v3(p_anonymous_id, p_kind, p_message, p_context, p_client_ref,
                                            case when v_bug then p_journal end);
  if coalesce((v_result ->> 'duplicate')::boolean, false) or not v_bug then
    return v_result || jsonb_build_object('snapshot', false, 'support', false);
  end if;
  v_snapshot := lumen_commands.sanitize_feedback_snapshot(p_snapshot);
  if p_support_case_id is not null and p_support_capture_id is not null and auth.uid() is not null then
    select c.id into v_case from lumen_commands.support_cases c
     where c.id = p_support_case_id and c.user_id = auth.uid();
  end if;
  update lumen.feedback f set snapshot = v_snapshot,
         support_case_id = v_case, support_capture_id = case when v_case is not null then p_support_capture_id end
   where f.id = (v_result ->> 'id')::bigint and f.anonymous_id = p_anonymous_id;
  return v_result || jsonb_build_object('snapshot', v_snapshot is not null, 'support', v_case is not null);
end $$;
revoke all on function public.lumen_send_feedback_v4(text, text, text, jsonb, text, jsonb, jsonb, uuid, uuid) from public;
grant execute on function public.lumen_send_feedback_v4(text, text, text, jsonb, text, jsonb, jsonb, uuid, uuid) to anon, authenticated, service_role;

-- A player's own report: signed-in owner, or the sending device (anonymous id and
-- the secret draft reference, at least 16 characters, never shown in full).
create or replace function lumen_commands.feedback_owned(f lumen.feedback, p_anonymous_id text, p_refs text[])
returns boolean language sql stable set search_path='' as $$
  select (auth.uid() is not null and f.user_id = auth.uid())
      or (p_anonymous_id is not null and length(p_anonymous_id) between 8 and 100 and f.anonymous_id = p_anonymous_id
          and f.client_ref is not null and length(f.client_ref) >= 16 and f.client_ref = any(coalesce(p_refs, '{}'::text[])));
$$;
revoke all on function lumen_commands.feedback_owned(lumen.feedback, text, text[]) from public, anon, authenticated;

-- « Mes signalements »: at most 20 recent reports with their exchange. With
-- p_summary only the unread count travels; p_mark_read stamps the answers shown.
create or replace function public.lumen_my_feedback(
  p_anonymous_id text default null, p_refs text[] default null,
  p_summary boolean default false, p_mark_read boolean default false)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_refs text[] := (select array_agg(r) from (select r from unnest(coalesce(p_refs, '{}'::text[])) r
                            where r ~ '^[A-Za-z0-9_-]{16,64}$' limit 20) s);
        v_items jsonb; v_unread integer;
begin
  if auth.uid() is null and coalesce(cardinality(v_refs), 0) = 0 then
    return jsonb_build_object('unread', 0, 'items', '[]'::jsonb);
  end if;
  with mine as (
    select f.* from lumen.feedback f
     where f.created_at > now() - interval '365 days'
       and lumen_commands.feedback_owned(f, p_anonymous_id, v_refs)
     order by f.created_at desc limit 20)
  select count(*) filter (where answered_at is not null and answered_at > coalesce(player_read_at, '-infinity')),
         case when p_summary then '[]'::jsonb else coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'kind', kind, 'status', status, 'created_at', created_at, 'message', message,
           'answered_at', answered_at,
           'unread', answered_at is not null and answered_at > coalesce(player_read_at, '-infinity'),
           'thread', (select coalesce(jsonb_agg(jsonb_build_object('by', m ->> 'by', 'body', m ->> 'body', 'at', m ->> 'at')), '[]'::jsonb)
                        from jsonb_array_elements(thread) m))
           order by created_at desc), '[]'::jsonb) end
    into v_unread, v_items from mine;
  if p_mark_read and not p_summary then
    update lumen.feedback f set player_read_at = now()
     where f.answered_at is not null and f.answered_at > coalesce(f.player_read_at, '-infinity')
       and f.created_at > now() - interval '365 days'
       and lumen_commands.feedback_owned(f, p_anonymous_id, v_refs);
  end if;
  return jsonb_build_object('unread', v_unread, 'items', v_items);
end $$;
revoke all on function public.lumen_my_feedback(text, text[], boolean, boolean) from public;
grant execute on function public.lumen_my_feedback(text, text[], boolean, boolean) to anon, authenticated, service_role;

-- A complementary reply, only under one's own report. It reopens the report
-- (« En cours »); the same message reference never adds a second message.
create or replace function public.lumen_feedback_reply(
  p_id bigint, p_body text, p_message_ref text,
  p_anonymous_id text default null, p_refs text[] default null)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_body text := btrim(coalesce(p_body, '')); f lumen.feedback;
begin
  if length(v_body) < 2 then raise exception using errcode = '22023', message = 'message_required'; end if;
  if p_message_ref is null or p_message_ref !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception using errcode = '22023', message = 'invalid_reference';
  end if;
  select * into f from lumen.feedback x where x.id = p_id for update;
  if not found or not lumen_commands.feedback_owned(f, p_anonymous_id, p_refs) then
    raise exception using errcode = 'P0002', message = 'feedback_not_found';
  end if;
  if exists (select 1 from jsonb_array_elements(f.thread) m where m ->> 'ref' = p_message_ref) then
    return jsonb_build_object('id', f.id, 'status', f.status, 'duplicate', true);
  end if;
  if (select count(*) from jsonb_array_elements(f.thread) m
       where m ->> 'by' = 'player' and (m ->> 'at')::timestamptz > now() - interval '1 hour') >= 5 then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;
  if jsonb_array_length(f.thread) >= 30 then raise exception using errcode = 'P0001', message = 'thread_full'; end if;
  update lumen.feedback x set
    thread = x.thread || jsonb_build_array(jsonb_build_object('by', 'player', 'body', left(v_body, 2000), 'at', now(), 'ref', p_message_ref)),
    status = case when x.status in ('answered', 'fixed', 'closed') then 'reviewed' else x.status end,
    updated_at = now()
   where x.id = f.id returning x.status into f.status;
  return jsonb_build_object('id', f.id, 'status', f.status, 'duplicate', false);
end $$;
revoke all on function public.lumen_feedback_reply(bigint, text, text, text, text[]) from public;
grant execute on function public.lumen_feedback_reply(bigint, text, text, text, text[]) to anon, authenticated, service_role;

-- ─── Administrators (analytics_cockpit) ────────────────────────────────────────
create or replace function lumen_commands.require_cockpit()
returns void language plpgsql stable set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c
       where c.user_id = auth.uid() and c.capability = 'analytics_cockpit'
         and (c.expires_at is null or c.expires_at > now())) then
    raise exception 'analytics_cockpit capability required' using errcode = '42501';
  end if;
end $$;
revoke all on function lumen_commands.require_cockpit() from public, anon, authenticated;

-- Capture state from references only (no payload is read).
create or replace function lumen_commands.feedback_capture_state(f lumen.feedback)
returns jsonb language sql stable set search_path='' as $$
  select case
    when f.support_capture_id is null then jsonb_build_object('state', 'none')
    else (select jsonb_build_object('state',
           case when c.id is null then 'expired'
                when c.purged_at is not null or c.revoked_at is not null then 'deleted'
                when t.id is not null then 'received'
                when f.created_at > now() - interval '1 hour' then 'pending'
                else 'failed' end,
           'case_id', f.support_case_id, 'capture_id', f.support_capture_id,
           'received_at', t.received_at, 'bytes', t.bytes, 'expires_at', c.expires_at)
          from (select 1) one
          left join lumen_commands.support_cases c on c.id = f.support_case_id
          left join lumen_commands.support_captures t on t.id = f.support_capture_id and t.case_id = c.id)
  end;
$$;
revoke all on function lumen_commands.feedback_capture_state(lumen.feedback) from public, anon, authenticated;

-- Paged inbox (30 per page, keyset on id) with filters and counters. Lists carry
-- no journal, snapshot or capture payload; those are read on demand.
create or replace function public.lumen_admin_feedback_inbox(
  p_days integer default 30, p_status text default null, p_kind text default null,
  p_player text default null, p_before bigint default null, p_limit integer default 30)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
        v_limit integer := greatest(1, least(coalesce(p_limit, 30), 100));
        v_player uuid; v_items jsonb; v_counts jsonb;
begin
  perform lumen_commands.require_cockpit();
  if p_player ~ '^u:[0-9a-fA-F-]{36}$' then v_player := substr(p_player, 3)::uuid; end if;
  with base as (
    select f.*, (f.status in ('new', 'reviewed') or (f.thread -> -1 ->> 'by') = 'player') needs_action
      from lumen.feedback f
     where f.created_at >= v_since and (v_player is null or f.user_id = v_player)
       and (p_kind is null or f.kind = p_kind or (p_kind = 'other' and f.kind in ('rule', 'difficulty', 'other')))
  ), page as (
    select * from base b
     where (p_status is null or (p_status = 'action' and b.needs_action)
            or (p_status = 'closed' and b.status in ('closed', 'fixed')) or b.status = p_status)
       and (p_before is null or b.id < p_before)
     order by b.id desc limit v_limit
  )
  select (select coalesce(jsonb_agg(jsonb_build_object(
            'id', p.id, 'created_at', p.created_at, 'kind', p.kind, 'status', p.status, 'message', p.message,
            'puzzle_id', p.puzzle_id, 'app_version', p.app_version, 'context', p.context,
            'player_key', case when p.user_id is not null then 'u:' || p.user_id end,
            'player_label', coalesce(nullif(pr.nickname, ''), case when p.user_id is null then 'Visiteur ' else 'Joueur ' end
                                     || upper(substr(md5(p.anonymous_id), 1, 4))),
            'journal_count', coalesce(jsonb_array_length(p.journal), 0), 'snapshot', p.snapshot is not null,
            'capture', p.support_capture_id is not null, 'messages', jsonb_array_length(p.thread),
            'last_by', p.thread -> -1 ->> 'by', 'answered_at', p.answered_at, 'player_read_at', p.player_read_at,
            'needs_action', p.needs_action) order by p.id desc), '[]'::jsonb)
            from page p left join lumen.profiles pr on pr.user_id = p.user_id),
         (select jsonb_build_object('all', count(*), 'action', count(*) filter (where needs_action),
            'new', count(*) filter (where status = 'new'), 'reviewed', count(*) filter (where status = 'reviewed'),
            'answered', count(*) filter (where status = 'answered'),
            'closed', count(*) filter (where status in ('closed', 'fixed'))) from base)
    into v_items, v_counts;
  return jsonb_build_object('items', v_items, 'counts', v_counts,
    'next_before', case when jsonb_array_length(v_items) = v_limit then (v_items -> -1 ->> 'id')::bigint end);
end $$;
revoke all on function public.lumen_admin_feedback_inbox(integer, text, text, text, bigint, integer) from public, anon;
grant execute on function public.lumen_admin_feedback_inbox(integer, text, text, text, bigint, integer) to authenticated, service_role;

-- One report with everything linked to it: journal, snapshot, exchange, capture
-- state (references only) and the player key to open sessions and the dossier.
create or replace function public.lumen_admin_feedback_detail(p_id bigint)
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare f lumen.feedback;
begin
  perform lumen_commands.require_cockpit();
  select * into f from lumen.feedback x where x.id = p_id;
  if not found then raise exception using errcode = 'P0002', message = 'feedback_not_found'; end if;
  return jsonb_build_object('id', f.id, 'status', f.status, 'kind', f.kind,
    'player_key', case when f.user_id is not null then 'u:' || f.user_id end,
    'journal', coalesce(f.journal, '[]'::jsonb), 'snapshot', f.snapshot,
    'thread', (select coalesce(jsonb_agg(jsonb_build_object('by', m ->> 'by', 'body', m ->> 'body', 'at', m ->> 'at')), '[]'::jsonb)
                 from jsonb_array_elements(f.thread) m),
    'answered_at', f.answered_at, 'player_read_at', f.player_read_at,
    'capture', lumen_commands.feedback_capture_state(f));
end $$;
revoke all on function public.lumen_admin_feedback_detail(bigint) from public, anon;
grant execute on function public.lumen_admin_feedback_detail(bigint) to authenticated, service_role;

-- Answer (status « answered », or « closed » to answer and resolve at once).
create or replace function public.lumen_admin_feedback_reply(p_id bigint, p_body text, p_message_ref text, p_resolve boolean default false)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_body text := btrim(coalesce(p_body, '')); f lumen.feedback;
begin
  perform lumen_commands.require_cockpit();
  if length(v_body) < 2 then raise exception using errcode = '22023', message = 'message_required'; end if;
  if p_message_ref is null or p_message_ref !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception using errcode = '22023', message = 'invalid_reference';
  end if;
  select * into f from lumen.feedback x where x.id = p_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'feedback_not_found'; end if;
  if exists (select 1 from jsonb_array_elements(f.thread) m where m ->> 'ref' = p_message_ref) then
    return jsonb_build_object('id', f.id, 'status', f.status, 'duplicate', true);
  end if;
  if jsonb_array_length(f.thread) >= 30 then raise exception using errcode = 'P0001', message = 'thread_full'; end if;
  update lumen.feedback x set
    thread = x.thread || jsonb_build_array(jsonb_build_object('by', 'admin', 'body', left(v_body, 2000), 'at', now(), 'ref', p_message_ref)),
    status = case when coalesce(p_resolve, false) then 'closed' else 'answered' end,
    answered_at = now(), updated_at = now()
   where x.id = f.id returning x.status into f.status;
  return jsonb_build_object('id', f.id, 'status', f.status, 'duplicate', false);
end $$;
revoke all on function public.lumen_admin_feedback_reply(bigint, text, text, boolean) from public, anon;
grant execute on function public.lumen_admin_feedback_reply(bigint, text, text, boolean) to authenticated, service_role;

-- Status follow-up now accepts « answered » (Réponse disponible).
create or replace function public.lumen_admin_feedback_set_status(p_id bigint, p_status text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_status text;
begin
  perform lumen_commands.require_cockpit();
  if p_status is null or p_status not in ('new', 'reviewed', 'answered', 'fixed', 'closed') then
    raise exception using errcode = '22023', message = 'invalid_status';
  end if;
  update lumen.feedback set status = p_status, updated_at = now() where id = p_id returning status into v_status;
  if not found then raise exception using errcode = 'P0002', message = 'feedback_not_found'; end if;
  return jsonb_build_object('id', p_id, 'status', v_status);
end $$;
revoke all on function public.lumen_admin_feedback_set_status(bigint, text) from public, anon;
grant execute on function public.lumen_admin_feedback_set_status(bigint, text) to authenticated, service_role;

-- ─── #848: Android native version observed on a device ─────────────────────────
alter table lumen_commands.outbox_health
  add column if not exists native_version text,
  add column if not exists native_observed_at timestamptz;
alter table lumen_commands.outbox_health drop constraint if exists outbox_health_native_version_check;
alter table lumen_commands.outbox_health add constraint outbox_health_native_version_check
  check (native_version is null or native_version ~ '^[0-9]{1,3}(\.[0-9]{1,3}){1,3}\+[0-9]{1,9}$');

-- Same observation as the 14-argument version; the native version comes only from
-- the Android launcher (never inferred from a user agent). Null keeps the last one
-- known for this device, so a browser session never erases it.
create or replace function lumen_commands.record_outbox_health(p_expected_user_id uuid,p_client_id uuid,p_session_id uuid,
 p_started_at timestamptz,p_sequence integer,p_platform text,p_state text,p_pending integer,
 p_failures integer,p_oldest_at timestamptz,p_version text,p_storage_kb integer,p_storage_ratio integer,p_storage_error text,
 p_native_version text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_native_version is not null and p_native_version !~ '^[0-9]{1,3}(\.[0-9]{1,3}){1,3}\+[0-9]{1,9}$' then
  raise exception using errcode='22023',message='invalid native version';end if;
 perform lumen_commands.record_outbox_health(p_expected_user_id,p_client_id,p_session_id,p_started_at,p_sequence,
  p_platform,p_state,p_pending,p_failures,p_oldest_at,p_version,p_storage_kb,p_storage_ratio,p_storage_error);
 if p_native_version is not null then
  update lumen_commands.outbox_health set native_version=p_native_version,native_observed_at=now()
  where user_id=auth.uid() and client_id=p_client_id and session_id=p_session_id and sequence=p_sequence;
 end if;
end $$;
create or replace function public.lumen_record_outbox_health(p_expected_user_id uuid,p_client_id uuid,p_session_id uuid,
 p_started_at timestamptz,p_sequence integer,p_platform text,p_state text,p_pending integer,
 p_failures integer,p_oldest_at timestamptz,p_version text,p_storage_kb integer,p_storage_ratio integer,p_storage_error text,
 p_native_version text)
returns void language sql security invoker set search_path='' as $$
 select lumen_commands.record_outbox_health(p_expected_user_id,p_client_id,p_session_id,p_started_at,p_sequence,p_platform,
  p_state,p_pending,p_failures,p_oldest_at,p_version,p_storage_kb,p_storage_ratio,p_storage_error,p_native_version);
$$;
revoke all on function lumen_commands.record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text,text),
 public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text,text) from public,anon;
grant execute on function lumen_commands.record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text,text),
 public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text,text) to authenticated;

-- ─── #708: facts for the player table, one bounded read ────────────────────────
-- Activity = last completed quest received by the server (canonical or legacy
-- receipt), never an Auth sign-in or a background request. Devices = the current
-- row of each device (at most 5 most recent); the verdict is computed client-side.
create or replace function public.lumen_admin_player_health(p_player_keys text[])
returns jsonb
language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
  perform lumen_commands.require_cockpit();
  if cardinality(p_player_keys) > 250 then raise exception using errcode = '22023', message = 'too many player keys'; end if;
  with keys as (
    select distinct lower(key) key from unnest(p_player_keys) key
     where key ~ '^u:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  ), players as (
    select k.key, u.id, u.last_sign_in_at from keys k join auth.users u on 'u:' || u.id::text = k.key
  ), rows as (
    select p.key, jsonb_build_object(
      'auth_at', p.last_sign_in_at,
      'domains', jsonb_build_object('canonical', c.at, 'legacy', l.at, 'wallet', w.at),
      'game_at', greatest(c.at, l.at),
      'devices', coalesce(d.list, '[]'::jsonb),
      'hydration', h.failure,
      'reports', r.summary) value
    from players p
    left join lateral (select x.recorded_at at from lumen_commands.canonical_receipts x where x.user_id = p.id order by x.recorded_at desc limit 1) c on true
    left join lateral (select x.recorded_at at from lumen_commands.legacy_receipts x where x.user_id = p.id order by x.recorded_at desc limit 1) l on true
    left join lateral (select x.recorded_at at from lumen_commands.wallet_receipts x where x.user_id = p.id order by x.recorded_at desc limit 1) w on true
    left join lateral (
      select jsonb_agg(jsonb_build_object('platform', o.platform, 'state', o.state, 'pending', o.pending, 'failures', o.failures,
               'oldest_pending_at', o.oldest_pending_at, 'observed_at', o.updated_at, 'version', o.app_version,
               'native_version', o.native_version, 'native_observed_at', o.native_observed_at,
               'storage_ratio', o.storage_ratio,
               'storage_error', case when o.storage_error_at >= now() - interval '7 days' then o.storage_error end)
             order by o.updated_at desc) list
        from (select * from lumen_commands.outbox_health o where o.user_id = p.id order by o.updated_at desc limit 5) o
    ) d on true
    left join lateral (
      select jsonb_build_object('at', f.recorded_at, 'reason', coalesce(f.reason, 'unknown'), 'version', f.app_version) failure
        from public.lumen_sync_health f
       where f.user_id = p.id and f.recorded_at >= now() - interval '30 days'
         and (f.event = 'hydration_failed' or (f.event = 'hydration_reconciliation' and f.outcome = 'blocked'))
         and coalesce(f.reason, 'unknown') not in ('network', 'offline')
         and not exists (select 1 from public.lumen_sync_health ok where ok.user_id = f.user_id
               and ok.event = 'hydration_ready' and (ok.recorded_at, ok.id) > (f.recorded_at, f.id))
       order by f.recorded_at desc limit 1
    ) h on true
    left join lateral (
      select jsonb_build_object('total', count(*), 'open', count(*) filter (where x.status in ('new', 'reviewed')
               or (x.thread -> -1 ->> 'by') = 'player'), 'last_at', max(x.created_at)) summary
        from lumen.feedback x where x.user_id = p.id and x.created_at >= now() - interval '180 days'
    ) r on true
  ) select jsonb_build_object('observed_at', now(), 'players', coalesce(jsonb_object_agg(key, value), '{}'::jsonb))
      into result from rows;
  return result;
end $$;
revoke all on function public.lumen_admin_player_health(text[]) from public, anon;
grant execute on function public.lumen_admin_player_health(text[]) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
