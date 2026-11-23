-- #960 follow-up: a report carries the device's sync journal, so a blocked
-- player never has to run a separate diagnostic activation (incident #1010:
-- the support case was never activated). Additive and idempotent.
-- The journal holds event names, timestamps, codes and counters only: the
-- server keeps at most 60 entries of scalar values (one nested level of
-- scalars for outbox summaries), drops anything else and caps the size.
-- Rollback: drop the two new functions and the journal column.

alter table lumen.feedback add column if not exists journal jsonb;

create or replace function lumen_commands.sanitize_feedback_journal(p jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_out jsonb := '[]'::jsonb; v_item jsonb; v_clean jsonb; v_key text; v_value jsonb;
        v_sub text; v_subvalue jsonb; v_nested jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' then return null; end if;
  for v_item in select value from jsonb_array_elements(p) limit 60 loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'event') <> 'string' then continue; end if;
    v_clean := '{}'::jsonb;
    for v_key, v_value in select key, value from jsonb_each(v_item) limit 24 loop
      if v_key !~ '^[A-Za-z][A-Za-z0-9_]{0,39}$' then continue; end if;
      if jsonb_typeof(v_value) in ('number', 'boolean') then
        v_clean := v_clean || jsonb_build_object(v_key, v_value);
      elsif jsonb_typeof(v_value) = 'string' and (v_value #>> '{}') ~ '^[A-Za-z0-9_:.+ -]{0,64}$' then
        v_clean := v_clean || jsonb_build_object(v_key, v_value);
      elsif jsonb_typeof(v_value) = 'object' then
        v_nested := '{}'::jsonb;
        for v_sub, v_subvalue in select key, value from jsonb_each(v_value) limit 16 loop
          if v_sub ~ '^[A-Za-z][A-Za-z0-9_]{0,39}$' and (jsonb_typeof(v_subvalue) in ('number', 'boolean')
             or (jsonb_typeof(v_subvalue) = 'string' and (v_subvalue #>> '{}') ~ '^[A-Za-z0-9_:.+ -]{0,64}$')) then
            v_nested := v_nested || jsonb_build_object(v_sub, v_subvalue);
          end if;
        end loop;
        v_clean := v_clean || jsonb_build_object(v_key, v_nested);
      end if;
    end loop;
    v_out := v_out || jsonb_build_array(v_clean);
  end loop;
  if octet_length(v_out::text) > 65536 then return null; end if;
  return v_out;
end $$;
revoke all on function lumen_commands.sanitize_feedback_journal(jsonb) from public, anon, authenticated;

-- Same contract as v2 (validation, idempotent reference, hourly limit,
-- allowlisted context), plus the sanitized journal on the new report only.
create or replace function public.lumen_send_feedback_v3(
  p_anonymous_id text, p_kind text, p_message text,
  p_context jsonb default '{}'::jsonb, p_client_ref text default null, p_journal jsonb default null)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_result jsonb; v_journal jsonb := lumen_commands.sanitize_feedback_journal(p_journal);
begin
  v_result := public.lumen_send_feedback_v2(p_anonymous_id, p_kind, p_message, p_context, p_client_ref);
  if v_journal is not null and coalesce((v_result ->> 'duplicate')::boolean, false) = false then
    update lumen.feedback f set journal = v_journal
     where f.id = (v_result ->> 'id')::bigint and f.anonymous_id = p_anonymous_id and f.journal is null;
  end if;
  return v_result || jsonb_build_object('journal', v_journal is not null);
end $$;
revoke all on function public.lumen_send_feedback_v3(text, text, text, jsonb, text, jsonb) from public;
grant execute on function public.lumen_send_feedback_v3(text, text, text, jsonb, text, jsonb) to anon, authenticated, service_role;

-- Administrators read one report's journal on demand (not in the list payload).
create or replace function public.lumen_admin_feedback_journal(p_id bigint)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_journal jsonb;
begin
  if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c
       where c.user_id = auth.uid() and c.capability = 'analytics_cockpit'
         and (c.expires_at is null or c.expires_at > now())) then
    raise exception 'analytics_cockpit capability required' using errcode = '42501';
  end if;
  select f.journal into v_journal from lumen.feedback f where f.id = p_id;
  if not found then raise exception using errcode = 'P0002', message = 'feedback_not_found'; end if;
  return coalesce(v_journal, '[]'::jsonb);
end $$;
revoke all on function public.lumen_admin_feedback_journal(bigint) from public, anon;
grant execute on function public.lumen_admin_feedback_journal(bigint) to authenticated, service_role;
notify pgrst, 'reload schema';
