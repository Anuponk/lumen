-- #1030 LUMEN Premium foundation (lots 0-2, server side). Additive and idempotent.
-- EVERYTHING IS OFF BY DEFAULT: no player sees any change until the owner turns
-- the commerce settings on (docs/PREMIUM_1030.md, activation plan). Nothing here
-- touches lumen.entitlements, purchases, progress or rankings.
--
-- 1. lumen_commands.commerce_settings: typed switches and quota values, editable
--    without redeploy (SQL editor or the capability-gated admin RPC), audited.
--    quotas_enabled cannot be turned on while quota_new_daily is undecided.
-- 2. Premium is a server right distinct from Adventure entitlements and mastery:
--    * derived live from the confirmed purchase ledger (lumen-premium, real-sky-all,
--      any sky upgrade, or five distinct unit Adventures): restore, multi-device,
--      refund and dispute follow the ledger automatically;
--    * or an explicit, traced grant (lumen_commands.premium_grants), written only by
--      lumen_commands.premium_backfill(true) for an administrative whole sky, or by
--      the service role. Partial grants, mastery-only skies and mixed sources are
--      reported, never granted (owner rule: do not invent an attribution).
--    The new product lumen-premium (4.99 EUR) is seeded INACTIVE; when paid it owns
--    the whole main sky like real-sky-all. Historical products stay for restores.
-- 3. Daily quotas ledger (lumen_commands.quota_state / quota_attempts): one row per
--    attempt identity, deduplicated across devices, imputed to the local day of its
--    start. Written only while quotas apply to the account (client side), so the
--    cost is zero while the settings are off.
-- 4. Private circles: creation requires Premium only once premium_circles is on.
-- 5. Analytics #1044: lumen_admin_quota_simulation (analytics_cockpit capability).
begin;

-- 1. Settings ---------------------------------------------------------------------
create table if not exists lumen_commands.commerce_settings(
 key text primary key check (key in ('premium_enabled','shop_premium','quotas_enabled',
  'quota_threshold_constellation','quota_new_daily','quota_replay_daily',
  'premium_stats','premium_archives','premium_circles','premium_cosmetics')),
 value jsonb not null,
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists lumen_commands.commerce_settings_audit(
 id bigint generated always as identity primary key,
 key text not null,
 old_value jsonb,
 new_value jsonb not null,
 changed_at timestamptz not null default clock_timestamp()
);
alter table lumen_commands.commerce_settings enable row level security;
alter table lumen_commands.commerce_settings_audit enable row level security;
revoke all on lumen_commands.commerce_settings,lumen_commands.commerce_settings_audit from public,anon,authenticated;
-- Never overwrite a value chosen by the owner on a re-run.
insert into lumen_commands.commerce_settings(key,value) values
 ('premium_enabled','false'),('shop_premium','false'),('quotas_enabled','false'),
 ('quota_threshold_constellation','4'),('quota_new_daily','null'),('quota_replay_daily','5'),
 ('premium_stats','false'),('premium_archives','false'),('premium_circles','false'),('premium_cosmetics','false')
on conflict (key) do nothing;

create or replace function lumen_commands.commerce_setting(p_key text)
returns jsonb language sql stable security definer set search_path='' as $$
 select value from lumen_commands.commerce_settings where key=p_key
$$;
create or replace function lumen_commands.commerce_config()
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value order by key),'{}'::jsonb) from lumen_commands.commerce_settings
$$;
revoke all on function lumen_commands.commerce_setting(text),lumen_commands.commerce_config() from public,anon,authenticated,service_role;

create or replace function lumen_commands.set_commerce_setting(p_key text,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old jsonb;
begin
 if p_key in ('premium_enabled','shop_premium','quotas_enabled','premium_stats','premium_archives','premium_circles','premium_cosmetics') then
  if jsonb_typeof(p_value) is distinct from 'boolean' then raise exception using errcode='22023',message='commerce_setting_boolean';end if;
 elsif p_key='quota_threshold_constellation' then
  if jsonb_typeof(p_value) is distinct from 'number' or (p_value::text)::numeric not between 1 and 88 or (p_value::text)::numeric<>trunc((p_value::text)::numeric) then
   raise exception using errcode='22023',message='commerce_setting_range';end if;
 elsif p_key='quota_new_daily' then
  if jsonb_typeof(p_value)<>'null' and (jsonb_typeof(p_value) is distinct from 'number' or (p_value::text)::numeric not between 1 and 500 or (p_value::text)::numeric<>trunc((p_value::text)::numeric)) then
   raise exception using errcode='22023',message='commerce_setting_range';end if;
 elsif p_key='quota_replay_daily' then
  if jsonb_typeof(p_value) is distinct from 'number' or (p_value::text)::numeric not between 0 and 500 or (p_value::text)::numeric<>trunc((p_value::text)::numeric) then
   raise exception using errcode='22023',message='commerce_setting_range';end if;
 else raise exception using errcode='22023',message='commerce_setting_unknown';
 end if;
 perform pg_advisory_xact_lock(1030,0);
 -- The new-quest quota value is an owner decision (#1044): quotas cannot be
 -- switched on before it exists, nor can it be cleared while they are on.
 if p_key='quotas_enabled' and p_value='true'::jsonb and coalesce(jsonb_typeof(lumen_commands.commerce_setting('quota_new_daily')),'null')='null' then
  raise exception using errcode='22023',message='quota_new_daily_undecided';end if;
 if p_key='quota_new_daily' and jsonb_typeof(p_value)='null' and lumen_commands.commerce_setting('quotas_enabled')='true'::jsonb then
  raise exception using errcode='22023',message='quota_new_daily_undecided';end if;
 select value into old from lumen_commands.commerce_settings where key=p_key for update;
 if old is not distinct from p_value then return lumen_commands.commerce_config();end if;
 insert into lumen_commands.commerce_settings(key,value,updated_at) values(p_key,p_value,clock_timestamp())
  on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
 insert into lumen_commands.commerce_settings_audit(key,old_value,new_value) values(p_key,old,p_value);
 return lumen_commands.commerce_config();
end $$;
revoke all on function lumen_commands.set_commerce_setting(text,jsonb) from public,anon,authenticated,service_role;

create or replace function lumen_commands.has_capability(p_user uuid,p_capability text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(select 1 from lumen.internal_capabilities c where c.user_id=p_user
  and c.capability=p_capability and (c.expires_at is null or c.expires_at>clock_timestamp()))
$$;
revoke all on function lumen_commands.has_capability(uuid,text) from public,anon,authenticated,service_role;

-- Owner console without redeploy: commerce_admin capability only.
create or replace function public.lumen_admin_set_commerce_setting(p_key text,p_value jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not lumen_commands.has_capability(auth.uid(),'commerce_admin') then
  raise exception using errcode='42501',message='commerce_admin capability required';end if;
 return lumen_commands.set_commerce_setting(p_key,p_value);
end $$;
revoke all on function public.lumen_admin_set_commerce_setting(text,jsonb) from public,anon,authenticated;
grant execute on function public.lumen_admin_set_commerce_setting(text,jsonb) to authenticated;

-- 2. Premium right ---------------------------------------------------------------
alter table lumen_commands.store_products drop constraint if exists store_products_kind_check;
alter table lumen_commands.store_products add constraint store_products_kind_check
 check (kind in ('adventure','sky','sky_upgrade','premium'));
insert into lumen_commands.store_products(product_id,kind,pack_id,price_cents,currency,active,upgrade_tier)
 values('lumen-premium','premium',null,499,'EUR',false,null)
on conflict (product_id) do nothing;

-- A paid Premium owns the main sky exactly like real-sky-all (same entitlement path).
create or replace function lumen_commands.main_sky_purchase_status(p_user uuid)
returns table(adventures_purchased integer, sky_purchased boolean)
language sql stable set search_path='' as $$
  select count(distinct p.product_id) filter (
    where s.kind='adventure' and s.pack_id ~ '^real-adventure-0[2-9]$'
  )::integer, coalesce(bool_or((s.kind='sky' and s.product_id='real-sky-all') or s.kind in ('sky_upgrade','premium')),false)
  from lumen_commands.purchases p
  join lumen_commands.store_products s on s.product_id=p.product_id
  where p.user_id=p_user and p.status='paid';
$$;
revoke all on function lumen_commands.main_sky_purchase_status(uuid) from public,anon,authenticated;

create table if not exists lumen_commands.premium_grants(
 user_id uuid primary key references auth.users(id) on delete cascade,
 source text not null check (source in ('admin_full_sky','admin')),
 granted_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence)='object' and pg_column_size(evidence)<=2048)
);
create table if not exists lumen_commands.premium_grant_events(
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 action text not null check (action in ('grant','revoke','restore')),
 source text not null,
 recorded_at timestamptz not null default clock_timestamp()
);
create index if not exists premium_grant_events_user_idx on lumen_commands.premium_grant_events(user_id,recorded_at desc);
alter table lumen_commands.premium_grants enable row level security;
alter table lumen_commands.premium_grant_events enable row level security;
revoke all on lumen_commands.premium_grants,lumen_commands.premium_grant_events from public,anon,authenticated;

-- Live derivation, in priority order. Refunded/disputed purchases never count.
create or replace function lumen_commands.premium_status(p_user uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with paid as (
  select s.kind,s.product_id,s.pack_id,p.purchased_at from lumen_commands.purchases p
  join lumen_commands.store_products s on s.product_id=p.product_id
  where p.user_id=p_user and p.status='paid'),
 derived as (
  select 1 rank,'premium_purchase' source,min(purchased_at) since from paid where kind='premium' having count(*)>0
  union all select 2,'sky_purchase',min(purchased_at) from paid where kind='sky' having count(*)>0
  union all select 3,'sky_upgrade',min(purchased_at) from paid where kind='sky_upgrade' having count(*)>0
  union all select 4,'five_adventures',max(purchased_at) from paid where kind='adventure' and pack_id ~ '^real-adventure-0[2-9]$'
   having count(distinct pack_id)>=5
  union all select 5,g.source,g.granted_at from lumen_commands.premium_grants g where g.user_id=p_user and g.revoked_at is null)
 select coalesce((select jsonb_build_object('active',true,'source',source,'since',since) from derived order by rank limit 1),
  jsonb_build_object('active',false,'source',null,'since',null))
 where p_user is not null
$$;
revoke all on function lumen_commands.premium_status(uuid) from public,anon,authenticated,service_role;
create or replace function lumen_commands.is_premium(p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((lumen_commands.premium_status(p_user)->>'active')::boolean,false)
$$;
revoke all on function lumen_commands.is_premium(uuid) from public,anon,authenticated,service_role;

-- Inventory of the historical rights (read-only unless p_apply). Only an
-- administrative whole sky becomes a traced grant; purchases are already derived.
-- Output carries short fingerprints, never account identifiers.
create or replace function lumen_commands.premium_backfill(p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb; granted integer:=0; r record;
begin
 perform pg_advisory_xact_lock(1030,1);
 create temporary table if not exists pg_temp.premium_backfill_scan(user_id uuid,class text,evidence jsonb) on commit drop;
 truncate pg_temp.premium_backfill_scan;
 insert into pg_temp.premium_backfill_scan
 with locked as (select pack_id from lumen_commands.adventure_packs where access='locked' and pack_id ~ '^real-adventure-0[2-9]$'),
 act as (select e.user_id,e.entitlement,e.source from lumen.entitlements e join locked l on l.pack_id=e.entitlement
  where e.expires_at is null or e.expires_at>clock_timestamp()),
 people as (select user_id from act union select user_id from lumen_commands.purchases union select user_id from lumen_commands.premium_grants),
 facts as (select p.user_id,
  (select count(*) from act a where a.user_id=p.user_id) owned,
  (select count(*) from locked) total,
  (select count(*) from act a where a.user_id=p.user_id and (a.source='admin' or a.source like 'admin\_%' or a.source='manual')) admin_owned,
  (select count(*) from act a where a.user_id=p.user_id and a.source='mastery') mastery_owned,
  (select count(*) from act a where a.user_id=p.user_id and a.source='purchase') purchase_owned,
  (select coalesce(jsonb_agg(distinct a.source),'[]'::jsonb) from act a where a.user_id=p.user_id) sources,
  lumen_commands.premium_status(p.user_id) premium
  from people p)
 select user_id,
  case when (premium->>'active')::boolean and premium->>'source' not in ('admin_full_sky','admin') then 'premium_from_purchases'
   when (premium->>'active')::boolean then 'premium_granted'
   when owned=total and admin_owned=total then 'admin_full_sky'
   when owned=total and mastery_owned=total then 'mastery_full_sky'
   when owned=total then 'mixed_full_sky_uncovered'
   when owned>0 then 'partial'
   else 'free' end,
  jsonb_build_object('owned',owned,'admin',admin_owned,'mastery',mastery_owned,'purchase',purchase_owned,'sources',sources)
 from facts;
 if p_apply then
  for r in select * from pg_temp.premium_backfill_scan where class='admin_full_sky' loop
   insert into lumen_commands.premium_grants(user_id,source,evidence) values(r.user_id,'admin_full_sky',r.evidence)
    on conflict(user_id) do nothing;
   if found then
    insert into lumen_commands.premium_grant_events(user_id,action,source) values(r.user_id,'grant','admin_full_sky');
    granted:=granted+1;
   end if;
  end loop;
 end if;
 select jsonb_build_object('applied',p_apply,'granted',granted,
  'classes',coalesce((select jsonb_object_agg(class,n) from (select class,count(*) n from pg_temp.premium_backfill_scan group by class) c),'{}'::jsonb),
  'review',coalesce((select jsonb_agg(jsonb_build_object('account',left(md5(user_id::text),8),'class',class,'evidence',evidence) order by class,md5(user_id::text))
   from pg_temp.premium_backfill_scan where class in ('admin_full_sky','mixed_full_sky_uncovered','mastery_full_sky')),'[]'::jsonb))
 into rows;
 return rows;
end $$;
revoke all on function lumen_commands.premium_backfill(boolean) from public,anon,authenticated,service_role;

-- Rollback of the traced grants (activation plan): revocation keeps the row and event.
create or replace function lumen_commands.premium_revoke_grant(p_user uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update lumen_commands.premium_grants set revoked_at=clock_timestamp() where user_id=p_user and revoked_at is null;
 if not found then return false;end if;
 insert into lumen_commands.premium_grant_events(user_id,action,source)
  select user_id,'revoke',source from lumen_commands.premium_grants where user_id=p_user;
 return true;
end $$;
revoke all on function lumen_commands.premium_revoke_grant(uuid) from public,anon,authenticated,service_role;

-- Stripe: the reservation body (#730/#865) is unchanged; Premium is refused to an
-- account already Premium (any origin), before any session is created. The product
-- stays unknown to checkout while it is inactive.
create or replace function public.lumen_stripe_checkout_begin(p_user uuid,p_product text,p_waiver_at timestamptz,p_livemode boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_product='lumen-premium' and exists(select 1 from lumen_commands.store_products s where s.product_id=p_product and s.active)
  and lumen_commands.is_premium(p_user) then
  return jsonb_build_object('result','already_owned');end if;
 return lumen_commands.stripe_checkout_begin(p_user,p_product,p_waiver_at,p_livemode);
end $$;
revoke all on function public.lumen_stripe_checkout_begin(uuid,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.lumen_stripe_checkout_begin(uuid,text,timestamptz,boolean) to service_role;

-- 3. Daily quotas ledger -----------------------------------------------------------
create table if not exists lumen_commands.quota_state(
 user_id uuid primary key references auth.users(id) on delete cascade,
 activated_at timestamptz,
 activation_quest text check (activation_quest is null or char_length(activation_quest) between 1 and 80),
 updated_at timestamptz not null default clock_timestamp()
);
create table if not exists lumen_commands.quota_attempts(
 user_id uuid not null references auth.users(id) on delete cascade,
 attempt_id text not null check (char_length(attempt_id) between 8 and 160),
 quest_id text not null check (char_length(quest_id) between 1 and 80),
 kind text not null check (kind in ('new','replay')),
 local_day date not null,
 time_zone text not null check (char_length(time_zone) between 1 and 64),
 started_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 primary key(user_id,attempt_id)
);
create index if not exists quota_attempts_day_idx on lumen_commands.quota_attempts(user_id,local_day);
alter table lumen_commands.quota_state enable row level security;
alter table lumen_commands.quota_attempts enable row level security;
revoke all on lumen_commands.quota_state,lumen_commands.quota_attempts from public,anon,authenticated;

create or replace function lumen_commands.quota_counts(p_user uuid,p_day date)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('day',p_day,'new',count(*) filter (where kind='new'),'replay',count(*) filter (where kind='replay'))
 from lumen_commands.quota_attempts where user_id=p_user and local_day=p_day
$$;
revoke all on function lumen_commands.quota_counts(uuid,date) from public,anon,authenticated,service_role;

create or replace function lumen_commands.commerce_public_config()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'premiumEnabled',coalesce(lumen_commands.commerce_setting('premium_enabled'),'false'),
  'shopPremium',coalesce(lumen_commands.commerce_setting('shop_premium'),'false'),
  'quotasEnabled',coalesce(lumen_commands.commerce_setting('quotas_enabled'),'false'),
  'thresholdConstellation',coalesce(lumen_commands.commerce_setting('quota_threshold_constellation'),'4'),
  'newDaily',coalesce(lumen_commands.commerce_setting('quota_new_daily'),'null'),
  'replayDaily',coalesce(lumen_commands.commerce_setting('quota_replay_daily'),'5'),
  'stats',coalesce(lumen_commands.commerce_setting('premium_stats'),'false'),
  'archives',coalesce(lumen_commands.commerce_setting('premium_archives'),'false'),
  'circles',coalesce(lumen_commands.commerce_setting('premium_circles'),'false'),
  'cosmetics',coalesce(lumen_commands.commerce_setting('premium_cosmetics'),'false'),
  'premiumPriceCents',(select price_cents from lumen_commands.store_products where product_id='lumen-premium'),
  'premiumProductActive',coalesce((select active from lumen_commands.store_products where product_id='lumen-premium'),false))
$$;
revoke all on function lumen_commands.commerce_public_config() from public,anon,authenticated,service_role;

-- Guests and signed-out clients: the public switches only (no account data).
create or replace function public.lumen_get_commerce_config()
returns jsonb language sql stable security definer set search_path='' as $$
 select lumen_commands.commerce_public_config()
$$;
revoke all on function public.lumen_get_commerce_config() from public;
grant execute on function public.lumen_get_commerce_config() to anon,authenticated;

-- One bounded read after entitlement hydration: switches, Premium, QA preview,
-- durable quota activation and the given local day's server counts.
create or replace function public.lumen_get_commerce_state(p_expected_user_id uuid,p_day date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid(); st lumen_commands.quota_state;
begin
 if me is null or p_expected_user_id is distinct from me then raise exception using errcode='42501',message='commerce_account_mismatch';end if;
 select * into st from lumen_commands.quota_state where user_id=me;
 return jsonb_build_object('config',lumen_commands.commerce_public_config(),
  'premium',lumen_commands.premium_status(me),
  'preview',lumen_commands.has_capability(me,'premium_preview'),
  'activatedAt',st.activated_at,
  'counts',case when p_day is null then null else lumen_commands.quota_counts(me,p_day) end);
end $$;
revoke all on function public.lumen_get_commerce_state(uuid,date) from public,anon;
grant execute on function public.lumen_get_commerce_state(uuid,date) to authenticated;

-- Batched, idempotent reconciliation of attempts started (possibly offline). The
-- server never refuses a run already played: it records it (dedup by identity) and
-- returns the authoritative counts the client limits itself with.
create or replace function public.lumen_quota_sync(p_expected_user_id uuid,p_day date,p_attempts jsonb default '[]'::jsonb,p_activation jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); a jsonb; accepted integer:=0; started timestamptz; d date; act_at timestamptz;
begin
 if me is null or p_expected_user_id is distinct from me then raise exception using errcode='42501',message='commerce_account_mismatch';end if;
 if p_day is null or abs(p_day-(clock_timestamp() at time zone 'UTC')::date)>1 then raise exception using errcode='22023',message='quota_day_invalid';end if;
 if jsonb_typeof(coalesce(p_attempts,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_attempts,'[]'::jsonb))>40 then
  raise exception using errcode='22023',message='quota_batch_invalid';end if;
 perform pg_advisory_xact_lock(1030,hashtext(me::text));
 if p_activation is not null then
  begin act_at:=(p_activation->>'at')::timestamptz;exception when others then act_at:=null;end;
  if act_at is null or act_at>clock_timestamp()+interval '10 minutes' or char_length(coalesce(p_activation->>'questId',''))not between 1 and 80 then
   raise exception using errcode='22023',message='quota_activation_invalid';end if;
  -- Durable and monotonic: the earliest activation wins, it is never cleared.
  insert into lumen_commands.quota_state(user_id,activated_at,activation_quest) values(me,act_at,p_activation->>'questId')
   on conflict(user_id) do update set activated_at=least(coalesce(lumen_commands.quota_state.activated_at,excluded.activated_at),excluded.activated_at),
    activation_quest=case when lumen_commands.quota_state.activated_at is null or excluded.activated_at<lumen_commands.quota_state.activated_at
     then excluded.activation_quest else lumen_commands.quota_state.activation_quest end,updated_at=clock_timestamp();
 end if;
 for a in select value from jsonb_array_elements(coalesce(p_attempts,'[]'::jsonb)) loop
  begin started:=(a->>'startedAt')::timestamptz;d:=(a->>'day')::date;exception when others then started:=null;end;
  -- Offline window of 7 days; the local day must match the start instant within
  -- the widest real time zone offsets (UTC-12 .. UTC+14).
  if started is null or d is null or started>clock_timestamp()+interval '10 minutes' or started<clock_timestamp()-interval '7 days'
   or d not between (started at time zone 'UTC' - interval '12 hours')::date and (started at time zone 'UTC' + interval '14 hours')::date
   or coalesce(a->>'kind','') not in ('new','replay') or char_length(coalesce(a->>'attemptId','')) not between 8 and 160
   or char_length(coalesce(a->>'questId','')) not between 1 and 80 or char_length(coalesce(a->>'timeZone','')) not between 1 and 64 then
   raise exception using errcode='22023',message='quota_attempt_invalid';end if;
  insert into lumen_commands.quota_attempts(user_id,attempt_id,quest_id,kind,local_day,time_zone,started_at)
   values(me,a->>'attemptId',a->>'questId',a->>'kind',d,a->>'timeZone',started) on conflict do nothing;
  if found then accepted:=accepted+1;end if;
 end loop;
 -- Bounded retention: the quota only needs recent days (analytics keep ranking runs).
 delete from lumen_commands.quota_attempts where user_id=me and local_day<p_day-45;
 return jsonb_build_object('accepted',accepted,'activatedAt',(select activated_at from lumen_commands.quota_state where user_id=me),
  'counts',lumen_commands.quota_counts(me,p_day),'premium',lumen_commands.premium_status(me));
end $$;
revoke all on function public.lumen_quota_sync(uuid,date,jsonb,jsonb) from public,anon;
grant execute on function public.lumen_quota_sync(uuid,date,jsonb,jsonb) to authenticated;

-- 4. Private circles: Premium creation once premium_circles is on ------------------
-- Same body as #929, plus the commercial gate. Joining, invitations by the existing
-- owner, rankings and existing circles are unchanged.
create or replace function public.lumen_circle_create(p_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen.social_caller();v text:=lumen.circle_name(p_name);created uuid;
begin
 if lumen_commands.commerce_setting('premium_circles')='true'::jsonb and not lumen_commands.is_premium(me)
  and not lumen_commands.has_capability(me,'premium_preview') then
  raise exception using errcode='P0001',message='circle_premium_required';end if;
 perform pg_advisory_xact_lock(hashtextextended('lumen-circle-user:'||me::text,0));
 perform lumen.circle_room(me);
 insert into lumen.circles(name,owner_user_id) values(v,me) returning id into created;
 insert into lumen.circle_members(circle_id,user_id,role) values(created,me,'owner');
 return jsonb_build_object('id',created,'name',v);
end $$;
revoke all on function public.lumen_circle_create(text) from public,anon;
grant execute on function public.lumen_circle_create(text) to authenticated;

-- 5. Analytics #1044: quota calibration from existing ranking runs ------------------
-- Ranking runs are the only per-attempt server record (signed-in accounts, QA runs
-- are never sent). New = before the first confirmed win of that quest; replay
-- after it (or after a historical solved projection). Days are Europe/Paris.
-- p_discovery_quests: stable IDs of the quota-free constellations (the catalogue
-- owns constellation order, the client sends the list).
create or replace function public.lumen_admin_quota_simulation(p_days integer default 30,p_discovery_quests text[] default null,
 p_quotas integer[] default array[5,10,15,20,30],p_replay_quota integer default 5)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_out jsonb;
begin
 if not lumen_commands.has_capability(auth.uid(),'analytics_cockpit') then
  raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 if p_days is null or p_days not between 1 and 90 or p_discovery_quests is null or cardinality(p_discovery_quests) not between 1 and 200
  or p_quotas is null or cardinality(p_quotas) not between 1 and 12 or p_replay_quota is null or p_replay_quota not between 0 and 500 then
  raise exception using errcode='22023',message='invalid_parameter_value';end if;
 with ext as (select distinct user_id from lumen.internal_capabilities),
 buyers as (select distinct user_id from lumen_commands.purchases where status='paid'),
 r as (select r.user_id,r.quest_id,r.issued_at,r.result,(r.started_at at time zone 'Europe/Paris')::date d,
   not (r.quest_id=any(p_discovery_quests)) post
  from lumen_commands.ranking_runs r
  where r.issued_at>=clock_timestamp()-make_interval(days=>p_days) and not exists(select 1 from ext where ext.user_id=r.user_id)),
 fw as (select user_id,quest_id,min(issued_at) filter (where result->>'status'='confirmed') first_win from r group by 1,2),
 cls as (select r.*,case when (fw.first_win is not null and fw.first_win<r.issued_at)
   or (fw.first_win is null and exists(select 1 from lumen_commands.quest_run_authority q where q.user_id=r.user_id and q.quest_id=r.quest_id and q.projection->>'solved'='true'))
   then 'replay' else 'new' end kind
  from r left join fw using(user_id,quest_id)),
 act as (select user_id,min(issued_at) filter (where post) act_at from cls group by 1),
 ud as (select c.user_id,c.d,count(*) filter (where kind='new') n_new,count(*) filter (where kind='replay') n_rep,count(*) n_all,
   exists(select 1 from buyers b where b.user_id=c.user_id) buyer,bool_or(a.act_at is not null and c.issued_at>=a.act_at) after4
  from cls c join act a using(user_id) group by c.user_id,c.d),
 seg as (select *,case when buyer then 'buyer' else 'free' end||'/'||case when after4 then 'after_threshold' else 'discovery' end s from ud)
 select jsonb_build_object(
  'source','ranking_runs','days',p_days,'timeZone','Europe/Paris','excluded','internal_capabilities accounts; QA runs never sent',
  'coverage',jsonb_build_object('userDays',(select count(*) from seg),'players',(select count(distinct user_id) from seg),
   'firstDay',(select min(d) from seg),'lastDay',(select max(d) from seg)),
  'segments',coalesce((select jsonb_agg(x order by x->>'segment') from (
   select jsonb_build_object('segment',s,'userDays',count(*),'players',count(distinct user_id),
    'percentiles',jsonb_build_object('levels',array[50,75,80,90,95,99],
     'new',percentile_disc(array[0.5,0.75,0.8,0.9,0.95,0.99]) within group (order by n_new),
     'replay',percentile_disc(array[0.5,0.75,0.8,0.9,0.95,0.99]) within group (order by n_rep),
     'all',percentile_disc(array[0.5,0.75,0.8,0.9,0.95,0.99]) within group (order by n_all))) x
   from seg group by s) y),'[]'::jsonb),
  'simulation',coalesce((select jsonb_agg(z order by (z->>'newQuota')::int) from (
   select jsonb_build_object('newQuota',q,'replayQuota',p_replay_quota,'userDays',count(*),'players',count(distinct user_id),
    'pctDaysReachNew',round(100.0*avg((n_new>=q)::int),1),'pctDaysReachReplay',round(100.0*avg((n_rep>=p_replay_quota)::int),1),
    'pctDaysReachAny',round(100.0*avg((n_new>=q or n_rep>=p_replay_quota)::int),1),
    'pctAttemptsBeyond',round(100.0*sum(greatest(n_new-q,0)+greatest(n_rep-p_replay_quota,0))/nullif(sum(n_new+n_rep),0),1),
    'playersNeverReaching',count(distinct user_id)-count(distinct user_id) filter (where n_new>=q or n_rep>=p_replay_quota)) z
   from seg,unnest(p_quotas) q where s='free/after_threshold' group by q) w),'[]'::jsonb)
 ) into v_out;
 return v_out;
end $$;
revoke all on function public.lumen_admin_quota_simulation(integer,text[],integer[],integer) from public,anon;
grant execute on function public.lumen_admin_quota_simulation(integer,text[],integer[],integer) to authenticated;

-- 6. Lot 2 Premium reads (bounded, on demand, account-only) -------------------------
-- A Premium feature is usable when the commercial model and that feature are on
-- and the account is Premium, or in QA preview.
create or replace function lumen_commands.premium_feature(p_user uuid,p_key text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_user is not null and (lumen_commands.has_capability(p_user,'premium_preview') or (
  lumen_commands.commerce_setting('premium_enabled')='true'::jsonb and lumen_commands.commerce_setting(p_key)='true'::jsonb
  and lumen_commands.is_premium(p_user)))
$$;
revoke all on function lumen_commands.premium_feature(uuid,text) from public,anon,authenticated,service_role;

-- Playable archives (#1015): the board of a PAST official day only (never today
-- or a future grid). The client replays it as a training run: no official
-- attempt, no ranking, no standing is ever written by this read.
create or replace function public.lumen_daily_archive(p_day date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid();p lumen_commands.daily_puzzles%rowtype;
begin
 if me is null then raise exception using errcode='42501',message='account_required';end if;
 if not lumen_commands.premium_feature(me,'premium_archives') then raise exception using errcode='42501',message='premium_required';end if;
 if p_day is null or p_day>=lumen_commands.daily_today() then raise exception using errcode='22023',message='archive_day_invalid';end if;
 select * into p from lumen_commands.daily_puzzles where day=p_day;
 if not found then raise exception using errcode='22023',message='archive_not_found';end if;
 return jsonb_build_object('day',p.day,'quest_id',p.quest_id,'grid_revision',p.grid_revision);
end $$;
revoke all on function public.lumen_daily_archive(date) from public,anon;
grant execute on function public.lumen_daily_archive(date) to authenticated;

-- Advanced personal statistics: existing ranking runs and victory receipts only
-- (no new collection). Keyset pagination of the history, 90-day daily series,
-- personal bests; difficulty is aggregated client side from the catalogue.
create or replace function public.lumen_premium_stats(p_expected_user_id uuid,p_before timestamptz default null,p_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid:=auth.uid();lim integer:=coalesce(p_limit,30);
begin
 if me is null or p_expected_user_id is distinct from me then raise exception using errcode='42501',message='commerce_account_mismatch';end if;
 if not lumen_commands.premium_feature(me,'premium_stats') then raise exception using errcode='42501',message='premium_required';end if;
 if lim not between 1 and 50 then raise exception using errcode='22023',message='invalid_parameter_value';end if;
 return jsonb_build_object(
  'history',coalesce((select jsonb_agg(h order by h->>'at' desc) from (
   select jsonb_build_object('at',r.issued_at,'questId',r.quest_id,'gridRevision',r.grid_revision,'qualifying',r.eligible,
    'status',coalesce(r.result->>'status','unfinished'),'improved',coalesce((r.result->>'improved')::boolean,false),
    'hints',coalesce((r.counts->>'hint')::int,0),'verifies',coalesce((r.counts->>'verify')::int,0),
    'seconds',(select case when c.request->'facts'->>'seconds' ~ '^\d{1,6}$' then (c.request->'facts'->>'seconds')::int end
      from lumen_commands.canonical_receipts c where c.user_id=me and c.operation_id=r.operation_id limit 1)) h
   from lumen_commands.ranking_runs r where r.user_id=me and (p_before is null or r.issued_at<p_before)
   order by r.issued_at desc limit lim) x),'[]'::jsonb),
  'series',case when p_before is null then coalesce((select jsonb_agg(jsonb_build_object('day',d,'attempts',n,'wins',w,'medianSeconds',m) order by d) from (
   select (r.issued_at at time zone 'Europe/Paris')::date d,count(*) n,count(*) filter (where r.result->>'status'='confirmed') w,
    percentile_disc(0.5) within group (order by (select case when c.request->'facts'->>'seconds' ~ '^\d{1,6}$' then (c.request->'facts'->>'seconds')::int end
     from lumen_commands.canonical_receipts c where c.user_id=me and c.operation_id=r.operation_id limit 1)) m
   from lumen_commands.ranking_runs r where r.user_id=me and r.issued_at>=clock_timestamp()-interval '90 days' group by 1) y),'[]'::jsonb) end,
  'records',case when p_before is null then coalesce((select jsonb_agg(jsonb_build_object('questId',s.quest_id,'gridRevision',s.grid_revision,
    'seconds',s.seconds,'penalty',s.penalty,'score',s.score) order by s.score,s.quest_id)
   from (select * from lumen_commands.ranking_scores where user_id=me order by score,quest_id limit 1000) s),'[]'::jsonb) end);
end $$;
revoke all on function public.lumen_premium_stats(uuid,timestamptz,integer) from public,anon;
grant execute on function public.lumen_premium_stats(uuid,timestamptz,integer) to authenticated;

-- Privacy: every player row is erased with the account; settings are product rules.
do $$begin
 if to_regprocedure('lumen_privacy.policy_before_premium_1030()') is null then
  alter function lumen_privacy.policy() rename to policy_before_premium_1030;
 end if;
end $$;
create or replace function lumen_privacy.policy()
returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
language sql stable security definer set search_path='' as $$
 select * from lumen_privacy.policy_before_premium_1030()
 union all values
 ('lumen_commands','commerce_settings',null::text,null::text,null::text,'retain-rule'),
 ('lumen_commands','commerce_settings_audit',null,null,null,'retain-rule'),
 ('lumen_commands','premium_grants','user_id',null,null,'delete'),
 ('lumen_commands','premium_grant_events','user_id',null,null,'delete'),
 ('lumen_commands','quota_state','user_id',null,null,'delete'),
 ('lumen_commands','quota_attempts','user_id',null,null,'delete')
$$;
revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_premium_1030() from public,anon,authenticated,service_role;
select lumen_privacy.install_guards();
notify pgrst,'reload schema';
commit;
