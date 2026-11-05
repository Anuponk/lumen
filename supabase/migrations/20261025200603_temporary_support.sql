-- #574: private observation only. Activation remains operator-disabled.
-- No Storage bucket: bounded typed JSON copies use atomic PostgreSQL retention.
create table lumen_commands.support_control (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false
);
insert into lumen_commands.support_control values(true,false);
create table lumen_commands.support_cases (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null default '574-v1', activated_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '24 hours',
 revoked_at timestamptz, purged_at timestamptz, last_viewed_at timestamptz
);
create index support_cases_owner_idx on lumen_commands.support_cases(user_id,activated_at desc);
create table lumen_commands.support_captures (
 id uuid primary key, case_id uuid not null references lumen_commands.support_cases(id) on delete cascade,
 received_at timestamptz not null default clock_timestamp(), bytes integer not null check(bytes between 1 and 524288),
 sha256 text not null, code text not null
);
create index support_capture_case_idx on lumen_commands.support_captures(case_id,received_at);
create table lumen_commands.support_contents (
 capture_id uuid primary key references lumen_commands.support_captures(id) on delete cascade,
 payload jsonb not null
);
create table lumen_commands.support_access (
 id bigint generated always as identity primary key,
 actor uuid references auth.users(id) on delete set null, case_id uuid,
 occurred_at timestamptz not null default clock_timestamp(), action text not null check(action in ('list','download','purge'))
);
alter table lumen_commands.support_control enable row level security;
alter table lumen_commands.support_cases enable row level security;
alter table lumen_commands.support_captures enable row level security;
alter table lumen_commands.support_contents enable row level security;
alter table lumen_commands.support_access enable row level security;
revoke all on lumen_commands.support_control,lumen_commands.support_cases,lumen_commands.support_captures,lumen_commands.support_contents,lumen_commands.support_access from public,anon,authenticated;

create function lumen_commands.validate_support(p jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare c jsonb;f jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>524288 then
  raise exception using errcode='22023',message='invalid support size or schema';end if;
 if (select array_agg(k order by k) from jsonb_object_keys(p) k) is distinct from array['code','copies','events','format','version'] or
  p->'format' is distinct from '1'::jsonb or p->>'code' is null or p->>'code' not in
  ('manual','sync_write_failed','sync_conflict','sync_retry','hydration_failed','hydration_blocked','outbox_read_failed','outbox_retry_failed','outbox_capture_failed','outbox_retried','outbox_acknowledged','runtime_exception','unhandled_rejection','resource_failed','guided_error','guided_undo','guided_input_blocked','guided_input_released') or
  p->>'version' is null or p->>'version' !~ '^(unknown|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9})$' or
  jsonb_typeof(p->'events') is distinct from 'array' or jsonb_typeof(p->'copies') is distinct from 'array' then raise exception using errcode='22023',message='invalid support schema';end if;
 if jsonb_array_length(p->'events')>20 or exists(select 1 from jsonb_array_elements(p->'events') e where jsonb_typeof(e)<>'string' or e#>>'{}' not in ('sync_write_failed','sync_conflict','sync_retry','hydration_failed','hydration_blocked','outbox_read_failed','outbox_retry_failed','outbox_capture_failed','outbox_retried','outbox_acknowledged','runtime_exception','unhandled_rejection','resource_failed','guided_error','guided_undo','guided_input_blocked','guided_input_released')) then raise exception using errcode='22023',message='invalid event codes';end if;
 if jsonb_array_length(p->'copies') not between 1 and 3 then raise exception using errcode='22023',message='invalid copy count';end if;
 for c in select * from jsonb_array_elements(p->'copies') loop
  if jsonb_typeof(c) is distinct from 'object' then raise exception using errcode='22023',message='invalid copy';end if;
  if (select array_agg(k order by k) from jsonb_object_keys(c) k) is distinct from array['facts','source'] or
   c->>'source' is null or c->>'source' not in ('local','checkpoint') or jsonb_typeof(c->'facts') is distinct from 'array'
   then raise exception using errcode='22023',message='invalid copy';end if;
  if jsonb_array_length(c->'facts')>6000 then raise exception using errcode='22023',message='too many facts';end if;
  for f in select * from jsonb_array_elements(c->'facts') loop
   if jsonb_typeof(f) is distinct from 'object' then raise exception using errcode='22023',message='invalid fact';end if;
   if (select array_agg(k order by k) from jsonb_object_keys(f) k) is distinct from array['metric','quest','value'] or
    jsonb_typeof(f->'quest') is distinct from 'number' or (f->>'quest') !~ '^[0-9]{1,8}$' or (f->>'quest')::numeric>10000000 or
    f->>'metric' is null or f->>'metric' not in ('solved','stars','noHint','autonomy','speed','noError','mastery','bestTime','time','attempts','version','shards','xp','skyScore','walletRevision','legacyVictoryRevision','pendingCanonical','pendingLegacy','pendingWallet') or
    jsonb_typeof(f->'value') not in ('boolean','number') or f->'value' is null
    then raise exception using errcode='22023',message='invalid fact';end if;
   if jsonb_typeof(f->'value')='number' and abs((f->>'value')::numeric)>1000000000000
    then raise exception using errcode='22023',message='invalid numeric fact';end if;
  end loop;
 end loop;
end $$;
revoke all on function lumen_commands.validate_support(jsonb) from public,anon,authenticated;

create function lumen_commands.support(p_expected_user_id uuid,p_action text,p_case_id uuid,p_capture_id uuid,p_payload jsonb,p_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c lumen_commands.support_cases; t lumen_commands.support_captures;
 target uuid; admin boolean:=false; result jsonb; n integer; total bigint; digest text;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception using errcode='42501',message='support account mismatch';end if;
 if p_action is null or p_action not in ('status','activate','revoke','capture','list','download','purge') then raise exception using errcode='22023',message='invalid support action';end if;
 admin:=p_action in ('list','download','purge');
 if admin and not exists(select 1 from lumen.internal_capabilities x where x.user_id=u and x.capability='analytics_cockpit' and (x.expires_at is null or x.expires_at>clock_timestamp()))
  then raise exception using errcode='42501',message='support capability required';end if;
 target:=case when admin then p_target_user_id else u end;
 if target is null then raise exception using errcode='42501',message='support owner required';end if;
 -- Serialize only support operations. Never acquire a player/profile/outbox lock.
 perform pg_advisory_xact_lock(574,hashtext(target::text));
 select * into c from lumen_commands.support_cases where user_id=target order by activated_at desc limit 1 for update;
 if p_action='revoke' then
  update lumen_commands.support_cases set revoked_at=coalesce(revoked_at,clock_timestamp()),purged_at=clock_timestamp() where user_id=u;
  delete from lumen_commands.support_captures where case_id in(select id from lumen_commands.support_cases where user_id=u);
  return jsonb_build_object('state','deleted');
 end if;
 if not coalesce((select enabled from lumen_commands.support_control where singleton),false) then return jsonb_build_object('state','unavailable');end if;
 if p_action='activate' and (c.id is null or c.revoked_at is not null or c.expires_at<=clock_timestamp()) then
  if (select count(*) from lumen_commands.support_cases where user_id=u and activated_at>clock_timestamp()-interval '1 day')>=3
   then raise exception using errcode='54000',message='support activation budget';end if;
  insert into lumen_commands.support_cases(user_id) values(u) returning * into c;
 end if;
 if p_action in ('status','activate') then
  return jsonb_build_object('id',c.id,'state',case when c.id is null or c.revoked_at is not null then 'disabled' when c.expires_at<=clock_timestamp() then 'expired' else 'active' end,
   'activated_at',c.activated_at,'expires_at',c.expires_at,'last_received_at',(select max(received_at) from lumen_commands.support_captures where case_id=c.id));
 end if;
 if p_action='capture' then
  if c.id is distinct from p_case_id or c.revoked_at is not null or c.expires_at<=clock_timestamp() or p_capture_id is null
   then raise exception using errcode='42501',message='support consent expired or revoked';end if;
  perform lumen_commands.validate_support(p_payload);
  digest:=encode(sha256(convert_to(p_payload::text,'UTF8')),'hex');
  select * into t from lumen_commands.support_captures where id=p_capture_id;
  if found then
   if t.case_id<>c.id or t.sha256<>digest then raise exception using errcode='22023',message='support identity conflict';end if;
  else
   -- Global lock also bounds concurrent callers and reactivations.
   perform 1 from lumen_commands.support_control where singleton for update;
   select count(*) into n from lumen_commands.support_captures sc join lumen_commands.support_cases cs on cs.id=sc.case_id where cs.user_id=u;
   select coalesce(sum(bytes),0) into total from lumen_commands.support_captures;
   if n>=8 or total+octet_length(p_payload::text)>33554432 or
    exists(select 1 from lumen_commands.support_captures where case_id=c.id and received_at>clock_timestamp()-interval '1 minute')
    then raise exception using errcode='54000',message='support capture budget';end if;
   insert into lumen_commands.support_captures(id,case_id,bytes,sha256,code) values(p_capture_id,c.id,octet_length(p_payload::text),digest,p_payload->>'code') returning * into t;
   insert into lumen_commands.support_contents values(t.id,p_payload);
  end if;
  return jsonb_build_object('capture_id',t.id,'received_at',t.received_at,'sha256',t.sha256,'bytes',t.bytes);
 end if;
 if c.id is null then return jsonb_build_object('state','disabled','captures','[]'::jsonb);end if;
 if p_action<>'list' and c.id is distinct from p_case_id then raise exception using errcode='42501',message='support case mismatch';end if;
 if p_action='purge' then
  delete from lumen_commands.support_captures where case_id in(select id from lumen_commands.support_cases where user_id=target);
  update lumen_commands.support_cases set revoked_at=coalesce(revoked_at,clock_timestamp()),purged_at=clock_timestamp() where user_id=target;
  insert into lumen_commands.support_access(actor,case_id,action) values(u,c.id,'purge');
  return jsonb_build_object('state','deleted');
 end if;
 if p_action='download' then
  if c.revoked_at is not null or c.activated_at<clock_timestamp()-interval '7 days' then raise exception using errcode='42501',message='support case unavailable';end if;
  select jsonb_build_object('reference',c.id,'captures',coalesce(jsonb_agg(jsonb_build_object('id',sc.id,'received_at',sc.received_at,'sha256',sc.sha256,'bytes',sc.bytes,'content',s.payload::text) order by sc.received_at),'[]'::jsonb)) into result
   from lumen_commands.support_captures sc join lumen_commands.support_contents s on s.capture_id=sc.id where sc.case_id=c.id;
 else
  select jsonb_build_object('id',c.id,'state',case when c.revoked_at is not null then 'deleted' when c.expires_at<=clock_timestamp() then 'expired' else 'active' end,
   'activated_at',c.activated_at,'expires_at',c.expires_at,'last_viewed_at',c.last_viewed_at,'purged_at',c.purged_at,
   'captures',coalesce(jsonb_agg(jsonb_build_object('id',sc.id,'received_at',sc.received_at,'bytes',sc.bytes,'sha256',sc.sha256,'code',sc.code) order by sc.received_at) filter(where sc.id is not null),'[]'::jsonb)) into result
   from lumen_commands.support_captures sc where sc.case_id=c.id;
 end if;
 insert into lumen_commands.support_access(actor,case_id,action) values(u,c.id,p_action);
 update lumen_commands.support_cases set last_viewed_at=clock_timestamp() where id=c.id;
 return result;
end $$;
revoke all on function lumen_commands.support(uuid,text,uuid,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function lumen_commands.support(uuid,text,uuid,uuid,jsonb,uuid) to authenticated;
create function public.lumen_support(p_expected_user_id uuid,p_action text,p_case_id uuid default null,p_capture_id uuid default null,p_payload jsonb default null,p_target_user_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$
 select lumen_commands.support(p_expected_user_id,p_action,p_case_id,p_capture_id,p_payload,p_target_user_id);
$$;
revoke all on function public.lumen_support(uuid,text,uuid,uuid,jsonb,uuid) from public,anon;
grant execute on function public.lumen_support(uuid,text,uuid,uuid,jsonb,uuid) to authenticated;

create function lumen_commands.prune_support() returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 -- Same case lock as uploads/revocation; a racing upload cannot resurrect a case.
 perform pg_advisory_xact_lock(574,hashtext(user_id::text)) from
  (select distinct user_id from lumen_commands.support_cases where activated_at<clock_timestamp()-interval '6 days' order by user_id) expired;
 delete from lumen_commands.support_cases where activated_at<clock_timestamp()-interval '6 days';
 get diagnostics n=row_count;
 delete from lumen_commands.support_access where occurred_at<clock_timestamp()-interval '7 days';
 return n;
end $$;
revoke all on function lumen_commands.prune_support() from public,anon,authenticated;
-- Reuse #398's existing daily job; fail if its reviewed hook has changed.
do $$declare d text;begin
 select pg_get_functiondef('lumen_commands.prune_sync_observations()'::regprocedure) into d;
 if position('return v_count+' in d)=0 then raise exception 'review support purge hook';end if;
 execute replace(d,'return v_count+','return v_count+lumen_commands.prune_support()+');
end $$;
notify pgrst,'reload schema';
