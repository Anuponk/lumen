-- #962: minimal device storage health in the existing sync observation (no consent
-- prompt: same legitimate-interest tier as outbox_health, documented in the privacy
-- policy). On 22/11/2026 a player's board blocked because Lumen's local storage was
-- full (172 recovery copies, 8.4 MB of ~10 MB); nothing on the server showed it until
-- she pasted a diagnostic by hand.
--
-- Additive only: four nullable columns on lumen_commands.outbox_health (bucketed local
-- size, browser usage ratio, last local storage error category and its time), an
-- overload of record_outbox_health that keeps the original 11-argument function for
-- older clients, and the same outbox_health_summary with one count and alert fields.
-- No free text, message, stack, key name or content. Retention and erasure unchanged
-- (rows pruned 30 days after confirmation, deleted with the account).
-- Rollback: drop the two 14-argument functions, restore the previous summary body
-- (20261115162545_reliable_analytics_708.sql) and drop the four columns.
begin;
set local lock_timeout = '5s';

alter table lumen_commands.outbox_health
  add column if not exists storage_kb integer check (storage_kb between 0 and 1048576),
  add column if not exists storage_ratio smallint check (storage_ratio between 0 and 100),
  add column if not exists storage_error text check (storage_error in ('quota','storage')),
  add column if not exists storage_error_at timestamptz;

create or replace function lumen_commands.record_outbox_health(p_expected_user_id uuid,p_client_id uuid,p_session_id uuid,
 p_started_at timestamptz,p_sequence integer,p_platform text,p_state text,p_pending integer,
 p_failures integer,p_oldest_at timestamptz,p_version text,p_storage_kb integer,p_storage_ratio integer,p_storage_error text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if (p_storage_kb is not null and p_storage_kb not between 0 and 1048576)
  or (p_storage_ratio is not null and p_storage_ratio not between 0 and 100)
  or (p_storage_error is not null and p_storage_error not in ('quota','storage'))
 then raise exception using errcode='22023',message='invalid bounded storage observation';end if;
 -- Identity, bounds, ordering and upsert: the original observation, unchanged.
 perform lumen_commands.record_outbox_health(p_expected_user_id,p_client_id,p_session_id,p_started_at,p_sequence,
  p_platform,p_state,p_pending,p_failures,p_oldest_at,p_version);
 update lumen_commands.outbox_health set storage_kb=p_storage_kb,storage_ratio=p_storage_ratio,
  storage_error=coalesce(p_storage_error,storage_error),
  storage_error_at=case when p_storage_error is not null then now() else storage_error_at end
 where user_id=auth.uid() and client_id=p_client_id and session_id=p_session_id and sequence=p_sequence;
end $$;

create or replace function public.lumen_record_outbox_health(p_expected_user_id uuid,p_client_id uuid,p_session_id uuid,
 p_started_at timestamptz,p_sequence integer,p_platform text,p_state text,p_pending integer,
 p_failures integer,p_oldest_at timestamptz,p_version text,p_storage_kb integer,p_storage_ratio integer,p_storage_error text)
returns void language sql security invoker set search_path='' as $$
 select lumen_commands.record_outbox_health(p_expected_user_id,p_client_id,p_session_id,p_started_at,p_sequence,p_platform,
  p_state,p_pending,p_failures,p_oldest_at,p_version,p_storage_kb,p_storage_ratio,p_storage_error);
$$;
revoke all on function lumen_commands.record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text),
 public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text) from public,anon;
grant execute on function lumen_commands.record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text),
 public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text) to authenticated;

-- Same body as 20261115162545_reliable_analytics_708.sql, plus storage_pressure_players
-- and storage fields/conditions on alerts.
create or replace function lumen_commands.outbox_health_summary() returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('pending_players',count(distinct user_id) filter(where pending>0),
  'critical_players',count(distinct user_id) filter(where state='critical'),
  'stalled_players',count(distinct user_id) filter(where state<>'confirmed' and oldest_pending_at<=now()-interval '15 minutes'),
  'recurrent_players',count(distinct user_id) filter(where failures>=3),'large_backlogs',count(distinct user_id) filter(where pending>=20),
  'fresh_pending_players',count(distinct user_id) filter(where pending>0 and updated_at>=now()-interval '15 minutes' and updated_at<=now()),
  'fresh_critical_players',count(distinct user_id) filter(where state='critical' and updated_at>=now()-interval '15 minutes' and updated_at<=now()),
  'storage_pressure_players',count(distinct user_id) filter(where storage_ratio>=80 or storage_kb>=6144
   or (storage_error is not null and storage_error_at>=now()-interval '7 days')),
  'last_observed_at',max(updated_at),'freshness_minutes',15,
  'alerts',coalesce((select jsonb_agg(to_jsonb(a) order by a.observed_at desc,a.key) from(
   select md5(user_id::text||client_id::text||oldest_pending_at::text) key,state,pending,oldest_pending_at since,
    platform,app_version version,updated_at observed_at,
    updated_at>=now()-interval '15 minutes' and updated_at<=now() fresh,
    storage_kb,storage_ratio,case when storage_error_at>=now()-interval '7 days' then storage_error end storage_error
   from lumen_commands.outbox_health where state='critical' or (state<>'confirmed' and
    (oldest_pending_at<=now()-interval '15 minutes' or failures>=3 or pending>=20))
    or storage_ratio>=80 or storage_kb>=6144 or (storage_error is not null and storage_error_at>=now()-interval '7 days')
   order by updated_at desc,user_id,client_id limit 20)a),'[]'))
 from lumen_commands.outbox_health;
$$;
revoke all on function lumen_commands.outbox_health_summary() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
