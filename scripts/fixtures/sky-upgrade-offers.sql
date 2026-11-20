-- Disposable PostgreSQL only; synthetic accounts. #865: the five commercial states of
-- « Tout débloquer », server-chosen tier, inactive-by-default products, Stripe reservation
-- and Play eligibility, direct main-sky grant, refunds and erasure-safe rollback.
begin;
do $$
declare
  p constant uuid := '00000000-0000-0000-0000-000000086501';
  q constant uuid := '00000000-0000-0000-0000-000000086502';
  r jsonb; i integer; pack text; owned text[];
begin
  assert not has_function_privilege('authenticated','public.lumen_sky_upgrade_eligible(uuid,text)','EXECUTE');
  assert not has_function_privilege('anon','public.lumen_sky_upgrade_eligible(uuid,text)','EXECUTE');
  assert has_function_privilege('service_role','public.lumen_sky_upgrade_eligible(uuid,text)','EXECUTE');
  assert not has_function_privilege('authenticated','lumen_commands.main_sky_offer(uuid)','EXECUTE');
  assert (select count(*) from lumen_commands.store_products where kind='sky_upgrade' and not active)=4,
    'the four upgrades are seeded inactive';
  assert (select array_agg(upgrade_tier order by upgrade_tier) from lumen_commands.store_products where kind='sky_upgrade')='{1,2,3,4}';
  begin
    insert into lumen_commands.store_products(product_id,kind,pack_id,price_cents,currency,active,upgrade_tier)
      values('bad-upgrade','sky_upgrade',null,100,'EUR',false,null);
    assert false,'an upgrade needs a tier';
  exception when check_violation then null; end;

  select array_agg(pack_id order by pack_id) into owned from lumen_commands.adventure_packs where access='locked';
  insert into auth.users(id) values(p),(q);
  insert into lumen.internal_capabilities(user_id,capability) values(p,'stripe_test_checkout'),(q,'stripe_test_checkout');
  perform set_config('request.jwt.claim.sub',p::text,true);

  -- N=0: the standard whole-sky offer with its catalogue price.
  r:=public.lumen_get_main_sky_purchase_progress(p);
  assert r->>'sky_offer'='real-sky-all' and (r->>'sky_offer_price_cents')::integer>0 and r->>'sky_offer_currency'='EUR', r::text;
  assert (r->>'purchased')::integer=0 and (r->>'unlocked')::boolean=false;

  -- N=1 with inactive upgrades: no whole-sky offer, unit purchases stay possible.
  perform public.lumen_record_purchase('stripe','up-02',p,'real-adventure-02',100,'EUR','paid');
  r:=public.lumen_get_main_sky_purchase_progress(p);
  assert r->'sky_offer'='null'::jsonb,'inactive upgrade is never offered: '||r::text;
  assert lumen_commands.stripe_checkout_begin(p,'real-sky-all',now())->>'result'='sky_after_single','no full price after a unit purchase';
  assert lumen_commands.stripe_checkout_begin(p,'real-sky-upgrade-1',now())->>'result'='unknown_product','inactive product is not sold';
  assert not public.lumen_sky_upgrade_eligible(p,'real-sky-upgrade-1'),'inactive product is not eligible on Play';

  -- Owner activation (manual step after price validation).
  update lumen_commands.store_products set active=true where kind='sky_upgrade';

  -- N=1..4: exactly one tier is offered and reservable.
  for i in 1..4 loop
    if i>1 then
      pack:='real-adventure-0'||(i+1);
      perform public.lumen_record_purchase('stripe','up-0'||(i+1),p,pack,100,'EUR','paid');
    end if;
    r:=public.lumen_get_main_sky_purchase_progress(p);
    assert r->>'sky_offer'='real-sky-upgrade-'||i and (r->>'purchased')::integer=i, r::text;
    assert public.lumen_sky_upgrade_eligible(p,'real-sky-upgrade-'||i),'tier '||i;
    assert (i=1 or public.lumen_sky_upgrade_eligible(p,'real-sky-upgrade-'||(i-1))),'a lower tier stays eligible (paid more than needed)';
    assert (i=4 or not public.lumen_sky_upgrade_eligible(p,'real-sky-upgrade-'||(i+1))),'a cheaper tier is never eligible early';
    assert (i=4 or lumen_commands.stripe_checkout_begin(p,'real-sky-upgrade-'||(i+1),now())->>'result'='offer_changed'),'Stripe refuses another tier';
    r:=lumen_commands.stripe_checkout_begin(p,'real-sky-upgrade-'||i,now());
    assert r->>'result'='reserved' and r->>'kind'='sky_upgrade'
      and (r->>'amount_cents')::integer=(select price_cents from lumen_commands.store_products where product_id='real-sky-upgrade-'||i),r::text;
    perform lumen_commands.stripe_checkout_release((r->>'reservation_id')::uuid);
  end loop;

  -- A confirmed upgrade grants the main sky directly, never fake unit purchases.
  r:=public.lumen_record_purchase('stripe','up-sky',p,'real-sky-upgrade-4',100,'EUR','paid');
  assert (select bool_and(r->'adventures' ? x) from unnest(owned) x),'upgrade unlocks every main-sky adventure: '||r::text;
  assert (select count(*) from lumen_commands.purchases where user_id=p and product_id like 'real-adventure-%')=4,'no fake unit purchase';
  r:=public.lumen_get_main_sky_purchase_progress(p);
  assert (r->>'unlocked')::boolean and r->'sky_offer'='null'::jsonb and (r->>'purchased')::integer=4, r::text;
  assert not public.lumen_sky_upgrade_eligible(p,'real-sky-upgrade-4'),'nothing to sell once unlocked';
  assert lumen_commands.stripe_checkout_begin(p,'real-sky-upgrade-4',now())->>'result'='already_owned';
  -- Idempotent replay.
  r:=public.lumen_record_purchase('stripe','up-sky',p,'real-sky-upgrade-4',100,'EUR','paid');
  assert (select count(*) from lumen_commands.purchases where provider_ref='up-sky')=1;

  -- Refund of the upgrade: back to the four unit rights and the same tier offer.
  r:=public.lumen_record_purchase('stripe','up-sky',p,'real-sky-upgrade-4',100,'EUR','refunded');
  assert not (r->'adventures' ? 'real-adventure-09'),'refunded upgrade withdraws the extra rights';
  assert r->'adventures' ? 'real-adventure-05','unit rights are kept';
  assert public.lumen_get_main_sky_purchase_progress(p)->>'sky_offer'='real-sky-upgrade-4';

  -- A unit refund lowers the tier: the old tier is no longer eligible (Play is not acknowledged).
  perform public.lumen_record_purchase('stripe','up-05',p,'real-adventure-05',100,'EUR','refunded');
  assert public.lumen_get_main_sky_purchase_progress(p)->>'sky_offer'='real-sky-upgrade-3';
  assert not public.lumen_sky_upgrade_eligible(p,'real-sky-upgrade-4');

  -- N>=5: everything unlocked without any further payment, no offer.
  perform set_config('request.jwt.claim.sub',q::text,true);
  for i in 2..6 loop
    perform public.lumen_record_purchase('play','q-0'||i,q,'real-adventure-0'||i,100,'EUR','paid');
  end loop;
  r:=public.lumen_get_main_sky_purchase_progress(q);
  assert (r->>'unlocked')::boolean and r->'sky_offer'='null'::jsonb and (r->>'remaining')::integer=0, r::text;
  assert (select bool_and(exists(select 1 from lumen.entitlements e where e.user_id=q and e.entitlement=x
    and (e.expires_at is null or e.expires_at>clock_timestamp()))) from unnest(owned) x),'five distinct purchases unlock the main sky';
  assert public.lumen_get_main_sky_purchase_progress(p) is null,'another account cannot read this progress';
end $$;
rollback;
