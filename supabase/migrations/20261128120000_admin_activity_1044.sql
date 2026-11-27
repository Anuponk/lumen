-- #1044 (Analytics, #708 cockpit): activity, play time, behaviour, Free/Premium limits,
-- shop traffic, Premium conversion funnels and retention after a limit.
-- Contract and limits: docs/ANALYTICS_1044.md. Read side = two bounded aggregate
-- reads (no account identifier leaves them); write side = one sober, idempotent
-- event journal for the shop and the limit dialog (nothing else was recorded).
--
-- Measurement rules (activity):
-- * Attempt = lumen_commands.ranking_runs (signed-in account, first gesture), on the
--   BASE attempt id: a scoped reset re-issues the attempt as « <id>-reset-N » and is
--   not a new attempt; a resume re-uses the same row.
-- * Completed = a victory receipt exists (canonical or legacy, primary key
--   (user_id, operation_id): duplicates and late syncs collapse).
-- * New vs replay (#1030): replay when the quest's first completion (receipt
--   outcome.firstCompletion) precedes the attempt, or when the quest was solved
--   before any receipt (authority projection, no first-completion receipt).
-- * Play time = facts.seconds of the completing run (effective chronometer: pauses
--   and background excluded; official penalties are stored apart and excluded).
--   Abandoned attempts carry no reliable duration: time = completed quests only.
-- * Day = Europe/Paris date of the first server issue. Guests are not observable.
-- * Premium at a day = right derived like premium_status (purchases still paid,
--   active grants) dated by purchase/grant. Internal = lumen.internal_capabilities.
begin;

-- 1. Commerce event journal --------------------------------------------------------
create table if not exists lumen_commands.commerce_events(
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id text not null check (event_id ~ '^[A-Za-z0-9._:-]{8,80}$'),
 type text not null check (type in ('shop_open','shop_close','cta_click','checkout_start','checkout_cancel','checkout_error','limit_block','limit_shown')),
 origin text check (origin in ('locked_adventure','quota_new','quota_replay','voluntary','premium_feature','other')),
 channel text check (channel in ('web','play')),
 visit_id text check (visit_id ~ '^[A-Za-z0-9._:-]{8,80}$'),
 kind text check (kind in ('new','replay')),
 product_id text check (char_length(product_id) between 1 and 80),
 price_cents integer check (price_cents between 0 and 100000),
 currency text check (currency ~ '^[A-Z]{3}$'),
 duration_ms integer check (duration_ms between 0 and 86400000),
 occurred_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(user_id,event_id)
);
create index if not exists commerce_events_time_idx on lumen_commands.commerce_events(occurred_at);
create index if not exists commerce_events_recorded_idx on lumen_commands.commerce_events(user_id,recorded_at);
alter table lumen_commands.commerce_events enable row level security;
revoke all on lumen_commands.commerce_events from public,anon,authenticated;

-- Batched (≤ 20), idempotent (client event id), bounded (300 rows/account/24 h),
-- self-purging (90 days). Never refuses the game: an invalid event is skipped.
create or replace function public.lumen_track_commerce(p_events jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); e jsonb; at timestamptz; accepted integer:=0; skipped integer:=0; budget integer;
begin
 if me is null then raise exception using errcode='42501',message='authentication_required';end if;
 if jsonb_typeof(coalesce(p_events,'null'::jsonb))<>'array' or jsonb_array_length(p_events)>20 then
  raise exception using errcode='22023',message='commerce_batch_invalid';end if;
 perform pg_advisory_xact_lock(1044,hashtext(me::text));
 select 300-count(*) into budget from lumen_commands.commerce_events where user_id=me and recorded_at>clock_timestamp()-interval '1 day';
 for e in select value from jsonb_array_elements(p_events) loop
  begin at:=(e->>'at')::timestamptz;exception when others then at:=null;end;
  if budget<=0 or at is null or at>clock_timestamp()+interval '10 minutes' or at<clock_timestamp()-interval '7 days' then skipped:=skipped+1;continue;end if;
  begin
   insert into lumen_commands.commerce_events(user_id,event_id,type,origin,channel,visit_id,kind,product_id,price_cents,currency,duration_ms,occurred_at)
   values(me,e->>'id',e->>'type',nullif(e->>'origin',''),nullif(e->>'channel',''),nullif(e->>'visit',''),nullif(e->>'kind',''),nullif(e->>'product',''),
    case when e->>'priceCents' ~ '^[0-9]{1,6}$' then (e->>'priceCents')::integer end,nullif(e->>'currency',''),
    case when e->>'durationMs' ~ '^[0-9]{1,9}$' then least((e->>'durationMs')::bigint,86400000)::integer end,at)
   on conflict do nothing;
   if found then accepted:=accepted+1;budget:=budget-1;end if;
  exception when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then skipped:=skipped+1;
  end;
 end loop;
 delete from lumen_commands.commerce_events where user_id=me and occurred_at<clock_timestamp()-interval '90 days';
 return jsonb_build_object('accepted',accepted,'skipped',skipped);
end $$;
revoke all on function public.lumen_track_commerce(jsonb) from public,anon;
grant execute on function public.lumen_track_commerce(jsonb) to authenticated;

-- Privacy: erased with the account (#1030 chain pattern).
do $$begin
 if to_regprocedure('lumen_privacy.policy_before_commerce_events_1044()') is null then
  alter function lumen_privacy.policy() rename to policy_before_commerce_events_1044;
 end if;
end $$;
create or replace function lumen_privacy.policy()
returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
language sql stable security definer set search_path='' as $$
 select * from lumen_privacy.policy_before_commerce_events_1044()
 union all values ('lumen_commands','commerce_events','user_id',null::text,null::text,'delete'),
  -- #974 view of proven historical records (derived from quest_run_authority).
  ('lumen_commands','ranking_reset_proven_candidates',null,null,null,'derived-view')
$$;
revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_commerce_events_1044() from public,anon,authenticated,service_role;
select lumen_privacy.install_guards();

-- 2. Shared helpers (internal) --------------------------------------------------------
-- Premium-equivalent right start per account (null = free), like premium_status.
create or replace function lumen_commands.premium_since(p_user uuid)
returns timestamptz language sql stable security definer set search_path='' as $$
 with paid as (select s.kind,s.pack_id,p.purchased_at from lumen_commands.purchases p
   join lumen_commands.store_products s on s.product_id=p.product_id where p.user_id=p_user and p.status='paid'),
 adv as (select pack_id,min(purchased_at) at from paid where kind='adventure' and pack_id ~ '^real-adventure-0[2-9]$' group by 1)
 select min(since) from (
  select min(purchased_at) since from paid where kind in ('premium','sky','sky_upgrade')
  union all select at from (select at,row_number() over (order by at) n from adv) z where n=5
  union all select min(granted_at) from lumen_commands.premium_grants where user_id=p_user and revoked_at is null) y
$$;
revoke all on function lumen_commands.premium_since(uuid) from public,anon,authenticated,service_role;
create or replace function lumen_commands.paris_day_end(p_day date)
returns timestamptz language sql immutable set search_path='' as $$ select ((p_day+1)::timestamp) at time zone 'Europe/Paris' $$;
revoke all on function lumen_commands.paris_day_end(date) from public,anon,authenticated,service_role;

-- 3. Activity, play time, behaviour, quotas reached ----------------------------------
create or replace function public.lumen_admin_activity(p_days integer default 30,p_include_internal boolean default false,p_segment text default 'all')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_out jsonb; v_today date:=(clock_timestamp() at time zone 'Europe/Paris')::date; v_from date; v_launch timestamptz; v_quota_on timestamptz;
begin
 if not lumen_commands.has_capability(auth.uid(),'analytics_cockpit') then
  raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 if p_days is null or p_days not between 1 and 90 or p_include_internal is null or p_segment is null or p_segment not in ('all','free','premium') then
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
 seg as (select a.user_id,a.base,a.completed,a.resets,a.started,(a.started at time zone 'Europe/Paris')::date d,
   case when f.first_at is not null then f.first_at<a.started
    else exists(select 1 from lumen_commands.quest_run_authority q where q.user_id=a.user_id and q.quest_id=a.quest_id and q.projection->>'solved'='true')
   end replay,
   case when a.seconds between 1 and 21600 then a.seconds end valid_seconds,
   coalesce(p.since<=a.started,false) premium
  from att a left join firsts f on f.user_id=a.user_id and f.quest_id=a.quest_id left join prem p on p.user_id=a.user_id),
 sel as (select * from seg where p_segment='all' or (p_segment='premium')=premium),
 pd as (select user_id,d,count(*) n_all,count(*) filter (where not replay) n_new,count(*) filter (where replay) n_rep,
   count(*) filter (where completed) n_done,sum(valid_seconds) secs,bool_or(started>=v_launch) after_launch
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
    'startedReplay',coalesce(x.started_rep,0),'completed',coalesce(x.done,0),'completedNew',coalesce(x.done_new,0),'completedReplay',coalesce(x.done_rep,0),
    'resets',coalesce(x.resets,0),'seconds',coalesce(x.secs,0),'timed',coalesce(x.timed,0),'timedPlayers',coalesce(x.timed_players,0),
    'freePlayers',coalesce(x.free_players,0),'premiumPlayers',coalesce(x.premium_players,0),
    'subjectPlayers',(select count(*) from subject sb where sb.d=dd.d),
    'reachNew',(select count(*) from qobs q where q.d=dd.d and q.n_new>=q.new_limit),
    'reachReplay',(select count(*) from qobs q where q.d=dd.d and q.n_rep>=q.replay_limit),
    'newLimit',(select new_limit from qlimit q where q.d=dd.d),'replayLimit',(select replay_limit from qlimit q where q.d=dd.d)) order by dd.d)
   from days dd left join (select d,count(distinct user_id) players,count(distinct user_id) filter (where completed) finishers,count(*) started,
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
     jsonb_build_object('bucket','31+','count',count(*) filter (where n_new>30)))) from pd),
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
revoke all on function public.lumen_admin_activity(integer,boolean,text) from public,anon;
grant execute on function public.lumen_admin_activity(integer,boolean,text) to authenticated;

-- 4. Limits, shop, funnels, attribution, retention -----------------------------------
-- Attribution window: p_window_days = 0 (same Paris day) or 7 (7 days after the step
-- that opens the chain). Chains are chronological per player (each step is the first
-- event AFTER the previous step); populations are never matched independently.
create or replace function public.lumen_admin_conversion(p_days integer default 30,p_include_internal boolean default false,p_channel text default 'all',p_window_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_out jsonb; v_today date:=(clock_timestamp() at time zone 'Europe/Paris')::date; v_from date; v_start timestamptz;
begin
 if not lumen_commands.has_capability(auth.uid(),'analytics_cockpit') then
  raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 if p_days is null or p_days not between 1 and 90 or p_include_internal is null or p_channel is null or p_channel not in ('all','web','play')
  or p_window_days is null or p_window_days not in (0,7) then
  raise exception using errcode='22023',message='invalid_parameter_value';end if;
 v_from:=v_today-(p_days-1);v_start:=v_from::timestamp at time zone 'Europe/Paris';
 with ext as (select distinct user_id from lumen.internal_capabilities),
 ev as (select e.*,(e.occurred_at at time zone 'Europe/Paris')::date d from lumen_commands.commerce_events e
  where e.occurred_at>=v_start and (p_include_internal or not exists(select 1 from ext where ext.user_id=e.user_id))),
 evc as (select * from ev where p_channel='all' or channel=p_channel or (channel is null and type in ('limit_block','limit_shown'))),
 buys as (select p.user_id,min(p.purchased_at) at,(array_agg(case p.provider when 'play' then 'play' else 'web' end order by p.purchased_at))[1] channel
  from lumen_commands.purchases p join lumen_commands.store_products s on s.product_id=p.product_id
  where s.kind='premium' and p.status in ('paid','refunded') and p.purchased_at>=v_start
   and (p_include_internal or not exists(select 1 from ext where ext.user_id=p.user_id))
  group by p.user_id),
 buysc as (select * from buys where p_channel='all' or channel=p_channel),
 lim as (select * from ev where type in ('limit_block','limit_shown')),
 -- Free active players (the funnel's population): signed-in, not Premium that day.
 active as (select r.user_id,min(r.issued_at) first_at from lumen_commands.ranking_runs r
  where r.issued_at>=v_start and (p_include_internal or not exists(select 1 from ext where ext.user_id=r.user_id))
   and not coalesce(lumen_commands.premium_since(r.user_id)<=r.issued_at,false) group by 1),
 -- Funnel A: first blocking limit, then chronological steps inside the window.
 a1 as (select b.user_id,min(b.occurred_at) at from ev b join active a using(user_id) where b.type='limit_block' group by 1),
 a2 as (select a1.user_id,a1.at block_at,(select min(o.occurred_at) from evc o where o.user_id=a1.user_id and o.type='shop_open' and o.occurred_at>=a1.at and (o.occurred_at at time zone 'Europe/Paris')::date<=(a1.at at time zone 'Europe/Paris')::date+p_window_days) at
  from a1),
 a3 as (select a2.*,(select min(c.occurred_at) from evc c where c.user_id=a2.user_id and c.type='cta_click' and a2.at is not null and c.occurred_at>=a2.at
    and (c.occurred_at at time zone 'Europe/Paris')::date<=(a2.block_at at time zone 'Europe/Paris')::date+p_window_days) cta_at from a2),
 a4 as (select a3.*,(select min(c.occurred_at) from evc c where c.user_id=a3.user_id and c.type='checkout_start' and a3.cta_at is not null and c.occurred_at>=a3.cta_at
    and (c.occurred_at at time zone 'Europe/Paris')::date<=(a3.block_at at time zone 'Europe/Paris')::date+p_window_days) co_at from a3),
 a5 as (select a4.*,(select b.at from buysc b where b.user_id=a4.user_id and a4.co_at is not null and b.at>=a4.co_at
    and (b.at at time zone 'Europe/Paris')::date<=(a4.block_at at time zone 'Europe/Paris')::date+p_window_days) buy_at from a4),
 -- Funnel B: first shop visit (any origin), then the same chain.
 b1 as (select user_id,min(occurred_at) at from evc where type='shop_open' group by 1),
 b2 as (select b1.*,(select min(c.occurred_at) from evc c where c.user_id=b1.user_id and c.type='cta_click' and c.occurred_at>=b1.at
    and (c.occurred_at at time zone 'Europe/Paris')::date<=(b1.at at time zone 'Europe/Paris')::date+p_window_days) cta_at from b1),
 b3 as (select b2.*,(select min(c.occurred_at) from evc c where c.user_id=b2.user_id and c.type='checkout_start' and b2.cta_at is not null and c.occurred_at>=b2.cta_at
    and (c.occurred_at at time zone 'Europe/Paris')::date<=(b2.at at time zone 'Europe/Paris')::date+p_window_days) co_at from b2),
 b4 as (select b3.*,(select b.at from buysc b where b.user_id=b3.user_id and b3.co_at is not null and b.at>=b3.co_at
    and (b.at at time zone 'Europe/Paris')::date<=(b3.at at time zone 'Europe/Paris')::date+p_window_days) buy_at from b3),
 -- Attribution: the last shop visit before the purchase, inside the window.
 attr as (select b.user_id,b.channel,(select o.origin from ev o where o.user_id=b.user_id and o.type='shop_open' and o.occurred_at<=b.at
    and (o.occurred_at at time zone 'Europe/Paris')::date>=(b.at at time zone 'Europe/Paris')::date-p_window_days order by o.occurred_at desc limit 1) origin
  from buysc b),
 -- Retention after a limit (free player-days past the threshold, complete follow-up).
 days_played as (select r.user_id,(r.issued_at at time zone 'Europe/Paris')::date d,count(distinct regexp_replace(r.operation_id,'-reset-[0-9]+$','')) n
  from lumen_commands.ranking_runs r where r.issued_at>=v_start-interval '1 day'
   and (p_include_internal or not exists(select 1 from ext where ext.user_id=r.user_id)) group by 1,2),
 secs as (select r.user_id,(r.issued_at at time zone 'Europe/Paris')::date d,sum(case when coalesce(c.request,l.request)#>>'{facts,seconds}' ~ '^[0-9]{1,5}$'
    then least((coalesce(c.request,l.request)#>>'{facts,seconds}')::integer,21600) end) s
  from lumen_commands.ranking_runs r
  left join lumen_commands.canonical_receipts c on c.user_id=r.user_id and c.operation_id=r.operation_id
  left join lumen_commands.legacy_receipts l on c.user_id is null and l.user_id=r.user_id and l.operation_id=r.operation_id
  where r.issued_at>=v_start-interval '1 day' group by 1,2),
 exposure as (select dp.user_id,dp.d,dp.n,exists(select 1 from lim b where b.user_id=dp.user_id and b.d=dp.d and b.type='limit_block') blocked
  from days_played dp join lumen_commands.quota_state q on q.user_id=dp.user_id
  where dp.d>=v_from and dp.d<v_today and q.activated_at<lumen_commands.paris_day_end(dp.d)
   and not coalesce(lumen_commands.premium_since(dp.user_id)<lumen_commands.paris_day_end(dp.d-1),false)),
 follow as (select x.*,
   exists(select 1 from days_played y where y.user_id=x.user_id and y.d=x.d+1) j1,
   case when x.d+7<v_today then exists(select 1 from days_played y where y.user_id=x.user_id and y.d=x.d+7) end j7,
   (select coalesce(sum(n),0) from days_played y where y.user_id=x.user_id and y.d between x.d+1 and least(x.d+7,v_today-1)) next_n,
   (select coalesce(sum(s),0) from secs y where y.user_id=x.user_id and y.d between x.d+1 and least(x.d+7,v_today-1)) next_s,
   (select coalesce(sum(n),0) from days_played y where y.user_id=x.user_id and y.d between x.d-7 and x.d-1) prev_n,
   exists(select 1 from buys b where b.user_id=x.user_id and b.at>=lumen_commands.paris_day_end(x.d)-interval '1 day' and b.at<lumen_commands.paris_day_end(x.d+7)) bought7,
   (select extract(day from lumen_commands.paris_day_end(x.d)-u.created_at)::integer from auth.users u where u.id=x.user_id) age_days,
   (select count(*) from lumen_commands.quest_run_authority qa where qa.user_id=x.user_id and qa.projection->>'solved'='true') progression
  from exposure x)
 select jsonb_build_object(
  'source','commerce_events + purchases + stripe_checkout_sessions + ranking_runs','timeZone','Europe/Paris','days',p_days,'from',v_from,'today',v_today,
  'channel',p_channel,'windowDays',p_window_days,'includeInternal',p_include_internal,
  'eventsStart',(select (min(occurred_at) at time zone 'Europe/Paris')::date from lumen_commands.commerce_events),
  'daily',(select jsonb_agg(jsonb_build_object('day',dd::date,
    'opens',(select count(*) from evc where d=dd::date and type='shop_open'),
    'visitors',(select count(distinct user_id) from evc where d=dd::date and type='shop_open'),
    'closes',(select count(*) from evc where d=dd::date and type='shop_close'),
    'ctas',(select count(*) from evc where d=dd::date and type='cta_click'),
    'checkouts',(select count(*) from evc where d=dd::date and type='checkout_start'),
    'cancels',(select count(*) from evc where d=dd::date and type='checkout_cancel'),
    'errors',(select count(*) from evc where d=dd::date and type='checkout_error'),
    'purchases',(select count(*) from buysc b where (b.at at time zone 'Europe/Paris')::date=dd::date),
    'blocksNew',(select count(*) from lim where d=dd::date and type='limit_block' and kind='new'),
    'blocksReplay',(select count(*) from lim where d=dd::date and type='limit_block' and kind='replay'),
    'shown',(select count(*) from lim where d=dd::date and type='limit_shown'),
    'blockedPlayers',(select count(distinct user_id) from lim where d=dd::date and type='limit_block')) order by dd)
   from generate_series(v_from,v_today,interval '1 day') dd),
  'shop',(select jsonb_build_object('opens',count(*) filter (where type='shop_open'),'visitors',count(distinct user_id) filter (where type='shop_open'),
    'closes',count(*) filter (where type='shop_close'),
    'closeMedianSeconds',round((percentile_cont(0.5) within group (order by duration_ms) filter (where type='shop_close'))/1000.0),
    'ctas',count(*) filter (where type='cta_click'),'ctaPlayers',count(distinct user_id) filter (where type='cta_click'),
    'checkouts',count(*) filter (where type='checkout_start'),'checkoutPlayers',count(distinct user_id) filter (where type='checkout_start'),
    'cancels',count(*) filter (where type='checkout_cancel'),'errors',count(*) filter (where type='checkout_error'),
    'purchases',(select count(*) from buysc),
    'stripeSessions',(select jsonb_build_object('created',count(*),'complete',count(*) filter (where s.status='complete'),'expired',count(*) filter (where s.status='expired'),
      'open',count(*) filter (where s.status not in ('complete','expired')))
     from lumen_commands.stripe_checkout_sessions s join lumen_commands.store_products sp on sp.product_id=s.product_id
     where sp.kind='premium' and s.created_at>=v_start and p_channel in ('all','web') and (p_include_internal or not exists(select 1 from ext where ext.user_id=s.user_id))),
    'origins',(select coalesce(jsonb_object_agg(o,jsonb_build_object('opens',n,'visitors',v)),'{}'::jsonb) from (
      select coalesce(origin,'other') o,count(*) n,count(distinct user_id) v from evc where type='shop_open' group by 1) z),
    'prices',(select coalesce(jsonb_agg(distinct jsonb_build_object('channel',channel,'priceCents',price_cents,'currency',currency)),'[]'::jsonb)
      from evc where type='shop_open' and price_cents is not null)) from evc),
  'limits',(select jsonb_build_object('blocksNew',count(*) filter (where type='limit_block' and kind='new'),'blocksReplay',count(*) filter (where type='limit_block' and kind='replay'),
    'shown',count(*) filter (where type='limit_shown'),'shownNew',count(*) filter (where type='limit_shown' and kind='new'),'shownReplay',count(*) filter (where type='limit_shown' and kind='replay'),
    'blockedPlayers',count(distinct user_id) filter (where type='limit_block'),
    'blockedPlayersNew',count(distinct user_id) filter (where type='limit_block' and kind='new'),'blockedPlayersReplay',count(distinct user_id) filter (where type='limit_block' and kind='replay'),
    'blockedPlayerDays',(select count(*) from (select distinct user_id,d from lim where type='limit_block') z),
    'shownPlayers',count(distinct user_id) filter (where type='limit_shown')) from lim),
  'funnelBlocked',(select jsonb_build_object('active',(select count(*) from active),'blocked',count(*),'shop',count(at),'cta',count(cta_at),'checkout',count(co_at),'purchase',count(buy_at)) from a5),
  'funnelShop',(select jsonb_build_object('visitors',count(*),'cta',count(cta_at),'checkout',count(co_at),'purchase',count(buy_at),
    'purchasesWithoutVisit',(select count(*) from buysc b where not exists(select 1 from ev o where o.user_id=b.user_id and o.type='shop_open' and o.occurred_at<=b.at))) from b4),
  'attribution',(select coalesce(jsonb_agg(jsonb_build_object('origin',coalesce(origin,'unattributed'),'channel',channel,'purchases',n)),'[]'::jsonb)
    from (select origin,channel,count(*) n from attr group by 1,2) z),
  'retention',(select jsonb_build_object(
    'blocked',jsonb_build_object('playerDays',count(*) filter (where blocked),'players',count(distinct user_id) filter (where blocked),
      'j1',round(100.0*avg(j1::int) filter (where blocked),1),'j7Eligible',count(j7) filter (where blocked),'j7',round(100.0*avg(j7::int) filter (where blocked and j7 is not null),1),
      'nextQuests',round(avg(next_n) filter (where blocked),1),'nextMinutes',round(avg(next_s) filter (where blocked)/60.0,1),'prevQuests',round(avg(prev_n) filter (where blocked),1),
      'sameDayQuests',round(avg(n) filter (where blocked),1),'conversion7',round(100.0*avg(bought7::int) filter (where blocked),1),
      'ageDays',round(avg(age_days) filter (where blocked),0),'progression',round(avg(progression) filter (where blocked),0)),
    'reference',jsonb_build_object('playerDays',count(*) filter (where not blocked),'players',count(distinct user_id) filter (where not blocked),
      'j1',round(100.0*avg(j1::int) filter (where not blocked),1),'j7Eligible',count(j7) filter (where not blocked),'j7',round(100.0*avg(j7::int) filter (where not blocked and j7 is not null),1),
      'nextQuests',round(avg(next_n) filter (where not blocked),1),'nextMinutes',round(avg(next_s) filter (where not blocked)/60.0,1),'prevQuests',round(avg(prev_n) filter (where not blocked),1),
      'sameDayQuests',round(avg(n) filter (where not blocked),1),'conversion7',round(100.0*avg(bought7::int) filter (where not blocked),1),
      'ageDays',round(avg(age_days) filter (where not blocked),0),'progression',round(avg(progression) filter (where not blocked),0))) from follow)
 ) into v_out;
 return v_out;
end $$;
revoke all on function public.lumen_admin_conversion(integer,boolean,text,integer) from public,anon;
grant execute on function public.lumen_admin_conversion(integer,boolean,text,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
