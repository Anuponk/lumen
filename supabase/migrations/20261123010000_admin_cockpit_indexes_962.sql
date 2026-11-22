-- #962: lumen_admin_cockpit, lumen_admin_quest_metrics and lumen_admin_recent_players
-- exceeded the 8 s statement timeout of `authenticated` (production 22/11: 9.7 s,
-- 7.9 s, 7.3 s measured one by one; HTTP 500 / SQLSTATE 57014 when the cockpit
-- loads them together). All three read lumen_commands.cockpit_events, which cannot
-- be inlined (SET search_path) and therefore runs a generic plan: a sequential scan
-- of every analytics event, decoding `properties` to keep ~3 % of rows (human, non
-- QA traffic), plus a heap read of every account-linked row for anonymous owners.
--
-- Additive only: two indexes matching those exact predicates. No function, result,
-- permission or timeout changes. Analytics collection is currently off (no event
-- in the last 7 days), so the brief write lock of the index build blocks nothing.
-- Rollback: drop the two indexes.
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

commit;
