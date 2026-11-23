-- #995 (Free-first), owner decision 23/11/2026: drop two exact duplicate
-- indexes on lumen.analytics_events (~18 MB on 23/11, already listed in
-- ANALYTICS_STORAGE_AUDIT_261). No row is touched.
--  * analytics_events_anon_idx     (anonymous_id, occurred_at): 8 scans,
--    twin of analytics_events_anonymous_occurred_idx (301 313 scans);
--  * analytics_events_occurred_idx (occurred_at): 2 scans,
--    twin of analytics_events_occurred_at_idx (529 scans).
-- Each drop requires its twin to exist with the same definition, so a
-- database where the twin is missing keeps its only index.
-- The table receives no insert since 26/10 (public collection disabled, #708),
-- so the brief exclusive lock of DROP INDEX blocks no player traffic.
-- Rollback: recreate them, e.g.
--   create index analytics_events_occurred_idx on lumen.analytics_events(occurred_at);
begin;
do $do$
declare
  pair text[];
  pairs constant text[][] := array[
    ['analytics_events_anon_idx','analytics_events_anonymous_occurred_idx'],
    ['analytics_events_occurred_idx','analytics_events_occurred_at_idx']];
  dup regclass; twin regclass;
begin
  foreach pair slice 1 in array pairs loop
    dup := to_regclass('lumen.'||pair[1]);
    twin := to_regclass('lumen.'||pair[2]);
    if dup is null or twin is null then continue; end if;
    if (select indrelid from pg_index where indexrelid=dup) <> 'lumen.analytics_events'::regclass
      or replace(pg_get_indexdef(dup),pair[1],'') <> replace(pg_get_indexdef(twin),pair[2],'') then
      raise notice 'kept %: twin definition differs', pair[1];
      continue;
    end if;
    execute format('drop index lumen.%I', pair[1]);
  end loop;
end $do$;
commit;
