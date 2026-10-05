-- Issue #115: beta-test admin cockpit and complete product analytics contract.
-- Admin reads are only exposed through authenticated, capability-checked RPCs.

insert into lumen.internal_capabilities(user_id,capability,source)
select user_id,'analytics_cockpit','issue-115'
from lumen.internal_capabilities
where capability='unlimited_shards'
on conflict (user_id,capability) do nothing;

create index if not exists analytics_events_occurred_at_idx on lumen.analytics_events(occurred_at);
create index if not exists analytics_events_event_occurred_idx on lumen.analytics_events(event_name,occurred_at);
create index if not exists analytics_events_anonymous_occurred_idx on lumen.analytics_events(anonymous_id,occurred_at);
create index if not exists analytics_events_user_occurred_idx on lumen.analytics_events(user_id,occurred_at) where user_id is not null;
create index if not exists analytics_events_puzzle_event_idx on lumen.analytics_events(puzzle_id,event_name) where puzzle_id is not null;
create index if not exists feedback_created_at_idx on lumen.feedback(created_at);

create or replace function public.lumen_track_event(
 p_anonymous_id text,p_event_name text,p_session_id text,p_puzzle_id integer default null,p_properties jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path=''
as $$
begin
 if length(p_anonymous_id) between 8 and 100
    and length(p_session_id) between 8 and 100
    and length(p_event_name) between 2 and 80
    and p_event_name = any(array[
      'session_start','app_opened','puzzle_start','puzzle_complete','tutorial_complete',
      'attempt_started','attempt_run_started','attempt_reset','attempt_completed','attempt_abandoned',
      'hint_used','verify_used','guided_intervention','auto_marking_enabled',
      'referral_visit','share_result','pwa_install_offer','pwa_install_choice','pwa_install_later','pwa_installed',
      'push_offer','push_choice','campaign_completed','account_signin_success','account_signin_failure','feedback_submitted'
    ])
    and (p_puzzle_id is null or p_puzzle_id between 1 and 10000)
 then
   insert into lumen.analytics_events(user_id,anonymous_id,event_name,puzzle_id,session_id,properties)
   values(auth.uid(),p_anonymous_id,p_event_name,p_puzzle_id,p_session_id,coalesce(p_properties,'{}'::jsonb));
 end if;
end $$;
revoke all on function public.lumen_track_event(text,text,text,integer,jsonb) from public;
grant execute on function public.lumen_track_event(text,text,text,integer,jsonb) to anon,authenticated,service_role;

create or replace function public.lumen_send_feedback(
 p_anonymous_id text,p_kind text,p_message text,p_puzzle_id integer,p_board_state jsonb,
 p_elapsed_seconds integer,p_hints_used integer,p_app_version text,p_user_agent text
) returns void
language plpgsql set search_path=''
as $$
begin
 if length(p_anonymous_id) between 8 and 100
    and p_kind in ('like','lost','bug','idea','rule','difficulty','other')
    and (p_puzzle_id is null or p_puzzle_id between 1 and 10000)
 then
  insert into lumen.feedback(user_id,anonymous_id,kind,message,puzzle_id,board_state,elapsed_seconds,hints_used,app_version,user_agent)
  values(auth.uid(),p_anonymous_id,p_kind,nullif(left(coalesce(p_message,''),2000),''),
         p_puzzle_id,null,greatest(coalesce(p_elapsed_seconds,0),0),greatest(coalesce(p_hints_used,0),0),
         left(coalesce(p_app_version,''),100),left(coalesce(p_user_agent,''),500));
 end if;
end $$;

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
     and coalesce(e.properties->>'qa_mode','')=''
 ), all_first as (
   select anonymous_id,min(occurred_at) first_seen from lumen.analytics_events
   where coalesce(properties->>'qa_mode','')='' group by anonymous_id
 ), players as (
   select b.player_key,min(b.occurred_at) first_in_period,max(b.occurred_at) last_seen,
     bool_or(f.first_seen>=now()-(p_days||' days')::interval) is_new
   from base b join all_first f using(anonymous_id) group by b.player_key
 ), daily as (
   select occurred_at::date day,count(distinct player_key) players,
     count(*) filter(where event_name in ('attempt_completed','puzzle_complete')) completions
   from base group by occurred_at::date order by day
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
    count(*) filter(where exists(select 1 from lumen.analytics_events e2 where e2.anonymous_id=f.anonymous_id and e2.occurred_at::date=f.first_day+1 and coalesce(e2.properties->>'qa_mode','')='')) j1_n,
    count(*) filter(where exists(select 1 from lumen.analytics_events e2 where e2.anonymous_id=f.anonymous_id and e2.occurred_at::date=f.first_day+3 and coalesce(e2.properties->>'qa_mode','')='')) j3_n,
    count(*) filter(where exists(select 1 from lumen.analytics_events e2 where e2.anonymous_id=f.anonymous_id and e2.occurred_at::date=f.first_day+7 and coalesce(e2.properties->>'qa_mode','')='')) j7_n,
    count(*) cohort
   from (select anonymous_id,min(occurred_at)::date first_day from lumen.analytics_events
         where coalesce(properties->>'qa_mode','')='' group by anonymous_id) f
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

create or replace function public.lumen_admin_players(p_days integer default 30)
returns table(player_key text,display_name text,player_type text,first_seen timestamptz,last_seen timestamptz,
 sessions bigint,active_days bigint,current_quest integer,quests_completed bigint,hints bigint,feedbacks bigint)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid() and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception 'analytics_cockpit capability required' using errcode='42501'; end if;
 return query
 with mapped as (
   select e.*,coalesce((select 'u:'||x.user_id::text from lumen.analytics_events x where x.anonymous_id=e.anonymous_id and x.user_id is not null order by x.occurred_at desc limit 1),'a:'||e.anonymous_id) pk
   from lumen.analytics_events e where e.occurred_at>=now()-(greatest(1,least(coalesce(p_days,30),3650))||' days')::interval and coalesce(e.properties->>'qa_mode','')=''
 ), roll as (
   select pk,min(occurred_at) first_seen,max(occurred_at) last_seen,count(distinct session_id) sessions,count(distinct occurred_at::date) active_days,
     max(puzzle_id) filter(where event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) current_quest,
     count(distinct puzzle_id) filter(where event_name in ('attempt_completed','puzzle_complete')) quests_completed,
     count(*) filter(where event_name='hint_used') hints,max(user_id) user_id,min(anonymous_id) anon
   from mapped group by pk
 )
 select r.pk,
   coalesce(p.nickname,case when r.pk like 'a:%' then 'Joueur '||upper(substr(md5(r.anon),1,4)) else 'Compte '||upper(substr(md5(r.pk),1,4)) end),
   case when r.user_id is null then 'anonymous' else 'authenticated' end,
   r.first_seen,r.last_seen,r.sessions,r.active_days,r.current_quest,r.quests_completed,r.hints,
   (select count(*) from lumen.feedback f where (r.user_id is not null and f.user_id=r.user_id) or (r.user_id is null and f.anonymous_id=r.anon))
 from roll r left join lumen.profiles p on p.user_id=r.user_id order by r.last_seen desc limit 250;
end $$;
revoke all on function public.lumen_admin_players(integer) from public,anon;
grant execute on function public.lumen_admin_players(integer) to authenticated,service_role;

create or replace function public.lumen_admin_player_timeline(p_player_key text,p_limit integer default 100)
returns table(occurred_at timestamptz,event_name text,puzzle_id integer,properties jsonb)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid() and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception 'analytics_cockpit capability required' using errcode='42501'; end if;
 return query
 with linked as (
   select distinct e.anonymous_id from lumen.analytics_events e
   where ('a:'||e.anonymous_id=p_player_key)
      or (p_player_key like 'u:%' and e.user_id::text=substr(p_player_key,3))
 )
 select e.occurred_at,e.event_name,e.puzzle_id,
   e.properties - 'board_state' - 'email' - 'name'
 from lumen.analytics_events e join linked l using(anonymous_id)
 where coalesce(e.properties->>'qa_mode','')=''
 order by e.occurred_at desc limit greatest(1,least(coalesce(p_limit,100),500));
end $$;
revoke all on function public.lumen_admin_player_timeline(text,integer) from public,anon;
grant execute on function public.lumen_admin_player_timeline(text,integer) to authenticated,service_role;

create or replace function public.lumen_admin_feedback(p_days integer default 30)
returns table(id bigint,created_at timestamptz,kind text,message text,puzzle_id integer,elapsed_seconds integer,hints_used integer,app_version text,player_label text)
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid() and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception 'analytics_cockpit capability required' using errcode='42501'; end if;
 return query select f.id,f.created_at,f.kind,f.message,f.puzzle_id,f.elapsed_seconds,f.hints_used,f.app_version,
   coalesce(p.nickname,'Joueur '||upper(substr(md5(f.anonymous_id),1,4)))
 from lumen.feedback f left join lumen.profiles p on p.user_id=f.user_id
 where f.created_at>=now()-(greatest(1,least(coalesce(p_days,30),3650))||' days')::interval
 order by f.created_at desc limit 250;
end $$;
revoke all on function public.lumen_admin_feedback(integer) from public,anon;
grant execute on function public.lumen_admin_feedback(integer) to authenticated,service_role;
