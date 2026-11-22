-- #962: the admin cockpit indexes exist with the exact cockpit_events predicates,
-- are usable by the planner for those predicates, and change no result.
-- Synthetic data in disposable PostgreSQL only, rolled back.
do $$begin
 if current_database()<>'lumen_test' then raise exception 'Disposable fixture requires the isolated test database';end if;
end $$;
\ir ../../supabase/migrations/20261123010000_admin_cockpit_indexes_962.sql
\ir ../../supabase/migrations/20261123010000_admin_cockpit_indexes_962.sql
begin;
do $$
declare
 owner uuid := gen_random_uuid();
 plan text := ''; line text; human_before bigint; human_after bigint; events_before bigint;
begin
 -- Exact predicates (the planner only uses a partial index whose predicate the query implies).
 assert (select indexdef from pg_indexes where schemaname='lumen' and indexname='analytics_events_human_occurred_idx')
  like '%(occurred_at) WHERE (((properties ->> ''traffic_type''::text) = ''human''::text) AND (COALESCE((properties ->> ''qa_mode''::text), ''''::text) = ''''::text))',
  'human index predicate matches cockpit_events';
 assert (select indexdef from pg_indexes where schemaname='lumen' and indexname='analytics_events_user_anonymous_idx')
  like '%(anonymous_id, user_id) WHERE (user_id IS NOT NULL)', 'owner index covers anonymous_id and user_id';

 -- `owners` is computed once (the inlined CTE was re-aggregated per event in production).
 assert position('owners as materialized' in (select prosrc from pg_proc where oid='lumen_commands.cockpit_events(integer)'::regprocedure))>0,
  'cockpit_events materializes owners';
 assert not has_function_privilege('authenticated','lumen_commands.cockpit_events(integer)','execute'), 'internal function stays private';
 select count(*) into events_before from lumen_commands.cockpit_events(null);
 insert into auth.users(id) values (owner);
 insert into lumen.analytics_events(user_id, anonymous_id, event_name, session_id, occurred_at, properties) values
  (owner, 'anon-962-a', 'session_start', 's1', now() - interval '1 day', '{"traffic_type":"human"}'),
  (null, 'anon-962-a', 'attempt_started', 's1', now() - interval '1 day', '{"traffic_type":"human"}'),
  (null, 'anon-962-b', 'session_start', 's2', now() - interval '2 days', '{"traffic_type":"automated_test"}'),
  (null, 'anon-962-c', 'session_start', 's3', now() - interval '2 days', '{"traffic_type":"human","qa_mode":"qa"}');
 select count(*) into human_after from lumen_commands.cockpit_events(null);
 assert human_after = events_before + 2, 'only human, non-QA events are returned (unchanged semantics)';
 assert (select count(*) from lumen_commands.cockpit_events(null) where player_key = 'u:' || owner::text) = 2,
  'an anonymous id owned by exactly one account is attributed to it';

 -- The planner can answer the cockpit_events filter from the partial index.
 set local enable_seqscan = off;
 for line in execute 'explain select count(*) from lumen.analytics_events e where e.occurred_at <= now()
   and e.properties->>''traffic_type''=''human'' and coalesce(e.properties->>''qa_mode'','''')='''''
 loop plan := plan || line || ' '; end loop;
 assert position('analytics_events_human_occurred_idx' in plan) > 0, 'human index usable: ' || plan;
 plan := '';
 for line in execute 'explain select anonymous_id, min(user_id::text) from lumen.analytics_events where user_id is not null group by anonymous_id'
 loop plan := plan || line || ' '; end loop;
 assert position('analytics_events_user_anonymous_idx' in plan) > 0, 'owner index usable: ' || plan;
end $$;
rollback;
