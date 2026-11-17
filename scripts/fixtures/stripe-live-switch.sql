-- Disposable PostgreSQL only; synthetic accounts. #730 real-sales switch: OFF by default,
-- then every signed-in player may buy LIVE; TEST stays reserved to test accounts; the
-- Stripe mode is part of a session's identity. Runs after stripe-checkout.sql.
do $$begin
 assert (select enabled from lumen_commands.feature_flags where name='stripe_live')=false,'real sales are off by default';
 assert has_function_privilege('authenticated','public.lumen_payment_channel()','EXECUTE'),'players can read their channel';
 assert not has_function_privilege('anon','public.lumen_payment_channel()','EXECUTE');
 assert not has_function_privilege('authenticated','public.lumen_stripe_checkout_begin(uuid,text,timestamptz,boolean)','EXECUTE');
 assert has_function_privilege('service_role','public.lumen_stripe_checkout_begin(uuid,text,timestamptz,boolean)','EXECUTE');
 assert to_regprocedure('public.lumen_stripe_checkout_begin(uuid,text,timestamptz)') is null,'the 3-argument gateway is replaced';
 assert not has_function_privilege('service_role','lumen_commands.stripe_live_enabled()','EXECUTE');
end $$;

insert into auth.users(id) values('00000000-0000-0000-0000-000000073061'),('00000000-0000-0000-0000-000000073062');
insert into lumen.internal_capabilities(user_id,capability) values('00000000-0000-0000-0000-000000073062','stripe_test_checkout');

-- Switch OFF: no live checkout for anyone; test accounts keep test checkouts.
do $$declare player uuid:='00000000-0000-0000-0000-000000073061';tester uuid:='00000000-0000-0000-0000-000000073062';r jsonb;begin
 assert lumen_commands.stripe_checkout_begin(player,'real-adventure-02',now(),true)->>'result'='not_eligible','switch off: no real sale';
 assert lumen_commands.stripe_checkout_begin(tester,'real-adventure-02',now(),true)->>'result'='not_eligible','switch off: not even for testers';
 assert lumen_commands.stripe_checkout_begin(player,'real-adventure-02',now())->>'result'='not_eligible','real players never get test checkouts';
 r:=lumen_commands.stripe_checkout_begin(tester,'real-adventure-02',now());
 assert r->>'result'='reserved' and (r->>'livemode')::boolean=false,'test accounts keep test checkouts (3-argument default)';
 perform lumen_commands.stripe_checkout_release((r->>'reservation_id')::uuid);
 begin perform lumen_commands.stripe_checkout_begin(player,'real-adventure-02',now(),null);raise exception 'null mode accepted';exception when invalid_parameter_value then null;end;
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000073061';set role authenticated;
do $$begin assert public.lumen_payment_channel()='off','a player sees no web checkout while off';end $$;
reset role;reset request.jwt.claim.sub;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000073062';set role authenticated;
do $$begin assert public.lumen_payment_channel()='test','a test account sees the test checkout';end $$;
reset role;reset request.jwt.claim.sub;

-- Switch ON (owner): every signed-in player may buy for real; test mode stays test-only.
update lumen_commands.feature_flags set enabled=true where name='stripe_live';
set request.jwt.claim.sub='00000000-0000-0000-0000-000000073061';set role authenticated;
do $$begin assert public.lumen_payment_channel()='live','real sales open to signed-in players';end $$;
reset role;reset request.jwt.claim.sub;
do $$declare player uuid:='00000000-0000-0000-0000-000000073061';r jsonb;rid uuid;progress jsonb;begin
 assert lumen_commands.stripe_checkout_begin(player,'real-adventure-02',now())->>'result'='not_eligible','still no test checkout for a real player';
 r:=lumen_commands.stripe_checkout_begin(player,'real-adventure-02',now(),true);
 assert r->>'result'='reserved' and (r->>'livemode')::boolean and (r->>'amount_cents')::integer=100,'live checkout at the catalogue price';
 rid:=(r->>'reservation_id')::uuid;
 begin perform lumen_commands.stripe_checkout_attach(rid,'cs_test_730x','https://checkout.stripe.com/c/pay/cs_test_730x',now()+interval '30 minutes');
  raise exception 'test session attached to a live reservation';exception when check_violation then null;end;
 assert lumen_commands.stripe_checkout_attach(rid,'cs_live_730a','https://checkout.stripe.com/c/pay/cs_live_730a',now()+interval '30 minutes');
 r:=lumen_commands.stripe_checkout_begin(player,'real-adventure-02',now(),true);
 assert r->>'result'='reuse' and r->>'session_id'='cs_live_730a','a double click reuses the live session';
 begin perform lumen_commands.stripe_record_session('cs_live_730a',player,'real-adventure-02',100,'EUR',false,'paid',false,'pi_730live',now());
  raise exception 'live session recorded as test';exception when invalid_parameter_value then null;end;
 r:=lumen_commands.stripe_record_session('cs_live_730a',player,'real-adventure-02',100,'EUR',true,'paid',false,'pi_730live',now());
 assert r->>'result'='recorded' and r->'adventures' ? 'real-adventure-02','a confirmed real payment grants its Adventure';
 assert (select count(*) from lumen_commands.purchases where provider='stripe' and provider_ref='cs_live_730a')=1;
 r:=lumen_commands.stripe_record_session('cs_live_730a',player,'real-adventure-02',100,'EUR',true,'paid',false,'pi_730live',now());
 assert (select count(*) from lumen_commands.purchase_events e join lumen_commands.purchases p on p.id=e.purchase_id where p.provider_ref='cs_live_730a')=1,'replay is idempotent';
 r:=lumen_commands.stripe_record_session('cs_live_730a',player,'real-adventure-02',100,'EUR',true,'refunded',false,'pi_730live',now());
 assert not (r->'adventures' ? 'real-adventure-02'),'a real refund withdraws the right';
 -- Test reset never touches real sales; erasure archives them for accounting.
 perform lumen_commands.stripe_test_reset(player);
 assert exists(select 1 from lumen_commands.purchases where provider_ref='cs_live_730a'),'real purchases survive the test reset';
 assert exists(select 1 from lumen_commands.stripe_checkout_sessions where session_id='cs_live_730a'),'real sessions survive the test reset';
 delete from lumen_commands.purchase_events where user_id=player;
 delete from lumen_commands.stripe_checkout_sessions where user_id=player;
 delete from lumen_commands.purchases where user_id=player;
 assert exists(select 1 from lumen_commands.purchase_accounting_records where provider='stripe' and provider_ref='cs_live_730a' and status='refunded'),'real sales are kept as accounting records';
end $$;
update lumen_commands.feature_flags set enabled=false where name='stripe_live';
do $$begin perform lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[]);end $$;
