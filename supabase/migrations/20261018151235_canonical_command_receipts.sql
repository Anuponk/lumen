-- #391: additive command receipts; no player backfill or reward rule change.
-- Keep privileged implementations outside the exposed public schema.
create schema if not exists lumen_commands;
revoke all on schema lumen_commands from public, anon;
grant usage on schema lumen_commands to authenticated;
create table lumen_commands.canonical_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id text not null check (operation_id ~ '^[A-Za-z0-9._-]{1,120}$'),
 request jsonb not null check (jsonb_typeof(request)='object'),
 outcome jsonb not null check (jsonb_typeof(outcome)='object'),
 recorded_at timestamptz not null default now(),
 primary key (user_id, operation_id)
);
alter table lumen_commands.canonical_receipts enable row level security;
revoke all on lumen_commands.canonical_receipts from public, anon, authenticated;

create function lumen_commands.commit_canonical(
 p_operation_id text, p_quest_id text, p_badges jsonb, p_performance jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_uid uuid := auth.uid();
 v_payload jsonb;
 v_request jsonb;
 v_result jsonb;
 v_receipt lumen_commands.canonical_receipts%rowtype;
begin
 if v_uid is null then raise exception using errcode='42501', message='authentication required'; end if;
 if p_operation_id is null or p_operation_id !~ '^[A-Za-z0-9._-]{1,120}$'
 then raise exception using errcode='22023', message='invalid operation identity'; end if;
 if p_quest_id is null or length(p_quest_id)>120
 then raise exception using errcode='22023', message='invalid quest identity'; end if;
 if p_badges is null or jsonb_typeof(p_badges)<>'object'
  or jsonb_typeof(coalesce(p_performance,'null'::jsonb)) not in ('object','null')
  or octet_length(p_badges::text)>2048 or octet_length(coalesce(p_performance::text,''))>4096
 then raise exception using errcode='22023', message='invalid command evidence'; end if;
 v_request := jsonb_build_object('version',1,'operationId',p_operation_id,
  'questId',p_quest_id,'badges',p_badges,'performance',p_performance);
 -- Same lock/order as legacy ledger and snapshot CAS, before checking receipts.
 select payload into v_payload from lumen.profile_snapshots where user_id=v_uid for update;
 if v_payload is null then raise exception 'verified cloud profile required'; end if;
 select * into v_receipt from lumen_commands.canonical_receipts
  where user_id=v_uid and operation_id=p_operation_id;
 if found then
  if v_receipt.request is distinct from v_request
  then raise exception using errcode='22023', message='operation evidence changed'; end if;
  -- Return original outcome with CURRENT profile, never reinstall a saved old snapshot.
  return jsonb_build_object('profile',v_payload,'newlyCompleted',v_receipt.outcome->'newlyCompleted',
   'alreadySaved',true,'replayed',true,'receipt',v_receipt.request || v_receipt.outcome ||
   jsonb_build_object('recordedAt',v_receipt.recorded_at));
 end if;
 v_result := public.lumen_commit_canonical_victory(p_quest_id,p_badges,p_performance);
 insert into lumen_commands.canonical_receipts(user_id,operation_id,request,outcome)
  values(v_uid,p_operation_id,v_request,jsonb_build_object('newlyCompleted',v_result->'newlyCompleted'))
  returning * into v_receipt;
 return v_result || jsonb_build_object('replayed',false,'receipt',v_receipt.request || v_receipt.outcome ||
  jsonb_build_object('recordedAt',v_receipt.recorded_at));
end $$;

create function lumen_commands.get_canonical(p_operation_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_receipt lumen_commands.canonical_receipts%rowtype;
begin
 if v_uid is null then raise exception using errcode='42501', message='authentication required'; end if;
 if p_operation_id is null or p_operation_id !~ '^[A-Za-z0-9._-]{1,120}$'
 then raise exception using errcode='22023', message='invalid operation identity'; end if;
 select * into v_receipt from lumen_commands.canonical_receipts where user_id=v_uid and operation_id=p_operation_id;
 if not found then return null; end if;
 return v_receipt.request || v_receipt.outcome || jsonb_build_object('recordedAt',v_receipt.recorded_at);
end $$;

create function public.lumen_commit_canonical_command(
 p_operation_id text, p_quest_id text, p_badges jsonb, p_performance jsonb default null
) returns jsonb language sql security invoker set search_path = '' as $$
 select lumen_commands.commit_canonical(p_operation_id,p_quest_id,p_badges,p_performance);
$$;
create function public.lumen_get_canonical_command(p_operation_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
 select lumen_commands.get_canonical(p_operation_id);
$$;
create function public.lumen_canonical_command_version()
returns integer language plpgsql stable security invoker set search_path = '' as $$
begin
 if auth.uid() is null then raise exception using errcode='42501', message='authentication required'; end if;
 return 1;
end $$;
revoke all on function lumen_commands.commit_canonical(text,text,jsonb,jsonb), lumen_commands.get_canonical(text) from public, anon;
grant execute on function lumen_commands.commit_canonical(text,text,jsonb,jsonb), lumen_commands.get_canonical(text) to authenticated;
revoke all on function public.lumen_commit_canonical_command(text,text,jsonb,jsonb), public.lumen_get_canonical_command(text), public.lumen_canonical_command_version() from public, anon;
grant execute on function public.lumen_commit_canonical_command(text,text,jsonb,jsonb), public.lumen_get_canonical_command(text), public.lumen_canonical_command_version() to authenticated;
