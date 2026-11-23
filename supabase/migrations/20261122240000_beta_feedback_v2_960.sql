-- #960: beta reports from anywhere in Lumen (bug, question, suggestion).
-- Additive and idempotent: v1 (lumen_send_feedback) and lumen_admin_feedback are
-- unchanged. The kind constraint only gains values; two nullable columns are added.
-- Rollback: drop the three new functions and the client_ref index, drop the two
-- columns, restore the previous kind constraint (no other data touched).

-- Kinds: existing rows stay valid; « question » and « idea » become possible.
alter table lumen.feedback drop constraint if exists feedback_kind_check;
alter table lumen.feedback add constraint feedback_kind_check
  check (kind = any (array['bug','rule','difficulty','other','question','idea']));

-- Minimal, allowlisted technical context and an idempotency reference.
alter table lumen.feedback add column if not exists context jsonb;
alter table lumen.feedback add column if not exists client_ref text;
create unique index if not exists lumen_feedback_client_ref_idx
  on lumen.feedback(anonymous_id, client_ref) where client_ref is not null;

-- Player entry point: validated, rate limited, idempotent, returns a receipt.
create or replace function public.lumen_send_feedback_v2(
  p_anonymous_id text, p_kind text, p_message text,
  p_context jsonb default '{}'::jsonb, p_client_ref text default null)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_msg text := btrim(coalesce(p_message, ''));
  v_ctx jsonb := '{}'::jsonb;
  v_raw jsonb := case when jsonb_typeof(p_context) = 'object' then p_context else '{}'::jsonb end;
  v_key text; v_value jsonb;
  v_id bigint; v_recent integer; v_puzzle integer;
begin
  if p_anonymous_id is null or length(p_anonymous_id) not between 8 and 100 then
    raise exception using errcode = '22023', message = 'invalid_reporter';
  end if;
  if p_kind is null or p_kind not in ('bug', 'question', 'idea') then
    raise exception using errcode = '22023', message = 'invalid_kind';
  end if;
  if length(v_msg) < 3 then
    raise exception using errcode = '22023', message = 'message_required';
  end if;
  if p_client_ref is not null and p_client_ref !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception using errcode = '22023', message = 'invalid_reference';
  end if;
  -- A retried draft (same reporter, same reference) never creates a second report.
  if p_client_ref is not null then
    select f.id into v_id from lumen.feedback f
     where f.anonymous_id = p_anonymous_id and f.client_ref = p_client_ref;
    if found then
      return jsonb_build_object('id', v_id, 'status', 'received', 'duplicate', true);
    end if;
  end if;
  select count(*) into v_recent from lumen.feedback f
   where f.created_at > now() - interval '1 hour'
     and (f.anonymous_id = p_anonymous_id or (v_uid is not null and f.user_id = v_uid));
  if v_recent >= 10 then
    raise exception using errcode = 'P0001', message = 'rate_limited';
  end if;
  -- Only these technical fields are kept; strings are bounded. No token, email,
  -- free-form state or identifier beyond the client session id.
  for v_key, v_value in select key, value from jsonb_each(v_raw) loop
    if v_key in ('app_version', 'android_version', 'platform', 'browser', 'screen', 'locale',
                 'surface', 'adventure', 'quest_id', 'quest_ordinal', 'puzzle_id', 'session_id',
                 'standalone', 'offline', 'error_code', 'in_quest')
       and jsonb_typeof(v_value) in ('string', 'number', 'boolean') then
      v_ctx := v_ctx || jsonb_build_object(v_key,
        case when jsonb_typeof(v_value) = 'string' then to_jsonb(left(v_value #>> '{}', 120)) else v_value end);
    end if;
  end loop;
  if jsonb_typeof(v_ctx -> 'puzzle_id') = 'number' and (v_ctx ->> 'puzzle_id')::numeric between 1 and 100000 then
    v_puzzle := (v_ctx ->> 'puzzle_id')::numeric::integer;
  end if;
  begin
    insert into lumen.feedback(user_id, anonymous_id, kind, message, puzzle_id, hints_used,
                               app_version, user_agent, context, client_ref)
    values (v_uid, p_anonymous_id, p_kind, left(v_msg, 2000), v_puzzle, 0,
            left(coalesce(v_ctx ->> 'app_version', ''), 100), left(coalesce(v_ctx ->> 'browser', ''), 120),
            v_ctx, p_client_ref)
    returning id into v_id;
  exception when unique_violation then
    -- Two concurrent sends of the same draft: the first one wins, both get its receipt.
    select f.id into v_id from lumen.feedback f
     where f.anonymous_id = p_anonymous_id and f.client_ref = p_client_ref;
    return jsonb_build_object('id', v_id, 'status', 'received', 'duplicate', true);
  end;
  return jsonb_build_object('id', v_id, 'status', 'received', 'duplicate', false);
end $$;
revoke all on function public.lumen_send_feedback_v2(text, text, text, jsonb, text) from public;
grant execute on function public.lumen_send_feedback_v2(text, text, text, jsonb, text) to anon, authenticated, service_role;

-- Administrators: same capability as lumen_admin_feedback, with kind, status and context.
create or replace function public.lumen_admin_feedback_v2(p_days integer default 30)
returns table(id bigint, created_at timestamptz, kind text, status text, message text, puzzle_id integer,
              app_version text, context jsonb, player_label text)
language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c
       where c.user_id = auth.uid() and c.capability = 'analytics_cockpit'
         and (c.expires_at is null or c.expires_at > now())) then
    raise exception 'analytics_cockpit capability required' using errcode = '42501';
  end if;
  return query
    select f.id, f.created_at, f.kind, f.status, f.message, f.puzzle_id, f.app_version, f.context,
           coalesce(p.nickname, 'Joueur ' || upper(substr(md5(f.anonymous_id), 1, 4)))
      from lumen.feedback f left join lumen.profiles p on p.user_id = f.user_id
     where f.created_at >= now() - (greatest(1, least(coalesce(p_days, 30), 3650)) || ' days')::interval
     order by f.created_at desc limit 250;
end $$;
revoke all on function public.lumen_admin_feedback_v2(integer) from public, anon;
grant execute on function public.lumen_admin_feedback_v2(integer) to authenticated, service_role;

-- Administrators: follow a report (new → reviewed → fixed → closed). Closing starts
-- the existing 180-day retention (#lumen_retention_stamp trigger).
create or replace function public.lumen_admin_feedback_set_status(p_id bigint, p_status text)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_status text;
begin
  if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c
       where c.user_id = auth.uid() and c.capability = 'analytics_cockpit'
         and (c.expires_at is null or c.expires_at > now())) then
    raise exception 'analytics_cockpit capability required' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('new', 'reviewed', 'fixed', 'closed') then
    raise exception using errcode = '22023', message = 'invalid_status';
  end if;
  update lumen.feedback set status = p_status where id = p_id returning status into v_status;
  if not found then raise exception using errcode = 'P0002', message = 'feedback_not_found'; end if;
  return jsonb_build_object('id', p_id, 'status', v_status);
end $$;
revoke all on function public.lumen_admin_feedback_set_status(bigint, text) from public, anon;
grant execute on function public.lumen_admin_feedback_set_status(bigint, text) to authenticated, service_role;
