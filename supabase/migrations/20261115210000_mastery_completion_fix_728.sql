-- #728 fix: some canonical quest projections hold a won run (runPerformance) and the
-- badges but no "solved" key (historical import / older command path). Verified in
-- production on 15/11/2026: 49 such rows, including Adventure 1 quests of the most
-- advanced players, which made 100% mastery of Adventure 1 impossible on the server.
-- A canonical quest now counts as completed when "solved" is truthy OR a run is
-- recorded. Mastery still requires every badge on every quest, and the server grants
-- badges only on victories, so no unlock can be obtained without winning.
-- Legacy quests are unchanged. Re-applying this migration is safe.
begin;
create or replace function lumen_commands.adventure_mastery(p_user uuid,p_pack text)
returns jsonb language sql stable security definer set search_path='' as $$
 with keys as (select badge_keys from lumen_commands.store_settings where singleton),
 legacy as (select projection from lumen_commands.legacy_authority where user_id=p_user),
 quests as (
  select qp.quest_id,
   case when qp.legacy_index is not null
    then (select l.projection->'solved'->(qp.legacy_index::text) not in ('null'::jsonb,'false'::jsonb,'0'::jsonb) from legacy l)
    else (select (r.projection->'solved' is not null and r.projection->'solved' not in ('null'::jsonb,'false'::jsonb,'0'::jsonb))
      or r.projection ? 'runPerformance'
     from lumen_commands.quest_run_authority r where r.user_id=p_user and r.quest_id=qp.quest_id)
   end as completed,
   case when qp.legacy_index is not null
    then (select case when jsonb_typeof(l.projection->'performances'->(qp.legacy_index::text)->'version')='number'
      and (l.projection->'performances'->(qp.legacy_index::text)->>'version')::numeric>=2
      then l.projection->'performances'->(qp.legacy_index::text)->'badges' end from legacy l)
    else (select r.projection->'badges' from lumen_commands.quest_run_authority r where r.user_id=p_user and r.quest_id=qp.quest_id)
   end as badges
  from lumen_commands.quest_packs qp where qp.pack_id=p_pack)
 select jsonb_build_object(
  'quests',count(*),
  'completed',count(*) filter (where q.completed is true),
  'possible',count(*)*coalesce((select cardinality(badge_keys) from keys),0),
  'earned',coalesce(sum((select count(*) from unnest((select badge_keys from keys)) k where q.badges->k='true'::jsonb)),0))
 from quests q;
$$;
revoke all on function lumen_commands.adventure_mastery(uuid,text) from public,anon,authenticated;
commit;
