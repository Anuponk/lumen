-- #1044 (description updated 28/11): replay distribution, behaviour per phase (free
-- discovery / free after the threshold / Premium) and distinct quests per day, in
-- the same single aggregate read. The discovery quests come from the client's
-- catalogue order (same contract as lumen_admin_quota_simulation, #1030); without
-- them the phase is simply « free ». Replaces the 3-argument version.
begin;
drop function if exists public.lumen_admin_activity(integer,boolean,text);
create or replace function public.lumen_admin_activity(p_days integer default 30,p_include_internal boolean default false,p_segment text default 'all',p_discovery_quests text[] default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_out jsonb; v_today date:=(clock_timestamp() at time zone 'Europe/Paris')::date; v_from date; v_launch timestamptz; v_quota_on timestamptz;
begin
 if not lumen_commands.has_capability(auth.uid(),'analytics_cockpit') then
  raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 if p_days is null or p_days not between 1 and 90 or p_include_internal is null or p_segment is null or p_segment not in ('all','free','premium')
  or (p_discovery_quests is not null and cardinality(p_discovery_quests) not between 1 and 200) then
  raise exception using errcode='22023',message='invalid_parameter_value';end if;
 v_from:=v_today-(p_days-1);
 select min(changed_at) into v_launch from lumen_commands.commerce_settings_audit where key='premium_enabled' and new_value='true'::jsonb;
 select min(changed_at) into v_quota_on from lumen_commands.commerce_settings_audit where key='quotas_enabled' and new_value='true'::jsonb;
 with ext as (select distinct user_id from lumen.internal_capabilities),
 runs as (select r.user_id,regexp_replace(r.operation_id,'-reset-[0-9]+$','') base,r.operation_id,r.quest_id,r.issued_at
  from lumen_commands.ranking_runs r
  where r.issued_at>=(v_from::timestamp at time zone 'Europe/Paris')
   and (p_include_internal or not exists(select 1 from ext where ext.user_id=r.user_id))),
 rec as (select ru.user_id,ru.operation_id,coalesce(c.request,l.request) req
  from runs ru
  left join lumen_commands.canonical_receipts c on c.user_id=ru.user_id and c.operation_id=ru.operation_id
  left join lumen_commands.legacy_receipts l on c.user_id is null and l.user_id=ru.user_id and l.operation_id=ru.operation_id),
 att as (select ru.user_id,ru.base,min(ru.quest_id) quest_id,min(ru.issued_at) started,count(*)-1 resets,
   bool_or(rc.req is not null) completed,
   -- The completing run carries the duration (a reset restarts the chronometer).
   (array_agg(case when rc.req#>>'{facts,seconds}' ~ '^[0-9]{1,5}$' then (rc.req#>>'{facts,seconds}')::integer end order by ru.issued_at desc)
     filter (where rc.req is not null))[1] seconds
  from runs ru left join rec rc on rc.user_id=ru.user_id and rc.operation_id=ru.operation_id
  group by ru.user_id,ru.base),
 users as (select distinct user_id from att),
 firsts as (select x.user_id,x.quest_id,min(x.at) first_at from (
   select c.user_id,c.request->>'questId' quest_id,c.recorded_at at from lumen_commands.canonical_receipts c join users u using(user_id)
    where c.outcome->>'firstCompletion'='true'
   union all
   select l.user_id,l.request->>'questId',l.recorded_at from lumen_commands.legacy_receipts l join users u using(user_id)
    where l.outcome->>'firstCompletion'='true') x group by 1,2),
 prem as (select user_id,lumen_commands.premium_since(user_id) since from users),
 -- #1044: phase of the player at that moment (discovery = first constellations, catalogue order from the client).
 act as (select user_id,min(started) act_at from att where p_discovery_quests is not null and not (quest_id=any(p_discovery_quests)) group by 1),
 seg as (select a.user_id,a.base,a.quest_id,a.completed,a.resets,a.started,(a.started at time zone 'Europe/Paris')::date d,
   case when f.first_at is not null then f.first_at<a.started
    else exists(select 1 from lumen_commands.quest_run_authority q where q.user_id=a.user_id and q.quest_id=a.quest_id and q.projection->>'solved'='true')
   end replay,
   case when a.seconds between 1 and 21600 then a.seconds end valid_seconds,
   coalesce(p.since<=a.started,false) premium,
   (select x.act_at from act x where x.user_id=a.user_id) act_at
  from att a left join firsts f on f.user_id=a.user_id and f.quest_id=a.quest_id left join prem p on p.user_id=a.user_id),
 sel as (select * from seg where p_segment='all' or (p_segment='premium')=premium),
 pd as (select user_id,d,count(*) n_all,count(*) filter (where not replay) n_new,count(*) filter (where replay) n_rep,
   count(*) filter (where completed) n_done,sum(valid_seconds) secs,bool_or(started>=v_launch) after_launch,
   case when bool_or(premium) then 'premium' when p_discovery_quests is null then 'free'
    when bool_or(act_at is not null and act_at<=started) then 'free_after_threshold' else 'free_discovery' end phase
  from sel group by user_id,d),
 days as (select g::date d from generate_series(v_from,v_today,interval '1 day') g),
 qlimit as (select dd.d,
   (select (a.new_value::text)::integer from lumen_commands.commerce_settings_audit a where a.key='quota_new_daily'
     and jsonb_typeof(a.new_value)='number' and a.changed_at<lumen_commands.paris_day_end(dd.d) order by a.changed_at desc limit 1) new_limit,
   coalesce((select (a.new_value::text)::integer from lumen_commands.commerce_settings_audit a where a.key='quota_replay_daily'
     and jsonb_typeof(a.new_value)='number' and a.changed_at<lumen_commands.paris_day_end(dd.d) order by a.changed_at desc limit 1),
    (select (value::text)::integer from lumen_commands.commerce_settings where key='quota_replay_daily' and jsonb_typeof(value)='number')) replay_limit
  from days dd where v_quota_on is not null and lumen_commands.paris_day_end(dd.d)>v_quota_on),
 qobs as (select qa.user_id,qa.local_day d,count(*) filter (where qa.kind='new') n_new,count(*) filter (where qa.kind='replay') n_rep,ql.new_limit,ql.replay_limit
  from lumen_commands.quota_attempts qa join qlimit ql on ql.d=qa.local_day
  where qa.local_day between v_from and v_today
   and (p_include_internal or not exists(select 1 from ext where ext.user_id=qa.user_id))
   and not coalesce(lumen_commands.premium_since(qa.user_id)<lumen_commands.paris_day_end(qa.local_day-1),false)
  group by qa.user_id,qa.local_day,ql.new_limit,ql.replay_limit),
 subject as (select s.user_id,s.d from seg s join lumen_commands.quota_state q using(user_id)
  where not s.premium and q.activated_at<lumen_commands.paris_day_end(s.d) and v_quota_on is not null and lumen_commands.paris_day_end(s.d)>v_quota_on
  group by 1,2)
 select jsonb_build_object(
  'source','ranking_runs + receipts + quota_attempts','timeZone','Europe/Paris','days',p_days,'from',v_from,'today',v_today,
  'includeInternal',p_include_internal,'segment',p_segment,
  'dataStart',(select (min(issued_at) at time zone 'Europe/Paris')::date from lumen_commands.ranking_runs),
  'premiumLaunch',v_launch,'quotasOn',v_quota_on,
  'internalPlayers',(select count(distinct r.user_id) from lumen_commands.ranking_runs r join ext using(user_id) where r.issued_at>=(v_from::timestamp at time zone 'Europe/Paris')),
  'settings',(select jsonb_object_agg(key,value) from lumen_commands.commerce_settings where key in ('quotas_enabled','quota_new_daily','quota_replay_daily','quota_threshold_constellation','premium_enabled')),
  'priceCents',(select price_cents from lumen_commands.store_products where product_id='lumen-premium'),
  'quotaHistory',coalesce((select jsonb_agg(jsonb_build_object('key',key,'value',new_value,'at',changed_at) order by changed_at)
    from lumen_commands.commerce_settings_audit where key in ('quotas_enabled','quota_new_daily','quota_replay_daily')),'[]'::jsonb),
  'daily',(select jsonb_agg(jsonb_build_object('day',dd.d,
    'players',coalesce(x.players,0),'finishers',coalesce(x.finishers,0),'started',coalesce(x.started,0),'startedNew',coalesce(x.started_new,0),
    'startedReplay',coalesce(x.started_rep,0),'questsDistinct',coalesce(x.quests_distinct,0),'completed',coalesce(x.done,0),'completedNew',coalesce(x.done_new,0),'completedReplay',coalesce(x.done_rep,0),
    'resets',coalesce(x.resets,0),'seconds',coalesce(x.secs,0),'timed',coalesce(x.timed,0),'timedPlayers',coalesce(x.timed_players,0),
    'freePlayers',coalesce(x.free_players,0),'premiumPlayers',coalesce(x.premium_players,0),
    'subjectPlayers',(select count(*) from subject sb where sb.d=dd.d),
    'reachNew',(select count(*) from qobs q where q.d=dd.d and q.n_new>=q.new_limit),
    'reachReplay',(select count(*) from qobs q where q.d=dd.d and q.n_rep>=q.replay_limit),
    'newLimit',(select new_limit from qlimit q where q.d=dd.d),'replayLimit',(select replay_limit from qlimit q where q.d=dd.d)) order by dd.d)
   from days dd left join (select d,count(distinct user_id) players,count(distinct user_id) filter (where completed) finishers,count(*) started,count(distinct quest_id) quests_distinct,
     count(*) filter (where not replay) started_new,count(*) filter (where replay) started_rep,count(*) filter (where completed) done,
     count(*) filter (where completed and not replay) done_new,count(*) filter (where completed and replay) done_rep,sum(resets) resets,
     sum(valid_seconds) secs,count(valid_seconds) timed,count(distinct user_id) filter (where valid_seconds is not null) timed_players,
     count(distinct user_id) filter (where not premium) free_players,count(distinct user_id) filter (where premium) premium_players
    from sel group by d) x using(d)),
  'behaviour',(select jsonb_build_object('playerDays',count(*),'players',count(distinct user_id),
    'mean',round(avg(n_all),1),'median',percentile_disc(0.5) within group (order by n_all),
    'p75',percentile_disc(0.75) within group (order by n_all),'p90',percentile_disc(0.9) within group (order by n_all),
    'p95',percentile_disc(0.95) within group (order by n_all),
    'meanNew',round(avg(n_new),1),'meanReplay',round(avg(n_rep),1),'meanCompleted',round(avg(n_done),1),
    'distribution',jsonb_build_array(
     jsonb_build_object('bucket','0','count',count(*) filter (where n_new=0)),
     jsonb_build_object('bucket','1-5','count',count(*) filter (where n_new between 1 and 5)),
     jsonb_build_object('bucket','6-10','count',count(*) filter (where n_new between 6 and 10)),
     jsonb_build_object('bucket','11-15','count',count(*) filter (where n_new between 11 and 15)),
     jsonb_build_object('bucket','16-20','count',count(*) filter (where n_new between 16 and 20)),
     jsonb_build_object('bucket','21-30','count',count(*) filter (where n_new between 21 and 30)),
     jsonb_build_object('bucket','31+','count',count(*) filter (where n_new>30))),
    'distributionReplay',jsonb_build_array(
     jsonb_build_object('bucket','0','count',count(*) filter (where n_rep=0)),
     jsonb_build_object('bucket','1-5','count',count(*) filter (where n_rep between 1 and 5)),
     jsonb_build_object('bucket','6-10','count',count(*) filter (where n_rep between 6 and 10)),
     jsonb_build_object('bucket','11-15','count',count(*) filter (where n_rep between 11 and 15)),
     jsonb_build_object('bucket','16-20','count',count(*) filter (where n_rep between 16 and 20)),
     jsonb_build_object('bucket','21-30','count',count(*) filter (where n_rep between 21 and 30)),
     jsonb_build_object('bucket','31+','count',count(*) filter (where n_rep>30))),
    'phases',coalesce((select jsonb_object_agg(phase,v) from (select phase,jsonb_build_object('playerDays',count(*),'players',count(distinct user_id),
      'mean',round(avg(n_all),1),'median',percentile_disc(0.5) within group (order by n_all),'p75',percentile_disc(0.75) within group (order by n_all),
      'p90',percentile_disc(0.9) within group (order by n_all),'p95',percentile_disc(0.95) within group (order by n_all),
      'meanNew',round(avg(n_new),1),'meanReplay',round(avg(n_rep),1),
      'newP90',percentile_disc(0.9) within group (order by n_new),'replayP90',percentile_disc(0.9) within group (order by n_rep)) v
     from pd group by phase) z),'{}'::jsonb)) from pd),
  'time',(select jsonb_build_object('completed',count(*) filter (where completed),'timed',count(valid_seconds),
    'invalid',count(*) filter (where completed and valid_seconds is null)) from sel),
  'premium',jsonb_build_object(
   'freePlayers',(select count(distinct user_id) from seg where not premium),
   'premiumPlayers',(select count(distinct user_id) from seg where premium),
   'freePastThreshold',(select count(distinct s.user_id) from seg s join lumen_commands.quota_state q using(user_id)
     where not s.premium and q.activated_at<lumen_commands.paris_day_end(s.d)),
   'subject',(select jsonb_build_object('playerDays',count(*),'players',count(distinct user_id)) from subject),
   'observed',(select jsonb_build_object('playerDays',count(*),'players',count(distinct user_id),
     'daysReachNew',count(*) filter (where n_new>=new_limit),'daysReachReplay',count(*) filter (where n_rep>=replay_limit),
     'daysReachAny',count(*) filter (where n_new>=new_limit or n_rep>=replay_limit),
     'playersReachNew',count(distinct user_id) filter (where n_new>=new_limit),'playersReachReplay',count(distinct user_id) filter (where n_rep>=replay_limit),
     'firstDay',min(d),'lastDay',max(d)) from qobs),
   'beforeAfter',(select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from (
     select case when after_launch then 'after' else 'before' end k,jsonb_build_object('playerDays',count(*),'players',count(distinct user_id),
      'meanStarted',round(avg(n_all),1),'meanNew',round(avg(n_new),1),'meanReplay',round(avg(n_rep),1),'meanCompleted',round(avg(n_done),1),
      'meanMinutes',round(avg(secs)/60.0,1)) v
     from pd where v_launch is not null group by 1) ba))
 ) into v_out;
 return v_out;
end $$;
revoke all on function public.lumen_admin_activity(integer,boolean,text,text[]) from public,anon;
grant execute on function public.lumen_admin_activity(integer,boolean,text,text[]) to authenticated;
notify pgrst, 'reload schema';
commit;
