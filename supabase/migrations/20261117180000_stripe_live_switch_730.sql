-- #730: prepare REAL Stripe sales behind a server switch, OFF by default.
-- * lumen_commands.feature_flags 'stripe_live' (false): while off, only TEST checkouts exist,
--   reserved to accounts holding 'stripe_test_checkout' (unchanged behaviour).
-- * When the owner turns it on AND the Edge Functions run with a live key, every signed-in
--   player can buy; each session records its Stripe mode (livemode) and the webhook/read-back
--   must match it. TEST and LIVE data never mix: a test row cannot become live and
--   test references stay excluded from accounting (#732).
-- * public.lumen_payment_channel(): tells the signed-in client whether the web checkout is
--   'live', 'test' (test account) or 'off'. It never grants anything.
-- Activation (owner, SQL editor, after the live key/webhook are configured):
--   update lumen_commands.feature_flags set enabled=true,updated_at=now() where name='stripe_live';
-- Idempotent.
begin;

insert into lumen_commands.feature_flags(name,enabled) values('stripe_live',false) on conflict(name) do nothing;

alter table lumen_commands.stripe_checkout_sessions drop constraint if exists stripe_checkout_sessions_livemode_check;
alter table lumen_commands.stripe_checkout_sessions drop constraint if exists stripe_checkout_sessions_session_id_check;
alter table lumen_commands.stripe_checkout_sessions drop constraint if exists stripe_checkout_sessions_mode_check;
alter table lumen_commands.stripe_checkout_sessions add constraint stripe_checkout_sessions_mode_check check (
 session_id is null or (livemode and session_id ~ '^cs_live_[A-Za-z0-9]{1,190}$') or (not livemode and session_id ~ '^cs_test_[A-Za-z0-9]{1,190}$'));

create or replace function lumen_commands.stripe_live_enabled() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select f.enabled from lumen_commands.feature_flags f where f.name='stripe_live'),false);
$$;

drop function if exists public.lumen_stripe_checkout_begin(uuid,text,timestamptz);
drop function if exists lumen_commands.stripe_checkout_begin(uuid,text,timestamptz);
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
  -- Real sales: only when the owner switched them on.
  if not lumen_commands.stripe_live_enabled() then return jsonb_build_object('result','not_eligible');end if;
 elsif not exists(select 1 from lumen.internal_capabilities c where c.user_id=p_user and c.capability='stripe_test_checkout'
  and (c.expires_at is null or c.expires_at>clock_timestamp())) then
  -- Test checkouts: dedicated test accounts only, never real players.
  return jsonb_build_object('result','not_eligible');
 end if;
 select * into prod from lumen_commands.store_products s where s.product_id=p_product and s.active;
 if not found then return jsonb_build_object('result','unknown_product');end if;
 if prod.kind='adventure' and exists(select 1 from lumen.entitlements e where e.user_id=p_user and e.entitlement=prod.pack_id
  and (e.expires_at is null or e.expires_at>clock_timestamp())) then
  return jsonb_build_object('result','already_owned');end if;
 if prod.kind='sky' then
  if not exists(select 1 from lumen_commands.adventure_packs a where a.access='locked' and not exists(
   select 1 from lumen.entitlements e where e.user_id=p_user and e.entitlement=a.pack_id and (e.expires_at is null or e.expires_at>clock_timestamp()))) then
   return jsonb_build_object('result','already_owned');end if;
  if exists(select 1 from lumen_commands.purchases p where p.user_id=p_user and p.status='paid' and p.currency='EUR' and p.amount_cents>0) then
   return jsonb_build_object('result','sky_after_single');end if;
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
  -- Only a session of the same mode can be expired with the current key.
  superseded:=case when cur.livemode=p_livemode then cur.session_id end;
 end if;
 insert into lumen_commands.stripe_checkout_sessions(user_id,product_id,amount_cents,currency,livemode,waiver_accepted_at)
  values(p_user,prod.product_id,prod.price_cents,prod.currency,p_livemode,p_waiver_at) returning reservation_id into rid;
 return jsonb_build_object('result','reserved','reservation_id',rid,'product_id',prod.product_id,'kind',prod.kind,
  'pack_id',prod.pack_id,'amount_cents',prod.price_cents,'currency',prod.currency,'superseded',superseded,'livemode',p_livemode);
end $$;

create or replace function lumen_commands.stripe_record_session(
 p_session_id text,p_user uuid,p_product text,p_amount_cents integer,p_currency text,p_livemode boolean,
 p_status text,p_dispute_closed boolean,p_payment_intent text,p_purchased_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s lumen_commands.stripe_checkout_sessions; v_rank smallint; ledger jsonb;
begin
 if p_livemode is null then raise exception using errcode='22023',message='invalid mode';end if;
 v_rank:=case p_status when 'pending' then 1 when 'failed' then 2 when 'expired' then 2
  when 'paid' then case when p_dispute_closed then 5 else 3 end
  when 'disputed' then case when p_dispute_closed then 5 else 4 end
  when 'refunded' then 6 end;
 if v_rank is null then raise exception using errcode='22023',message='invalid stripe status';end if;
 select * into s from lumen_commands.stripe_checkout_sessions where session_id=p_session_id;
 if not found then return jsonb_build_object('result','unknown_session');end if;
 perform pg_advisory_xact_lock(728,hashtext(s.user_id::text)); -- same order as record_purchase
 select * into s from lumen_commands.stripe_checkout_sessions where session_id=p_session_id for update;
 -- The Stripe mode is part of the identity: a test payment can never be recorded as live.
 if s.livemode is distinct from p_livemode then
  raise exception using errcode='22023',message='live mode mismatch';end if;
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

-- What the signed-in player may see: 'live' (real sales on), 'test' (test account), 'off'.
create or replace function lumen_commands.payment_channel() returns text
language sql stable security definer set search_path='' as $$
 select case when auth.uid() is null then 'off'
  when lumen_commands.stripe_live_enabled() then 'live'
  when exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid() and c.capability='stripe_test_checkout'
   and (c.expires_at is null or c.expires_at>clock_timestamp())) then 'test'
  else 'off' end;
$$;

create or replace function public.lumen_stripe_checkout_begin(p_user uuid,p_product text,p_waiver_at timestamptz,p_livemode boolean default false)
returns jsonb language sql security definer set search_path='' as $$ select lumen_commands.stripe_checkout_begin(p_user,p_product,p_waiver_at,p_livemode) $$;
create or replace function public.lumen_payment_channel() returns text
language sql stable security invoker set search_path='' as $$ select lumen_commands.payment_channel() $$;

do $do$declare f text;begin
 foreach f in array array['lumen_commands.stripe_checkout_begin(uuid,text,timestamptz,boolean)','lumen_commands.stripe_live_enabled()'] loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f);
 end loop;
 revoke all on function lumen_commands.stripe_record_session(text,uuid,text,integer,text,boolean,text,boolean,text,timestamptz) from public,anon,authenticated,service_role;
 revoke all on function public.lumen_stripe_checkout_begin(uuid,text,timestamptz,boolean) from public,anon,authenticated;
 grant execute on function public.lumen_stripe_checkout_begin(uuid,text,timestamptz,boolean) to service_role;
 revoke all on function lumen_commands.payment_channel() from public,anon,service_role;
 grant execute on function lumen_commands.payment_channel() to authenticated;
 revoke all on function public.lumen_payment_channel() from public,anon;
 grant execute on function public.lumen_payment_channel() to authenticated;
end $do$;
notify pgrst,'reload schema';
commit;
