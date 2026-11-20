-- #882 rollback rehearsal (docs/DAILY_CHALLENGE.md §7) on the migrated schema.
-- Disposable fixture only: everything below is rolled back.
begin;
drop function if exists public.lumen_daily_today(),public.lumen_daily_begin(text),
 public.lumen_daily_finish(date,text,text,integer,integer,integer,integer),public.lumen_daily_board(date),public.lumen_daily_week(date),
 public.lumen_daily_preview(date,integer),public.lumen_daily_override(date,text,integer),
 lumen_commands.daily_run_json(lumen_commands.daily_runs),lumen_commands.daily_finalize(date),lumen_commands.daily_ranks(date,uuid),
 lumen_commands.daily_caller(),lumen_commands.daily_enabled_for(uuid),lumen_commands.daily_previewer(uuid),
 lumen_commands.daily_closes_at(date),lumen_commands.daily_opens_at(date),lumen_commands.daily_today();
drop function lumen_privacy.policy();
alter function lumen_privacy.policy_before_daily_challenge() rename to policy;
revoke all on function lumen_privacy.policy() from public,anon,authenticated,service_role;
drop table if exists lumen_commands.daily_standings,lumen_commands.daily_runs,lumen_commands.daily_finalized,lumen_commands.daily_puzzles;
delete from lumen_commands.feature_flags where name='daily_challenge';
do $$
begin
 assert to_regclass('lumen_commands.daily_runs') is null and to_regclass('lumen_commands.daily_puzzles') is null,'tables removed';
 assert to_regprocedure('lumen_privacy.policy_before_daily_challenge()') is null,'policy chain restored';
 assert not exists(select 1 from lumen_privacy.policy() where rel like 'daily\_%' escape '\'),'no stale policy rows';
 assert lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[])->>'scope'='Lumen only','erasure review still passes';
 assert to_regprocedure('public.lumen_friend_list()') is not null and to_regclass('lumen_commands.ranking_scores') is not null,'Lot 2 and #638 untouched';
end $$;
rollback;
