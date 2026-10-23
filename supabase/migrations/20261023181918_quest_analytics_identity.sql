-- #522: read-only stable quest analytics. No event/player rewrite or new PII.
create function lumen_commands.quest_analytics(p_days integer)
returns table(player_key text,event_name text,quest_id text,quest_ordinal integer,puzzle_id integer,occurred_at timestamptz,properties jsonb)
language sql stable security definer set search_path='' as $$
 select coalesce('u:'||e.user_id::text,
  (select 'u:'||min(x.user_id::text) from lumen.analytics_events x where x.anonymous_id=e.anonymous_id and x.user_id is not null having count(distinct x.user_id)=1),
  'a:'||e.anonymous_id),e.event_name::text,q.quest_id,(q.rules->>'ordinal')::integer,e.puzzle_id,e.occurred_at,e.properties
 from lumen.analytics_events e
 left join lumen_commands.quest_rules q on q.quest_id=coalesce(e.properties->>'stable_quest_id',
  (select historical.quest_id from lumen_commands.quest_rules historical where historical.legacy_index=e.puzzle_id-1))
  and (e.properties->>'stable_quest_id' is null or e.puzzle_id is null or q.legacy_index=e.puzzle_id-1)
 where (p_days is null or e.occurred_at>=now()-make_interval(days=>p_days))
  and coalesce(e.properties->>'qa_mode','')='' and e.properties->>'traffic_type'='human';
$$;
revoke all on function lumen_commands.quest_analytics(integer) from public,anon,authenticated;
create function public.lumen_admin_quest_metrics(p_days integer default 7) returns jsonb
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
   percentile_cont(.5) within group(order by case when properties->>'active_seconds' ~ '^[0-9]+(\.[0-9]+)?$' then (properties->>'active_seconds')::numeric end)
    filter(where event_name='attempt_completed') median_seconds
  from base where quest_id is not null group by quest_id,quest_ordinal
 ),counts as(
  select count(distinct player_key) filter(where event_name='session_start') app_open,
   count(distinct player_key) filter(where quest_ordinal=1 and event_name in ('attempt_started','puzzle_start')) q1_start,
   count(distinct player_key) filter(where quest_ordinal=1 and event_name in ('attempt_completed','puzzle_complete')) q1_done,
   count(distinct player_key) filter(where event_name='tutorial_complete') tutorial_done,
   count(distinct player_key) filter(where quest_ordinal>=3 and event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) q3_reached,
   count(distinct player_key) filter(where quest_ordinal>=10 and event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')) q10_reached from base
 ),funnel as(
  select v.* from counts c cross join lateral(values
   (1,'Application lancée',c.app_open),(2,'Quête 1 commencée',c.q1_start),(3,'Quête 1 terminée',c.q1_done),
   (4,'Tutoriel terminé',c.tutorial_done),(5,'Quête 3 atteinte',c.q3_reached),(6,'Quête 10 atteinte',c.q10_reached))v(step,label,players)
 ),latest as(
  select distinct on(player_key) player_key,quest_ordinal,occurred_at from lumen_commands.quest_analytics(null)
  where quest_id is not null and event_name in ('attempt_started','puzzle_start','attempt_completed','puzzle_complete')
  order by player_key,occurred_at desc,quest_ordinal desc
 ),recent as(select * from latest order by occurred_at desc limit 1000)
 select jsonb_build_object('friction',coalesce((select jsonb_agg(to_jsonb(f) order by quest_ordinal) from friction f),'[]'),
  'funnel',(select jsonb_agg(to_jsonb(f) order by step) from funnel f),
  'current_players',coalesce((select jsonb_object_agg(player_key,quest_ordinal) from recent),'{}')) into result;
 return result;
end $$;
create function public.lumen_admin_quest_timeline(p_player_key text,p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid() and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.occurred_at desc),'[]') into result from(
  select event_name,puzzle_id,quest_id stable_quest_id,quest_ordinal,occurred_at from lumen_commands.quest_analytics(null)
  where player_key=p_player_key order by occurred_at desc limit greatest(1,least(coalesce(p_limit,100),1000))
 )x;
 return result;
end $$;
revoke all on function public.lumen_admin_quest_metrics(integer),public.lumen_admin_quest_timeline(text,integer) from public,anon;
grant execute on function public.lumen_admin_quest_metrics(integer),public.lumen_admin_quest_timeline(text,integer) to authenticated;
notify pgrst,'reload schema';
