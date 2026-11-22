begin;

create table if not exists lumen_commands.performance_samples (
 owner_id uuid not null references auth.users(id) on delete cascade,
 sample_day date not null,
 recorded_at timestamptz not null default now(),
 version text not null,
 build integer not null,
 platform text not null,
 browser text not null,
 network text not null,
 metrics jsonb not null,
 primary key(owner_id,sample_day)
);
alter table lumen_commands.performance_samples enable row level security;
revoke all on lumen_commands.performance_samples from public,anon,authenticated,service_role;
create index if not exists performance_samples_recorded_idx on lumen_commands.performance_samples(recorded_at);

create or replace function public.lumen_record_performance_sample(
 p_version text,p_platform text,p_browser text,p_network text,p_metrics jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid();
begin
 if owner is null or not exists (
  select 1 from lumen_commands.diagnostic_preferences d join auth.users u on u.id=d.user_id
  where d.user_id=owner and d.enabled and lumen_ops.activity_player(u) for share of d
 ) then return false; end if;
 if p_version is null or p_version !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9}$'
  or p_platform is null or p_platform not in ('android-twa','android-pwa','android-web','desktop','other')
  or p_browser is null or p_browser not in ('chromium','firefox','safari','other')
  or p_network is null or p_network not in ('slow-2g','2g','3g','4g','unknown')
  or jsonb_typeof(p_metrics) is distinct from 'object' or octet_length(p_metrics::text)>240
  or p_metrics='{}'::jsonb then return false; end if;
 if exists(select 1 from jsonb_each(p_metrics) e where
  e.key not in ('load','grid_render','grid_input','long_task','victory_gap','cloud_rpc','sync_rpc')
  or case when jsonb_typeof(e.value)='number' then (e.value::text)::numeric not between 1 and 60000 else true end
 ) then return false; end if;
 -- One attempted write per opted-in account and UTC day. No raw URL/session/input.
 insert into lumen_commands.performance_samples(owner_id,sample_day,version,build,platform,browser,network,metrics)
 values(owner,(now() at time zone 'UTC')::date,p_version,split_part(p_version,'+',2)::integer,p_platform,p_browser,p_network,p_metrics)
 on conflict do nothing;
 return found;
end $$;
revoke all on function public.lumen_record_performance_sample(text,text,text,text,jsonb) from public,anon;
grant execute on function public.lumen_record_performance_sample(text,text,text,text,jsonb) to authenticated;

create or replace function lumen_ops.performance_comparison(p_min integer)
returns table(version text,reference text, platform text,browser text,network text,metric text,
 samples integer,reference_samples integer,p90 integer,reference_p90 integer,regression boolean)
language sql stable set search_path='' as $$
 with measured as (
  select s.version,s.build,s.platform,s.browser,s.network,m.key as metric,
   count(distinct s.owner_id)::integer as samples,
   round(percentile_cont(0.9) within group (order by (m.value::text)::numeric)::numeric)::integer as p90
  from lumen_commands.performance_samples s cross join lateral jsonb_each(s.metrics) m
  where s.recorded_at>=now()-interval '14 days'
  group by s.version,s.build,s.platform,s.browser,s.network,m.key
 ), ranked as (
  select m.*,dense_rank() over (partition by m.platform,m.browser,m.network,m.metric order by m.build desc,m.version desc) as position
  from measured m
 )
 select c.version,r.version,c.platform,c.browser,c.network,c.metric,c.samples,r.samples,c.p90,r.p90,
  coalesce(c.samples>=p_min and r.samples>=p_min and c.p90>=r.p90*1.5
   and c.p90-r.p90>=case c.metric when 'load' then 250 when 'cloud_rpc' then 100 when 'sync_rpc' then 100
                      when 'long_task' then 35 when 'grid_input' then 25 else 15 end,false)
 from ranked c left join ranked r on r.position=2
  and (r.platform,r.browser,r.network,r.metric)=(c.platform,c.browser,c.network,c.metric)
 where c.position=1
$$;
revoke all on function lumen_ops.performance_comparison(integer) from public,anon,authenticated,service_role;

create or replace function lumen_ops.clear_performance_after_opt_out()
returns trigger language plpgsql set search_path='' as $$
begin
 delete from lumen_commands.performance_samples where owner_id=new.user_id;
 return new;
end $$;
revoke all on function lumen_ops.clear_performance_after_opt_out() from public,anon,authenticated,service_role;
drop trigger if exists clear_performance_after_opt_out on lumen_commands.diagnostic_preferences;
create trigger clear_performance_after_opt_out after update of enabled on lumen_commands.diagnostic_preferences
 for each row when (old.enabled and not new.enabled)
 execute function lumen_ops.clear_performance_after_opt_out();

create or replace function lumen_ops.hydration_error_comparison()
returns jsonb language sql stable set search_path='' as $$
 with versions as (
  select split_part(h.app_version,' ',1) as version,
   count(distinct h.user_id)::integer as samples,
   round(10000.0*count(*) filter(where h.event='hydration_failed')/count(*))::integer as rate
  from public.lumen_sync_health h join auth.users u on u.id=h.user_id
  where h.recorded_at>=now()-interval '14 days'
  and h.event in ('hydration_ready','hydration_failed') and lumen_ops.activity_player(u)
  and split_part(h.app_version,' ',1) ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9}$'
  group by 1 order by split_part(split_part(h.app_version,' ',1),'+',2)::integer desc,1 desc limit 2
 ), compared as (
  select *,lead(version) over w as reference,lead(samples) over w as reference_samples,
   lead(rate) over w as reference_rate
  from versions window w as (order by split_part(version,'+',2)::integer desc,version desc)
 )
 select jsonb_build_object('version',version,'reference',reference,'samples',samples,
  'reference_samples',reference_samples,'metric','hydration_error_rate','rate',rate,'reference_rate',reference_rate,
  'regression',true)
 from compared where samples>=20 and reference_samples>=20 and rate-reference_rate>=500
  and rate>=reference_rate*1.5
$$;
revoke all on function lumen_ops.hydration_error_comparison() from public,anon,authenticated,service_role;

create or replace function public.lumen_admin_performance_health()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform lumen_ops.require_incident_admin();
 return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
  select * from lumen_ops.performance_comparison(20) order by regression desc,samples desc,metric,platform,browser,network limit 50
 ) x);
end $$;
revoke all on function public.lumen_admin_performance_health() from public,anon;
grant execute on function public.lumen_admin_performance_health() to authenticated;

alter table lumen_commands.activity_mail drop constraint activity_mail_kind_check;
alter table lumen_commands.activity_mail add constraint activity_mail_kind_check check (
 kind in ('signup','purchase','purchase_missing_access','refund','revocation','purchase_access_restored',
  'incident_open','incident_resolved','performance_regression'));
alter table lumen_commands.activity_mail drop constraint activity_mail_owner_scope;
alter table lumen_commands.activity_mail add constraint activity_mail_owner_scope check (
 (owner_id is null)=(kind in ('incident_open','incident_resolved','performance_regression')));

create or replace function lumen_ops.prune_performance_samples()
returns bigint language sql set search_path='' as $$
 with deleted as (
  delete from lumen_commands.performance_samples where recorded_at<now()-interval '14 days' returning 1
 ) select count(*) from deleted
$$;
revoke all on function lumen_ops.prune_performance_samples() from public,anon,authenticated,service_role;

do $job$
declare definition text;
begin
 select pg_get_functiondef('lumen_commands.prune_sync_observations()'::regprocedure) into definition;
 if position('lumen_ops.prune_performance_samples()' in definition)>0 then return; end if;
 if position('return v_count+' in definition)=0 then raise exception 'review the daily retention job';end if;
 execute replace(definition,'return v_count+','return v_count+lumen_ops.prune_performance_samples()+');
end $job$;

create or replace function public.lumen_observe_performance()
returns integer language plpgsql security definer set search_path='' as $$
declare queued integer; rate jsonb;
begin
 if not pg_try_advisory_xact_lock(948,1) then return 0; end if;
 perform lumen_ops.prune_performance_samples();
 insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload)
 select null,'performance_regression',concat_ws(':',c.version,c.reference,c.platform,c.browser,c.network,c.metric),
  to_jsonb(c) || jsonb_build_object('event_at',now(),'severity','P1')
 from lumen_ops.performance_comparison(20) c
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

do $migration$
begin
 if to_regprocedure('lumen_privacy.policy_before_performance_samples()') is null then
  alter function lumen_privacy.policy() rename to policy_before_performance_samples;
 end if;
end $migration$;
create or replace function lumen_privacy.policy()
returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
language sql stable set search_path='' as $$
 select * from lumen_privacy.policy_before_performance_samples()
 union all values ('lumen_commands','performance_samples','owner_id',null,null,'delete')
$$;
revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_performance_samples()
 from public,anon,authenticated,service_role;
select lumen_privacy.install_guards();

notify pgrst,'reload schema';
commit;
