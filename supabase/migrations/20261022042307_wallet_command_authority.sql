-- #248/#391: additive, lazy account activation. No backfill or player rewrite.
-- Apply only after separate production approval. Keep receipts on rollback.
create table lumen_commands.wallet_authority (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null check(revision>0),
 balance bigint not null check(balance>=0),
 daily jsonb not null
);
create table lumen_commands.wallet_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id text not null,
 request jsonb not null,
 outcome jsonb not null,
 recorded_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
alter table lumen_commands.wallet_authority enable row level security;
alter table lumen_commands.wallet_receipts enable row level security;
revoke all on lumen_commands.wallet_authority,lumen_commands.wallet_receipts from public,anon,authenticated;

-- Called only by trusted command implementations, under the snapshot row lock.
create function lumen_commands.adopt_wallet_projection(p_uid uuid,p_profile jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_revision bigint;
begin
 if jsonb_typeof(p_profile->'shards') is distinct from 'number'
  or (p_profile->>'shards') !~ '^[0-9]{1,15}$'
 then raise exception using errcode='22023',message='wallet baseline requires review';end if;
 update lumen_commands.wallet_authority set revision=revision+1,
  balance=(p_profile->>'shards')::bigint,daily=coalesce(p_profile->'daily','{}')
 where user_id=p_uid returning revision into v_revision;
 if not found then return p_profile;end if;
 return p_profile||jsonb_build_object('walletRevision',v_revision);
end $$;
revoke all on function lumen_commands.adopt_wallet_projection(uuid,jsonb) from public,anon,authenticated;

create function lumen_commands.protect_wallet_authority() returns trigger
language plpgsql security definer set search_path='' as $$
declare v lumen_commands.wallet_authority%rowtype;
begin
 select * into v from lumen_commands.wallet_authority where user_id=new.user_id;
 if found and ((new.payload->'walletRevision') is distinct from to_jsonb(v.revision)
  or (new.payload->'shards') is distinct from to_jsonb(v.balance)
  or coalesce(new.payload->'daily','{}') is distinct from v.daily)
 then raise exception using errcode='22023',message='wallet command required; preserve pending data and update client';end if;
 if not found and new.payload ? 'walletRevision'
 then raise exception using errcode='22023',message='wallet authority missing';end if;
 return new;
end $$;
revoke all on function lumen_commands.protect_wallet_authority() from public,anon,authenticated;
create trigger protect_wallet_authority before insert or update of payload on lumen.profile_snapshots
 for each row execute function lumen_commands.protect_wallet_authority();

-- Keep old clients compatible before lazy activation, never let them bypass the
-- new projection after activation. Trusted victory/daily commands call privately.
alter function public.lumen_claim_daily(integer) set schema lumen_commands;
alter function lumen_commands.lumen_claim_daily(integer) rename to claim_daily_v1;
revoke all on function lumen_commands.claim_daily_v1(integer) from public,anon,authenticated;
create function lumen_commands.claim_daily_compat(p_puzzle_id integer)
returns table(server_day date,credited boolean,reward integer,streak integer)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception using errcode='42501',message='authentication required';end if;
 perform 1 from lumen.profile_snapshots where user_id=auth.uid() for update;
 if exists(select 1 from lumen_commands.wallet_authority where user_id=auth.uid())
 then raise exception using errcode='22023',message='wallet command required; preserve pending data and update client';end if;
 return query select * from lumen_commands.claim_daily_v1(p_puzzle_id);
end $$;
create function public.lumen_claim_daily(p_puzzle_id integer)
returns table(server_day date,credited boolean,reward integer,streak integer)
language sql security invoker set search_path='' as $$select * from lumen_commands.claim_daily_compat(p_puzzle_id);$$;
revoke all on function lumen_commands.claim_daily_compat(integer),public.lumen_claim_daily(integer) from public,anon;
grant execute on function lumen_commands.claim_daily_compat(integer),public.lumen_claim_daily(integer) to authenticated;
alter function public.lumen_save_daily(date,integer) set schema lumen_commands;
alter function lumen_commands.lumen_save_daily(date,integer) rename to save_daily_v1;
revoke all on function lumen_commands.save_daily_v1(date,integer) from public,anon,authenticated;
create function lumen_commands.save_daily_compat(p_play_date date,p_puzzle_id integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception using errcode='42501',message='authentication required';end if;
 perform 1 from lumen.profile_snapshots where user_id=auth.uid() for update;
 if exists(select 1 from lumen_commands.wallet_authority where user_id=auth.uid())
 then raise exception using errcode='22023',message='wallet command required; preserve pending data and update client';end if;
 perform lumen_commands.save_daily_v1(p_play_date,p_puzzle_id);
end $$;
create function public.lumen_save_daily(p_play_date date,p_puzzle_id integer) returns void
language sql security invoker set search_path='' as $$select lumen_commands.save_daily_compat(p_play_date,p_puzzle_id);$$;
revoke all on function lumen_commands.save_daily_compat(date,integer),public.lumen_save_daily(date,integer) from public,anon;
grant execute on function lumen_commands.save_daily_compat(date,integer),public.lumen_save_daily(date,integer) to authenticated;

-- Preserve the existing historical command and all its guards/rules. Instrument
-- its single snapshot write, failing the migration if that boundary has changed.
do $$
declare v_definition text;v_boundary text:='update lumen.profile_snapshots set payload=v_profile';
begin
 select pg_get_functiondef('lumen_commands.commit_legacy(text,uuid,text,jsonb)'::regprocedure) into v_definition;
 if (length(v_definition)-length(replace(v_definition,v_boundary,'')))/length(v_boundary)<>1
 then raise exception 'historical wallet boundary changed; review migration';end if;
 execute replace(replace(v_definition,'public.lumen_claim_daily(','lumen_commands.claim_daily_v1('),v_boundary,
  'v_profile:=lumen_commands.adopt_wallet_projection(v_uid,v_profile); '||v_boundary);
end $$;

create function lumen_commands.commit_wallet(p_operation_id text,p_expected_user_id uuid,p_request jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_profile jsonb;v_receipt lumen_commands.wallet_receipts%rowtype;
 v_balance bigint;v_initial_balance bigint;v_cost integer;v_sequence integer;v_revision bigint;v_key text;
 v_claim record;v_row record;v_daily jsonb;v_dates jsonb;v_rewards jsonb;v_daily_credited boolean:=false;v_daily_reward integer:=0;
begin
 if v_uid is null or p_expected_user_id is distinct from v_uid
 then raise exception using errcode='42501',message='command account changed';end if;
 if p_operation_id is null or p_operation_id !~ '^[A-Za-z0-9._-]{1,120}$'
  or p_request is null or jsonb_typeof(p_request)<>'object' or octet_length(p_request::text)>1024
 then raise exception using errcode='22023',message='invalid wallet command';end if;
 select payload into v_profile from lumen.profile_snapshots where user_id=v_uid for update;
 if not found then raise exception using errcode='22023',message='verified cloud profile required';end if;
 select * into v_receipt from lumen_commands.wallet_receipts where user_id=v_uid and operation_id=p_operation_id;
 if found then
  if v_receipt.request is distinct from p_request then raise exception using errcode='22023',message='operation evidence changed';end if;
  return v_receipt.outcome;
 end if;
 if jsonb_typeof(v_profile->'shards') is distinct from 'number' or (v_profile->>'shards') !~ '^[0-9]{1,15}$'
 then raise exception using errcode='22023',message='wallet baseline requires review';end if;
 v_balance:=(v_profile->>'shards')::bigint;
 v_initial_balance:=v_balance;
 -- A first wallet epoch imports known dates, never guesses whether an old
 -- daily credit was already included in a scalar balance. Missing application
 -- receipts require an audited baseline, before any debit or activation.
 if not exists(select 1 from lumen_commands.wallet_authority where user_id=v_uid) then
  perform 1 from lumen.engagement_state where user_id=v_uid for update;
  v_daily:=coalesce(v_profile->'daily','{}');v_dates:=coalesce(v_daily->'dates','{}');v_rewards:=coalesce(v_daily->'rewards','{}');
  if jsonb_typeof(v_daily)<>'object' or jsonb_typeof(v_dates)<>'object' or jsonb_typeof(v_rewards)<>'object'
  then raise exception using errcode='22023',message='wallet baseline daily data requires review';end if;
  for v_row in select key,value from jsonb_each(coalesce((select rewarded_days from lumen.engagement_state where user_id=v_uid),'{}')) loop
   if v_rewards->('streak:'||v_row.key) is distinct from v_row.value
   then raise exception using errcode='22023',message='wallet baseline daily receipt requires review';end if;
  end loop;
  for v_row in select play_date from lumen.daily_progress where user_id=v_uid loop
   v_dates:=v_dates||jsonb_build_object(v_row.play_date::text,1);
  end loop;
  v_profile:=v_profile||jsonb_build_object('daily',v_daily||jsonb_build_object('dates',v_dates,'rewards',v_rewards));
 end if;
 v_cost:=0;
 if p_request->>'kind' in ('hint','verify') then
  if not(p_request ?& array['kind','attemptId','resetCount','sequence'])
   or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('kind','attemptId','resetCount','sequence'))
   or (p_request->>'attemptId') !~ '^[A-Za-z0-9._-]{1,80}$'
   or jsonb_typeof(p_request->'resetCount') is distinct from 'number' or (p_request->>'resetCount') !~ '^[0-9]{1,6}$'
   or jsonb_typeof(p_request->'sequence') is distinct from 'number' or (p_request->>'sequence') !~ '^[1-9][0-9]{0,5}$'
  then raise exception using errcode='22023',message='invalid spend evidence';end if;
  if p_operation_id is distinct from (p_request->>'attemptId')||'-reset-'||(p_request->>'resetCount')||'-'||(p_request->>'kind')||'-'||(p_request->>'sequence')
  then raise exception using errcode='22023',message='spend identity mismatch';end if;
  v_sequence:=(p_request->>'sequence')::integer;
  v_cost:=case when p_request->>'kind'='hint' and v_sequence>1 then 2 else 1 end;
  if v_balance<v_cost then raise exception using errcode='P0001',message='insufficient wallet balance';end if;
  v_balance:=v_balance-v_cost;
 elsif p_request->>'kind'='establish' then
  if p_request<>'{"kind":"establish"}'::jsonb or p_operation_id<>'wallet-establish-v1'
  then raise exception using errcode='22023',message='invalid wallet activation';end if;
 elsif p_request->>'kind'='daily' then
  if not(p_request ?& array['kind','day','puzzleId'])
   or exists(select 1 from jsonb_object_keys(p_request) k where k not in ('kind','day','puzzleId'))
   or p_request->>'day' is distinct from (now() at time zone 'Europe/Paris')::date::text
   or jsonb_typeof(p_request->'puzzleId') is distinct from 'number'
   or (p_request->>'puzzleId') !~ '^[1-9][0-9]{0,5}$'
  then raise exception using errcode='22023',message='invalid daily evidence';end if;
  -- Same lock order as historical victory: snapshot then engagement.
  select * into v_claim from lumen_commands.claim_daily_v1((p_request->>'puzzleId')::integer);
  v_daily_credited:=coalesce(v_claim.credited,false);
  v_daily_reward:=coalesce(v_claim.reward,0);
  v_daily:=coalesce(v_profile->'daily','{}');v_dates:=coalesce(v_daily->'dates','{}');v_rewards:=coalesce(v_daily->'rewards','{}');
  for v_row in select play_date from lumen.daily_progress where user_id=v_uid loop
   v_dates:=v_dates||jsonb_build_object(v_row.play_date::text,1);
  end loop;
  for v_row in select key,value from jsonb_each(coalesce((select rewarded_days from lumen.engagement_state where user_id=v_uid),'{}')) loop
   v_key:='streak:'||v_row.key;
   if v_rewards ? v_key then
    if v_rewards->v_key is distinct from v_row.value then raise exception using errcode='22023',message='daily reward requires review';end if;
   else
    if v_row.key<>(now() at time zone 'Europe/Paris')::date::text or not v_daily_credited
    then raise exception using errcode='22023',message='historical daily receipt requires review';end if;
    v_balance:=v_balance+(v_row.value::text)::bigint;
    v_rewards:=v_rewards||jsonb_build_object(v_key,v_row.value);
   end if;
  end loop;
  v_profile:=jsonb_set(v_profile,'{daily}',v_daily||jsonb_build_object('dates',v_dates,'rewards',v_rewards));
 else raise exception using errcode='22023',message='unknown wallet action';end if;
 insert into lumen_commands.wallet_authority(user_id,revision,balance,daily)
 values(v_uid,1,v_balance,coalesce(v_profile->'daily','{}'))
 on conflict(user_id) do update set revision=lumen_commands.wallet_authority.revision+1,
  balance=excluded.balance,daily=excluded.daily returning revision into v_revision;
 v_profile:=v_profile||jsonb_build_object('shards',v_balance,'walletRevision',v_revision);
 if octet_length(v_profile::text)>524288 then raise exception using errcode='22001',message='wallet projection too large; preserve pending data';end if;
 update lumen.profile_snapshots set payload=v_profile,saved_at=now() where user_id=v_uid;
 insert into lumen_commands.wallet_receipts(user_id,operation_id,request,outcome)
 values(v_uid,p_operation_id,p_request,jsonb_build_object('version',1,'operationId',p_operation_id,'request',p_request,
  'cost',v_cost,'revision',v_revision,'balance',v_balance,'balanceDelta',v_balance-v_initial_balance,
  'dailyCredited',v_daily_credited,'dailyReward',v_daily_reward)) returning * into v_receipt;
 return v_receipt.outcome;
end $$;

create function lumen_commands.get_wallet(p_operation_id text,p_expected_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid()
 then raise exception using errcode='42501',message='command account changed';end if;
 return (select outcome from lumen_commands.wallet_receipts where user_id=auth.uid() and operation_id=p_operation_id);
end $$;
create function public.lumen_commit_wallet_command(p_operation_id text,p_expected_user_id uuid,p_request jsonb)
returns jsonb language sql security invoker set search_path='' as $$select lumen_commands.commit_wallet(p_operation_id,p_expected_user_id,p_request);$$;
create function public.lumen_get_wallet_command(p_operation_id text,p_expected_user_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select lumen_commands.get_wallet(p_operation_id,p_expected_user_id);$$;
create function public.lumen_wallet_command_version() returns integer language plpgsql stable security invoker set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='authentication required';end if;return 1;end $$;
revoke all on function lumen_commands.commit_wallet(text,uuid,jsonb),lumen_commands.get_wallet(text,uuid) from public,anon;
grant execute on function lumen_commands.commit_wallet(text,uuid,jsonb),lumen_commands.get_wallet(text,uuid) to authenticated;
revoke all on function public.lumen_commit_wallet_command(text,uuid,jsonb),public.lumen_get_wallet_command(text,uuid),public.lumen_wallet_command_version() from public,anon;
grant execute on function public.lumen_commit_wallet_command(text,uuid,jsonb),public.lumen_get_wallet_command(text,uuid),public.lumen_wallet_command_version() to authenticated;
-- Required argument keeps the legacy zero-argument API unambiguous. The SDK
-- may change its bearer token before the UI receives its auth callback.
create function public.lumen_restore_profile(p_expected_user_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid()
 then raise exception using errcode='42501',message='profile account changed';end if;
 return public.lumen_restore_profile();
end $$;
revoke all on function public.lumen_restore_profile(uuid) from public,anon;
grant execute on function public.lumen_restore_profile(uuid) to authenticated;
create function public.lumen_initialize_profile(p_payload jsonb,p_expected_user_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid()
 then raise exception using errcode='42501',message='profile account changed';end if;
 return public.lumen_initialize_profile(p_payload);
end $$;
revoke all on function public.lumen_initialize_profile(jsonb,uuid) from public,anon;
grant execute on function public.lumen_initialize_profile(jsonb,uuid) to authenticated;
create function public.lumen_cas_profile(p_expected jsonb,p_payload jsonb,p_expected_user_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid()
 then raise exception using errcode='42501',message='profile account changed';end if;
 return public.lumen_cas_profile(p_expected,p_payload);
end $$;
revoke all on function public.lumen_cas_profile(jsonb,jsonb,uuid) from public,anon;
grant execute on function public.lumen_cas_profile(jsonb,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
