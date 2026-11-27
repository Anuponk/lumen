-- #1034 private rehearsal. Global daily_push remains disabled.
-- No account is granted preview by the migration. Operations grant named test accounts separately.
begin;
create or replace function lumen_commands.daily_push_available(p_user uuid)
returns boolean language sql stable set search_path='' as $body$
 select p_user is not null and (
  exists(select 1 from lumen_commands.feature_flags where name='daily_push' and enabled)
  or exists(select 1 from lumen.internal_capabilities where user_id=p_user and capability='daily_push_preview'
   and (expires_at is null or expires_at>statement_timestamp())))
$body$;
revoke all on function lumen_commands.daily_push_available(uuid) from public,anon,authenticated,service_role;

create or replace function lumen_commands.daily_push_v1(
 p_expected_user_id uuid,
 p_action text,
 p_device_id uuid,
 p_expected_revision integer,
 p_confirm_daily boolean,
 p_subscription jsonb,
 p_timezone text,
 p_locale text
) returns jsonb
language plpgsql volatile security definer set search_path='' as $body$
declare
 v_user uuid:=auth.uid();
 v_session_id text:=auth.jwt()->>'session_id';
 v_flag boolean;
 v_public_key text;
 v_pref lumen_commands.push_preferences%rowtype;
 v_device lumen_commands.push_devices%rowtype;
 v_endpoint text;
 v_p256dh text;
 v_auth text;
 v_now timestamptz:=statement_timestamp();
begin
 if v_user is null or v_user is distinct from p_expected_user_id
    or auth.jwt()->>'is_anonymous'='true'
    or coalesce(v_session_id,'') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then
  raise exception using errcode='42501',message='push_account_required';
 end if;
 if not exists(select 1 from auth.sessions as s where s.id=v_session_id::uuid
                 and s.user_id=v_user and (s.not_after is null or s.not_after>v_now))
    or not exists(select 1 from lumen.profiles as p where p.user_id=v_user) then
  raise exception using errcode='42501',message='push_account_required';
 end if;
 if p_action is null or p_action not in ('read','enable','disable','unlink','refresh')
    or (p_action in ('enable','unlink','refresh') and p_device_id is null)
    or (p_action in ('enable','disable','refresh') and coalesce(p_expected_revision,-1)<0)
    or (p_action='refresh' and p_subscription is not null) then
  raise exception using errcode='22023',message='push_invalid_request';
 end if;

 select c.vapid_public_key into v_public_key
 from lumen_commands.push_configuration as c
 -- Availability is checked for the authenticated account, including private QA.
 where c.singleton and lumen_commands.daily_push_available(v_user);
 v_flag:=v_public_key is not null;
 if p_action in ('enable','refresh') then
  if not v_flag then raise exception using errcode='42501',message='push_disabled'; end if;
  if p_action='enable' and p_confirm_daily is distinct from true then
   raise exception using errcode='22023',message='push_consent_required';
  end if;
  if coalesce(p_locale,'') not in ('fr','en','es')
     or coalesce(length(p_timezone),0) not between 1 and 80
     or not exists(select 1 from pg_catalog.pg_timezone_names as tz where tz.name=p_timezone) then
   raise exception using errcode='22023',message='push_invalid_device';
  end if;
 end if;
 if p_action='enable' then
  v_endpoint:=p_subscription->>'endpoint';
  v_p256dh:=p_subscription#>>'{keys,p256dh}';
  v_auth:=p_subscription#>>'{keys,auth}';
  -- Future delivery may reach only supported Web Push providers, over HTTPS.
  -- Ignore any extra subscription fields and persist no whole request object.
  if coalesce(length(v_endpoint),0) not between 25 and 2048
     or v_endpoint !~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com)/[A-Za-z0-9._~%/?=&+:-]+$'
     or coalesce(v_p256dh,'') !~ '^B[A-Za-z0-9_-]{86}$'
     or coalesce(v_auth,'') !~ '^[A-Za-z0-9_-]{22}$' then
   raise exception using errcode='22023',message='push_invalid_device';
  end if;
 end if;

 if p_action<>'read' then
  if p_action<>'refresh' then
   insert into lumen_commands.push_preferences(user_id) values(v_user) on conflict(user_id) do nothing;
  end if;
  select p.* into v_pref from lumen_commands.push_preferences as p where p.user_id=v_user for update;
  if p_action='refresh' and (not found or v_pref.daily_consented_at is null) then
   raise exception using errcode='22023',message='push_device_unavailable';
  end if;
  if p_action<>'unlink' and v_pref.revision<>p_expected_revision then
   raise exception using errcode='40001',message='push_stale_revision';
  end if;

  if p_action='enable' then
   if not exists(select 1 from lumen_commands.push_devices as d where d.user_id=v_user and d.device_id=p_device_id)
      and (select count(*) from lumen_commands.push_devices as d where d.user_id=v_user)>=10 then
    raise exception using errcode='22023',message='push_device_limit';
   end if;
   begin
    insert into lumen_commands.push_devices(user_id,device_id,endpoint,p256dh,auth_secret,timezone,locale,updated_at)
     values(v_user,p_device_id,v_endpoint,v_p256dh,v_auth,p_timezone,p_locale,v_now)
     on conflict(user_id,device_id) do update set endpoint=excluded.endpoint,p256dh=excluded.p256dh,
      auth_secret=excluded.auth_secret,timezone=excluded.timezone,locale=excluded.locale,updated_at=excluded.updated_at;
   exception when unique_violation then
    raise exception using errcode='22023',message='push_device_conflict';
   end;
  elsif p_action='refresh' then
   select d.* into v_device from lumen_commands.push_devices as d
   where d.user_id=v_user and d.device_id=p_device_id and d.updated_at>=v_now-interval '90 days' for update;
   if not found then
    raise exception using errcode='22023',message='push_device_unavailable';
   end if;
   if v_device.timezone<>p_timezone or v_device.locale<>p_locale or v_device.updated_at<v_now-interval '30 days' then
    update lumen_commands.push_devices as d
    set timezone=p_timezone,locale=p_locale,updated_at=v_now
    where d.user_id=v_user and d.device_id=p_device_id;
   end if;
  elsif p_action='unlink' then
   delete from lumen_commands.push_devices as d where d.user_id=v_user and d.device_id=p_device_id;
  end if;
  -- A revocation invalidates an in-flight enrollment even if the user had already turned reminders off.
  if p_action in ('disable','unlink') or (p_action='enable' and v_pref.daily_consented_at is null) then
   update lumen_commands.push_preferences as p
   set revision=p.revision+1,daily_consented_at=case p_action
    when 'disable' then null when 'enable' then v_now else p.daily_consented_at end
   where p.user_id=v_user;
  end if;
 end if;

 select p.* into v_pref from lumen_commands.push_preferences as p where p.user_id=v_user;
 return jsonb_build_object(
  'version',1,'available',v_flag,'preview',exists(select 1 from lumen.internal_capabilities where user_id=v_user and capability='daily_push_preview' and (expires_at is null or expires_at>v_now)),'dailyEnabled',v_pref.daily_consented_at is not null,
  'revision',coalesce(v_pref.revision,0),'reminderHour',18,'vapidPublicKey',v_public_key,
  'deviceRegistered',exists(select 1 from lumen_commands.push_devices as d where d.user_id=v_user and d.device_id=p_device_id)
 );
end
$body$;

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
   and lumen_commands.daily_push_available(d.user_id)
   and exists(select 1 from lumen_commands.feature_flags as f where f.name='daily_challenge' and f.enabled)
   and not exists(select 1 from lumen_commands.daily_runs as run
    where run.user_id=d.user_id and run.day=puzzle.day and run.status='completed')
   and not exists(select 1 from lumen_privacy.erased_identifiers as erased
    where erased.kind='user' and erased.digest=lumen_privacy.fingerprint(d.user_id::text));
$body$;

create table if not exists lumen_commands.push_test_dispatches
 (like lumen_commands.push_daily_dispatches including all,
  foreign key(user_id) references auth.users(id) on delete cascade);
alter table lumen_commands.push_test_dispatches enable row level security;
revoke all on lumen_commands.push_test_dispatches from public,anon,authenticated,service_role;
do $privacy$
begin
 if to_regprocedure('lumen_privacy.policy_before_push_test()') is null then
  alter function lumen_privacy.policy() rename to policy_before_push_test;
  execute $policy$create function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $body$
    select * from lumen_privacy.policy_before_push_test()
    union all values ('lumen_commands','push_test_dispatches','user_id',null,null,'delete')
   $body$
  $policy$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_push_test() from public,anon,authenticated,service_role;
 end if;
 perform lumen_privacy.install_guards();
end
$privacy$;
create or replace function lumen_commands.eligible_test_push(
 p_now timestamptz,p_user_id uuid default null,p_device_id uuid default null
) returns table(
 challenge_day date,user_id uuid,device_id uuid,device_updated_at timestamptz,
 consent_revision integer,end_at timestamptz,endpoint_fingerprint text,subscription_fingerprint text,
 endpoint text,p256dh text,auth_secret text,locale text,vapid_public_key text
)
language sql stable set search_path='' as $body$
 select puzzle.day,d.user_id,d.device_id,d.updated_at,pref.revision,
  p_now+interval '10 minutes',
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
   and exists(select 1 from lumen.internal_capabilities where user_id=d.user_id and capability='daily_push_preview' and (expires_at is null or expires_at>p_now))
   and (p_user_id is null or d.user_id=p_user_id)
   and (p_device_id is null or d.device_id=p_device_id)
   and d.updated_at>=p_now-interval '90 days'
   and lumen_commands.daily_push_available(d.user_id)
   and exists(select 1 from lumen_commands.feature_flags as f where f.name='daily_challenge' and f.enabled)
   and not exists(select 1 from lumen_privacy.erased_identifiers as erased
    where erased.kind='user' and erased.digest=lumen_privacy.fingerprint(d.user_id::text));
$body$;

create or replace function lumen_commands.authorize_test_push(p_now timestamptz,p_reservation_id uuid)
returns jsonb language plpgsql volatile set search_path='' as $body$
declare
 v_ticket lumen_commands.push_test_dispatches%rowtype;
 v_device record;
begin
 select r.* into v_ticket from lumen_commands.push_test_dispatches as r
 where r.reservation_id=p_reservation_id for update;
 if not found or v_ticket.state<>'reserved' then return null; end if;

 -- Serialize authorization with revocation and unlink. Re-read delivery rules
 -- and the registered subscription only after taking the consent lock.
 perform 1 from lumen_commands.push_preferences as pref where pref.user_id=v_ticket.user_id for share;
 select e.* into v_device
 from lumen_commands.eligible_test_push(p_now,v_ticket.user_id,v_ticket.device_id) as e
 where e.challenge_day=v_ticket.challenge_day and e.consent_revision=v_ticket.consent_revision
   and e.device_updated_at=v_ticket.device_updated_at and e.subscription_fingerprint=v_ticket.subscription_fingerprint;
 if not found or v_ticket.reserved_until<=p_now then
  update lumen_commands.push_test_dispatches set state='skipped' where reservation_id=p_reservation_id;
  return null;
 end if;

 -- Starting a send is a one-way transition. If this response is lost, another
 -- caller cannot retrieve the subscription and risk a second provider call.
 update lumen_commands.push_test_dispatches set state='dispatching' where reservation_id=p_reservation_id;
 return jsonb_build_object(
  'reservationId',p_reservation_id,'challengeDay',v_ticket.challenge_day,
  'expiresAt',least(v_ticket.expires_at,v_device.end_at),'locale',v_device.locale,
  'vapidPublicKey',v_device.vapid_public_key,
  'subscription',jsonb_build_object('endpoint',v_device.endpoint,
   'keys',jsonb_build_object('p256dh',v_device.p256dh,'auth',v_device.auth_secret))
 );
end
$body$;

create or replace function lumen_commands.finish_test_push(p_reservation_id uuid,p_outcome text)
returns text language plpgsql volatile set search_path='' as $body$
declare v_ticket lumen_commands.push_test_dispatches%rowtype;
begin
 if p_outcome is null or p_outcome not in ('sent','expired','rejected','ambiguous') then
  raise exception using errcode='22023',message='push_invalid_outcome';
 end if;
 select r.* into v_ticket from lumen_commands.push_test_dispatches as r
 where r.reservation_id=p_reservation_id for update;
 if not found then return null; end if;
 if v_ticket.state<>'dispatching' then return v_ticket.state; end if;
 update lumen_commands.push_test_dispatches set state=p_outcome where reservation_id=p_reservation_id;
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
 update lumen_commands.push_test_dispatches set state='skipped' where state='reserved' and reserved_until<=p_now;
 update lumen_commands.push_test_dispatches set state='ambiguous' where state='dispatching' and expires_at<=p_now;
 delete from lumen_commands.push_test_dispatches where challenge_day<(p_now at time zone 'Europe/Paris')::date-7;
 delete from lumen_commands.push_devices where updated_at<p_now-interval '90 days';
 get diagnostics v_devices=row_count;
 return jsonb_build_object('skipped',v_skipped,'ambiguous',v_ambiguous,'oldReservations',v_old,'inactiveDevices',v_devices);
end
$body$;

-- A valid account session and explicit enrollment are required even to read a test result.
create or replace function public.lumen_daily_push_test_v1(p_expected_user_id uuid,p_device_id uuid,p_action text)
returns jsonb language plpgsql volatile security definer set search_path='' as $body$
declare
 v_now timestamptz:=statement_timestamp();
 v_state jsonb;
 v_device record;
 v_ticket lumen_commands.push_test_dispatches%rowtype;
 v_secret text;
begin
 v_state:=lumen_commands.daily_push_v1(p_expected_user_id,'read',p_device_id,null,null,null,null,null);
 if p_action is null or p_action not in ('send','read') or p_device_id is null then
  raise exception using errcode='22023',message='push_invalid_request';
 end if;
 if v_state->>'preview'<>'true' or v_state->>'available'<>'true' then
  raise exception using errcode='42501',message='push_test_forbidden';
 end if;
 -- Serialize enrollment/revocation, rate limit and simultaneous clicks on this account.
 perform 1 from lumen_commands.push_preferences where user_id=p_expected_user_id for update;
 select * into v_device from lumen_commands.eligible_test_push(v_now,p_expected_user_id,p_device_id);
 if not found then raise exception using errcode='42501',message='push_device_unavailable'; end if;
 select * into v_ticket from lumen_commands.push_test_dispatches
 where user_id=p_expected_user_id and device_id=p_device_id and challenge_day=v_device.challenge_day;
 if p_action='read' or found then
  return jsonb_build_object('status',case when v_ticket.state='reserved' and v_ticket.reserved_until<=v_now then 'skipped'
   when v_ticket.state='dispatching' and v_ticket.expires_at<=v_now then 'ambiguous' else coalesce(v_ticket.state,'none') end);
 end if;
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='lumen_daily_push_job_token';
 if coalesce(length(v_secret),0)<32 then raise exception using errcode='55000',message='push_test_unconfigured'; end if;
 insert into lumen_commands.push_test_dispatches(challenge_day,user_id,device_id,device_updated_at,consent_revision,
  endpoint_fingerprint,subscription_fingerprint,reserved_until,expires_at)
 values(v_device.challenge_day,p_expected_user_id,p_device_id,v_device.device_updated_at,v_device.consent_revision,
  v_device.endpoint_fingerprint,v_device.subscription_fingerprint,v_now+interval '90 seconds',v_device.end_at)
 on conflict do nothing returning * into v_ticket;
 if not found then return jsonb_build_object('status','skipped'); end if;
 -- Fixed same-project destination. No endpoint, token or HTTP response is returned to clients.
 perform net.http_post(url:='https://tjdjlavmusmncuszhsuw.supabase.co/functions/v1/lumen-daily-push-dispatch?action=test',
  body:=jsonb_build_object('reservationId',v_ticket.reservation_id),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),timeout_milliseconds:=10000);
 return jsonb_build_object('status','reserved');
end
$body$;
create or replace function public.lumen_authorize_test_push_v1(p_reservation_id uuid)
returns jsonb language sql volatile security definer set search_path='' as $body$
 select lumen_commands.authorize_test_push(statement_timestamp(),p_reservation_id)
$body$;
create or replace function public.lumen_finish_test_push_v1(p_reservation_id uuid,p_outcome text)
returns text language sql volatile security definer set search_path='' as $body$
 select lumen_commands.finish_test_push(p_reservation_id,p_outcome)
$body$;
revoke all on function lumen_commands.eligible_test_push(timestamptz,uuid,uuid),
 lumen_commands.authorize_test_push(timestamptz,uuid),lumen_commands.finish_test_push(uuid,text),
 public.lumen_daily_push_test_v1(uuid,uuid,text),public.lumen_authorize_test_push_v1(uuid),public.lumen_finish_test_push_v1(uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.lumen_daily_push_test_v1(uuid,uuid,text) to authenticated;
grant execute on function public.lumen_authorize_test_push_v1(uuid),public.lumen_finish_test_push_v1(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
