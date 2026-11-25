-- #1034: prepare a Daily Challenge reminder exactly once for a device/day.
-- Disabled until the existing daily_push flag, VAPID setup and daily_challenge
-- flag are ready. This migration installs neither a sender nor a scheduler.
begin;

create table if not exists lumen_commands.push_daily_dispatches (
 challenge_day date not null,
 device_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 reservation_id uuid not null unique default gen_random_uuid(),
 endpoint_fingerprint text not null,
 subscription_fingerprint text not null,
 device_updated_at timestamptz not null,
 consent_revision integer not null,
 reserved_until timestamptz not null,
 expires_at timestamptz not null,
 state text not null default 'reserved'
  check (state in ('reserved','dispatching','skipped','sent','expired','rejected','ambiguous')),
 primary key(challenge_day,device_id),
 unique(challenge_day,endpoint_fingerprint)
);
alter table lumen_commands.push_daily_dispatches enable row level security;
revoke all on lumen_commands.push_daily_dispatches from public,anon,authenticated,service_role;
create index if not exists push_daily_dispatches_owner_idx on lumen_commands.push_daily_dispatches(user_id);
create index if not exists push_daily_dispatches_pending_idx
 on lumen_commands.push_daily_dispatches(state,reserved_until,expires_at)
 where state in ('reserved','dispatching');
create index if not exists push_devices_activity_idx on lumen_commands.push_devices(updated_at);

do $privacy$
begin
 if to_regprocedure('lumen_privacy.policy_before_daily_push_dispatch()') is null then
  alter function lumen_privacy.policy() rename to policy_before_daily_push_dispatch;
  execute $policy$create function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $body$
    select * from lumen_privacy.policy_before_daily_push_dispatch()
    union all values ('lumen_commands','push_daily_dispatches','user_id',null,null,'delete')
   $body$
  $policy$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_daily_push_dispatch()
   from public,anon,authenticated,service_role;
 end if;
 perform lumen_privacy.install_guards();
end
$privacy$;

-- Private building block parameterized in time so date/timezone cases are
-- reproducible in local tests. Public wrappers always use the database clock.
create or replace function lumen_commands.eligible_daily_push(
 p_now timestamptz,p_user_id uuid default null,p_device_id uuid default null
) returns table(
 challenge_day date,user_id uuid,device_id uuid,device_updated_at timestamptz,
 consent_revision integer,end_at timestamptz,endpoint_fingerprint text,subscription_fingerprint text,
 endpoint text,p256dh text,auth_secret text,locale text,vapid_public_key text
)
language sql stable set search_path='' as $body$
 select puzzle.day,d.user_id,d.device_id,d.updated_at,pref.revision,
  least(lumen_commands.daily_closes_at(puzzle.day),deadline.end_at),
  lumen_privacy.fingerprint(d.endpoint),lumen_privacy.fingerprint(concat_ws('|',d.endpoint,d.p256dh,d.auth_secret)),
  d.endpoint,d.p256dh,d.auth_secret,d.locale,c.vapid_public_key
 from lumen_commands.push_configuration as c
 join lumen_commands.daily_puzzles as puzzle on puzzle.day=(p_now at time zone 'Europe/Paris')::date
 join lumen_commands.push_preferences as pref on pref.daily_consented_at is not null
 join lumen_commands.push_devices as d on d.user_id=pref.user_id
 join lumen.profiles as profile on profile.user_id=d.user_id
 cross join lateral (select p_now at time zone d.timezone as local_now) as z
 cross join lateral (
  select (date_trunc('day',z.local_now)+interval '18 hours 15 minutes') at time zone d.timezone as end_at
 ) as deadline
 where c.singleton
   and (p_user_id is null or d.user_id=p_user_id)
   and (p_device_id is null or d.device_id=p_device_id)
   and d.updated_at>=p_now-interval '90 days'
   and z.local_now::time>=time '18:00' and z.local_now::time<time '18:15' and deadline.end_at>p_now
   and exists(select 1 from lumen_commands.feature_flags as f where f.name='daily_push' and f.enabled)
   and exists(select 1 from lumen_commands.feature_flags as f where f.name='daily_challenge' and f.enabled)
   and not exists(select 1 from lumen_commands.daily_runs as run
    where run.user_id=d.user_id and run.day=puzzle.day and run.status='completed')
   and not exists(select 1 from lumen_privacy.erased_identifiers as erased
    where erased.kind='user' and erased.digest=lumen_privacy.fingerprint(d.user_id::text));
$body$;

create or replace function lumen_commands.reserve_daily_push(p_now timestamptz,p_limit integer)
returns jsonb language plpgsql volatile set search_path='' as $body$
declare v_reserved jsonb;
begin
 if p_limit is null or p_limit not between 1 and 50 then
  raise exception using errcode='22023',message='push_invalid_batch';
 end if;
 with reserved as (
  insert into lumen_commands.push_daily_dispatches(
   challenge_day,user_id,device_id,device_updated_at,consent_revision,endpoint_fingerprint,subscription_fingerprint,reserved_until,expires_at
  )
  select e.challenge_day,e.user_id,e.device_id,e.device_updated_at,e.consent_revision,e.endpoint_fingerprint,e.subscription_fingerprint,
   least(p_now+interval '90 seconds',e.end_at),e.end_at
  from lumen_commands.eligible_daily_push(p_now) as e
  where not exists(select 1 from lumen_commands.push_daily_dispatches as d
         where d.challenge_day=e.challenge_day and d.device_id=e.device_id)
    and not exists(select 1 from lumen_commands.push_daily_dispatches as d
         where d.challenge_day=e.challenge_day and d.endpoint_fingerprint=e.endpoint_fingerprint)
  order by e.end_at,e.device_id
  limit p_limit
  on conflict do nothing
  returning reservation_id
 )
 select coalesce(jsonb_agg(jsonb_build_object('reservationId',r.reservation_id)),'[]'::jsonb)
 into v_reserved from reserved as r;
 return v_reserved;
end
$body$;

create or replace function lumen_commands.authorize_daily_push(p_now timestamptz,p_reservation_id uuid)
returns jsonb language plpgsql volatile set search_path='' as $body$
declare
 v_ticket lumen_commands.push_daily_dispatches%rowtype;
 v_device record;
begin
 select r.* into v_ticket from lumen_commands.push_daily_dispatches as r
 where r.reservation_id=p_reservation_id for update;
 if not found or v_ticket.state<>'reserved' then return null; end if;

 -- Serialize authorization with revocation and unlink. Re-read delivery rules
 -- and the registered subscription only after taking the consent lock.
 perform 1 from lumen_commands.push_preferences as pref where pref.user_id=v_ticket.user_id for share;
 select e.* into v_device
 from lumen_commands.eligible_daily_push(p_now,v_ticket.user_id,v_ticket.device_id) as e
 where e.challenge_day=v_ticket.challenge_day and e.consent_revision=v_ticket.consent_revision
   and e.device_updated_at=v_ticket.device_updated_at and e.subscription_fingerprint=v_ticket.subscription_fingerprint;
 if not found or v_ticket.reserved_until<=p_now then
  update lumen_commands.push_daily_dispatches set state='skipped' where reservation_id=p_reservation_id;
  return null;
 end if;

 -- Starting a send is a one-way transition. If this response is lost, another
 -- caller cannot retrieve the subscription and risk a second provider call.
 update lumen_commands.push_daily_dispatches set state='dispatching' where reservation_id=p_reservation_id;
 return jsonb_build_object(
  'reservationId',p_reservation_id,'challengeDay',v_ticket.challenge_day,
  'expiresAt',least(v_ticket.expires_at,v_device.end_at),'locale',v_device.locale,
  'vapidPublicKey',v_device.vapid_public_key,
  'subscription',jsonb_build_object('endpoint',v_device.endpoint,
   'keys',jsonb_build_object('p256dh',v_device.p256dh,'auth',v_device.auth_secret))
 );
end
$body$;

create or replace function lumen_commands.finish_daily_push(p_reservation_id uuid,p_outcome text)
returns text language plpgsql volatile set search_path='' as $body$
declare v_ticket lumen_commands.push_daily_dispatches%rowtype;
begin
 if p_outcome is null or p_outcome not in ('sent','expired','rejected','ambiguous') then
  raise exception using errcode='22023',message='push_invalid_outcome';
 end if;
 select r.* into v_ticket from lumen_commands.push_daily_dispatches as r
 where r.reservation_id=p_reservation_id for update;
 if not found then return null; end if;
 if v_ticket.state<>'dispatching' then return v_ticket.state; end if;
 update lumen_commands.push_daily_dispatches set state=p_outcome where reservation_id=p_reservation_id;
 if p_outcome='expired' then
  delete from lumen_commands.push_devices as d
  where d.user_id=v_ticket.user_id and d.device_id=v_ticket.device_id
   and d.updated_at=v_ticket.device_updated_at
   and lumen_privacy.fingerprint(concat_ws('|',d.endpoint,d.p256dh,d.auth_secret))=v_ticket.subscription_fingerprint;
 end if;
 return p_outcome;
end
$body$;

create or replace function lumen_commands.cleanup_daily_push(p_now timestamptz)
returns jsonb language plpgsql volatile set search_path='' as $body$
declare v_skipped integer; v_ambiguous integer; v_old integer; v_devices integer;
begin
 update lumen_commands.push_daily_dispatches set state='skipped'
 where state='reserved' and reserved_until<=p_now;
 get diagnostics v_skipped=row_count;
 update lumen_commands.push_daily_dispatches set state='ambiguous'
 where state='dispatching' and expires_at<=p_now;
 get diagnostics v_ambiguous=row_count;
 delete from lumen_commands.push_daily_dispatches where challenge_day<(p_now at time zone 'Europe/Paris')::date-7;
 get diagnostics v_old=row_count;
 delete from lumen_commands.push_devices where updated_at<p_now-interval '90 days';
 get diagnostics v_devices=row_count;
 return jsonb_build_object('skipped',v_skipped,'ambiguous',v_ambiguous,'oldReservations',v_old,'inactiveDevices',v_devices);
end
$body$;

create or replace function public.lumen_reserve_daily_push_v1(p_limit integer default 20)
returns jsonb language sql volatile security definer set search_path='' as $body$
 select lumen_commands.reserve_daily_push(statement_timestamp(),p_limit)
$body$;
create or replace function public.lumen_authorize_daily_push_v1(p_reservation_id uuid)
returns jsonb language sql volatile security definer set search_path='' as $body$
 select lumen_commands.authorize_daily_push(statement_timestamp(),p_reservation_id)
$body$;
create or replace function public.lumen_finish_daily_push_v1(p_reservation_id uuid,p_outcome text)
returns text language sql volatile security definer set search_path='' as $body$
 select lumen_commands.finish_daily_push(p_reservation_id,p_outcome)
$body$;
create or replace function public.lumen_cleanup_daily_push_v1()
returns jsonb language sql volatile security definer set search_path='' as $body$
 select lumen_commands.cleanup_daily_push(statement_timestamp())
$body$;

revoke all on function lumen_commands.eligible_daily_push(timestamptz,uuid,uuid),
 lumen_commands.reserve_daily_push(timestamptz,integer),lumen_commands.authorize_daily_push(timestamptz,uuid),
 lumen_commands.finish_daily_push(uuid,text),lumen_commands.cleanup_daily_push(timestamptz)
 from public,anon,authenticated,service_role;
revoke all on function public.lumen_reserve_daily_push_v1(integer),public.lumen_authorize_daily_push_v1(uuid),
 public.lumen_finish_daily_push_v1(uuid,text),public.lumen_cleanup_daily_push_v1()
 from public,anon,authenticated,service_role;
grant execute on function public.lumen_reserve_daily_push_v1(integer),public.lumen_authorize_daily_push_v1(uuid),
 public.lumen_finish_daily_push_v1(uuid,text),public.lumen_cleanup_daily_push_v1() to service_role;

notify pgrst,'reload schema';
commit;
