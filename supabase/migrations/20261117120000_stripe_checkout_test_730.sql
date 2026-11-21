-- #730: Stripe Checkout for the web/PWA, TEST MODE ONLY.
-- * Reuses the #728 ledger: rights are granted only by lumen_commands.record_purchase
--   (provider 'stripe', provider_ref = Checkout Session id), never by this table.
-- * lumen_commands.stripe_checkout_sessions binds each Stripe Checkout Session to the
--   Lumen account, product and catalogue price chosen by the server, and keeps a
--   monotonic Stripe state rank so replayed or out-of-order webhooks never move a
--   purchase backwards (e.g. a late "paid" after a refund).
-- * Test isolation: the production database holds real players, so a test checkout is
--   allowed only for accounts holding the internal capability 'stripe_test_checkout'
--   (dedicated test accounts). Test rows are recognisable by 'cs_test_' references, are
--   never archived as accounting records (#732) and can be reset by the owner.
-- * livemode=false is enforced by a CHECK: a live launch needs a reviewed migration.
-- Every function is executable by service_role only (Edge Functions lumen-stripe-*).
-- Re-applying this migration is safe. Production application requires owner approval.
begin;

create table if not exists lumen_commands.stripe_checkout_sessions (
 reservation_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id text not null references lumen_commands.store_products(product_id),
 amount_cents integer not null check (amount_cents>0),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 livemode boolean not null default false check (not livemode),
 session_id text unique check (session_id ~ '^cs_test_[A-Za-z0-9]{1,190}$'),
 checkout_url text check (checkout_url ~ '^https://checkout\.stripe\.com/'),
 payment_intent text check (payment_intent ~ '^pi_[A-Za-z0-9_]{1,190}$'),
 status text not null default 'creating'
  check (status in ('creating','open','superseded','failed','expired','pending','paid','disputed','refunded')),
 state_rank smallint not null default 0 check (state_rank between 0 and 6),
 waiver_accepted_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz,
 updated_at timestamptz not null default clock_timestamp()
);
-- One checkout in flight per account: double clicks and parallel tabs share it.
create unique index if not exists stripe_checkout_in_flight_idx
 on lumen_commands.stripe_checkout_sessions(user_id) where status in ('creating','open');
create index if not exists stripe_checkout_user_idx on lumen_commands.stripe_checkout_sessions(user_id,created_at desc);
create index if not exists stripe_checkout_intent_idx on lumen_commands.stripe_checkout_sessions(payment_intent) where payment_intent is not null;
alter table lumen_commands.stripe_checkout_sessions enable row level security;
revoke all on lumen_commands.stripe_checkout_sessions from public,anon,authenticated;

-- Reserve a checkout for a verified player. The product, its price and its currency
-- come from the server catalogue; the caller only names the product.
create or replace function lumen_commands.stripe_checkout_begin(p_user uuid,p_product text,p_waiver_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prod lumen_commands.store_products; cur lumen_commands.stripe_checkout_sessions; superseded text; rid uuid;
begin
 if p_user is null or not exists(select 1 from auth.users a where a.id=p_user) then
  raise exception using errcode='22023',message='unknown player';end if;
 if p_waiver_at is null then raise exception using errcode='22023',message='waiver required';end if;
 perform pg_advisory_xact_lock(730,hashtext(p_user::text));
 -- Test phase: dedicated test accounts only, never real players.
 if not exists(select 1 from lumen.internal_capabilities c where c.user_id=p_user and c.capability='stripe_test_checkout'
  and (c.expires_at is null or c.expires_at>clock_timestamp())) then
  return jsonb_build_object('result','not_eligible');end if;
 select * into prod from lumen_commands.store_products s where s.product_id=p_product and s.active;
 if not found then return jsonb_build_object('result','unknown_product');end if;
 if prod.kind='adventure' and exists(select 1 from lumen.entitlements e where e.user_id=p_user and e.entitlement=prod.pack_id
  and (e.expires_at is null or e.expires_at>clock_timestamp())) then
  return jsonb_build_object('result','already_owned');end if;
 if prod.kind='sky' then
  if not exists(select 1 from lumen_commands.adventure_packs a where a.access='locked' and not exists(
   select 1 from lumen.entitlements e where e.user_id=p_user and e.entitlement=a.pack_id and (e.expires_at is null or e.expires_at>clock_timestamp()))) then
   return jsonb_build_object('result','already_owned');end if;
  -- #729 owner rule: after a single purchase the player continues at €1 up to the €5 cap.
  if exists(select 1 from lumen_commands.purchases p where p.user_id=p_user and p.status='paid' and p.currency='EUR' and p.amount_cents>0) then
   return jsonb_build_object('result','sky_after_single');end if;
 end if;
 if (select count(*) from lumen_commands.stripe_checkout_sessions s where s.user_id=p_user and s.created_at>clock_timestamp()-interval '1 hour')>=10 then
  return jsonb_build_object('result','rate_limited');end if;
 select * into cur from lumen_commands.stripe_checkout_sessions s where s.user_id=p_user and s.status in ('creating','open') for update;
 if found then
  if cur.status='open' and cur.product_id=p_product and cur.checkout_url is not null and cur.expires_at>clock_timestamp()+interval '5 minutes' then
   return jsonb_build_object('result','reuse','url',cur.checkout_url,'session_id',cur.session_id);end if;
  if cur.status='creating' and cur.created_at>clock_timestamp()-interval '1 minute' then
   return jsonb_build_object('result','busy');end if;
  update lumen_commands.stripe_checkout_sessions set status='superseded',updated_at=clock_timestamp() where reservation_id=cur.reservation_id;
  superseded:=cur.session_id;
 end if;
 insert into lumen_commands.stripe_checkout_sessions(user_id,product_id,amount_cents,currency,waiver_accepted_at)
  values(p_user,prod.product_id,prod.price_cents,prod.currency,p_waiver_at) returning reservation_id into rid;
 return jsonb_build_object('result','reserved','reservation_id',rid,'product_id',prod.product_id,'kind',prod.kind,
  'pack_id',prod.pack_id,'amount_cents',prod.price_cents,'currency',prod.currency,'superseded',superseded);
end $$;

create or replace function lumen_commands.stripe_checkout_attach(p_reservation uuid,p_session_id text,p_url text,p_expires_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 update lumen_commands.stripe_checkout_sessions set session_id=p_session_id,checkout_url=p_url,expires_at=p_expires_at,
  status=case when status='creating' then 'open' else status end,updated_at=clock_timestamp()
  where reservation_id=p_reservation and session_id is null;
 return found;
end $$;

create or replace function lumen_commands.stripe_checkout_release(p_reservation uuid)
returns void language sql security definer set search_path='' as $$
 update lumen_commands.stripe_checkout_sessions set status='failed',updated_at=clock_timestamp()
  where reservation_id=p_reservation and status='creating' and session_id is null;
$$;

-- Record the state read back from Stripe for one Checkout Session. The identity must
-- match the server reservation; the state only moves forward:
--   pending 1 < failed/expired 2 < paid 3 < disputed 4 < dispute closed (won→paid, lost→disputed) 5 < refunded 6.
-- Paid, disputed and refunded states go through the #728 ledger (idempotent).
create or replace function lumen_commands.stripe_record_session(
 p_session_id text,p_user uuid,p_product text,p_amount_cents integer,p_currency text,p_livemode boolean,
 p_status text,p_dispute_closed boolean,p_payment_intent text,p_purchased_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s lumen_commands.stripe_checkout_sessions; v_rank smallint; ledger jsonb;
begin
 if p_livemode is distinct from false then raise exception using errcode='22023',message='live mode refused';end if;
 v_rank:=case p_status when 'pending' then 1 when 'failed' then 2 when 'expired' then 2
  when 'paid' then case when p_dispute_closed then 5 else 3 end
  when 'disputed' then case when p_dispute_closed then 5 else 4 end
  when 'refunded' then 6 end;
 if v_rank is null then raise exception using errcode='22023',message='invalid stripe status';end if;
 select * into s from lumen_commands.stripe_checkout_sessions where session_id=p_session_id;
 if not found then return jsonb_build_object('result','unknown_session');end if;
 perform pg_advisory_xact_lock(728,hashtext(s.user_id::text)); -- same order as record_purchase
 select * into s from lumen_commands.stripe_checkout_sessions where session_id=p_session_id for update;
 if s.user_id is distinct from p_user or s.product_id is distinct from p_product
  or s.amount_cents is distinct from p_amount_cents or s.currency is distinct from p_currency then
  raise exception using errcode='22023',message='session identity conflict';end if;
 if p_payment_intent is not null and s.payment_intent is null then
  update lumen_commands.stripe_checkout_sessions set payment_intent=p_payment_intent where reservation_id=s.reservation_id;
 end if;
 if v_rank<s.state_rank then
  return jsonb_build_object('result','stale','status',s.status);end if;
 update lumen_commands.stripe_checkout_sessions set status=p_status,state_rank=v_rank,updated_at=clock_timestamp()
  where reservation_id=s.reservation_id;
 if p_status in ('paid','disputed','refunded') then
  ledger:=lumen_commands.record_purchase('stripe',p_session_id,s.user_id,s.product_id,s.amount_cents,s.currency,p_status,p_purchased_at);
 end if;
 return jsonb_build_object('result','recorded','status',p_status,'ledger',ledger,
  'adventures',(select coalesce(jsonb_agg(e.entitlement order by e.entitlement),'[]'::jsonb) from lumen.entitlements e
   where e.user_id=s.user_id and (e.expires_at is null or e.expires_at>clock_timestamp())));
end $$;

create or replace function lumen_commands.stripe_session_by_payment_intent(p_payment_intent text)
returns text language sql stable security definer set search_path='' as $$
 select s.session_id from lumen_commands.stripe_checkout_sessions s where s.payment_intent=p_payment_intent limit 1;
$$;

-- A player's own sessions (status after the Stripe return, « Restaurer mes achats »).
create or replace function lumen_commands.stripe_sessions_for_user(p_user uuid,p_session_id text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('session_id',s.session_id,'product_id',s.product_id,'status',s.status) order by s.created_at desc),'[]'::jsonb)
 from (select * from lumen_commands.stripe_checkout_sessions s where s.user_id=p_user and s.session_id is not null
  and (p_session_id is null or s.session_id=p_session_id) order by s.created_at desc limit 20) s;
$$;

-- Owner tool (SQL editor only): remove one test account's Stripe TEST data and
-- re-converge its purchase rights. Real purchases and progress are never touched.
create or replace function lumen_commands.stripe_test_reset(p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 perform pg_advisory_xact_lock(728,hashtext(p_user::text));
 delete from lumen_commands.purchase_events e using lumen_commands.purchases p
  where e.purchase_id=p.id and p.user_id=p_user and p.provider='stripe' and p.provider_ref like 'cs\_test\_%';
 with gone as (delete from lumen_commands.purchases p where p.user_id=p_user and p.provider='stripe' and p.provider_ref like 'cs\_test\_%' returning 1)
  select count(*) into n from gone;
 delete from lumen_commands.stripe_checkout_sessions s where s.user_id=p_user and not s.livemode;
 perform lumen_commands.sync_purchase_entitlements(p_user);
 return jsonb_build_object('purchases_removed',n);
end $$;

-- #732 accounting archive: Stripe TEST payments are not sales, never archive them.
create or replace function lumen_commands.archive_purchase_accounting() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.provider='stripe' and old.provider_ref like 'cs\_test\_%' then return old;end if;
 insert into lumen_commands.purchase_accounting_records
  (provider,provider_ref,product_id,amount_cents,currency,status,purchased_at,status_at,retain_until)
 values (old.provider,old.provider_ref,old.product_id,old.amount_cents,old.currency,old.status,old.purchased_at,old.updated_at,
  date_trunc('year',old.purchased_at at time zone 'Europe/Paris') at time zone 'Europe/Paris'+interval '11 years')
 on conflict (provider,provider_ref) do update
  set status=excluded.status,status_at=excluded.status_at,archived_at=clock_timestamp();
 return old;
end $$;
revoke all on function lumen_commands.archive_purchase_accounting() from public,anon,authenticated;

-- Service-role gateway for the Edge Functions.
create or replace function public.lumen_stripe_checkout_begin(p_user uuid,p_product text,p_waiver_at timestamptz)
returns jsonb language sql security definer set search_path='' as $$ select lumen_commands.stripe_checkout_begin(p_user,p_product,p_waiver_at) $$;
create or replace function public.lumen_stripe_checkout_attach(p_reservation uuid,p_session_id text,p_url text,p_expires_at timestamptz)
returns boolean language sql security definer set search_path='' as $$ select lumen_commands.stripe_checkout_attach(p_reservation,p_session_id,p_url,p_expires_at) $$;
create or replace function public.lumen_stripe_checkout_release(p_reservation uuid)
returns void language sql security definer set search_path='' as $$ select lumen_commands.stripe_checkout_release(p_reservation) $$;
create or replace function public.lumen_stripe_record_session(
 p_session_id text,p_user uuid,p_product text,p_amount_cents integer,p_currency text,p_livemode boolean,
 p_status text,p_dispute_closed boolean,p_payment_intent text,p_purchased_at timestamptz)
returns jsonb language sql security definer set search_path='' as $$
 select lumen_commands.stripe_record_session(p_session_id,p_user,p_product,p_amount_cents,p_currency,p_livemode,p_status,p_dispute_closed,p_payment_intent,p_purchased_at) $$;
create or replace function public.lumen_stripe_session_by_payment_intent(p_payment_intent text)
returns text language sql stable security definer set search_path='' as $$ select lumen_commands.stripe_session_by_payment_intent(p_payment_intent) $$;
create or replace function public.lumen_stripe_sessions_for_user(p_user uuid,p_session_id text default null)
returns jsonb language sql stable security definer set search_path='' as $$ select lumen_commands.stripe_sessions_for_user(p_user,p_session_id) $$;

do $do$declare f text;begin
 foreach f in array array[
  'lumen_commands.stripe_checkout_begin(uuid,text,timestamptz)','lumen_commands.stripe_checkout_attach(uuid,text,text,timestamptz)',
  'lumen_commands.stripe_checkout_release(uuid)',
  'lumen_commands.stripe_record_session(text,uuid,text,integer,text,boolean,text,boolean,text,timestamptz)',
  'lumen_commands.stripe_session_by_payment_intent(text)','lumen_commands.stripe_sessions_for_user(uuid,text)',
  'lumen_commands.stripe_test_reset(uuid)'] loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
 foreach f in array array[
  'public.lumen_stripe_checkout_begin(uuid,text,timestamptz)','public.lumen_stripe_checkout_attach(uuid,text,text,timestamptz)',
  'public.lumen_stripe_checkout_release(uuid)',
  'public.lumen_stripe_record_session(text,uuid,text,integer,text,boolean,text,boolean,text,timestamptz)',
  'public.lumen_stripe_session_by_payment_intent(text)','public.lumen_stripe_sessions_for_user(uuid,text)'] loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to service_role',f);
 end loop;
end $do$;

-- Privacy inventory: checkout sessions are player data, erased with the account.
do $do$begin
 if to_regprocedure('lumen_privacy.policy()') is not null
  and to_regprocedure('lumen_privacy.policy_before_stripe()') is null then
  alter function lumen_privacy.policy() rename to policy_before_stripe;
 end if;
 if to_regprocedure('lumen_privacy.policy_before_stripe()') is not null then
  execute $f$create or replace function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $b$
    select * from lumen_privacy.policy_before_stripe()
    union all values
     ('lumen_commands','stripe_checkout_sessions','user_id',null,null,'delete')
   $b$ $f$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_stripe() from public,anon,authenticated,service_role;
  perform lumen_privacy.install_guards();
 end if;
end $do$;
notify pgrst,'reload schema';
commit;
