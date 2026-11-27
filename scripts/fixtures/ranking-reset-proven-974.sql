-- Disposable PostgreSQL only; synthetic players, rolled back. #974 owner report
-- 27/11: historical records proven to be on the current grid (scoped reset to the
-- current revision, best time qualified after that reset) join the rankings; every
-- unproven, opted-out or already-better case is left untouched; idempotent; backup.
begin;
do $$
declare
 q text; rev integer; adv text; r jsonb;
 ids uuid[] := array(select ('00000000-0000-4000-8000-000009740a0'||g)::uuid from generate_series(1,6) g);
 proj jsonb;
begin
 select g.quest_id, qr.grid_revision, g.adventure_id into q, rev, adv
  from lumen_commands.ranking_groups g join lumen_commands.quest_rules qr using (quest_id)
  where qr.grid_revision <> 0 order by g.quest_id limit 1;
 if q is null then
  select g.quest_id, g.adventure_id into q, adv from lumen_commands.ranking_groups g order by g.quest_id limit 1;
  update lumen_commands.quest_rules set grid_revision = 1 where quest_id = q;
  rev := 1;
 end if;
 insert into auth.users(id) select unnest(ids);
 insert into lumen.profiles(user_id, nickname) select ids[i], 'Proof974_' || i from generate_series(1,6) i;
 insert into lumen_commands.ranking_members(user_id, nickname, participating) select ids[i], 'Proof974_' || i, true from generate_series(1,6) i
  on conflict (user_id) do update set participating = true;
 update lumen.profiles set ranking_opted_out = true where user_id = ids[4];
 proj := jsonb_build_object('solved', true, 'resetRevision', rev, 'resetAt', '2026-11-08T12:08:28Z',
  'runPerformance', jsonb_build_object('bestTime', 40, 'lastQualifiedAt', '2026-11-08T12:34:13Z'));
 insert into lumen_commands.quest_run_authority(user_id, quest_id, projection) values
  (ids[1], q, proj),
  (ids[2], q, jsonb_set(proj, '{runPerformance,lastQualifiedAt}', '"2026-11-08T11:00:00Z"')),
  (ids[3], q, jsonb_set(proj, '{resetRevision}', to_jsonb(rev + 1))),
  (ids[4], q, proj), (ids[5], q, proj), (ids[6], q, proj);
 insert into lumen_commands.ranking_scores(user_id, quest_id, grid_revision, seconds, penalty) values
  (ids[5], q, rev, 30, 0), (ids[6], q, rev, 60, 0);
 assert not has_function_privilege('authenticated', 'lumen_commands.import_reset_proven_records(boolean,uuid)', 'execute');
 assert not has_table_privilege('authenticated', 'lumen_commands.ranking_reset_proven_candidates', 'select');
 r := lumen_commands.import_reset_proven_records(false);
 assert not exists(select 1 from lumen_commands.ranking_scores where user_id = ids[1]), 'a dry run writes nothing';
 r := lumen_commands.import_reset_proven_records(true);
 assert (select score from lumen_commands.ranking_scores where user_id = ids[1] and quest_id = q and grid_revision = rev) = 40, 'proven record imported: ' || r::text;
 assert not exists(select 1 from lumen_commands.ranking_scores where user_id = ids[2]), 'a time qualified before the reset may be on an older grid';
 assert not exists(select 1 from lumen_commands.ranking_scores where user_id = ids[3]), 'reset to another revision is not proof';
 assert not exists(select 1 from lumen_commands.ranking_scores where user_id = ids[4]), 'opted-out players stay out';
 assert (select score from lumen_commands.ranking_scores where user_id = ids[5]) = 30, 'a better ranked time is never replaced';
 assert (select score from lumen_commands.ranking_scores where user_id = ids[6]) = 40, 'a worse ranked time is improved';
 assert (select (previous ->> 'seconds')::int from lumen_commands.ranking_import_backup where user_id = ids[6]) = 60, 'backup keeps the replaced score';
 assert exists(select 1 from lumen_commands.ranking_import_backup where user_id = ids[1] and previous is null);
 assert exists(select 1 from lumen_commands.ranking_quest_points where user_id = ids[1] and quest_id = q), 'adventure points follow the imported record';
 assert exists(select 1 from lumen_commands.ranking_adventure_totals where user_id = ids[1] and adventure_id = adv);
 r := lumen_commands.import_reset_proven_records(true);
 assert (r ->> 'imported')::int = 0 and (r ->> 'improved')::int = 0, 'idempotent: ' || r::text;
end $$;
rollback;
