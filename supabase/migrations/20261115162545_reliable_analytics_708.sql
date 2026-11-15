-- #708: read-only metrics from existing service receipts and qualified events.
-- No collection permission, player record, receipt or saved progress is changed.
begin;

-- Existing (user_id, recorded_at) indexes serve player details; these serve the
-- cross-account rolling window without scanning the complete receipt history.
create index if not exists canonical_receipts_activity_time_idx on lumen_commands.canonical_receipts(recorded_at);
create index if not exists legacy_receipts_activity_time_idx on lumen_commands.legacy_receipts(recorded_at);

create or replace function lumen_commands.cockpit_events(p_days integer)
returns table(player_key text,event_name text,quest_id text,quest_ordinal integer,puzzle_id integer,session_id text,occurred_at timestamptz,properties jsonb)
language sql stable security invoker set search_path='' as $$
 with owners as (
  select anonymous_id,min(user_id::text) owner from lumen.analytics_events
  where user_id is not null
  group by anonymous_id having count(distinct user_id)=1
 )
 select coalesce('u:'||e.user_id::text,'u:'||o.owner,'a:'||e.anonymous_id),e.event_name::text,q.quest_id,
  (q.rules->>'ordinal')::integer,e.puzzle_id,e.session_id::text,e.occurred_at,e.properties
 from lumen.analytics_events e left join owners o using(anonymous_id)
 left join lumen_commands.quest_rules q on q.quest_id=coalesce(e.properties->>'stable_quest_id',
  (select h.quest_id from lumen_commands.quest_rules h where h.legacy_index=e.puzzle_id-1))
  and (e.properties->>'stable_quest_id' is null or e.puzzle_id is null or q.legacy_index=e.puzzle_id-1)
 where (p_days is null or e.occurred_at>=now()-make_interval(days=>p_days)) and e.occurred_at<=now()
  and e.properties->>'traffic_type'='human' and coalesce(e.properties->>'qa_mode','')='';
$$;
revoke all on function lumen_commands.cockpit_events(integer) from public,anon,authenticated;

create or replace function lumen_commands.service_activity(p_days integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 with receipts as (
  select user_id,operation_id,request,outcome,recorded_at from lumen_commands.canonical_receipts
  where recorded_at>=now()-make_interval(days=>p_days) and recorded_at<=now()
  union all
  select user_id,operation_id,request,outcome,recorded_at from lumen_commands.legacy_receipts
  where recorded_at>=now()-make_interval(days=>p_days) and recorded_at<=now()
 ), wins as (
  select distinct on(r.user_id,r.operation_id,r.request->>'questId') r.user_id,r.operation_id,
   r.request->>'questId' quest_id,q.rules->>'ordinal' quest_ordinal,r.recorded_at,
   r.outcome->>'firstCompletion'='true' first_completion
  from receipts r join lumen.users u on u.user_id=r.user_id
  join lumen_commands.quest_rules q on q.quest_id=r.request->>'questId'
  order by r.user_id,r.operation_id,r.request->>'questId',r.recorded_at
 ), daily as (
  select (recorded_at at time zone 'UTC')::date activity_date,count(distinct user_id) players,count(*) completions
  from wins group by 1
 ), quests as (
  select quest_id stable_quest_id,quest_ordinal::integer quest_ordinal,count(distinct user_id) players,count(*) completions,
   count(distinct user_id) filter(where first_completion) first_completions,max(recorded_at) last_received_at
  from wins group by quest_id,quest_ordinal
 ), players as (
  select 'u:'||user_id::text player_key,count(*) completions,count(distinct quest_id) quests,
   max(quest_ordinal::integer) furthest_confirmed_quest,max(recorded_at) last_received_at
  from wins group by user_id order by last_received_at desc,user_id limit 250
 )
 select jsonb_build_object('clock','server_received_utc','days',p_days,'includes_test_accounts',true,
  'summary',(select jsonb_build_object('players',count(distinct user_id),'quests',count(distinct quest_id),'completions',count(*),
   'first_completions',count(distinct (user_id,quest_id)) filter(where first_completion),'last_received_at',max(recorded_at)) from wins),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by activity_date) from daily d),'[]'),
  'quests',coalesce((select jsonb_agg(to_jsonb(q) order by quest_ordinal) from quests q),'[]'),
  'players',coalesce((select jsonb_agg(to_jsonb(p) order by last_received_at desc,player_key) from players p),'[]'),
  'players_limit',250);
$$;
revoke all on function lumen_commands.service_activity(integer) from public,anon,authenticated;

-- Both summary and quest reads use explicit ownership and the same human filter.
create or replace function lumen_commands.quest_analytics(p_days integer)
returns table(player_key text,event_name text,quest_id text,quest_ordinal integer,puzzle_id integer,occurred_at timestamptz,properties jsonb)
language sql stable security definer set search_path='' as $$
 select e.player_key,e.event_name,e.quest_id,e.quest_ordinal,e.puzzle_id,e.occurred_at,e.properties
 from lumen_commands.cockpit_events(p_days) e;
$$;
revoke all on function lumen_commands.quest_analytics(integer) from public,anon,authenticated;

create or replace function public.lumen_admin_cockpit(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid()
  and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 p_days:=greatest(1,least(coalesce(p_days,7),3650));
 with history as materialized(select * from lumen_commands.cockpit_events(null)),
 base as(select * from history where occurred_at>=now()-make_interval(days=>p_days)),
 first_seen as(select player_key,min(occurred_at) first_seen from history group by player_key),
 players as(select distinct b.player_key,f.first_seen from base b join first_seen f using(player_key)),
 completions as(
  select distinct player_key,quest_id,session_id,properties->>'attempt_id' attempt_id,properties->>'run_index' run_index
  from base where event_name in ('attempt_completed','puzzle_complete') and quest_id is not null
 ),starts as(
  select distinct player_key,quest_id,session_id,properties->>'attempt_id' attempt_id,properties->>'run_index' run_index
  from base where event_name in ('attempt_started','attempt_run_started') and quest_id is not null
 ),daily as(
  select (occurred_at at time zone 'UTC')::date activity_date,count(distinct player_key) players from base group by 1
 )
 select jsonb_build_object('days',p_days,
  'collection',jsonb_build_object('enabled',false,'last_event_at',(select max(occurred_at) from history),'clock','UTC'),
  'summary',jsonb_build_object('unique_players',(select count(*) from players),
   'new_players',(select count(*) from players where first_seen>=now()-make_interval(days=>p_days)),
   'returning_players',(select count(*) from players where first_seen<now()-make_interval(days=>p_days)),
   'dau',(select count(distinct player_key) from history where occurred_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
   'wau',(select count(distinct player_key) from history where occurred_at>=now()-interval '7 days'),
   'sessions',(select count(distinct (player_key,session_id)) from base where session_id is not null),
   'quests_started',(select count(*) from starts),'quests_completed',(select count(*) from completions),
   'feedback_count',(select count(*) from lumen.feedback where created_at>=now()-make_interval(days=>p_days))),
  'daily',coalesce((select jsonb_agg(to_jsonb(d) order by activity_date) from daily d),'[]'),
  'retention',jsonb_build_object('j1',null,'j3',null,'j7',null,'reason','collection_disabled_incomplete_cohorts'),
  'funnel','[]'::jsonb,'friction','[]'::jsonb) into result;
 return result||jsonb_build_object('service_activity',lumen_commands.service_activity(p_days));
end $$;
revoke all on function public.lumen_admin_cockpit(integer) from public,anon;
grant execute on function public.lumen_admin_cockpit(integer) to authenticated,service_role;

-- Preserve all historical outbox counts; add separately named fresh evidence.
create or replace function lumen_commands.outbox_health_summary() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('pending_players',count(distinct user_id) filter(where pending>0),
  'critical_players',count(distinct user_id) filter(where state='critical'),
  'stalled_players',count(distinct user_id) filter(where state<>'confirmed' and oldest_pending_at<=now()-interval '15 minutes'),
  'recurrent_players',count(distinct user_id) filter(where failures>=3),'large_backlogs',count(distinct user_id) filter(where pending>=20),
  'fresh_pending_players',count(distinct user_id) filter(where pending>0 and updated_at>=now()-interval '15 minutes' and updated_at<=now()),
  'fresh_critical_players',count(distinct user_id) filter(where state='critical' and updated_at>=now()-interval '15 minutes' and updated_at<=now()),
  'last_observed_at',max(updated_at),'freshness_minutes',15,
  'alerts',coalesce((select jsonb_agg(to_jsonb(a) order by a.observed_at desc,a.key) from(
   select md5(user_id::text||client_id::text||oldest_pending_at::text) key,state,pending,oldest_pending_at since,
    platform,app_version version,updated_at observed_at,
    updated_at>=now()-interval '15 minutes' and updated_at<=now() fresh
   from lumen_commands.outbox_health where state='critical' or (state<>'confirmed' and
    (oldest_pending_at<=now()-interval '15 minutes' or failures>=3 or pending>=20))
   order by updated_at desc,user_id,client_id limit 20)a),'[]'))
 from lumen_commands.outbox_health;
$$;
revoke all on function lumen_commands.outbox_health_summary() from public,anon,authenticated;
create or replace function public.lumen_admin_quest_metrics(p_days integer default 7) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid() and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 p_days:=greatest(1,least(coalesce(p_days,7),3650));
 with base as(select * from lumen_commands.quest_analytics(p_days)),friction as(
  select quest_id stable_quest_id,quest_ordinal,min(puzzle_id) puzzle_id,
   count(distinct player_key) filter(where event_name in ('attempt_started','puzzle_start')) started,
   count(distinct player_key) filter(where event_name in ('attempt_completed','puzzle_complete')) completed,
   count(*) filter(where event_name='attempt_reset') resets,count(*) filter(where event_name='attempt_abandoned') abandons,
   count(*) filter(where event_name='hint_used') hints,count(*) filter(where event_name='verify_used') verifies,
   count(*) filter(where event_name='guided_intervention') guided,
   case when count(distinct properties->>'grid_revision') filter(where event_name='attempt_completed')=1 then percentile_cont(.5) within group(order by case when properties->>'active_seconds' ~ '^[0-9]+(\.[0-9]+)?$' then (properties->>'active_seconds')::numeric end)
    filter(where event_name='attempt_completed' and properties->>'grid_revision' ~ '^[0-9]+$') end median_seconds,
   count(*) filter(where event_name='attempt_completed' and properties->>'grid_revision' ~ '^[0-9]+$' and properties->>'active_seconds' ~ '^[0-9]+(\.[0-9]+)?$') duration_samples,
   case when count(distinct properties->>'grid_revision') filter(where event_name='attempt_completed')=1 then min(properties->>'grid_revision') filter(where event_name='attempt_completed') end observed_grid_revision
  from base where quest_id is not null group by quest_id,quest_ordinal
 ),counts as(
  select count(distinct player_key) filter(where event_name='session_start') app_open,
   count(distinct player_key) filter(where quest_ordinal=1 and event_name in ('attempt_started','puzzle_start')) q1_start,
   count(distinct player_key) filter(where quest_ordinal=1 and event_name in ('attempt_completed','puzzle_complete')) q1_done,
   null::bigint tutorial_done,
   count(distinct player_key) filter(where quest_ordinal>=3 and event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) q3_reached,
   count(distinct player_key) filter(where quest_ordinal>=10 and event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) q10_reached from base
 ),funnel as(
  select v.* from counts c cross join lateral(values
   (1,'Application lancée',c.app_open),(2,'Quête 1 commencée',c.q1_start),(3,'Quête 1 terminée',c.q1_done),
   (4,'Tutoriel terminé',c.tutorial_done),(5,'Quête 3 atteinte',c.q3_reached),(6,'Quête 10 atteinte',c.q10_reached))v(step,label,players)
 ),furthest as(
  select player_key,max(quest_ordinal) quest_ordinal,max(occurred_at) occurred_at
  from lumen_commands.quest_analytics(null)
  where quest_id is not null and event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')
  group by player_key
 ),recent as(select * from furthest order by occurred_at desc,player_key limit 1000)
 select jsonb_build_object('friction',coalesce((select jsonb_agg(to_jsonb(f) order by quest_ordinal) from friction f),'[]'),
  'funnel',(select jsonb_agg(to_jsonb(f) order by step) from funnel f),
  'current_players',coalesce((select jsonb_object_agg(player_key,quest_ordinal) from recent),'{}')) into result;
 return result;
end $$;
revoke all on function public.lumen_admin_quest_metrics(integer) from public,anon;
grant execute on function public.lumen_admin_quest_metrics(integer) to authenticated;

-- Keep the existing account contract; ambiguous legacy traffic is not human.
CREATE OR REPLACE FUNCTION public.lumen_admin_accounts(p_limit integer DEFAULT 250)
 RETURNS TABLE(user_id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, nickname text, last_activity timestamp with time zone, current_quest integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not exists(
   select 1 from lumen.internal_capabilities c
   where c.user_id=auth.uid() and c.capability='analytics_cockpit'
     and (c.expires_at is null or c.expires_at>now())
 ) then raise exception 'analytics_cockpit capability required' using errcode='42501'; end if;

 return query
 select u.id,u.email::text,u.created_at,u.last_sign_in_at,p.nickname,a.last_activity,
        greatest(pr.current_quest,a.current_quest)
 from lumen.users lu
 join auth.users u on u.id=lu.user_id
 left join lumen.profiles p on p.user_id=u.id
 left join lateral (
   select max(e.occurred_at) last_activity,
          max((q.rules->>'ordinal')::integer) filter(where e.event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) current_quest
   from lumen.analytics_events e left join lumen_commands.quest_rules q on q.quest_id=coalesce(e.properties->>'stable_quest_id',
    (select h.quest_id from lumen_commands.quest_rules h where h.legacy_index=e.puzzle_id-1))
    and (e.properties->>'stable_quest_id' is null or e.puzzle_id is null or q.legacy_index=e.puzzle_id-1)
   where e.user_id=u.id and e.occurred_at<=now()
    and e.properties->>'traffic_type'='human' and coalesce(e.properties->>'qa_mode','')=''
 ) a on true
 left join lateral (
   select max((q.rules->>'ordinal')::integer) current_quest
   from lumen.progress g join lumen_commands.quest_rules q on q.legacy_index=g.puzzle_id where g.user_id=u.id
 ) pr on true
 order by lu.last_seen_at desc
 limit greatest(1,least(coalesce(p_limit,250),1000));
end $function$;

revoke all on function public.lumen_admin_accounts(integer) from public,anon;
grant execute on function public.lumen_admin_accounts(integer) to authenticated,service_role;

create or replace function public.lumen_admin_recent_players(p_limit integer default 250)
returns table(player_key text,display_name text,player_type text,last_seen timestamptz,sessions bigint,current_quest integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid()
  and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 return query
 with ranked as (
  select e.player_key pkey,max(e.occurred_at) latest,count(distinct e.session_id) sess,max(e.quest_ordinal) quest
  from lumen_commands.cockpit_events(90) e
  where e.player_key like 'a:%' or exists(select 1 from lumen.users u where 'u:'||u.user_id::text=e.player_key)
  group by e.player_key
 )
 select r.pkey,coalesce(nullif(p.nickname,''),case when r.pkey like 'u:%' then 'Joueur connecté' else 'Joueur '||upper(substr(md5(r.pkey),1,4)) end),
  case when r.pkey like 'u:%' then 'authenticated' else 'anonymous' end,r.latest,r.sess,r.quest
 from ranked r left join lumen.profiles p on 'u:'||p.user_id::text=r.pkey
 order by r.latest desc,r.pkey limit greatest(1,least(coalesce(p_limit,250),500));
end $$;
revoke all on function public.lumen_admin_recent_players(integer) from public,anon;
grant execute on function public.lumen_admin_recent_players(integer) to authenticated;
notify pgrst,'reload schema';
commit;
