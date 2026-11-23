-- #995: pg_cron history keeps 7 days, the latest run of every job and running rows.
-- The CI image has no pg_cron: a minimal stand-in table is created and rolled back.
begin;
do $setup$
begin
  if to_regclass('cron.job_run_details') is null then
    create schema if not exists cron;
    create table cron.job_run_details(jobid bigint, runid bigint primary key, status text,
      start_time timestamptz, end_time timestamptz);
  end if;
end $setup$;
do $$
declare base bigint := coalesce((select max(runid) from cron.job_run_details),0) + 1000000;
begin
  assert not has_function_privilege('service_role','lumen_commands.prune_cron_run_details(interval,integer)','EXECUTE');
  insert into cron.job_run_details(jobid,runid,status,start_time,end_time) values
    (990001, base+1, 'succeeded', now()-interval '20 days', now()-interval '20 days'),  -- old: removed
    (990001, base+2, 'failed',    now()-interval '8 days',  now()-interval '8 days'),   -- old: removed
    (990001, base+3, 'succeeded', now()-interval '6 days',  now()-interval '6 days'),   -- recent: kept
    (990001, base+4, 'succeeded', now()-interval '1 hour',  now()-interval '1 hour'),   -- latest: kept
    (990002, base+5, 'succeeded', now()-interval '25 days', now()-interval '25 days'),  -- monthly, old: removed
    (990002, base+6, 'succeeded', now()-interval '24 days', now()-interval '24 days'),  -- monthly latest: kept
    (990003, base+7, 'running',   now()-interval '30 days', null),                      -- running: kept
    (990003, base+8, 'succeeded', now()-interval '2 days',  now()-interval '2 days');

  begin
    perform lumen_commands.prune_cron_run_details(interval '1 hour');
    assert false, 'a retention below one day must be refused';
  exception when invalid_parameter_value then null;
  end;

  -- Bounded batch: one row per call.
  perform lumen_commands.prune_cron_run_details(interval '7 days', 1);
  assert not exists(select from cron.job_run_details where runid=base+1);
  assert exists(select from cron.job_run_details where runid=base+2);
  perform lumen_commands.prune_cron_run_details();

  assert (select array_agg(runid-base order by runid) from cron.job_run_details where jobid between 990001 and 990003)
    = array[3,4,6,7,8]::bigint[],
    (select array_agg(runid-base order by runid) from cron.job_run_details where jobid between 990001 and 990003)::text;
  assert lumen_commands.prune_cron_run_details() = 0, 'a second pass removes nothing';
end $$;
rollback;
