-- Version the existing production telemetry contract without rewriting history.
-- No player profiles, balances or canonical receipts are modified.
create table if not exists public.lumen_sync_health (
 id bigint generated always as identity primary key,
 user_id uuid not null default auth.uid(),
 recorded_at timestamptz not null default now(),
 event text not null check (event in ('hydration_failed','hydration_ready','hydration_reconciliation')),
 reason text, outcome text, app_version text
);
alter table public.lumen_sync_health enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='lumen_sync_health' and policyname='lumen_sync_health_insert_own') then
  create policy lumen_sync_health_insert_own on public.lumen_sync_health
   for insert to authenticated with check (user_id=(select auth.uid()));
 end if;
end $$;
revoke all on public.lumen_sync_health from public, anon, authenticated;
grant insert on public.lumen_sync_health to authenticated;
grant usage on sequence public.lumen_sync_health_id_seq to authenticated;
create index if not exists lumen_sync_health_user_time_idx
 on public.lumen_sync_health(user_id,recorded_at desc,id desc);
create index if not exists lumen_sync_health_time_idx
 on public.lumen_sync_health(recorded_at desc);

create or replace function public.lumen_record_sync_health(
 p_event text,p_reason text default null,p_outcome text default null,p_version text default null
) returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'not authenticated' using errcode='42501'; end if;
 insert into public.lumen_sync_health(user_id,event,reason,outcome,app_version)
 values(auth.uid(),p_event,left(p_reason,64),left(p_outcome,32),left(p_version,80));
end $$;
revoke all on function public.lumen_record_sync_health(text,text,text,text) from public,anon;
grant execute on function public.lumen_record_sync_health(text,text,text,text) to authenticated;

create or replace function public.lumen_admin_sync_health(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.lumen_get_internal_capabilities()
   where capability='analytics_cockpit') then
  raise exception 'forbidden' using errcode='42501';
 end if;
 -- Order by timestamp AND identity: successes and failures can share a timestamp.
 -- Only hydration_ready proves that the complete hydration has succeeded.
 with recent as (
  select * from public.lumen_sync_health
  where recorded_at>=now()-make_interval(days=>least(greatest(coalesce(p_days,7),1),90))
 ), last_ready as (
  select distinct on(user_id) user_id,recorded_at,id from public.lumen_sync_health
  where event='hydration_ready' order by user_id,recorded_at desc,id desc
 ), unresolved as (
  select h.user_id,min(h.recorded_at) as blocked_since
  from public.lumen_sync_health h left join last_ready r using(user_id)
  where (h.event='hydration_failed' or (h.event='hydration_reconciliation' and h.outcome='blocked'))
    and (r.user_id is null or (h.recorded_at,h.id)>(r.recorded_at,r.id))
  group by h.user_id
 ), failures as (
  select * from recent where event='hydration_failed'
   or (event='hydration_reconciliation' and outcome='blocked')
 )
 select jsonb_build_object(
  'events',(select count(*) from recent),
  'failures',(select count(*) from recent where event='hydration_failed'),
  'resolved',(select count(*) from recent where event='hydration_ready'),
  'blocked',(select count(*) from recent where event='hydration_reconciliation' and outcome='blocked'),
  'affected_players',(select count(distinct user_id) from failures),
  'stalled_players',(select count(*) from unresolved where blocked_since<=now()-interval '15 minutes'),
  'oldest_unresolved_at',(select min(blocked_since) from unresolved),
  'by_reason',(select coalesce(jsonb_agg(jsonb_build_object('reason',reason,'count',n)),'[]'::jsonb)
   from (select coalesce(reason,'unknown') reason,count(*) n from failures group by 1 order by 2 desc,1 limit 10)x),
  'by_version',(select coalesce(jsonb_agg(jsonb_build_object('version',app_version,'count',n)),'[]'::jsonb)
   from (select coalesce(app_version,'unknown') app_version,count(*) n from failures group by 1 order by 2 desc,1 limit 10)x)
 ) into result;
 return result;
end $$;
revoke all on function public.lumen_admin_sync_health(integer) from public,anon;
grant execute on function public.lumen_admin_sync_health(integer) to authenticated;
