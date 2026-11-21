-- #708 Lot D: release comparison with an exposure base. Read-only,
-- analytics_cockpit only, aggregates only. For each app version in the period:
-- hydrations (ready + failed = exposure), failures, blocked reconciliations,
-- distinct players, and devices whose outbox is still waiting. A rate is
-- only meaningful with its sample: the client flags small samples.
begin;

create or replace function public.lumen_admin_version_health(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 d integer:=least(greatest(coalesce(p_days,7),1),3650);
 since timestamptz:=statement_timestamp()-make_interval(days=>least(greatest(coalesce(p_days,7),1),3650));
 versions jsonb;totals jsonb;
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid()
  and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception using errcode='42501',message='analytics_cockpit capability required';end if;

 with health as (
  select coalesce(nullif(btrim(h.app_version),''),'unknown') as version,h.user_id,h.event,h.outcome,h.recorded_at
  from public.lumen_sync_health h where h.recorded_at>=since
 ), by_version as (
  select version,
   count(*) filter(where event in ('hydration_ready','hydration_failed')) as hydrations,
   count(*) filter(where event='hydration_failed') as failures,
   count(*) filter(where event='hydration_reconciliation' and outcome='blocked') as blocked,
   count(distinct user_id) as players,
   min(recorded_at) as first_seen,max(recorded_at) as last_seen
  from health group by version
 ), outbox as (
  select coalesce(nullif(btrim(o.app_version),''),'unknown') as version,
   count(*) as devices,count(*) filter(where o.state<>'confirmed' and o.pending>0) as waiting
  from lumen_commands.outbox_health o where o.updated_at>=since group by 1
 )
 select coalesce(jsonb_agg(jsonb_build_object('version',coalesce(b.version,o.version),
   'hydrations',coalesce(b.hydrations,0),'failures',coalesce(b.failures,0),'blocked',coalesce(b.blocked,0),
   'players',coalesce(b.players,0),'devices',coalesce(o.devices,0),'waiting_devices',coalesce(o.waiting,0),
   'first_seen',b.first_seen,'last_seen',b.last_seen)
   order by coalesce(b.last_seen,'-infinity'::timestamptz) desc,coalesce(b.version,o.version)),'[]'::jsonb)
 into versions
 from by_version b full join outbox o on o.version=b.version;

 select jsonb_build_object(
  'hydrations',count(*) filter(where h.event in ('hydration_ready','hydration_failed')),
  'failures',count(*) filter(where h.event='hydration_failed'))
 into totals from public.lumen_sync_health h where h.recorded_at>=since;

 return jsonb_build_object('days',d,'since',since,'generated_at',statement_timestamp(),'totals',totals,'versions',versions);
end $$;

revoke all on function public.lumen_admin_version_health(integer) from public,anon;
grant execute on function public.lumen_admin_version_health(integer) to authenticated;
notify pgrst,'reload schema';
commit;
