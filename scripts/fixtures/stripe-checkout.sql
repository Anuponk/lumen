-- Disposable PostgreSQL only; synthetic accounts. #730 Stripe Checkout TEST phase:
-- test-account isolation, server prices, one checkout in flight, monotonic Stripe states
-- (duplicates, reordering, refunds, disputes), the €5 cap, preserved admin/mastery
-- rights and progress, test-data reset and the accounting exclusion of TEST payments.
-- Runs after the #732 step (ledger, Play gateway and accounting archive installed).
do $$declare f text;begin
 foreach f in array array['public.lumen_stripe_checkout_begin(uuid,text,timestamptz)','public.lumen_stripe_checkout_attach(uuid,text,text,timestamptz)',
  'public.lumen_stripe_checkout_release(uuid)','public.lumen_stripe_record_session(text,uuid,text,integer,text,boolean,text,boolean,text,timestamptz)',
  'public.lumen_stripe_session_by_payment_intent(text)','public.lumen_stripe_sessions_for_user(uuid,text)'] loop
  assert not has_function_privilege('authenticated',f,'EXECUTE'),'players cannot call '||f;
  assert not has_function_privilege('anon',f,'EXECUTE'),'anonymous cannot call '||f;
  assert has_function_privilege('service_role',f,'EXECUTE'),'the Edge Functions can call '||f;
 end loop;
 assert not has_function_privilege('service_role','lumen_commands.stripe_test_reset(uuid)','EXECUTE'),'test reset is an operator SQL tool';
 assert not has_function_privilege('authenticated','lumen_commands.stripe_record_session(text,uuid,text,integer,text,boolean,text,boolean,text,timestamptz)','EXECUTE');
 assert not has_table_privilege('authenticated','lumen_commands.stripe_checkout_sessions','SELECT'),'checkout sessions are private';
 assert not has_table_privilege('anon','lumen_commands.stripe_checkout_sessions','SELECT');
 assert exists(select 1 from lumen_privacy.policy() where ns='lumen_commands' and rel='stripe_checkout_sessions' and action='delete' and uid_col='user_id'),'erased with the account';
 perform lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[]);
end $$;

insert into auth.users(id) values('00000000-0000-0000-0000-000000073001'),('00000000-0000-0000-0000-000000073002'),
 ('00000000-0000-0000-0000-000000073003'),('00000000-0000-0000-0000-000000073004'),('00000000-0000-0000-0000-000000073005');
insert into lumen.internal_capabilities(user_id,capability) values('00000000-0000-0000-0000-000000073001','stripe_test_checkout'),
 ('00000000-0000-0000-0000-000000073003','stripe_test_checkout'),('00000000-0000-0000-0000-000000073005','stripe_test_checkout');
insert into lumen.internal_capabilities(user_id,capability,expires_at) values('00000000-0000-0000-0000-000000073004','stripe_test_checkout',now()-interval '1 day');
-- Player A already owns Adventure 7 by an administrator and Adventure 5 by mastery.
insert into lumen.entitlements(user_id,entitlement,granted_at,expires_at,source) values
 ('00000000-0000-0000-0000-000000073001','real-adventure-07',now(),null,'admin'),
 ('00000000-0000-0000-0000-000000073001','real-adventure-05',now(),null,'mastery');
insert into lumen_commands.quest_run_authority(user_id,quest_id,projection)
 select '00000000-0000-0000-0000-000000073001',q.quest_id,jsonb_build_object('solved',true,'badges',jsonb_build_object('speed',true))
 from lumen_commands.quest_packs q where q.legacy_index is null order by q.quest_id limit 3;

-- Eligibility, catalogue, ownership, waiver, double click and supersession.
do $$declare a uuid:='00000000-0000-0000-0000-000000073001';r jsonb;rid uuid;begin
 assert lumen_commands.stripe_checkout_begin('00000000-0000-0000-0000-000000073002','real-adventure-02',now())->>'result'='not_eligible','real players never reach the TEST checkout';
 assert lumen_commands.stripe_checkout_begin('00000000-0000-0000-0000-000000073004','real-adventure-02',now())->>'result'='not_eligible','expired test capability';
 assert lumen_commands.stripe_checkout_begin(a,'real-adventure-99',now())->>'result'='unknown_product';
 assert lumen_commands.stripe_checkout_begin(a,'base-real-sky',now())->>'result'='unknown_product','the free Adventure is not for sale';
 assert lumen_commands.stripe_checkout_begin(a,'real-adventure-07',now())->>'result'='already_owned','an admin right is not sold again';
 assert lumen_commands.stripe_checkout_begin(a,'real-adventure-05',now())->>'result'='already_owned','a mastery right is not sold again';
 begin perform lumen_commands.stripe_checkout_begin(a,'real-adventure-02',null);raise exception 'missing waiver accepted';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.stripe_checkout_begin(gen_random_uuid(),'real-adventure-02',now());raise exception 'unknown player accepted';exception when invalid_parameter_value then null;end;
 update lumen_commands.store_products set active=false where product_id='real-adventure-08';
 assert lumen_commands.stripe_checkout_begin(a,'real-adventure-08',now())->>'result'='unknown_product','inactive products cannot be bought';
 update lumen_commands.store_products set active=true where product_id='real-adventure-08';

 r:=lumen_commands.stripe_checkout_begin(a,'real-adventure-02',now());
 assert r->>'result'='reserved' and (r->>'amount_cents')::integer=(select price_cents from lumen_commands.store_products where product_id='real-adventure-02')
  and r->>'currency'='EUR','the price comes from the catalogue';
 rid:=(r->>'reservation_id')::uuid;
 assert lumen_commands.stripe_checkout_begin(a,'real-adventure-02',now())->>'result'='busy','double click while the session is created';
 assert lumen_commands.stripe_checkout_attach(rid,'cs_test_730a','https://checkout.stripe.com/c/pay/cs_test_730a',now()+interval '30 minutes');
 assert not lumen_commands.stripe_checkout_attach(rid,'cs_test_730z','https://checkout.stripe.com/c/pay/cs_test_730z',now()),'a reservation is attached once';
 r:=lumen_commands.stripe_checkout_begin(a,'real-adventure-02',now());
 assert r->>'result'='reuse' and r->>'session_id'='cs_test_730a','a second click reuses the open session';
 r:=lumen_commands.stripe_checkout_begin(a,'real-adventure-03',now());
 assert r->>'result'='reserved' and r->>'superseded'='cs_test_730a','another product supersedes the open session';
 perform lumen_commands.stripe_checkout_attach((r->>'reservation_id')::uuid,'cs_test_730b','https://checkout.stripe.com/c/pay/cs_test_730b',now()+interval '30 minutes');
 assert (select count(*) from lumen_commands.stripe_checkout_sessions where user_id=a and status in ('creating','open'))=1,'one checkout in flight';
 begin insert into lumen_commands.stripe_checkout_sessions(user_id,product_id,amount_cents,currency,livemode,waiver_accepted_at)
  values(a,'real-adventure-04',100,'EUR',true,now());raise exception 'live session stored';exception when check_violation then null;end;
 r:=lumen_commands.stripe_checkout_begin(a,'real-adventure-04',now());perform lumen_commands.stripe_checkout_release((r->>'reservation_id')::uuid);
 assert (select status from lumen_commands.stripe_checkout_sessions where reservation_id=(r->>'reservation_id')::uuid)='failed','a failed creation is released';
end $$;

-- Recording: identity checks, unpaid states, payment, duplicates, refund and reordering.
do $$declare a uuid:='00000000-0000-0000-0000-000000073001';r jsonb;progress jsonb;begin
 begin perform lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',1,'EUR',false,'paid',false,'pi_730a',now());
  raise exception 'forged amount accepted';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',100,'USD',false,'paid',false,'pi_730a',now());
  raise exception 'forged currency accepted';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.stripe_record_session('cs_test_730a',a,'real-sky-all',100,'EUR',false,'paid',false,'pi_730a',now());
  raise exception 'forged product accepted';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.stripe_record_session('cs_test_730a','00000000-0000-0000-0000-000000073002','real-adventure-02',100,'EUR',false,'paid',false,'pi_730a',now());
  raise exception 'session moved to another account';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',100,'EUR',true,'paid',false,'pi_730a',now());
  raise exception 'live payment accepted';exception when invalid_parameter_value then null;end;
 begin perform lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',100,'EUR',false,'free',false,'pi_730a',now());
  raise exception 'bad status accepted';exception when invalid_parameter_value then null;end;
 assert lumen_commands.stripe_record_session('cs_test_unknown',a,'real-adventure-02',100,'EUR',false,'paid',false,null,now())->>'result'='unknown_session',
  'a session Lumen did not create is never recorded';
 -- Scoped to this fixture: the #728 fixture already recorded a synthetic 'stripe' purchase.
 assert not exists(select 1 from lumen_commands.purchases where provider='stripe' and (provider_ref like 'cs\_test\_%' or user_id=a)),'nothing recorded by refused calls';

 r:=lumen_commands.stripe_record_session('cs_test_730b',a,'real-adventure-03',100,'EUR',false,'pending',false,'pi_730b',null);
 assert not (r->'adventures' ? 'real-adventure-03'),'a pending payment grants nothing';
 r:=lumen_commands.stripe_record_session('cs_test_730b',a,'real-adventure-03',100,'EUR',false,'failed',false,'pi_730b',null);
 assert not (r->'adventures' ? 'real-adventure-03') and r->>'status'='failed','a failed payment grants nothing';
 assert not exists(select 1 from lumen_commands.purchases where provider_ref='cs_test_730b'),'unpaid sessions never reach the ledger';

 r:=lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',100,'EUR',false,'paid',false,'pi_730a',now());
 assert r->>'result'='recorded' and r->'adventures' ? 'real-adventure-02','a confirmed payment grants its Adventure';
 assert (select source from lumen.entitlements where user_id=a and entitlement='real-adventure-02')='purchase';
 r:=lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',100,'EUR',false,'paid',false,'pi_730a',now());
 assert (select count(*) from lumen_commands.purchases where provider='stripe' and provider_ref='cs_test_730a')=1,'a replayed webhook creates one purchase';
 assert (select count(*) from lumen_commands.purchase_events e join lumen_commands.purchases p on p.id=e.purchase_id where p.provider_ref='cs_test_730a')=1,'and one event';
 assert lumen_commands.stripe_session_by_payment_intent('pi_730a')='cs_test_730a';
 assert (select amount_cents from lumen_commands.purchases where provider_ref='cs_test_730a')=100;

 select jsonb_agg(to_jsonb(q) order by q.quest_id) into progress from lumen_commands.quest_run_authority q where q.user_id=a;
 r:=lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',100,'EUR',false,'refunded',false,'pi_730a',now());
 assert not (r->'adventures' ? 'real-adventure-02'),'a refund withdraws the right';
 assert exists(select 1 from lumen.entitlements where user_id=a and entitlement='real-adventure-02' and expires_at is not null),'expired, never deleted';
 assert r->'adventures' ? 'real-adventure-07' and r->'adventures' ? 'real-adventure-05','admin and mastery rights survive a refund';
 assert (select jsonb_agg(to_jsonb(q) order by q.quest_id) from lumen_commands.quest_run_authority q where q.user_id=a)=progress,'progress is untouched';
 r:=lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',100,'EUR',false,'paid',false,'pi_730a',now());
 assert r->>'result'='stale' and r->>'status'='refunded','a late "paid" after a refund is ignored';
 r:=lumen_commands.stripe_record_session('cs_test_730a',a,'real-adventure-02',100,'EUR',false,'disputed',false,'pi_730a',now());
 assert r->>'result'='stale','a refund is final';
 assert not exists(select 1 from lumen.entitlements where user_id=a and entitlement='real-adventure-02' and (expires_at is null or expires_at>clock_timestamp())),'still withdrawn'; -- server clock, as the ledger
 assert (select status from lumen_commands.purchases where provider_ref='cs_test_730a')='refunded';
end $$;

-- Disputes and reordering.
do $$declare a uuid:='00000000-0000-0000-0000-000000073001';r jsonb;begin
 r:=lumen_commands.stripe_checkout_begin(a,'real-adventure-04',now());
 perform lumen_commands.stripe_checkout_attach((r->>'reservation_id')::uuid,'cs_test_730c','https://checkout.stripe.com/c/pay/cs_test_730c',now()+interval '30 minutes');
 -- The dispute arrives before the completion event: the read-back already says disputed.
 r:=lumen_commands.stripe_record_session('cs_test_730c',a,'real-adventure-04',100,'EUR',false,'disputed',false,'pi_730c',now());
 assert not (r->'adventures' ? 'real-adventure-04'),'an open dispute grants nothing';
 r:=lumen_commands.stripe_record_session('cs_test_730c',a,'real-adventure-04',100,'EUR',false,'paid',false,'pi_730c',now());
 assert r->>'result'='stale','the delayed completion event does not grant during a dispute';
 r:=lumen_commands.stripe_record_session('cs_test_730c',a,'real-adventure-04',100,'EUR',false,'paid',true,'pi_730c',now());
 assert r->'adventures' ? 'real-adventure-04','a won dispute restores the right';
 r:=lumen_commands.stripe_record_session('cs_test_730c',a,'real-adventure-04',100,'EUR',false,'disputed',false,'pi_730c',now());
 assert r->>'result'='stale' and r->'adventures' is null,'an older "dispute open" cannot withdraw it again';
 assert exists(select 1 from lumen.entitlements where user_id=a and entitlement='real-adventure-04' and expires_at is null);
 r:=lumen_commands.stripe_record_session('cs_test_730c',a,'real-adventure-04',100,'EUR',false,'refunded',false,'pi_730c',now());
 assert not (r->'adventures' ? 'real-adventure-04'),'a refund after a won dispute still withdraws';
end $$;

-- The €5 cap with Stripe single purchases; the whole sky is not sold after a single.
do $$declare c uuid:='00000000-0000-0000-0000-000000073003';r jsonb;i integer;owned text[];pack text;begin
 select array_agg(pack_id order by pack_id) into owned from lumen_commands.adventure_packs where access='locked';
 for i in 2..6 loop
  pack:='real-adventure-0'||i;
  r:=lumen_commands.stripe_checkout_begin(c,pack,now());
  assert r->>'result'='reserved',pack||': '||r::text;
  perform lumen_commands.stripe_checkout_attach((r->>'reservation_id')::uuid,'cs_test_730cap'||i,'https://checkout.stripe.com/c/pay/cs_test_730cap'||i,now()+interval '30 minutes');
  r:=lumen_commands.stripe_record_session('cs_test_730cap'||i,c,pack,100,'EUR',false,'paid',false,'pi_730cap'||i,now());
  if i=2 then
   assert lumen_commands.stripe_checkout_begin(c,'real-sky-all',now())->>'result'='sky_after_single','continue at €1 after a single purchase';
   assert lumen_commands.stripe_checkout_begin(c,pack,now())->>'result'='already_owned';
  end if;
  if i<6 then assert not (r->'adventures' ? 'real-adventure-09'),'below €5 no cap';end if;
 end loop;
 assert (select bool_and(r->'adventures' ? x) from unnest(owned) x),'€5 of Stripe singles unlock every Adventure';
 assert lumen_commands.stripe_checkout_begin(c,'real-sky-all',now())->>'result'='already_owned','nothing left to sell';
 assert lumen_commands.stripe_checkout_begin(c,'real-adventure-09',now())->>'result'='already_owned';
 r:=lumen_commands.stripe_record_session('cs_test_730cap6',c,'real-adventure-06',100,'EUR',false,'refunded',false,'pi_730cap6',now());
 assert not (r->'adventures' ? 'real-adventure-09') and r->'adventures' ? 'real-adventure-05','a refund below the cap withdraws cap rights only';
end $$;

-- Abuse: at most 10 checkouts per hour and account.
do $$declare d uuid:='00000000-0000-0000-0000-000000073005';r jsonb;i integer;begin
 for i in 1..10 loop
  r:=lumen_commands.stripe_checkout_begin(d,case when i%2=0 then 'real-adventure-02' else 'real-adventure-03' end,now());
  assert r->>'result'='reserved','attempt '||i||': '||r::text;
  perform lumen_commands.stripe_checkout_attach((r->>'reservation_id')::uuid,'cs_test_730d'||i,'https://checkout.stripe.com/c/pay/cs_test_730d'||i,now()+interval '30 minutes');
 end loop;
 assert lumen_commands.stripe_checkout_begin(d,'real-adventure-04',now())->>'result'='rate_limited';
 assert jsonb_array_length(lumen_commands.stripe_sessions_for_user(d))=10;
 assert jsonb_array_length(lumen_commands.stripe_sessions_for_user(d,'cs_test_730d3'))=1;
 assert jsonb_array_length(lumen_commands.stripe_sessions_for_user('00000000-0000-0000-0000-000000073001','cs_test_730d3'))=0,'a player only sees their own sessions';
end $$;

-- Owner reset of TEST data: real purchases and progress stay; TEST rows are not accounting records.
do $$declare a uuid:='00000000-0000-0000-0000-000000073001';c uuid:='00000000-0000-0000-0000-000000073003';r jsonb;progress jsonb;begin
 perform lumen_commands.record_purchase('play','gp-730-real',a,'real-adventure-06',100,'EUR','paid');
 select jsonb_agg(to_jsonb(q) order by q.quest_id) into progress from lumen_commands.quest_run_authority q where q.user_id=a;
 r:=lumen_commands.stripe_test_reset(a);
 assert (r->>'purchases_removed')::integer=2,r::text;
 assert not exists(select 1 from lumen_commands.purchases where user_id=a and provider='stripe');
 assert not exists(select 1 from lumen_commands.stripe_checkout_sessions where user_id=a);
 assert exists(select 1 from lumen_commands.purchases where provider_ref='gp-730-real' and status='paid'),'real purchases are kept';
 assert exists(select 1 from lumen.entitlements where user_id=a and entitlement='real-adventure-06' and expires_at is null and source='purchase');
 assert exists(select 1 from lumen.entitlements where user_id=a and entitlement='real-adventure-07' and expires_at is null and source='admin');
 assert (select jsonb_agg(to_jsonb(q) order by q.quest_id) from lumen_commands.quest_run_authority q where q.user_id=a)=progress;
 assert not exists(select 1 from lumen_commands.purchase_accounting_records where provider='stripe' and provider_ref like 'cs\_test\_%'),'TEST payments are not sales';
 -- Erasure path (row DELETE): TEST rows skip the accounting archive, real ones are kept.
 delete from lumen_commands.purchase_events where user_id=c;
 delete from lumen_commands.stripe_checkout_sessions where user_id=c;
 delete from lumen_commands.purchases where user_id=c;
 assert not exists(select 1 from lumen_commands.purchase_accounting_records where provider_ref like 'cs\_test\_730cap%');
 delete from lumen_commands.purchase_events where user_id=a;
 delete from lumen_commands.purchases where user_id=a;
 assert exists(select 1 from lumen_commands.purchase_accounting_records where provider='play' and provider_ref='gp-730-real'),'real sales are still archived';
end $$;
