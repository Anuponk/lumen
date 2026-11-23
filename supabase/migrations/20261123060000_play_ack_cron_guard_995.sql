-- #995 (Free-first): the pg_cron job "lumen-play-acknowledge" called the Edge
-- Function every 30 s even with nothing to do. On 22-23/11/2026 the queue was
-- empty, yet each tick cost one Edge invocation, two logged RPCs, one
-- net._http_response row and one cron.job_run_details row: ~94 % of the
-- API-gateway log events at rest, about 20 MB of Log Ingestion per day.
--
-- Additive and idempotent. The job keeps its Vault secret and moves from 30 s
-- to 2 minutes (see below); the HTTP call is skipped while nothing is due. The
-- guard matches exactly the two things the "acknowledge" mode does:
--  * claim: token kept, retry lease expired (lumen_claim_play_acknowledgements);
--  * prune: token older than 4 days (lumen_prune_play_acknowledgements).
-- A purchase still acknowledges inline in lumen-play-purchase; this job remains
-- the durable retry path (at most 2 minutes after the retry lease expires).
-- Rollback: cron.alter_job(<id>, schedule := '30 seconds', command := <previous
-- command>) — the previous command lacks the final "and ..._due()" line.
begin;

create or replace function lumen_commands.play_acknowledgement_due()
returns boolean language sql stable set search_path='' as $$
  select exists(
    select 1 from lumen_commands.play_acknowledgements a
    where a.purchase_token is not null
      and (a.retry_at <= statement_timestamp()
        or a.created_at <= statement_timestamp() - interval '4 days'));
$$;
revoke all on function lumen_commands.play_acknowledgement_due() from public,anon,authenticated,service_role;

-- Pure rewrite, tested in CI without pg_cron: append the guard to the job's
-- final WHERE clause once; anything unexpected is returned unchanged.
create or replace function lumen_commands.guard_play_ack_command(p_command text)
returns text language plpgsql immutable set search_path='' as $$
begin
  if p_command is null or p_command like '%lumen_commands.play_acknowledgement_due()%'
    or p_command !~* '''acknowledge''' or p_command !~* '\mwhere\M' or p_command !~ ';\s*$' then
    return p_command;
  end if;
  return regexp_replace(p_command, ';\s*$', E'\n  and lumen_commands.play_acknowledgement_due();\n');
end $$;
revoke all on function lumen_commands.guard_play_ack_command(text) from public,anon,authenticated,service_role;

do $do$
declare job record;
begin
  if to_regclass('cron.job') is null then return; end if;
  for job in execute $q$select jobid, command, schedule from cron.job where jobname = 'lumen-play-acknowledge'$q$ loop
    if lumen_commands.guard_play_ack_command(job.command) is distinct from job.command then
      execute 'select cron.alter_job($1, command := $2)'
        using job.jobid, lumen_commands.guard_play_ack_command(job.command);
    end if;
    -- Owner decision 23/11/2026: every 2 minutes instead of 30 s. pg_cron still
    -- writes two postgres_logs lines and one job_run_details row per tick, even
    -- when the guard skips the call. This is only the retry path (inline ack at
    -- purchase, Google allows 3 days, retry lease grows to 5 min).
    if job.schedule = '30 seconds' then
      execute 'select cron.alter_job($1, schedule := $2)' using job.jobid, '*/2 * * * *';
    end if;
  end loop;
end $do$;

commit;
