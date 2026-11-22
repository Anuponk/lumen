-- #962: lumen_admin_cockpit, lumen_admin_quest_metrics and lumen_admin_recent_players
-- exceeded the 8 s statement timeout of `authenticated` (production 22/11: 9.7 s,
-- 7.9 s, 7.3 s measured one by one; HTTP 500 / SQLSTATE 57014 when the cockpit
-- loads them together). All three read lumen_commands.cockpit_events, which cannot
-- be inlined (SET search_path) and therefore runs a generic plan: a sequential scan
-- of every analytics event, decoding `properties` to keep ~3 % of rows (human, non
-- QA traffic), plus a heap read of every account-linked row for anonymous owners.
--
-- Two indexes matching those exact predicates, and `owners` computed once. Same
-- results, permissions and timeouts. Analytics collection is currently off (no
-- event in the last 7 days), so the brief write lock of the index build blocks nothing.
--
-- Production lesson (22/11): the owner index alone made it worse (9.0-9.5 s). The
-- planner underestimates human rows (no statistics on the JSON predicate) and then
-- re-aggregated the inlined `owners` CTE once per event (5,287 loops, 3.7 M heap
-- fetches). MATERIALIZED computes it once: full history 2.2 M -> 26,809 buffers.
-- Rollback: restore the previous cockpit_events body (without MATERIALIZED) and drop
-- the two indexes.
begin;
set local lock_timeout = '5s';

-- Human, non-QA events: the WHERE clause of cockpit_events, verbatim.
create index if not exists analytics_events_human_occurred_idx
  on lumen.analytics_events (occurred_at)
  where (properties ->> 'traffic_type') = 'human' and coalesce(properties ->> 'qa_mode', '') = '';

-- Owners of anonymous ids (cockpit_events `owners`): answered from the index alone.
create index if not exists analytics_events_user_anonymous_idx
  on lumen.analytics_events (anonymous_id, user_id)
  where user_id is not null;

-- Same body as 20261115162545_reliable_analytics_708.sql; only `owners` is MATERIALIZED.
create or replace function lumen_commands.cockpit_events(p_days integer)
returns table(player_key text,event_name text,quest_id text,quest_ordinal integer,puzzle_id integer,session_id text,occurred_at timestamptz,properties jsonb)
language sql stable security invoker set search_path='' as $$
 with owners as materialized (
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

commit;
