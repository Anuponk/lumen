-- Bounded operational metadata, separate from immutable command receipts.
create table lumen_commands.outbox_health (
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id uuid not null,session_id uuid not null,session_started timestamptz not null,
 sequence integer not null check(sequence>0),platform text not null,
 state text not null,pending integer not null check(pending between 0 and 10000),
 failures integer not null check(failures between 0 and 10000),oldest_pending_at timestamptz,
 app_version text,updated_at timestamptz not null default now(),
 primary key(user_id,client_id)
);
alter table lumen_commands.outbox_health enable row level security;
revoke all on lumen_commands.outbox_health from public,anon,authenticated;
create index outbox_health_unresolved_idx on lumen_commands.outbox_health(oldest_pending_at)
 where state<>'confirmed';
create index outbox_health_retention_idx on lumen_commands.outbox_health(updated_at)
 where state='confirmed';

create function lumen_commands.record_outbox_health(p_expected_user_id uuid,p_client_id uuid,p_session_id uuid,
 p_started_at timestamptz,p_sequence integer,p_platform text,p_state text,p_pending integer,
 p_failures integer,p_oldest_at timestamptz,p_version text)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();
begin
 if v_uid is null or p_expected_user_id is distinct from v_uid
 then raise exception using errcode='42501',message='observation account changed';end if;
 if p_client_id is null or p_session_id is null or p_started_at is null or not isfinite(p_started_at)
  or p_started_at>now()+interval '5 minutes' or p_sequence is null or p_sequence<1
  or p_platform is null or p_platform not in ('android-pwa','android-web','desktop','other')
  or p_state is null or p_state not in ('confirmed','pending','review','auth','critical')
  or p_pending is null or p_pending not between 0 and 10000 or p_failures is null or p_failures not between 0 and 10000
  or (p_state='confirmed' and (p_pending<>0 or p_failures<>0))
  or (p_oldest_at is not null and (not isfinite(p_oldest_at) or p_oldest_at>now()+interval '5 minutes'))
 then raise exception using errcode='22023',message='invalid bounded sync observation';end if;
 if p_version is null or p_version !~ '^(unknown|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9}([ .-]+[0-9a-f]{7,40})?)$'
 then p_version:='unknown';end if;
 insert into lumen_commands.outbox_health(user_id,client_id,session_id,session_started,sequence,platform,state,pending,failures,oldest_pending_at,app_version)
 values(v_uid,p_client_id,p_session_id,p_started_at,p_sequence,p_platform,p_state,p_pending,p_failures,
  case when p_state='confirmed' then null else least(coalesce(p_oldest_at,now()),now()) end,left(p_version,80))
 on conflict(user_id,client_id) do update set session_id=excluded.session_id,session_started=excluded.session_started,
  sequence=excluded.sequence,platform=excluded.platform,state=excluded.state,pending=excluded.pending,failures=excluded.failures,
  oldest_pending_at=case when excluded.state='confirmed' then null
   else least(coalesce(lumen_commands.outbox_health.oldest_pending_at,excluded.oldest_pending_at),excluded.oldest_pending_at) end,
  app_version=excluded.app_version,updated_at=now()
 where (excluded.session_started,excluded.sequence)>(lumen_commands.outbox_health.session_started,lumen_commands.outbox_health.sequence);
end $$;
create function public.lumen_record_outbox_health(p_expected_user_id uuid,p_client_id uuid,p_session_id uuid,
 p_started_at timestamptz,p_sequence integer,p_platform text,p_state text,p_pending integer,
 p_failures integer,p_oldest_at timestamptz,p_version text)
returns void language sql security invoker set search_path='' as $$
 select lumen_commands.record_outbox_health(p_expected_user_id,p_client_id,p_session_id,p_started_at,p_sequence,p_platform,p_state,p_pending,p_failures,p_oldest_at,p_version);
$$;
revoke all on function lumen_commands.record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text),
 public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text) from public,anon;
grant execute on function lumen_commands.record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text),
 public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text) to authenticated;

create function lumen_commands.outbox_health_summary() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('pending_players',count(distinct user_id) filter(where pending>0),
  'critical_players',count(distinct user_id) filter(where state='critical'),
  'stalled_players',count(distinct user_id) filter(where state<>'confirmed' and oldest_pending_at<=now()-interval '15 minutes'),
  'recurrent_players',count(distinct user_id) filter(where failures>=3),
  'large_backlogs',count(distinct user_id) filter(where pending>=20),
  'alerts',coalesce(jsonb_agg(jsonb_build_object(
   'key',md5(user_id::text||client_id::text||oldest_pending_at::text),
   'state',state,'pending',pending,'since',oldest_pending_at,'platform',platform,'version',app_version))
   filter(where state='critical' or (state<>'confirmed' and (oldest_pending_at<=now()-interval '15 minutes' or failures>=3 or pending>=20))),'[]'::jsonb))
 from lumen_commands.outbox_health;
$$;
revoke all on function lumen_commands.outbox_health_summary() from public,anon,authenticated;
-- Keep the existing capability-gated cockpit RPC and its incident algorithm.
do $$declare v_definition text;begin
 select pg_get_functiondef('public.lumen_admin_sync_health(integer)'::regprocedure) into v_definition;
 if position('return result;' in v_definition)=0 then raise exception 'cockpit boundary changed; review migration';end if;
 execute replace(v_definition,'return result;', 'return result || jsonb_build_object(''outbox'',lumen_commands.outbox_health_summary());');
end $$;

-- Operator/cron only. Never expire unresolved incidents or idempotency receipts.
create function lumen_commands.prune_sync_observations() returns bigint
language plpgsql security invoker set search_path='' as $$
declare v_count bigint;begin
 delete from lumen_commands.outbox_health where state='confirmed' and updated_at<now()-interval '30 days';
 get diagnostics v_count=row_count;return v_count;
end $$;
revoke all on function lumen_commands.prune_sync_observations() from public,anon,authenticated;
notify pgrst,'reload schema';
