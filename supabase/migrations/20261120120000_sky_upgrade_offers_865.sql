-- #865: « Tout débloquer » at an adjusted price after unit purchases (#728/#819 rule).
-- N = distinct main-sky Adventures bought one by one and confirmed (paid), all providers.
-- N=0 sells real-sky-all; N=1..4 sells real-sky-upgrade-N; N>=5 or main sky bought: nothing.
-- An upgrade grants the main sky directly (kind sky_upgrade), never fake unit purchases.
-- Upgrade products are seeded INACTIVE with proposed prices: the owner validates the
-- prices, creates the matching Play products, then activates them (docs/SHOP_865.md).
-- Idempotent and self-contained: it can be pasted as-is into the SQL editor.
begin;

alter table lumen_commands.store_products add column if not exists upgrade_tier smallint;
alter table lumen_commands.store_products drop constraint if exists store_products_kind_check;
alter table lumen_commands.store_products add constraint store_products_kind_check
  check (kind in ('adventure','sky','sky_upgrade'));
alter table lumen_commands.store_products drop constraint if exists store_products_upgrade_tier_check;
alter table lumen_commands.store_products add constraint store_products_upgrade_tier_check
  check ((kind='sky_upgrade')=(upgrade_tier is not null) and (upgrade_tier is null or upgrade_tier between 1 and 4));

-- Never overwrite a price or an activation decided by the owner on a re-run.
insert into lumen_commands.store_products(product_id,kind,pack_id,price_cents,currency,active,upgrade_tier) values
  ('real-sky-upgrade-1','sky_upgrade',null,400,'EUR',false,1),
  ('real-sky-upgrade-2','sky_upgrade',null,300,'EUR',false,2),
  ('real-sky-upgrade-3','sky_upgrade',null,200,'EUR',false,3),
  ('real-sky-upgrade-4','sky_upgrade',null,100,'EUR',false,4)
on conflict (product_id) do nothing;

-- A confirmed upgrade owns the main sky like real-sky-all. Unit counts are unchanged.
create or replace function lumen_commands.main_sky_purchase_status(p_user uuid)
returns table(adventures_purchased integer, sky_purchased boolean)
language sql stable set search_path='' as $$
  select count(distinct p.product_id) filter (
    where s.kind='adventure' and s.pack_id ~ '^real-adventure-0[2-9]$'
  )::integer, coalesce(bool_or((s.kind='sky' and s.product_id='real-sky-all') or s.kind='sky_upgrade'),false)
  from lumen_commands.purchases p
  join lumen_commands.store_products s on s.product_id=p.product_id
  where p.user_id=p_user and p.status='paid';
$$;
revoke all on function lumen_commands.main_sky_purchase_status(uuid) from public,anon,authenticated;

-- The single whole-sky product this account may buy now, or null. Only active products.
create or replace function lumen_commands.main_sky_offer(p_user uuid)
returns text language sql stable set search_path='' as $$
  select case when st.sky_purchased or st.adventures_purchased>=5 then null else (
    select s.product_id from lumen_commands.store_products s
    where s.active and (
      (st.adventures_purchased=0 and s.kind='sky' and s.product_id='real-sky-all')
      or (st.adventures_purchased between 1 and 4 and s.kind='sky_upgrade' and s.upgrade_tier=st.adventures_purchased))
    order by s.product_id limit 1) end
  from lumen_commands.main_sky_purchase_status(p_user) st;
$$;
revoke all on function lumen_commands.main_sky_offer(uuid) from public,anon,authenticated,service_role;

-- Play: payment happens before the server sees the token. An upgrade bought for a tier
-- that no longer applies (refund in between, crafted request) is not recorded and not
-- acknowledged, so Google refunds it automatically. Already-recorded tokens skip this.
create or replace function public.lumen_sky_upgrade_eligible(p_user uuid,p_product text)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((
    select not st.sky_purchased and st.adventures_purchased between s.upgrade_tier and 4
    from lumen_commands.store_products s, lumen_commands.main_sky_purchase_status(p_user) st
    where s.product_id=p_product and s.kind='sky_upgrade' and s.active),false);
$$;
revoke all on function public.lumen_sky_upgrade_eligible(uuid,text) from public,anon,authenticated;
grant execute on function public.lumen_sky_upgrade_eligible(uuid,text) to service_role;

-- Signed-in read: progress plus the applicable offer and its catalogue price (Stripe).
-- In the Play app the displayed price always comes from Google Play.
create or replace function public.lumen_get_main_sky_purchase_progress(p_expected_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'purchased', st.adventures_purchased,
    'remaining', greatest(0,5-st.adventures_purchased),
    'unlocked', st.sky_purchased or st.adventures_purchased >= 5,
    'sky_offer', o.product_id,
    'sky_offer_price_cents', o.price_cents,
    'sky_offer_currency', o.currency
  )
  from lumen_commands.main_sky_purchase_status(auth.uid()) st
  left join lumen_commands.store_products o on o.product_id=lumen_commands.main_sky_offer(auth.uid())
  where auth.uid() = p_expected_user_id;
$$;
revoke all on function public.lumen_get_main_sky_purchase_progress(uuid) from public,anon;
grant execute on function public.lumen_get_main_sky_purchase_progress(uuid) to authenticated;

-- Stripe reservation (#730 live switch body), now tier-aware. The old € rule is gone:
-- real-sky-all is refused after a unit purchase, and an upgrade must be the current offer.
create or replace function lumen_commands.stripe_checkout_begin(p_user uuid,p_product text,p_waiver_at timestamptz,p_livemode boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prod lumen_commands.store_products; cur lumen_commands.stripe_checkout_sessions; superseded text; rid uuid;
begin
 if p_user is null or not exists(select 1 from auth.users a where a.id=p_user) then
  raise exception using errcode='22023',message='unknown player';end if;
 if p_waiver_at is null then raise exception using errcode='22023',message='waiver required';end if;
 if p_livemode is null then raise exception using errcode='22023',message='invalid mode';end if;
 perform pg_advisory_xact_lock(730,hashtext(p_user::text));
 if p_livemode then
  if not lumen_commands.stripe_live_enabled() then return jsonb_build_object('result','not_eligible');end if;
 elsif not exists(select 1 from lumen.internal_capabilities c where c.user_id=p_user and c.capability='stripe_test_checkout'
  and (c.expires_at is null or c.expires_at>clock_timestamp())) then
  return jsonb_build_object('result','not_eligible');
 end if;
 select * into prod from lumen_commands.store_products s where s.product_id=p_product and s.active;
 if not found then return jsonb_build_object('result','unknown_product');end if;
 if prod.kind='adventure' and exists(select 1 from lumen.entitlements e where e.user_id=p_user and e.entitlement=prod.pack_id
  and (e.expires_at is null or e.expires_at>clock_timestamp())) then
  return jsonb_build_object('result','already_owned');end if;
 if prod.kind in ('sky','sky_upgrade') then
  if not exists(select 1 from lumen_commands.adventure_packs a where a.access='locked' and not exists(
   select 1 from lumen.entitlements e where e.user_id=p_user and e.entitlement=a.pack_id and (e.expires_at is null or e.expires_at>clock_timestamp()))) then
   return jsonb_build_object('result','already_owned');end if;
  if prod.kind='sky' and (select adventures_purchased from lumen_commands.main_sky_purchase_status(p_user))>0 then
   return jsonb_build_object('result','sky_after_single');end if;
  if prod.kind='sky_upgrade' and prod.product_id is distinct from lumen_commands.main_sky_offer(p_user) then
   return jsonb_build_object('result','offer_changed');end if;
 end if;
 if (select count(*) from lumen_commands.stripe_checkout_sessions s where s.user_id=p_user and s.created_at>clock_timestamp()-interval '1 hour')>=10 then
  return jsonb_build_object('result','rate_limited');end if;
 select * into cur from lumen_commands.stripe_checkout_sessions s where s.user_id=p_user and s.status in ('creating','open') for update;
 if found then
  if cur.status='open' and cur.product_id=p_product and cur.livemode=p_livemode and cur.checkout_url is not null
   and cur.expires_at>clock_timestamp()+interval '5 minutes' then
   return jsonb_build_object('result','reuse','url',cur.checkout_url,'session_id',cur.session_id);end if;
  if cur.status='creating' and cur.created_at>clock_timestamp()-interval '1 minute' then
   return jsonb_build_object('result','busy');end if;
  update lumen_commands.stripe_checkout_sessions set status='superseded',updated_at=clock_timestamp() where reservation_id=cur.reservation_id;
  superseded:=case when cur.livemode=p_livemode then cur.session_id end;
 end if;
 insert into lumen_commands.stripe_checkout_sessions(user_id,product_id,amount_cents,currency,livemode,waiver_accepted_at)
  values(p_user,prod.product_id,prod.price_cents,prod.currency,p_livemode,p_waiver_at) returning reservation_id into rid;
 return jsonb_build_object('result','reserved','reservation_id',rid,'product_id',prod.product_id,'kind',prod.kind,
  'pack_id',prod.pack_id,'amount_cents',prod.price_cents,'currency',prod.currency,'superseded',superseded,'livemode',p_livemode);
end $$;
revoke all on function lumen_commands.stripe_checkout_begin(uuid,text,timestamptz,boolean) from public,anon,authenticated,service_role;

-- Re-sync existing buyers (no-op unless an upgrade was already recorded).
do $$
declare owner uuid;
begin
  for owner in select distinct user_id from lumen_commands.purchases order by user_id loop
    perform lumen_commands.sync_purchase_entitlements(owner);
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
