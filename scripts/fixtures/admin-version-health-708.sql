-- #708 Lot D: lumen_admin_version_health on the migrated schema. Synthetic data
-- in disposable PostgreSQL only; everything is rolled back.
do $$begin
 if current_database()<>'lumen_test' and current_setting('lumen.sql_fixture',true) is distinct from '708'
 then raise exception 'Disposable analytics fixture requires an isolated test database';end if;
end $$;
\ir ../../supabase/migrations/20261121170000_admin_version_health_708.sql
\ir ../../supabase/migrations/20261121170000_admin_version_health_708.sql
begin;
do $$
declare admin uuid:=gen_random_uuid();p1 uuid:=gen_random_uuid();p2 uuid:=gen_random_uuid();r jsonb;a jsonb;b jsonb;
begin
 insert into auth.users(id) values(admin),(p1),(p2);
 insert into lumen.internal_capabilities(user_id,capability) values(admin,'analytics_cockpit');
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_admin_version_health(7);raise exception 'guest read version health';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',p1::text,true);
 begin perform public.lumen_admin_version_health(7);raise exception 'player read version health';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('anon','public.lumen_admin_version_health(integer)','EXECUTE'),'anon cannot call it';

 -- Version A: 10 hydrations, 1 failure, 2 players. Version B: 4 hydrations, 3 failures, 1 blocked.
 insert into public.lumen_sync_health(user_id,event,app_version,recorded_at)
  select case when i%2=0 then p1 else p2 end,'hydration_ready','vtest-708-a',now()-interval '1 hour' from generate_series(1,9) i;
 insert into public.lumen_sync_health(user_id,event,reason,app_version,recorded_at) values(p1,'hydration_failed','network','vtest-708-a',now()-interval '30 minutes');
 insert into public.lumen_sync_health(user_id,event,app_version,recorded_at) values(p2,'hydration_ready','vtest-708-b',now()-interval '10 minutes');
 insert into public.lumen_sync_health(user_id,event,reason,app_version,recorded_at)
  select p2,'hydration_failed','storage_quota','vtest-708-b',now()-interval '5 minutes' from generate_series(1,3);
 insert into public.lumen_sync_health(user_id,event,outcome,app_version,recorded_at) values(p2,'hydration_reconciliation','blocked','vtest-708-b',now()-interval '4 minutes');
 insert into public.lumen_sync_health(user_id,event,app_version,recorded_at) values(p1,'hydration_failed','vtest-708-old',now()-interval '30 days');
 insert into lumen_commands.outbox_health(user_id,client_id,session_id,session_started,sequence,platform,state,pending,failures,oldest_pending_at,app_version)
  values(p2,gen_random_uuid(),gen_random_uuid(),now(),1,'web','pending',2,1,now()-interval '20 minutes','vtest-708-b'),
        (p1,gen_random_uuid(),gen_random_uuid(),now(),1,'web','confirmed',0,0,null,'vtest-708-a');

 perform set_config('request.jwt.claim.sub',admin::text,true);
 r:=public.lumen_admin_version_health(7);
 select x into a from jsonb_array_elements(r->'versions') x where x->>'version'='vtest-708-a';
 select x into b from jsonb_array_elements(r->'versions') x where x->>'version'='vtest-708-b';
 assert (a->>'hydrations')::int=10 and (a->>'failures')::int=1 and (a->>'players')::int=2 and (a->>'devices')::int=1 and (a->>'waiting_devices')::int=0,'version A: '||coalesce(a::text,'none');
 assert (b->>'hydrations')::int=4 and (b->>'failures')::int=3 and (b->>'blocked')::int=1 and (b->>'players')::int=1 and (b->>'waiting_devices')::int=1,'version B: '||coalesce(b::text,'none');
 assert not exists(select 1 from jsonb_array_elements(r->'versions') x where x->>'version'='vtest-708-old'),'outside the period';
 assert (select min(i) from jsonb_array_elements(r->'versions') with ordinality t(x,i) where x->>'version'='vtest-708-b')
  <(select min(i) from jsonb_array_elements(r->'versions') with ordinality t(x,i) where x->>'version'='vtest-708-a'),'more recently seen version listed first';
 assert r::text !~ '[0-9a-f]{8}-[0-9a-f]{4}-','no identifier';
 assert (public.lumen_admin_version_health(0)->>'days')::int=1 and (public.lumen_admin_version_health(99999)->>'days')::int=3650,'period bounds';
end $$;
rollback;
