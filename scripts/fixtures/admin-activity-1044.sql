-- Disposable PostgreSQL only; synthetic accounts, rolled back. #1044 cockpit:
-- activity (resets, receipts, new vs replay, internal exclusion, midnight), play time
-- (60 min = 10 + 20 + 30, penalties excluded), behaviour percentiles, quotas reached
-- vs blocked vs dialog shown, shop journal (idempotent, bounded, validated), funnels
-- in chronological order, attribution windows, retention after a limit, permissions.
begin;
do $$
declare
 owner_ constant uuid:='00000000-0000-4000-8000-000001044001'; -- analytics_cockpit
 p1 constant uuid:='00000000-0000-4000-8000-000001044002';
 p2 constant uuid:='00000000-0000-4000-8000-000001044003';
 p3 constant uuid:='00000000-0000-4000-8000-000001044004';
 pb constant uuid:='00000000-0000-4000-8000-000001044005';     -- web buyer, no visit
 qa constant uuid:='00000000-0000-4000-8000-000001044006';     -- internal account
 today date:=(clock_timestamp() at time zone 'Europe/Paris')::date;
 d1 date; d2 date; d3 date; d4 date;
 q1 text; q2 text; q3 text; r jsonb; c jsonb; day jsonb; e jsonb;
 at_ timestamptz;
begin
 d1:=today-1;d2:=today-2;d3:=today-3;d4:=today-4;
 select quest_id into q1 from lumen_commands.quest_rules order by quest_id limit 1;
 select quest_id into q2 from lumen_commands.quest_rules order by quest_id offset 1 limit 1;
 select quest_id into q3 from lumen_commands.quest_rules order by quest_id offset 2 limit 1;
 -- Isolation inside this rolled-back transaction: earlier CI steps may keep synthetic
 -- runs; the aggregates below must only see this scenario.
 delete from lumen_commands.ranking_runs;delete from lumen_commands.quota_attempts;delete from lumen_commands.commerce_events;
 delete from lumen_commands.commerce_settings_audit;
 insert into auth.users(id,created_at) values(owner_,now()-interval '60 days'),(p1,now()-interval '30 days'),(p2,now()-interval '20 days'),
  (p3,now()-interval '10 days'),(pb,now()-interval '5 days'),(qa,now()-interval '90 days');
 insert into lumen.internal_capabilities(user_id,capability) values(owner_,'analytics_cockpit'),(qa,'premium_preview');

 -- Permissions and bounds.
 assert not has_function_privilege('anon','public.lumen_admin_activity(integer,boolean,text)','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_admin_conversion(integer,boolean,text,integer)','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_track_commerce(jsonb)','EXECUTE');
 assert has_function_privilege('authenticated','public.lumen_track_commerce(jsonb)','EXECUTE');
 assert not has_table_privilege('authenticated','lumen_commands.commerce_events','SELECT');
 assert exists(select 1 from lumen_privacy.policy() where rel='commerce_events' and action='delete'),'erased with the account';
 perform set_config('request.jwt.claim.sub',p1::text,true);
 begin perform public.lumen_admin_activity(30,false,'all');raise exception 'player read the activity';exception when insufficient_privilege then null;end;
 begin perform public.lumen_admin_conversion(30,false,'all',7);raise exception 'player read the conversion';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_::text,true);
 begin perform public.lumen_admin_activity(365,false,'all');raise exception 'unbounded period';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_admin_conversion(30,false,'all',3);raise exception 'arbitrary window';exception when invalid_parameter_value then null;end;

 -- Attempts (server issue = first gesture). p1: a reset is the same attempt; the
 -- completing run carries the time; a later attempt on the won quest is a replay.
 insert into lumen_commands.ranking_runs(user_id,operation_id,quest_id,grid_revision,started_at,issued_at,eligible,result) values
  (p1,'a1aaaaaa-reset-0',q1,0,now(),(d2+time '12:00') at time zone 'Europe/Paris',true,null),
  (p1,'a1aaaaaa-reset-1',q1,0,now(),(d2+time '12:05') at time zone 'Europe/Paris',true,'{"status":"confirmed"}'),
  (p1,'a2aaaaaa-reset-0',q1,0,now(),(d2+time '13:00') at time zone 'Europe/Paris',true,null),
  (p1,'a3aaaaaa-reset-0',q2,0,now(),(d1+time '10:00') at time zone 'Europe/Paris',true,null),
  (p2,'b1bbbbbb-reset-0',q2,0,now(),(d2+time '11:00') at time zone 'Europe/Paris',true,'{"status":"confirmed"}'),
  (p2,'b2bbbbbb-reset-0',q3,0,now(),(d2+time '11:30') at time zone 'Europe/Paris',true,null),
  (p3,'c1cccccc-reset-0',q1,0,now(),(d2+time '15:30') at time zone 'Europe/Paris',true,'{"status":"confirmed"}'),
  (p3,'c0cccccc-reset-0',q3,0,now(),(d3+time '23:59') at time zone 'Europe/Paris',true,'{"status":"confirmed"}'),
  (pb,'d1dddddd-reset-0',q1,0,now(),(d2+time '12:00') at time zone 'Europe/Paris',true,null),
  (pb,'d0dddddd-reset-0',q1,0,now(),(d4+time '12:00') at time zone 'Europe/Paris',true,null),
  (qa,'e1eeeeee-reset-0',q1,0,now(),(d2+time '12:00') at time zone 'Europe/Paris',true,'{"status":"confirmed"}');
 -- Receipts: effective seconds without penalties; p1's first completion at 12:06.
 insert into lumen_commands.canonical_receipts(user_id,operation_id,request,outcome,recorded_at) values
  (p1,'a1aaaaaa-reset-1',jsonb_build_object('questId',q1,'facts',jsonb_build_object('seconds',600)),'{"firstCompletion":true}',(d2+time '12:06') at time zone 'Europe/Paris'),
  (p3,'c1cccccc-reset-0',jsonb_build_object('questId',q1,'facts',jsonb_build_object('seconds',1800)),'{"firstCompletion":true}',(d2+time '16:00') at time zone 'Europe/Paris'),
  (p3,'c0cccccc-reset-0',jsonb_build_object('questId',q3,'facts',jsonb_build_object('seconds',120)),'{"firstCompletion":true}',(d2+time '00:01') at time zone 'Europe/Paris'),
  (qa,'e1eeeeee-reset-0',jsonb_build_object('questId',q1,'facts',jsonb_build_object('seconds',999)),'{"firstCompletion":true}',(d2+time '12:20') at time zone 'Europe/Paris');
 insert into lumen_commands.legacy_receipts(user_id,operation_id,request,outcome,recorded_at) values
  (p2,'b1bbbbbb-reset-0',jsonb_build_object('questId',q2,'facts',jsonb_build_object('seconds',1200)),'{"firstCompletion":true}',(d2+time '11:20') at time zone 'Europe/Paris');
 -- pb: web Premium purchase at 08:00 on d2 (before playing that day), no shop visit.
 insert into lumen_commands.purchases(provider,provider_ref,user_id,product_id,amount_cents,currency,status,purchased_at) values
  ('stripe','fixture-1044-pb',pb,'lumen-premium',499,'EUR','paid',(d2+time '08:00') at time zone 'Europe/Paris');

 r:=public.lumen_admin_activity(30,false,'free');
 select x into day from jsonb_array_elements(r->'daily') x where (x->>'day')::date=d2;
 assert (day->>'players')::int=3,'p1, p2, p3 (pb is Premium, qa internal): '||day::text;
 assert (day->>'started')::int=5 and (day->>'startedNew')::int=4 and (day->>'startedReplay')::int=1,'reset deduplicated, replay after first win: '||day::text;
 assert (day->>'completed')::int=3 and (day->>'resets')::int=1,day::text;
 assert (day->>'seconds')::int=3600 and (day->>'timedPlayers')::int=3,'60 min total, 20 min per timed player: '||day::text;
 select x into day from jsonb_array_elements(r->'daily') x where (x->>'day')::date=d3;
 assert (day->>'players')::int=1 and (day->>'completed')::int=1,'midnight: the day of the start: '||day::text;
 -- Free player-days: 2,2,1 (d2) + 1 (d3) + 1 (d1) + 1 (pb, d4, before buying).
 assert (r->'behaviour'->>'playerDays')::int=6 and (r->'behaviour'->>'median')::int=1 and (r->'behaviour'->>'mean')::numeric=1.3
  and (r->'behaviour'->>'p95')::int=2,'percentiles over active player-days only: '||(r->'behaviour')::text;
 assert (r->'time'->>'timed')::int=(r->'time'->>'completed')::int,r::text;
 assert position(p1::text in r::text)=0 and position(qa::text in r::text)=0,'aggregates only';
 assert (r->>'internalPlayers')::int=1;
 r:=public.lumen_admin_activity(30,false,'premium');
 select x into day from jsonb_array_elements(r->'daily') x where (x->>'day')::date=d2;
 assert (day->>'players')::int=1,'pb is Premium after the purchase: '||day::text;
 select x into day from jsonb_array_elements(r->'daily') x where (x->>'day')::date=d4;
 assert (day->>'players')::int=0,'pb was free before the purchase';
 r:=public.lumen_admin_activity(30,true,'all');
 select x into day from jsonb_array_elements(r->'daily') x where (x->>'day')::date=d2;
 assert (day->>'players')::int=5,'internal accounts on request: '||day::text;
 select x into day from jsonb_array_elements(r->'daily') x where (x->>'day')::date=today-10;
 assert (day->>'players')::int=0 and (r->>'dataStart')::date<=d4,'an empty day inside the coverage is a measured zero';

 -- Quotas: limits 2 new / 1 replay from d3 (audit is the effective history).
 insert into lumen_commands.commerce_settings_audit(key,old_value,new_value,changed_at) values
  ('quota_new_daily','null','2',(d3+time '08:00') at time zone 'Europe/Paris'),
  ('quota_replay_daily','5','1',(d3+time '08:00') at time zone 'Europe/Paris'),
  ('quotas_enabled','false','true',(d3+time '08:00') at time zone 'Europe/Paris'),
  ('premium_enabled','false','true',(d3+time '08:00') at time zone 'Europe/Paris');
 insert into lumen_commands.quota_state(user_id,activated_at,activation_quest) values
  (p1,(d3+time '09:00') at time zone 'Europe/Paris',q1),(p2,(d3+time '09:00') at time zone 'Europe/Paris',q1),(p3,(d4+time '09:00') at time zone 'Europe/Paris',q1);
 insert into lumen_commands.quota_attempts(user_id,attempt_id,quest_id,kind,local_day,time_zone,started_at) values
  (p1,'qa-p1-0001',q1,'new',d2,'Europe/Paris',now()),(p1,'qa-p1-0002',q1,'new',d2,'Europe/Paris',now()),
  (p2,'qa-p2-0001',q2,'new',d2,'Europe/Paris',now()),(p2,'qa-p2-0002',q2,'replay',d2,'Europe/Paris',now());
 r:=public.lumen_admin_activity(30,false,'all');
 assert (r->'premium'->'observed'->>'daysReachNew')::int=1 and (r->'premium'->'observed'->>'daysReachReplay')::int=1,'reached (not blocked): '||(r->'premium')::text;
 select x into day from jsonb_array_elements(r->'daily') x where (x->>'day')::date=d2;
 assert (day->>'newLimit')::int=2 and (day->>'replayLimit')::int=1,'effective settings, never hard-coded: '||day::text;

 -- Journal: validation, idempotence, chronology. Events within the last 7 days.
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_track_commerce('[]');raise exception 'anonymous journal';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',p1::text,true);
 begin perform public.lumen_track_commerce((select jsonb_agg(jsonb_build_object('id','x'||g||'xxxxxxx')) from generate_series(1,21) g));raise exception 'unbounded batch';
 exception when invalid_parameter_value then null;end;
 e:=jsonb_build_array(
  jsonb_build_object('id','p1-ev-000001','type','limit_block','kind','new','at',(d2+time '12:10') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000002','type','limit_shown','kind','new','at',(d2+time '12:10') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000003','type','limit_block','kind','new','at',(d2+time '12:30') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000004','type','shop_open','origin','quota_new','channel','play','visit','p1-visit-01','priceCents',499,'currency','EUR','at',(d2+time '12:31') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000005','type','cta_click','channel','play','visit','p1-visit-01','at',(d2+time '12:32') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000006','type','checkout_start','channel','play','visit','p1-visit-01','at',(d2+time '12:33') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000007','type','checkout_cancel','channel','play','visit','p1-visit-01','at',(d2+time '12:34') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000008','type','shop_close','channel','play','visit','p1-visit-01','durationMs',240000,'at',(d2+time '12:35') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000009','type','not_an_event','at',(d2+time '12:35') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p1-ev-000010','type','shop_open','at',now()+interval '1 day'));
 c:=public.lumen_track_commerce(e);
 assert (c->>'accepted')::int=8 and (c->>'skipped')::int=2,c::text;
 c:=public.lumen_track_commerce(e);
 assert (c->>'accepted')::int=0,'retries never double count: '||c::text;
 perform set_config('request.jwt.claim.sub',p2::text,true);
 c:=public.lumen_track_commerce(jsonb_build_array(
  jsonb_build_object('id','p2-ev-000001','type','limit_block','kind','replay','at',(d2+time '14:00') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p2-ev-000002','type','limit_shown','kind','replay','at',(d2+time '14:00') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p2-ev-000003','type','shop_open','origin','quota_replay','channel','play','visit','p2-visit-01','at',(d2+time '14:01') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p2-ev-000004','type','cta_click','channel','play','visit','p2-visit-01','at',(d2+time '14:02') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p2-ev-000005','type','checkout_start','channel','play','visit','p2-visit-01','at',(d2+time '14:03') at time zone 'Europe/Paris')));
 assert (c->>'accepted')::int=5,c::text;
 insert into lumen_commands.purchases(provider,provider_ref,user_id,product_id,amount_cents,currency,status,purchased_at) values
  ('play','fixture-1044-p2',p2,'lumen-premium',500,'EUR','paid',(d2+time '14:05') at time zone 'Europe/Paris');
 -- p3: voluntary visit on d2, Premium click only on d1 (7-day window only).
 perform set_config('request.jwt.claim.sub',p3::text,true);
 c:=public.lumen_track_commerce(jsonb_build_array(
  jsonb_build_object('id','p3-ev-000001','type','shop_open','origin','voluntary','channel','web','visit','p3-visit-01','at',(d2+time '15:00') at time zone 'Europe/Paris'),
  jsonb_build_object('id','p3-ev-000002','type','cta_click','channel','web','visit','p3-visit-02','at',(d1+time '15:00') at time zone 'Europe/Paris')));
 assert (c->>'accepted')::int=2,c::text;
 -- Budget: 300 rows per account and 24 h.
 insert into lumen_commands.commerce_events(user_id,event_id,type,occurred_at) select p3,'p3-bulk-'||lpad(g::text,6,'0'),'shop_close',now() from generate_series(1,298) g;
 c:=public.lumen_track_commerce(jsonb_build_array(jsonb_build_object('id','p3-ev-000003','type','shop_close','at',now())));
 assert (c->>'accepted')::int=0 and (c->>'skipped')::int=1,'daily budget: '||c::text;
 delete from lumen_commands.commerce_events where event_id like 'p3-bulk-%';

 perform set_config('request.jwt.claim.sub',owner_::text,true);
 r:=public.lumen_admin_conversion(30,false,'all',7);
 assert (r->'limits'->>'blocksNew')::int=2 and (r->'limits'->>'blocksReplay')::int=1 and (r->'limits'->>'shown')::int=2,'blocked vs shown: '||(r->'limits')::text;
 assert (r->'limits'->>'blockedPlayers')::int=2 and (r->'limits'->>'blockedPlayerDays')::int=2,(r->'limits')::text;
 assert (r->'shop'->>'opens')::int=3 and (r->'shop'->>'visitors')::int=3 and (r->'shop'->>'purchases')::int=2,(r->'shop')::text;
 assert (r->'shop'->'origins'->'quota_new'->>'opens')::int=1 and (r->'shop'->'origins'->'voluntary'->>'opens')::int=1,(r->'shop')::text;
 assert (r->'funnelBlocked'->>'active')::int=4,'free active players (pb before purchase): '||(r->'funnelBlocked')::text;
 assert r->'funnelBlocked'='{"active":4,"blocked":2,"shop":2,"cta":2,"checkout":2,"purchase":1}'::jsonb,(r->'funnelBlocked')::text;
 assert (r->'funnelShop'->>'visitors')::int=3 and (r->'funnelShop'->>'cta')::int=3 and (r->'funnelShop'->>'purchase')::int=1
  and (r->'funnelShop'->>'purchasesWithoutVisit')::int=1,(r->'funnelShop')::text;
 assert exists(select 1 from jsonb_array_elements(r->'attribution') a where a->>'origin'='quota_replay' and a->>'channel'='play' and (a->>'purchases')::int=1),(r->'attribution')::text;
 assert exists(select 1 from jsonb_array_elements(r->'attribution') a where a->>'origin'='unattributed' and a->>'channel'='web'),(r->'attribution')::text;
 r:=public.lumen_admin_conversion(30,false,'all',0);
 assert (r->'funnelShop'->>'cta')::int=2,'same-day window drops the next-day click: '||(r->'funnelShop')::text;
 r:=public.lumen_admin_conversion(30,false,'web',7);
 assert (r->'shop'->>'opens')::int=1 and (r->'shop'->>'purchases')::int=1,'channel filter: '||(r->'shop')::text;
 r:=public.lumen_admin_conversion(30,false,'all',7);
 assert (r->'retention'->'blocked'->>'playerDays')::int=2 and (r->'retention'->'blocked'->>'j1')::numeric=50,'p1 back on d1, p2 not: '||(r->'retention')::text;
 assert (r->'retention'->'blocked'->>'conversion7')::numeric=50,(r->'retention')::text;
 assert (r->'retention'->'blocked'->>'j7Eligible')::int=0,'no J+7 without a complete follow-up';
 assert (r->'retention'->'reference'->>'playerDays')::int>=1,(r->'retention')::text;
 assert position(p2::text in r::text)=0,'aggregates only';
end $$;
rollback;
