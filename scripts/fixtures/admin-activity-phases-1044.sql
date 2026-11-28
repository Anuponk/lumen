-- Disposable PostgreSQL only; synthetic accounts, rolled back. #1044 (28/11):
-- behaviour per phase (free discovery / free after the threshold / Premium), replay
-- distribution and distinct quests per day, in the single activity read.
begin;
do $$
declare
 owner_ constant uuid:='00000000-0000-4000-8000-000010440101';
 p1 constant uuid:='00000000-0000-4000-8000-000010440102';
 p2 constant uuid:='00000000-0000-4000-8000-000010440103';
 pb constant uuid:='00000000-0000-4000-8000-000010440104';
 today date:=(clock_timestamp() at time zone 'Europe/Paris')::date; d2 date; d3 date;
 q1 text; q2 text; r jsonb; day jsonb;
begin
 d2:=today-2;d3:=today-3;
 delete from lumen_commands.ranking_runs;
 select quest_id into q1 from lumen_commands.quest_rules order by quest_id limit 1;
 select quest_id into q2 from lumen_commands.quest_rules order by quest_id offset 1 limit 1;
 insert into auth.users(id) values(owner_),(p1),(p2),(pb);
 insert into lumen.internal_capabilities(user_id,capability) values(owner_,'analytics_cockpit');
 assert not has_function_privilege('anon','public.lumen_admin_activity(integer,boolean,text,text[])','EXECUTE');
 assert to_regprocedure('public.lumen_admin_activity(integer,boolean,text)') is null,'single signature';
 -- p1: discovery only on d3 (q1 twice: new then replay), then q2 (after threshold) on d2.
 -- p2: discovery only. pb: Premium buyer before playing.
 insert into lumen_commands.ranking_runs(user_id,operation_id,quest_id,grid_revision,started_at,issued_at,eligible,result) values
  (p1,'ph1aaaaa-reset-0',q1,0,now(),(d3+time '10:00') at time zone 'Europe/Paris',true,'{"status":"confirmed"}'),
  (p1,'ph1bbbbb-reset-0',q1,0,now(),(d3+time '11:00') at time zone 'Europe/Paris',true,null),
  (p1,'ph1ccccc-reset-0',q2,0,now(),(d2+time '10:00') at time zone 'Europe/Paris',true,null),
  (p2,'ph2aaaaa-reset-0',q1,0,now(),(d2+time '10:00') at time zone 'Europe/Paris',true,null),
  (pb,'phbaaaaa-reset-0',q2,0,now(),(d2+time '12:00') at time zone 'Europe/Paris',true,null);
 insert into lumen_commands.canonical_receipts(user_id,operation_id,request,outcome,recorded_at) values
  (p1,'ph1aaaaa-reset-0',jsonb_build_object('questId',q1,'facts',jsonb_build_object('seconds',60)),'{"firstCompletion":true}',(d3+time '10:05') at time zone 'Europe/Paris');
 insert into lumen_commands.purchases(provider,provider_ref,user_id,product_id,amount_cents,currency,status,purchased_at) values
  ('stripe','fixture-1044-phases',pb,'lumen-premium',499,'EUR','paid',(d2+time '08:00') at time zone 'Europe/Paris');
 perform set_config('request.jwt.claim.sub',owner_::text,true);
 r:=public.lumen_admin_activity(30,false,'all',array[q1]);
 assert (r->'behaviour'->'phases'->'free_discovery'->>'playerDays')::int=2,'p1 on d3, p2 on d2: '||(r->'behaviour'->'phases')::text;
 assert (r->'behaviour'->'phases'->'free_after_threshold'->>'playerDays')::int=1,'p1 on d2 after the threshold';
 assert (r->'behaviour'->'phases'->'premium'->>'playerDays')::int=1,'pb';
 assert exists(select 1 from jsonb_array_elements(r->'behaviour'->'distributionReplay') x where x->>'bucket'='1-5' and (x->>'count')::int=1),'p1 replayed once on d3';
 select x into day from jsonb_array_elements(r->'daily') x where (x->>'day')::date=d3;
 assert (day->>'started')::int=2 and (day->>'questsDistinct')::int=1 and (day->>'completed')::int=1,'attempts vs distinct quests vs wins: '||day::text;
 -- Without the catalogue order the phase is simply « free ».
 r:=public.lumen_admin_activity(30,false,'all');
 assert (r->'behaviour'->'phases'->'free'->>'playerDays')::int=3,(r->'behaviour'->'phases')::text;
 begin perform public.lumen_admin_activity(30,false,'all',array[]::text[]);raise exception 'empty discovery list';exception when invalid_parameter_value then null;end;
end $$;
rollback;
