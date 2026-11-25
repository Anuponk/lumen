-- #1032: preferences and device enrollment for daily Web Push.
-- No legacy consent import, delivery job, provider key or production activation.
begin;

create table if not exists lumen_commands.push_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision integer not null default 0 check (revision >= 0),
 daily_consented_at timestamptz
);
create table if not exists lumen_commands.push_devices (
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null,
 endpoint text not null unique,
 p256dh text not null,
 auth_secret text not null,
 timezone text not null,
 locale text not null check (locale in ('fr','en','es')),
 updated_at timestamptz not null,
 primary key (user_id,device_id)
);
create table if not exists lumen_commands.push_configuration (
 singleton boolean primary key check (singleton),
 vapid_public_key text not null check (vapid_public_key ~ '^B[A-Za-z0-9_-]{86}$')
);
alter table lumen_commands.push_configuration enable row level security;
alter table lumen_commands.push_preferences enable row level security;
alter table lumen_commands.push_devices enable row level security;
revoke all on lumen_commands.push_configuration,lumen_commands.push_preferences,lumen_commands.push_devices from public,anon,authenticated,service_role;

insert into lumen_commands.feature_flags(name,enabled)
 values('daily_push',false) on conflict(name) do nothing;

do $privacy$
begin
 if to_regprocedure('lumen_privacy.policy_before_daily_push()') is null then
  alter function lumen_privacy.policy() rename to policy_before_daily_push;
  execute $policy$create function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $body$
    select * from lumen_privacy.policy_before_daily_push()
    union all values ('lumen_commands','push_preferences','user_id',null,null,'delete'),
                     ('lumen_commands','push_devices','user_id',null,null,'delete'),
                     ('lumen_commands','push_configuration',null,null,null,'retain-rule')
   $body$
  $policy$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_daily_push() from public,anon,authenticated,service_role;
 end if;
 perform lumen_privacy.install_guards();
end
$privacy$;

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
 join lumen_commands.feature_flags as f on f.name='daily_push' and f.enabled
 where c.singleton;
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
  'version',1,'available',v_flag,'dailyEnabled',v_pref.daily_consented_at is not null,
  'revision',coalesce(v_pref.revision,0),'reminderHour',18,'vapidPublicKey',v_public_key,
  'deviceRegistered',exists(select 1 from lumen_commands.push_devices as d where d.user_id=v_user and d.device_id=p_device_id)
 );
end
$body$;

create or replace function public.lumen_daily_push_v1(
 p_expected_user_id uuid,
 p_action text,
 p_device_id uuid default null,
 p_expected_revision integer default null,
 p_confirm_daily boolean default null,
 p_subscription jsonb default null,
 p_timezone text default null,
 p_locale text default null
) returns jsonb
language sql volatile security invoker set search_path='' as $body$
 select lumen_commands.daily_push_v1(p_expected_user_id,p_action,p_device_id,p_expected_revision,
  p_confirm_daily,p_subscription,p_timezone,p_locale);
$body$;

revoke all on function lumen_commands.daily_push_v1(uuid,text,uuid,integer,boolean,jsonb,text,text),
 public.lumen_daily_push_v1(uuid,text,uuid,integer,boolean,jsonb,text,text) from public,anon,authenticated,service_role;
grant execute on function lumen_commands.daily_push_v1(uuid,text,uuid,integer,boolean,jsonb,text,text),
 public.lumen_daily_push_v1(uuid,text,uuid,integer,boolean,jsonb,text,text) to authenticated;

-- Extend the owner-only export to redact delivery secrets from the new devices.
create or replace function lumen_privacy.export_account(
 p_user_id uuid,p_verified_actors text[],p_max_rows integer default 10000
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 r record; predicate text; n bigint; bytes bigint; total_rows bigint:=0;
 total_bytes bigint:=0; report jsonb; tables jsonb:='{}'; rows_json jsonb;
 actors text[]:=coalesce(p_verified_actors,array[]::text[]); keys text[];
 barrier jsonb; expression text;
begin
 if auth.uid() is not null then
  raise exception using errcode='42501',message='Operator database session required';
 end if;
 if current_setting('transaction_read_only')<>'on'
  or current_setting('transaction_isolation') not in ('repeatable read','serializable') then
  raise exception using errcode='25000',message='LUMEN_EXPORT_REQUIRES_STABLE_READ_ONLY_TRANSACTION';
 end if;
 if p_max_rows is null or p_max_rows not between 1 and 10000 then
  raise exception using errcode='22023',message='Invalid export bound';
 end if;
 report:=lumen_privacy.review_erasure(p_user_id,actors);
 keys:=array['u:'||p_user_id::text]||array(select 'a:'||a from unnest(actors) a);
 select coalesce(jsonb_agg(to_jsonb(e) order by e.kind,e.digest),'[]') into barrier
 from lumen_privacy.erased_identifiers e where e.owner_digest=lumen_privacy.fingerprint(p_user_id::text) or
  (e.kind='user' and e.digest=lumen_privacy.fingerprint(p_user_id::text))
  or (e.kind='actor' and e.digest in (select lumen_privacy.fingerprint(a) from unnest(actors) a))
  or (e.kind='key' and e.digest in (select lumen_privacy.fingerprint(k) from unnest(keys) k));
 total_rows:=jsonb_array_length(barrier);
 total_bytes:=pg_column_size(barrier);
 -- Preflight every category before materializing the combined JSON. Never truncate.
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') order by ns,rel loop
  predicate:=lumen_privacy.scope_predicate(r.ns,r.rel,r.uid_col,r.actor_col,r.key_col);
  execute format('select count(*),coalesce(sum(pg_column_size(to_jsonb(t))),0) from %I.%I t where %s',r.ns,r.rel,predicate)
   into n,bytes using p_user_id,actors,keys;
  if n<>(report->'tables'->(r.ns||'.'||r.rel)->>'rows')::bigint then
   raise exception 'LUMEN_EXPORT_VISIBILITY_REVIEW_REQUIRED';
  end if;
  total_rows:=total_rows+n; total_bytes:=total_bytes+bytes;
  if total_rows>p_max_rows or total_bytes>8388608 then
   raise exception using errcode='54000',message='LUMEN_EXPORT_BOUND_EXCEEDED_REVIEW_REQUIRED';
  end if;
 end loop;
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') order by ns,rel loop
  predicate:=lumen_privacy.scope_predicate(r.ns,r.rel,r.uid_col,r.actor_col,r.key_col);
  expression:='to_jsonb(t)';
  if r.ns='lumen_commands' and r.rel='support_access' then expression:='to_jsonb(t)-''actor''-''case_id''-''privacy_owner_id''';end if;
  if r.ns='lumen_commands' and r.rel='push_devices' then
   expression:='to_jsonb(t)-''endpoint''-''p256dh''-''auth_secret''';
  end if;
  if r.ns='public' and r.rel='lumen_push_subscriptions' then
   expression:='case when jsonb_typeof(to_jsonb(t)->''subscription'')=''object'' then jsonb_set(to_jsonb(t),''{subscription}'',(to_jsonb(t)->''subscription'')-''keys'') else to_jsonb(t) end';
  end if;
  execute format('select coalesce(jsonb_agg(%s order by to_jsonb(t)::text),''[]'') from %I.%I t where %s',expression,r.ns,r.rel,predicate)
   into rows_json using p_user_id,actors,keys;
  tables:=tables||jsonb_build_object(r.ns||'.'||r.rel,rows_json);
 end loop;
 return jsonb_build_object('scope','Lumen only','formatVersion',1,'userId',p_user_id,
  'capturedAt',transaction_timestamp(),'tables',tables,'erasureBarrier',barrier,
  'thirdPartyReviewRequired',true,'omittedTechnicalFields',jsonb_build_array('push subscription.keys','push_devices.endpoint','push_devices.p256dh','push_devices.auth_secret','support_access.actor','support_access.case_id','support_access.privacy_owner_id'),
  'authIncluded',false,'restoreSupported',false);
end $$;
revoke all on function lumen_privacy.export_account(uuid,text[],integer) from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
commit;
