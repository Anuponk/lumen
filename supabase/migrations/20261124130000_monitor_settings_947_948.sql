-- #947/#948 (EPIC #946): supervision tuned for Lumen's real, small population.
-- Additive and idempotent. No player data is read beyond the existing monitors.
--  * lumen_ops.monitor_settings: one row of thresholds an admin changes without a
--    redeploy (lumen_admin_set_monitor_settings), bounded by CHECK constraints.
--  * #947: a hydration failure counts as an ACTIVE incident only when it happened
--    in the last hydration_active_hours (default 24 h) and was not followed by a
--    successful hydration. Older unresolved failures (accounts that never came
--    back) were kept open forever; they stay visible in the cockpit history.
--  * #948: performance is compared by PERIOD, not by single version: the recent
--    window (perf_recent_days, default 3) against the rest of the 14-day retention,
--    because Lumen ships several builds a day with about one account each. An alert
--    needs perf_min_accounts distinct accounts on BOTH sides (default 5) and the
--    existing ratio/absolute floors; each comparison carries a confidence level.
-- Function signatures are unchanged, so callers (cockpit snapshot, workers) keep working.
begin;

create table if not exists lumen_ops.monitor_settings (
 id boolean primary key default true check (id),
 hydration_active_hours integer not null default 24 check (hydration_active_hours between 1 and 720),
 perf_min_accounts integer not null default 5 check (perf_min_accounts between 3 and 200),
 perf_ratio numeric not null default 1.5 check (perf_ratio between 1.1 and 5),
 perf_recent_days integer not null default 3 check (perf_recent_days between 1 and 7),
 updated_at timestamptz not null default now()
);
alter table lumen_ops.monitor_settings enable row level security;
revoke all on lumen_ops.monitor_settings from public,anon,authenticated,service_role;
insert into lumen_ops.monitor_settings(id) values (true) on conflict do nothing;

-- low: below the alert floor (never alerts) · medium: floor reached · high: twice the floor.
create or replace function lumen_ops.performance_confidence(p_samples integer,p_reference integer)
returns text language sql stable set search_path='' as $$
 select case
  when least(coalesce(p_samples,0),coalesce(p_reference,0))>=2*s.perf_min_accounts then 'high'
  when least(coalesce(p_samples,0),coalesce(p_reference,0))>=s.perf_min_accounts then 'medium'
  else 'low' end
 from lumen_ops.monitor_settings s where s.id
$$;
revoke all on function lumen_ops.performance_confidence(integer,integer) from public,anon,authenticated,service_role;

-- p_min is kept for compatibility; the floor now comes from monitor_settings.
create or replace function lumen_ops.performance_comparison(p_min integer)
returns table(version text,reference text, platform text,browser text,network text,metric text,
 samples integer,reference_samples integer,p90 integer,reference_p90 integer,regression boolean)
language sql stable set search_path='' as $$
 with s as (select * from lumen_ops.monitor_settings where id),
 measured as (
  select case when x.recorded_at>=now()-make_interval(days=>s.perf_recent_days) then 'recent' else 'reference' end as period,
   x.version,x.build,x.platform,x.browser,x.network,m.key as metric,x.owner_id,(m.value::text)::numeric as value
  from lumen_commands.performance_samples x cross join s cross join lateral jsonb_each(x.metrics) m
  where x.recorded_at>=now()-interval '14 days'
 ), grouped as (
  select period,platform,browser,network,metric,
   (array_agg(version order by build desc,version desc))[1] as version,
   count(distinct owner_id)::integer as samples,
   round(percentile_cont(0.9) within group (order by value)::numeric)::integer as p90
  from measured group by period,platform,browser,network,metric
 )
 select c.version,r.version,c.platform,c.browser,c.network,c.metric,c.samples,r.samples,c.p90,r.p90,
  coalesce(c.samples>=s.perf_min_accounts and r.samples>=s.perf_min_accounts and c.p90>=r.p90*s.perf_ratio
   and c.p90-r.p90>=case c.metric when 'load' then 250 when 'cloud_rpc' then 100 when 'sync_rpc' then 100
                      when 'long_task' then 35 when 'grid_input' then 25 else 15 end,false)
 from grouped c cross join s left join grouped r on r.period='reference'
  and (r.platform,r.browser,r.network,r.metric)=(c.platform,c.browser,c.network,c.metric)
 where c.period='recent'
$$;
revoke all on function lumen_ops.performance_comparison(integer) from public,anon,authenticated,service_role;

create or replace function lumen_ops.hydration_error_comparison()
returns jsonb language sql stable set search_path='' as $$
 with s as (select * from lumen_ops.monitor_settings where id),
 events as (
  select case when h.recorded_at>=now()-make_interval(days=>s.perf_recent_days) then 'recent' else 'reference' end as period,
   split_part(h.app_version,' ',1) as version,h.user_id,h.event
  from public.lumen_sync_health h join auth.users u on u.id=h.user_id cross join s
  where h.recorded_at>=now()-interval '14 days'
  and h.event in ('hydration_ready','hydration_failed') and lumen_ops.activity_player(u)
  and split_part(h.app_version,' ',1) ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9}$'
 ), periods as (
  select period,
   (array_agg(version order by split_part(version,'+',2)::integer desc,version desc))[1] as version,
   count(distinct user_id)::integer as samples,
   round(10000.0*count(*) filter(where event='hydration_failed')/count(*))::integer as rate
  from events group by period
 )
 select jsonb_build_object('version',c.version,'reference',r.version,'samples',c.samples,
  'reference_samples',r.samples,'metric','hydration_error_rate','rate',c.rate,'reference_rate',r.rate,
  'regression',true,'confidence',lumen_ops.performance_confidence(c.samples,r.samples))
 from periods c join periods r on r.period='reference' cross join s
 where c.period='recent' and c.samples>=s.perf_min_accounts and r.samples>=s.perf_min_accounts
  and c.rate-r.rate>=500 and c.rate>=r.rate*s.perf_ratio
$$;
revoke all on function lumen_ops.hydration_error_comparison() from public,anon,authenticated,service_role;

create or replace function public.lumen_admin_performance_health()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform lumen_ops.require_incident_admin();
 return (select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('confidence',
   lumen_ops.performance_confidence(x.samples,x.reference_samples))),'[]'::jsonb) from (
  select * from lumen_ops.performance_comparison(null) order by regression desc,samples desc,metric,platform,browser,network limit 50
 ) x);
end $$;
revoke all on function public.lumen_admin_performance_health() from public,anon;
grant execute on function public.lumen_admin_performance_health() to authenticated;

create or replace function public.lumen_observe_performance()
returns integer language plpgsql security definer set search_path='' as $$
declare queued integer; rate jsonb;
begin
 if not pg_try_advisory_xact_lock(948,1) then return 0; end if;
 perform lumen_ops.prune_performance_samples();
 insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload)
 select null,'performance_regression',concat_ws(':',c.version,c.reference,c.platform,c.browser,c.network,c.metric),
  to_jsonb(c) || jsonb_build_object('event_at',now(),'severity','P1',
   'confidence',lumen_ops.performance_confidence(c.samples,c.reference_samples))
 from lumen_ops.performance_comparison(null) c
 where c.regression
 and not exists(select 1 from lumen_commands.activity_mail m where m.kind='performance_regression'
   and m.source_id=concat_ws(':',c.version,c.reference,c.platform,c.browser,c.network,c.metric))
 order by c.p90-c.reference_p90 desc,c.metric,c.platform,c.browser,c.network limit 10
 on conflict on constraint activity_mail_source_unique do nothing;
 get diagnostics queued=row_count;
 rate:=lumen_ops.hydration_error_comparison();
 if rate is not null then
  insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload)
  select null,'performance_regression',concat_ws(':',rate->>'version',rate->>'reference','hydration_error_rate'),
   rate || jsonb_build_object('event_at',now(),'severity','P1')
  where not exists(select 1 from lumen_commands.activity_mail m where m.kind='performance_regression'
   and m.source_id=concat_ws(':',rate->>'version',rate->>'reference','hydration_error_rate'))
  on conflict on constraint activity_mail_source_unique do nothing;
  if found then queued:=queued+1;end if;
 end if;
 return queued;
end $$;
revoke all on function public.lumen_observe_performance() from public,anon,authenticated;
grant execute on function public.lumen_observe_performance() to service_role;

create or replace function public.lumen_observe_critical_incidents(
 p_sample bigint,p_probe_ok boolean,p_stall_minutes integer default 15,
 p_failures integer default 3,p_recoveries integer default 2,p_backlog integer default 20)
returns boolean language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz; active_since timestamptz; hydration integer; outbox integer; backlog integer; unverified_outbox boolean;
begin
 if p_sample is null or p_sample<1 or p_probe_ok is null
  or p_stall_minutes is null or p_stall_minutes not between 5 and 240
  or p_failures is null or p_failures not between 2 and 10
  or p_recoveries is null or p_recoveries not between 2 and 10
  or p_backlog is null or p_backlog not between 3 and 200 then
  raise exception using errcode='22023',message='invalid incident observation';
 end if;
 if not pg_try_advisory_xact_lock(947,1) then return false; end if;
 if exists(select 1 from lumen_ops.critical_incidents s where s.signature='availability' and s.sample>=p_sample) then
  return true;
 end if;

 cutoff := now()-make_interval(mins=>p_stall_minutes);
 -- #947: only recent unresolved failures are an active incident.
 select now()-make_interval(hours=>s.hydration_active_hours) into active_since
 from lumen_ops.monitor_settings s where s.id;
 select count(distinct h.user_id)::integer into hydration
 from public.lumen_sync_health h join auth.users u on u.id=h.user_id
 where h.recorded_at<=cutoff and h.recorded_at>=active_since and lumen_ops.activity_player(u)
  and (h.event='hydration_failed' or (h.event='hydration_reconciliation' and h.outcome='blocked'))
  and coalesce(h.reason,'unknown') not in ('network','offline')
  and not exists(select 1 from public.lumen_sync_health ready
   where ready.user_id=h.user_id and ready.event='hydration_ready'
     and (ready.recorded_at,ready.id)>(h.recorded_at,h.id));
 select count(distinct o.user_id) filter (where o.state in ('critical','review')
                            or (o.state='pending' and o.pending>0 and o.failures>=3))::integer,
        count(distinct o.user_id) filter (where o.state='pending' and o.failures<3 and o.pending>=p_backlog)::integer,
        coalesce(bool_or(o.state='auth' and o.pending>0),false)
   into outbox,backlog,unverified_outbox
 from lumen_commands.outbox_health o join auth.users u on u.id=o.user_id
 where o.oldest_pending_at<=cutoff and o.state in ('pending','critical','review','auth')
   and lumen_ops.activity_player(u);

 -- A payment alarm recovers only when the paid product's rights can be read back.
 insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload)
 select m.owner_id,'purchase_access_restored',m.source_id,
   m.payload || jsonb_build_object('access','verified','event_at',now())
 from lumen_commands.activity_mail m
 join lumen_commands.purchases p on p.id::text=m.source_id and p.user_id=m.owner_id and p.status='paid'
 join lumen_commands.store_products product on product.product_id=p.product_id
 where m.kind='purchase_missing_access'
   and not exists(select 1 from lumen_commands.activity_mail cleared
     where cleared.kind='purchase_access_restored' and cleared.source_id=m.source_id)
   and not exists(select 1 from lumen_commands.adventure_packs a
     where a.access='locked' and (a.pack_id=product.pack_id or
       (product.kind in ('sky','sky_upgrade') and a.pack_id ~ '^real-adventure-0[2-9]$'))
     and not exists(select 1 from lumen.entitlements e where e.user_id=m.owner_id and e.entitlement=a.pack_id
       and (e.expires_at is null or e.expires_at>now())))
 order by m.observed_at,m.id limit 100
 on conflict on constraint activity_mail_source_unique do nothing;

 perform lumen_ops.observe_incident('availability',p_sample,case when p_probe_ok then 0 else 1 end,p_failures,p_recoveries);
 perform lumen_ops.observe_incident('hydration',p_sample,hydration,1,p_recoveries);
 perform lumen_ops.observe_incident('outbox',p_sample,case when outbox=0 and unverified_outbox then null else outbox end,1,p_recoveries);
 perform lumen_ops.observe_incident('backlog',p_sample,backlog,p_failures,p_recoveries);
 return true;
end $$;
revoke all on function public.lumen_observe_critical_incidents(bigint,boolean,integer,integer,integer,integer)
 from public,anon,authenticated;
grant execute on function public.lumen_observe_critical_incidents(bigint,boolean,integer,integer,integer,integer)
 to service_role;

-- Admin read/write of the thresholds (analytics_cockpit capability), no redeploy.
create or replace function public.lumen_admin_monitor_settings()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform lumen_ops.require_incident_admin();
 return (select to_jsonb(s)-'id' from lumen_ops.monitor_settings s where s.id);
end $$;
revoke all on function public.lumen_admin_monitor_settings() from public,anon;
grant execute on function public.lumen_admin_monitor_settings() to authenticated;

create or replace function public.lumen_admin_set_monitor_settings(
 p_hydration_active_hours integer default null,p_perf_min_accounts integer default null,
 p_perf_ratio numeric default null,p_perf_recent_days integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform lumen_ops.require_incident_admin();
 update lumen_ops.monitor_settings s set
  hydration_active_hours=coalesce(p_hydration_active_hours,s.hydration_active_hours),
  perf_min_accounts=coalesce(p_perf_min_accounts,s.perf_min_accounts),
  perf_ratio=coalesce(p_perf_ratio,s.perf_ratio),
  perf_recent_days=coalesce(p_perf_recent_days,s.perf_recent_days),
  updated_at=now()
 where s.id;
 return (select to_jsonb(s)-'id' from lumen_ops.monitor_settings s where s.id);
end $$;
revoke all on function public.lumen_admin_set_monitor_settings(integer,integer,numeric,integer) from public,anon;
grant execute on function public.lumen_admin_set_monitor_settings(integer,integer,numeric,integer) to authenticated;

notify pgrst,'reload schema';
commit;
