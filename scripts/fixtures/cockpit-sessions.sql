-- Disposable test database only; all synthetic accounts roll back.
begin;
create table if not exists lumen.users(user_id uuid primary key references auth.users(id));
\ir ../../supabase/migrations/20261025063343_cockpit_player_sessions.sql
do $$
declare admin uuid:=gen_random_uuid();actor uuid:=gen_random_uuid();other uuid:=gen_random_uuid();r jsonb;
begin
 insert into auth.users(id) values(admin),(actor),(other);
 insert into lumen.users values(actor),(other);
 insert into lumen.internal_capabilities(user_id,capability) values(admin,'analytics_cockpit');
 insert into lumen.analytics_events(user_id,anonymous_id,session_id,event_name,properties) values
 (actor,'shared-browser','00000000-0000-0000-0000-000000000001','hint_used','{"traffic_type":"human","email":"SECRET"}'),
 (other,'shared-browser','session-b','hint_used','{"traffic_type":"human"}'),
 (null,'shared-browser','Bearer-SECRET','hint_used','{"traffic_type":"human"}'),
 (actor,'shared-browser','bot','hint_used','{"traffic_type":"automated_test"}'),
 (actor,'shared-browser','qa','hint_used','{"traffic_type":"human","qa_mode":"test"}');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.lumen_admin_player_sessions('u:'||actor);raise exception 'non-admin access';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 r:=public.lumen_admin_player_sessions('u:'||actor);
 assert jsonb_array_length(r->'analytics')=1,'no relinking guest/other-account/shared-browser events';
 assert r->'analytics'->0->>'session_id'='00000000-0000-0000-0000-000000000001';assert r::text not like '%SECRET%';
 r:=public.lumen_admin_player_sessions('a:shared-browser');assert jsonb_array_length(r->'analytics')=1;
 assert r->'analytics'->0->'session_id'='null'::jsonb;assert r::text not like '%SECRET%';
 insert into lumen_commands.diagnostic_preferences(user_id,enabled) values(actor,true);
 insert into lumen_commands.diagnostic_events(user_id,event_id,session_id,trace_id,sequence,occurred_at,received_at,code,stage,kind,severity,platform,browser,app_version,before_state,after_state,retry,signature)
 select actor,gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,now(),now()-make_interval(days=>age),
  'guided_input_blocked','guided','unknown','warning','desktop','chromium','1.11.1+101','ready','blocked',0,'synthetic'
 from generate_series(0,8,8) age;
 r:=public.lumen_admin_player_sessions('u:'||actor);
 assert jsonb_array_length(r->'diagnostics')=1,'expired optional data is never displayed';
 update lumen_commands.diagnostic_preferences set enabled=false where user_id=actor;
 r:=public.lumen_admin_player_sessions('u:'||actor);assert jsonb_array_length(r->'diagnostics')=0,'withdrawn consent is honoured';
 insert into lumen.analytics_events(user_id,anonymous_id,session_id,event_name,properties)
 select actor,'shared-browser',gen_random_uuid()::text,'hint_used','{"traffic_type":"human"}'::jsonb from generate_series(1,200);
 r:=public.lumen_admin_player_sessions('u:'||actor);assert jsonb_array_length(r->'analytics')=100,'response is bounded';
 assert not has_table_privilege('authenticated','lumen_commands.diagnostic_events','SELECT');
 assert not has_function_privilege('anon','public.lumen_admin_player_sessions(text)','EXECUTE');
 update lumen.internal_capabilities set expires_at=now()-interval '1 second' where user_id=admin;
 begin perform public.lumen_admin_player_sessions('u:'||actor);raise exception 'expired capability';exception when insufficient_privilege then null;end;
end $$;
rollback;
