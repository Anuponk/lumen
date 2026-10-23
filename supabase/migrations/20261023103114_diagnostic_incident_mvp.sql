-- #534: optional incident detail stream complements #398's live projections.
-- No profile/save/receipt reads or mutations. Reuse its capability and cron.
create table lumen_commands.diagnostic_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null, purpose text not null default '534-v1',
 updated_at timestamptz not null default clock_timestamp()
);
create table lumen_commands.diagnostic_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id uuid not null,session_id uuid not null,trace_id uuid not null,
 sequence integer not null,occurred_at timestamptz not null,
 received_at timestamptz not null default clock_timestamp(),
 code text not null,stage text not null,kind text not null,severity text not null,
 platform text not null,browser text not null,app_version text not null,
 before_state text not null,after_state text not null,retry integer not null,
 signature text not null,primary key(user_id,event_id)
);
create index diagnostic_retention_idx on lumen_commands.diagnostic_events(received_at);
create index diagnostic_trace_idx on lumen_commands.diagnostic_events(trace_id,sequence);
create table lumen_commands.diagnostic_budgets (
 lane text not null,subject text not null,day date not null,
 events integer not null default 0,calls integer not null default 0,
 minute timestamptz not null,minute_calls integer not null default 0,
 primary key(lane,subject,day)
);
create index diagnostic_budget_retention_idx on lumen_commands.diagnostic_budgets(day);
alter table lumen_commands.diagnostic_preferences enable row level security;
alter table lumen_commands.diagnostic_events enable row level security;
alter table lumen_commands.diagnostic_budgets enable row level security;
revoke all on lumen_commands.diagnostic_preferences,lumen_commands.diagnostic_events,lumen_commands.diagnostic_budgets from public,anon,authenticated;

create function lumen_commands.diagnostic_budget(p_uid uuid,p_lane text,p_events integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare u lumen_commands.diagnostic_budgets;g lumen_commands.diagnostic_budgets;
 d date:=(clock_timestamp() at time zone 'UTC')::date;m timestamptz:=date_trunc('minute',clock_timestamp());
 cap integer:=case when p_lane='details' then 5000 else 20000 end;
begin
 if p_uid is null or p_lane not in ('details','health') or p_events not between 0 and 10 then return false;end if;
 insert into lumen_commands.diagnostic_budgets(lane,subject,day,minute)
 values(p_lane,p_uid::text,d,m),(p_lane,'global',d,m) on conflict do nothing;
 -- Every ingestion locks its account then the same global row; no profile lock.
 select * into u from lumen_commands.diagnostic_budgets where lane=p_lane and subject=p_uid::text and day=d for update;
 if u.calls>=120 or u.events+p_events>200 or (u.minute=m and u.minute_calls>=10) then return false;end if;
 select * into g from lumen_commands.diagnostic_budgets where lane=p_lane and subject='global' and day=d for update;
 if g.events+p_events>cap or g.calls>=20000 then return false;end if;
 update lumen_commands.diagnostic_budgets set calls=calls+1,events=events+p_events,
  minute=m,minute_calls=case when minute=m then minute_calls+1 else 1 end
 where lane=p_lane and day=d and subject in (p_uid::text,'global');
 return true;
end $$;
revoke all on function lumen_commands.diagnostic_budget(uuid,text,integer) from public,anon,authenticated;

create function lumen_commands.diagnostic_preference(p_enabled boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p lumen_commands.diagnostic_preferences;
begin
 if u is null then raise exception using errcode='42501',message='not authenticated';end if;
 if p_enabled is not null then
  insert into lumen_commands.diagnostic_preferences(user_id,enabled) values(u,p_enabled)
  on conflict(user_id) do update set enabled=excluded.enabled,
   updated_at=case when lumen_commands.diagnostic_preferences.enabled is distinct from excluded.enabled then clock_timestamp() else lumen_commands.diagnostic_preferences.updated_at end;
  if not p_enabled then delete from lumen_commands.diagnostic_events where user_id=u;end if;
 end if;
 select * into p from lumen_commands.diagnostic_preferences where user_id=u;
 return jsonb_build_object('enabled',coalesce(p.enabled,false),'since',p.updated_at,'purpose','534-v1');
end $$;
create function public.lumen_diagnostic_preference(p_enabled boolean default null) returns jsonb
language sql security invoker set search_path='' as $$select lumen_commands.diagnostic_preference(p_enabled)$$;
revoke all on function lumen_commands.diagnostic_preference(boolean),public.lumen_diagnostic_preference(boolean) from public,anon;
grant execute on function lumen_commands.diagnostic_preference(boolean),public.lumen_diagnostic_preference(boolean) to authenticated;

create function lumen_commands.record_diagnostics(p_expected_user_id uuid,p_events jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();consent lumen_commands.diagnostic_preferences;e jsonb;
 accepted jsonb:='[]';event_uuid uuid;s uuid;t uuid;seq integer;observed timestamptz;
 c text;st text;k text;plat text;br text;v text;b text;a text;r integer;sig text;
 prior lumen_commands.diagnostic_events;new_count integer:=0;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception using errcode='42501',message='diagnostic account changed';end if;
 if jsonb_typeof(p_events) is distinct from 'array' or octet_length(p_events::text)>8192
 then raise exception using errcode='22023',message='invalid diagnostic batch';end if;
 if jsonb_array_length(p_events) not between 1 and 10 then raise exception using errcode='22023',message='invalid diagnostic batch';end if;
 -- Lock consent until commit: withdrawal cannot race an in-flight insertion.
 select * into consent from lumen_commands.diagnostic_preferences where user_id=u for update;
 if not coalesce(consent.enabled,false) then return jsonb_build_object('disabled',true,'accepted','[]'::jsonb);end if;
 for e in select value from jsonb_array_elements(p_events) loop
  begin
   if jsonb_typeof(e)<>'object' or not e ?& array['id','session','trace','seq','at','code','stage','kind','platform','browser','version','before','after','retry']
    or exists(select 1 from jsonb_object_keys(e) key where key not in ('id','session','trace','seq','at','code','stage','kind','platform','browser','version','before','after','retry'))
    or coalesce(e->>'id','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or coalesce(e->>'session','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or coalesce(e->>'trace','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    or coalesce(e->>'at','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9:.]+(Z|[+-][0-9:]+)$'
    or coalesce(e->>'seq','') !~ '^[0-9]{1,5}$' or coalesce(e->>'retry','') !~ '^[0-5]$'
   then raise exception 'invalid';end if;
   c:=e->>'code';st:=e->>'stage';k:=e->>'kind';plat:=e->>'platform';br:=e->>'browser';v:=e->>'version';b:=e->>'before';a:=e->>'after';
   if coalesce(c,'') not in ('sync_write_failed','sync_conflict','sync_retry','hydration_failed','hydration_blocked','outbox_read_failed','outbox_retry_failed','outbox_capture_failed','outbox_retried','outbox_acknowledged','runtime_exception','unhandled_rejection','resource_failed','guided_error','guided_undo','guided_input_blocked','guided_input_released')
    or coalesce(st,'') not in ('sync_write','reconciliation','cloud_initialize','daily_read','wallet_receipt_readback','achievement_backup','achievement_install','achievement_rollback','legacy_mirror','outbox_capture','outbox_read','outbox_retry','guided','runtime','unknown')
    or coalesce(k,'') not in ('quota','storage','network','auth','conflict','unknown')
    or coalesce(plat,'') not in ('android-pwa','android-web','desktop','other')
    or coalesce(br,'') not in ('chromium','firefox','safari','other')
    or coalesce(v,'') !~ '^(unknown|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9})$'
    or coalesce(b,'') not in ('ready','blocked','unknown') or coalesce(a,'') not in ('ready','blocked','unknown')
   then raise exception 'invalid';end if;
   event_uuid:=(e->>'id')::uuid;s:=(e->>'session')::uuid;t:=(e->>'trace')::uuid;
   seq:=(e->>'seq')::integer;r:=(e->>'retry')::integer;observed:=(e->>'at')::timestamptz;
   if seq<1 or seq>10000 or observed>clock_timestamp()+interval '5 minutes' or observed<clock_timestamp()-interval '24 hours' then raise exception 'invalid';end if;
  exception when others then raise exception using errcode='22023',message='invalid diagnostic event';end;
  -- Discard acknowledged stale queues from before a fresh opt-in, never replay them.
  if observed<consent.updated_at then accepted:=accepted||jsonb_build_array(event_uuid);continue;end if;
  sig:=md5(jsonb_build_array(c,st,k,plat,br,v,b,a)::text);
  select * into prior from lumen_commands.diagnostic_events where user_id=u and event_id=event_uuid;
  if found then
   if (prior.signature,prior.session_id,prior.trace_id,prior.sequence,prior.occurred_at,prior.retry) is distinct from (sig,s,t,seq,observed,r)
   then raise exception using errcode='22023',message='diagnostic identity changed';end if;
  else new_count:=new_count+1;end if;
  accepted:=accepted||jsonb_build_array(event_uuid);
 end loop;
 if not lumen_commands.diagnostic_budget(u,'details',new_count) then return jsonb_build_object('limited',true,'accepted','[]'::jsonb);end if;
 for e in select value from jsonb_array_elements(p_events) loop
  observed:=(e->>'at')::timestamptz;if observed<consent.updated_at then continue;end if;
  c:=e->>'code';
  insert into lumen_commands.diagnostic_events(user_id,event_id,session_id,trace_id,sequence,occurred_at,code,stage,kind,severity,platform,browser,app_version,before_state,after_state,retry,signature)
  values(u,(e->>'id')::uuid,(e->>'session')::uuid,(e->>'trace')::uuid,(e->>'seq')::integer,observed,c,e->>'stage',e->>'kind',
   case when c in ('guided_undo','guided_input_released','sync_retry','outbox_retried','outbox_acknowledged') then 'info' when c='guided_error' then 'warning' else 'error' end,
   e->>'platform',e->>'browser',e->>'version',e->>'before',e->>'after',(e->>'retry')::integer,
   md5(jsonb_build_array(c,e->>'stage',e->>'kind',e->>'platform',e->>'browser',e->>'version',e->>'before',e->>'after')::text))
  on conflict(user_id,event_id) do nothing;
 end loop;
 return jsonb_build_object('accepted',accepted,'limited',false);
end $$;
create function public.lumen_record_diagnostics(p_expected_user_id uuid,p_events jsonb) returns jsonb
language sql security invoker set search_path='' as $$select lumen_commands.record_diagnostics(p_expected_user_id,p_events)$$;
revoke all on function lumen_commands.record_diagnostics(uuid,jsonb),public.lumen_record_diagnostics(uuid,jsonb) from public,anon;
grant execute on function lumen_commands.record_diagnostics(uuid,jsonb),public.lumen_record_diagnostics(uuid,jsonb) to authenticated;

-- #398 compatibility: close direct-table bypass, keep the public signature and
-- the original live incident algorithm. No raw provider text or version persists.
revoke insert on public.lumen_sync_health from authenticated;
revoke usage on sequence public.lumen_sync_health_id_seq from authenticated;
create function lumen_commands.record_sync_health(p_event text,p_reason text,p_outcome text,p_version text) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();last_event text;begin
 if u is null then raise exception using errcode='42501',message='not authenticated';end if;
 if p_event is null or p_event not in ('hydration_failed','hydration_ready','hydration_reconciliation') then raise exception using errcode='22023',message='invalid health event';end if;
 -- A noisy failure stream must not prevent a real recovery from closing #398.
 -- Coalesce ready/ready; allow one ready after a failure even at quota. Each
 -- extra recovery requires an accepted failure, rather than an unbounded lane.
 perform pg_advisory_xact_lock(hashtextextended('lumen-health:'||u::text,0));
 select event into last_event from public.lumen_sync_health where user_id=u order by recorded_at desc,id desc limit 1;
 if p_event='hydration_ready' and last_event='hydration_ready' then return;end if;
 if not lumen_commands.diagnostic_budget(u,'health',1) and p_event<>'hydration_ready' then return;end if;
 if p_reason is not null and p_reason not in ('network','mutable_balance','mutable_ledger','invalid_balance','invalid_wallet_revision','stale_wallet_revision','reward_conflict','canonical_reward_conflict','local_divergence','cloud_local_divergence','legacy_command_required','storage_quota','storage_unavailable','storage_failed','backup_unverified','local_install_unverified','unclassified_field','unknown','cloud_initialize','daily_read','wallet_receipt_readback','achievement_backup','achievement_install','achievement_rollback','legacy_mirror') then p_reason:='unknown';end if;
 if p_outcome is not null and p_outcome not in ('blocked','merged','covered','unchanged','ready','partial','resolved') then p_outcome:='unknown';end if;
 if p_version is null or p_version !~ '^([Vv]ersion[ ]+)?[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9}([ .·-]+[0-9a-f]{7,40})?$' then p_version:='unknown';end if;
 insert into public.lumen_sync_health(user_id,event,reason,outcome,app_version) values(u,p_event,p_reason,p_outcome,p_version);
end $$;
create or replace function public.lumen_record_sync_health(p_event text,p_reason text default null,p_outcome text default null,p_version text default null)
returns void language sql security invoker set search_path='' as $$select lumen_commands.record_sync_health(p_event,p_reason,p_outcome,p_version)$$;
revoke all on function lumen_commands.record_sync_health(text,text,text,text) from public,anon;
grant execute on function lumen_commands.record_sync_health(text,text,text,text) to authenticated;

-- Called only from the already capability-guarded #398 cockpit. No account IDs.
create function lumen_commands.diagnostic_summary(p_days integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 with recent as (select * from lumen_commands.diagnostic_events
  where received_at>=now()-make_interval(days=>least(greatest(coalesce(p_days,7),1),7)))
 select jsonb_build_object('sample','opt-in, incomplete','events',(select count(*) from recent),
  'sessions',(select count(distinct session_id) from recent),
  'signatures',(select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) from
   (select signature,code,stage,severity,app_version,platform,browser,count(*) as occurrences,count(distinct session_id) as sessions,
    min(occurred_at) as first_at,max(occurred_at) as last_at
    from recent group by signature,code,stage,severity,app_version,platform,browser order by count(*) desc,signature limit 30)g),
  'timeline',(select coalesce(jsonb_agg(to_jsonb(t) order by t.received_at,t.sequence),'[]'::jsonb) from
   (select session_id,trace_id,sequence,occurred_at,received_at,code,stage,kind,severity,app_version,platform,browser,before_state,after_state,retry
    from recent order by received_at desc,sequence desc limit 100)t));
$$;
revoke all on function lumen_commands.diagnostic_summary(integer) from public,anon,authenticated;
do $$declare d text;begin
 select pg_get_functiondef('public.lumen_admin_sync_health(integer)'::regprocedure) into d;
 if position('jsonb_build_object(''outbox'',lumen_commands.outbox_health_summary())' in d)=0 then raise exception 'review changed #398 cockpit';end if;
 execute replace(d,'jsonb_build_object(''outbox'',lumen_commands.outbox_health_summary())',
  'jsonb_build_object(''outbox'',lumen_commands.outbox_health_summary(),''diagnostics'',lumen_commands.diagnostic_summary(p_days))');
end $$;

create function lumen_commands.prune_diagnostics() returns bigint
language plpgsql security invoker set search_path='' as $$
declare n bigint;begin
 delete from lumen_commands.diagnostic_events where (user_id,event_id) in
  (select user_id,event_id from lumen_commands.diagnostic_events where received_at<now()-interval '7 days' order by received_at limit 20000);get diagnostics n=row_count;
 delete from lumen_commands.diagnostic_budgets where (lane,subject,day) in
  (select lane,subject,day from lumen_commands.diagnostic_budgets where day<(now() at time zone 'UTC')::date-1 order by day limit 20000);
 -- Retain all unresolved health history and the last ready anchor; only resolved
 -- old history is eligible. Never touch profiles, outboxes or immutable receipts.
 delete from public.lumen_sync_health where id in
  (select h.id from public.lumen_sync_health h where h.recorded_at<now()-interval '30 days'
   and exists(select 1 from public.lumen_sync_health r where r.user_id=h.user_id and r.event='hydration_ready' and (r.recorded_at,r.id)>(h.recorded_at,h.id)) order by h.recorded_at limit 20000);
 return n;
end $$;
revoke all on function lumen_commands.prune_diagnostics() from public,anon,authenticated;
do $$declare d text;begin
 select pg_get_functiondef('lumen_commands.prune_sync_observations()'::regprocedure) into d;
 if position('return v_count;' in d)=0 then raise exception 'review changed #398 retention';end if;
 execute replace(d,'return v_count;','return v_count+lumen_commands.prune_diagnostics();');
end $$;
notify pgrst,'reload schema';
