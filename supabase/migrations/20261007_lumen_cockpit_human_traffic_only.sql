-- Cockpit metrics must represent real players only.
-- Events without an explicit traffic_type are legacy/ambiguous and are intentionally excluded.
-- Automated browser tests and QA sessions are excluded as well.

create or replace function public.lumen_admin_cockpit(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(
   select 1 from lumen.internal_capabilities c
   where c.user_id=auth.uid() and c.capability='analytics_cockpit'
     and (c.expires_at is null or c.expires_at>now())
 ) then raise exception 'analytics_cockpit capability required' using errcode='42501'; end if;
 p_days:=greatest(1,least(coalesce(p_days,7),3650));
 with base as (
   select e.*,
     coalesce((select 'u:'||x.user_id::text from lumen.analytics_events x
       where x.anonymous_id=e.anonymous_id and x.user_id is not null order by x.occurred_at desc limit 1),
       'a:'||e.anonymous_id) player_key
   from lumen.analytics_events e
   where e.occurred_at>=now()-(p_days||' days')::interval
     and coalesce(e.properties->>'qa_mode','')='' and e.properties->>'traffic_type'='human'
 ), all_first as (
   select anonymous_id,min(occurred_at) first_seen from lumen.analytics_events
   where coalesce(properties->>'qa_mode','')='' and properties->>'traffic_type'='human' group by anonymous_id
 ), players as (
   select b.player_key,min(b.occurred_at) first_in_period,max(b.occurred_at) last_seen,
     bool_or(f.first_seen>=now()-(p_days||' days')::interval) is_new
   from base b join all_first f using(anonymous_id) group by b.player_key
 ), daily as (
   select occurred_at::date as activity_date,count(distinct player_key) players,
     count(*) filter(where event_name in ('attempt_completed','puzzle_complete')) completions
   from base group by occurred_at::date order by activity_date
 ), summary as (
   select count(*) unique_players,count(*) filter(where is_new) new_players,
     count(*) filter(where not is_new) returning_players from players
 ), events as (
   select count(distinct session_id) sessions,
     count(*) filter(where event_name in ('attempt_started','puzzle_start')) quests_started,
     count(*) filter(where event_name in ('attempt_completed','puzzle_complete')) quests_completed
   from base
 ), today as (
   select count(distinct player_key) dau from base where occurred_at>=current_date
 ), wau as (
   select count(distinct player_key) wau from base where occurred_at>=now()-interval '7 days'
 ), feedbacks as (
   select count(*) feedback_count from lumen.feedback where created_at>=now()-(p_days||' days')::interval
 ), funnel_counts as (
   select
     count(distinct player_key) filter(where event_name='session_start') app_open,
     count(distinct player_key) filter(where puzzle_id=1 and event_name in ('attempt_started','puzzle_start')) q1_start,
     count(distinct player_key) filter(where puzzle_id=1 and event_name in ('attempt_completed','puzzle_complete')) q1_done,
     count(distinct player_key) filter(where event_name='tutorial_complete') tutorial_done,
     count(distinct player_key) filter(where puzzle_id>=3 and event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) q3_reached,
     count(distinct player_key) filter(where puzzle_id>=10 and event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) q10_reached
   from base
 ), funnel_steps as (
   select v.step,v.label,v.players from funnel_counts c
   cross join lateral (values
     (1,'Application lancée',c.app_open),
     (2,'Quête 1 commencée',c.q1_start),
     (3,'Quête 1 terminée',c.q1_done),
     (4,'Tutoriel terminé',c.tutorial_done),
     (5,'Quête 3 atteinte',c.q3_reached),
     (6,'Quête 10 atteinte',c.q10_reached)
   ) v(step,label,players)
 ), friction as (
   select puzzle_id,
     count(distinct player_key) filter(where event_name in ('attempt_started','puzzle_start')) started,
     count(distinct player_key) filter(where event_name in ('attempt_completed','puzzle_complete')) completed,
     count(*) filter(where event_name='attempt_reset') resets,
     count(*) filter(where event_name='attempt_abandoned') abandons,
     count(*) filter(where event_name='hint_used') hints,
     count(*) filter(where event_name='verify_used') verifies,
     count(*) filter(where event_name='guided_intervention') guided,
     percentile_cont(.5) within group(order by nullif(properties->>'active_seconds','')::numeric)
       filter(where event_name='attempt_completed' and (properties->>'active_seconds')~'^[0-9]+(\\.[0-9]+)?$') median_seconds
   from base where puzzle_id is not null group by puzzle_id order by puzzle_id
 ), retention as (
   select
    count(*) filter(where exists(select 1 from lumen.analytics_events e2 where e2.anonymous_id=f.anonymous_id and e2.occurred_at::date=f.first_day+1 and coalesce(e2.properties->>'qa_mode','')='' and e2.properties->>'traffic_type'='human')) j1_n,
    count(*) filter(where exists(select 1 from lumen.analytics_events e2 where e2.anonymous_id=f.anonymous_id and e2.occurred_at::date=f.first_day+3 and coalesce(e2.properties->>'qa_mode','')='' and e2.properties->>'traffic_type'='human')) j3_n,
    count(*) filter(where exists(select 1 from lumen.analytics_events e2 where e2.anonymous_id=f.anonymous_id and e2.occurred_at::date=f.first_day+7 and coalesce(e2.properties->>'qa_mode','')='' and e2.properties->>'traffic_type'='human')) j7_n,
    count(*) cohort
   from (select anonymous_id,min(occurred_at)::date first_day from lumen.analytics_events
         where coalesce(properties->>'qa_mode','')='' and properties->>'traffic_type'='human' group by anonymous_id) f
   where f.first_day>=current_date-p_days and f.first_day<current_date
 )
 select jsonb_build_object(
   'days',p_days,
   'summary',(select to_jsonb(s)||to_jsonb(e)||to_jsonb(t)||to_jsonb(w)||to_jsonb(fb) from summary s cross join events e cross join today t cross join wau w cross join feedbacks fb),
   'daily',coalesce((select jsonb_agg(to_jsonb(d)) from daily d),'[]'::jsonb),
   'funnel',coalesce((select jsonb_agg(to_jsonb(f) order by step) from funnel_steps f),'[]'::jsonb),
   'friction',coalesce((select jsonb_agg(to_jsonb(f)) from friction f),'[]'::jsonb),
   'retention',(select jsonb_build_object('cohort',cohort,'j1',case when cohort>0 then round(100.0*j1_n/cohort,1) else 0 end,'j3',case when cohort>0 then round(100.0*j3_n/cohort,1) else 0 end,'j7',case when cohort>0 then round(100.0*j7_n/cohort,1) else 0 end) from retention)
 ) into result;
 return result;
end $$;
revoke all on function public.lumen_admin_cockpit(integer) from public,anon;
grant execute on function public.lumen_admin_cockpit(integer) to authenticated,service_role;
