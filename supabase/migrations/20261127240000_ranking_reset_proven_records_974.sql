-- #974 (owner report 27/11/2026, « Les chemins du firmament »): historical records
-- missing from the rankings. The 11/11 historical import excluded every quest whose
-- grid is no longer revision 0 (« ambiguous_revision »), without reading the proof
-- the player's projection carries: a scoped quest reset (#108) moved that player to
-- the CURRENT grid revision, and the best time was qualified AFTER that reset. Such a
-- time can only have been played on the current grid. Measured on production:
-- 171 records (real-adventure-05: 123, real-adventure-06: 48), two players.
--
-- This migration imports exactly those proven records, with the guards of the
-- original import (account exists, nickname ready, ranking participation, not opted
-- out), without penalty (historical times predate official penalties, same as the
-- original import), only when no better score exists, with a backup row per change
-- (lumen_commands.ranking_import_backup) for rollback. Adventure points follow via the
-- existing statement trigger. Idempotent: a re-run imports nothing new.
begin;

create or replace view lumen_commands.ranking_reset_proven_candidates as
select a.user_id, a.quest_id, r.grid_revision,
  (a.projection #>> '{runPerformance,bestTime}')::integer as seconds,
  (a.projection ->> 'resetAt')::timestamptz as reset_at,
  (a.projection #>> '{runPerformance,lastQualifiedAt}')::timestamptz as qualified_at
from lumen_commands.quest_run_authority a
join lumen_commands.quest_rules r using (quest_id)
join lumen_commands.ranking_groups g using (quest_id)
where r.grid_revision <> 0
  and a.projection ->> 'solved' = 'true'
  and a.projection ->> 'resetRevision' ~ '^[0-9]{1,4}$'
  and (a.projection ->> 'resetRevision')::integer = r.grid_revision
  and coalesce(nullif(a.projection ->> 'gridRevision', ''), a.projection ->> 'resetRevision') = r.grid_revision::text
  and a.projection #>> '{runPerformance,bestTime}' ~ '^[0-9]{1,5}$'
  and (a.projection #>> '{runPerformance,bestTime}')::integer between 1 and 86400
  and a.projection ->> 'resetAt' is not null
  and a.projection #>> '{runPerformance,lastQualifiedAt}' is not null
  and (a.projection #>> '{runPerformance,lastQualifiedAt}')::timestamptz > (a.projection ->> 'resetAt')::timestamptz;
revoke all on lumen_commands.ranking_reset_proven_candidates from public, anon, authenticated, service_role;

create or replace function lumen_commands.import_reset_proven_records(p_apply boolean default false, p_batch uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; imported integer := 0; improved integer := 0; unchanged integer := 0; skipped integer := 0; a integer; b integer; c_new integer;
begin
 for u in select distinct user_id from lumen_commands.ranking_reset_proven_candidates order by user_id loop
  -- Same owner lock as withdrawal, finish, erasure and the original import.
  perform pg_advisory_xact_lock(hashtextextended('ranking:' || u::text, 0));
  if not exists(select 1 from auth.users where id = u)
   or not exists(select 1 from lumen.profiles where user_id = u and nickname_ready and not ranking_opted_out)
   or not exists(select 1 from lumen_commands.ranking_members where user_id = u and participating) then
   skipped := skipped + (select count(*) from lumen_commands.ranking_reset_proven_candidates where user_id = u);
   continue;
  end if;
  select count(*) filter (where s.user_id is not null and s.score <= c.seconds),
         count(*) filter (where s.user_id is not null and s.score > c.seconds),
         count(*) filter (where s.user_id is null)
    into a, b, c_new
    from lumen_commands.ranking_reset_proven_candidates c
    left join lumen_commands.ranking_scores s on s.user_id = c.user_id and s.quest_id = c.quest_id and s.grid_revision = c.grid_revision
   where c.user_id = u;
  unchanged := unchanged + a; improved := improved + b; imported := imported + c_new;
  if p_apply then
   insert into lumen_commands.ranking_import_backup(batch_id, user_id, quest_id, grid_revision, previous, imported_seconds)
    select p_batch, c.user_id, c.quest_id, c.grid_revision, case when s.user_id is not null then to_jsonb(s) end, c.seconds
    from lumen_commands.ranking_reset_proven_candidates c
    left join lumen_commands.ranking_scores s on s.user_id = c.user_id and s.quest_id = c.quest_id and s.grid_revision = c.grid_revision
    where c.user_id = u and (s.user_id is null or s.score > c.seconds);
   insert into lumen_commands.ranking_scores(user_id, quest_id, grid_revision, seconds, penalty)
    select c.user_id, c.quest_id, c.grid_revision, c.seconds, 0
    from lumen_commands.ranking_reset_proven_candidates c where c.user_id = u
    on conflict (user_id, quest_id, grid_revision) do update set seconds = excluded.seconds, penalty = 0
     where lumen_commands.ranking_scores.score > excluded.seconds;
  end if;
 end loop;
 return jsonb_build_object('batch', p_batch, 'applied', p_apply,
  'candidates', (select count(*) from lumen_commands.ranking_reset_proven_candidates),
  'imported', imported, 'improved', improved, 'unchanged', unchanged, 'skipped', skipped);
end $$;
revoke all on function lumen_commands.import_reset_proven_records(boolean, uuid) from public, anon, authenticated, service_role;

select lumen_commands.import_reset_proven_records(true);
notify pgrst, 'reload schema';
commit;
