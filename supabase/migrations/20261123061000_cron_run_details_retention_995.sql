-- #995 (Free-first): pg_cron logs every run in cron.job_run_details and never
-- prunes it. On 23/11/2026: 12 921 rows / 8,4 MB since 01/10, ~2 900 new rows
-- per day. Owner decision (23/11/2026): keep 7 days.
--
-- Technical scheduler history only: no player data, receipt or proof. The
-- database is shared with SoldeZen, whose monthly job would lose its only trace
-- after 7 days; the latest run of every job is therefore always kept, whatever
-- its age. Running rows are never touched. Batches are bounded.
-- Rollback: select cron.unschedule('lumen-cron-run-details-retention');
begin;

create or replace function lumen_commands.prune_cron_run_details(
  p_keep interval default interval '7 days', p_limit integer default 20000)
returns integer language plpgsql security invoker set search_path='' as $$
declare removed integer;
begin
  if p_keep is null or p_keep < interval '1 day' then
    raise exception using errcode='22023',message='cron_retention_too_short';
  end if;
  if p_limit is null or p_limit not between 1 and 50000 then
    raise exception using errcode='22023',message='cron_retention_limit_invalid';
  end if;
  delete from cron.job_run_details d
  where d.runid in (
    select r.runid from cron.job_run_details r
    where coalesce(r.end_time, r.start_time) < statement_timestamp() - p_keep
      and r.status not in ('running','starting')
      and r.runid < (select max(l.runid) from cron.job_run_details l where l.jobid = r.jobid)
    order by r.runid
    limit p_limit);
  get diagnostics removed = row_count;
  return removed;
end $$;
revoke all on function lumen_commands.prune_cron_run_details(interval,integer)
  from public,anon,authenticated,service_role;

do $do$
begin
  if to_regclass('cron.job') is null then return; end if;
  -- cron.schedule upserts by name: re-running the migration keeps one job.
  perform cron.schedule('lumen-cron-run-details-retention', '41 3 * * *',
    'select lumen_commands.prune_cron_run_details();');
  perform lumen_commands.prune_cron_run_details();
end $do$;

commit;
