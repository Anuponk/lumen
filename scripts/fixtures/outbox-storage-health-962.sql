-- #962: bounded device storage health in outbox_health. Disposable database only.
do $$begin
 if current_database()<>'lumen_test' then raise exception 'Disposable storage-health fixture requires lumen_test';end if;
end $$;
-- Applied twice: additive and idempotent (reliable-analytics re-applies the #708 summary).
\ir ../../supabase/migrations/20261123020000_outbox_storage_health_962.sql
\ir ../../supabase/migrations/20261123020000_outbox_storage_health_962.sql
begin;
do $$
declare a uuid:=gen_random_uuid();client uuid:=gen_random_uuid();session uuid:=gen_random_uuid();started timestamptz:=now()-interval '1 hour';
 r jsonb;row lumen_commands.outbox_health%rowtype;baseline bigint;alert jsonb;
begin
 insert into auth.users(id) values(a);
 baseline:=(lumen_commands.outbox_health_summary()->>'storage_pressure_players')::bigint;
 perform set_config('request.jwt.claim.sub',a::text,true);
 -- New 14-argument observation.
 perform public.lumen_record_outbox_health(a,client,session,started,1,'android-pwa','pending',4,0,now()-interval '30 days','1.11.1+770 27bf8ed',8192,9,'quota');
 select * into row from lumen_commands.outbox_health where user_id=a;
 assert row.storage_kb=8192 and row.storage_ratio=9 and row.storage_error='quota' and row.storage_error_at is not null,'storage fields stored';
 assert row.pending=4 and row.app_version='1.11.1+770 27bf8ed','original observation unchanged';
 -- An older client (11 arguments) still works and keeps the last storage signal.
 perform public.lumen_record_outbox_health(a,client,session,started,2,'android-pwa','pending',4,0,now()-interval '30 days','1.11.1+768 54e60d0');
 select * into row from lumen_commands.outbox_health where user_id=a;
 assert row.sequence=2 and row.storage_error='quota' and row.storage_kb=8192,'legacy call keeps storage signal';
 -- A later observation without error keeps the last error; sizes follow the device.
 perform public.lumen_record_outbox_health(a,client,session,started,3,'android-pwa','pending',4,0,now()-interval '30 days','1.11.1+770 27bf8ed',512,1,null);
 select * into row from lumen_commands.outbox_health where user_id=a;
 assert row.storage_kb=512 and row.storage_ratio=1 and row.storage_error='quota','sizes updated, last error kept';
 -- A stale (older sequence) packet changes nothing.
 perform public.lumen_record_outbox_health(a,client,session,started,1,'android-pwa','pending',4,0,now()-interval '30 days','1.11.1+770 27bf8ed',9999,99,'storage');
 select * into row from lumen_commands.outbox_health where user_id=a;
 assert row.sequence=3 and row.storage_kb=512 and row.storage_error='quota','stale packet ignored';
 -- Bounds: no free text, no out-of-range values.
 begin perform public.lumen_record_outbox_health(a,client,session,started,4,'android-pwa','pending',4,0,null,'1.11.1+770',1,1,'QuotaExceededError: secret');raise exception 'free text accepted';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_record_outbox_health(a,client,session,started,4,'android-pwa','pending',4,0,null,'1.11.1+770',1,101,null);raise exception 'ratio > 100 accepted';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_record_outbox_health(a,client,session,started,4,'android-pwa','pending',4,0,null,'1.11.1+770',-1,1,null);raise exception 'negative size accepted';exception when invalid_parameter_value then null;end;
 -- Identity: another account cannot write this device row.
 begin perform public.lumen_record_outbox_health(gen_random_uuid(),client,session,started,5,'android-pwa','pending',4,0,null,'1.11.1+770',1,1,null);raise exception 'foreign account accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 -- Admin summary: one more account under storage pressure, alert carries only buckets and category.
 r:=lumen_commands.outbox_health_summary();
 assert (r->>'storage_pressure_players')::bigint=baseline+1,'storage pressure counted once';
 select x into alert from jsonb_array_elements(r->'alerts') x where x->>'storage_error'='quota' and (x->>'storage_kb')::integer=512 limit 1;
 assert alert is not null,'alert exposes storage buckets and category';
 assert not (alert ? 'user_id') and not (alert ? 'client_id'),'alert stays anonymous';
 update lumen_commands.outbox_health set storage_error_at=now()-interval '8 days' where user_id=a;
 assert (lumen_commands.outbox_health_summary()->>'storage_pressure_players')::bigint=baseline,'old storage error expires from the summary';
 -- Privileges.
 assert has_function_privilege('authenticated','public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text)','EXECUTE');
 assert not has_function_privilege('anon','public.lumen_record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text)','EXECUTE');
 assert not has_function_privilege('anon','lumen_commands.record_outbox_health(uuid,uuid,uuid,timestamptz,integer,text,text,integer,integer,timestamptz,text,integer,integer,text)','EXECUTE');
 assert not has_function_privilege('authenticated','lumen_commands.outbox_health_summary()','EXECUTE');
 assert not has_table_privilege('authenticated','lumen_commands.outbox_health','SELECT');
 -- Erasure still removes the row (privacy registry unchanged).
 assert exists(select 1 from lumen_privacy.policy() p where p.ns='lumen_commands' and p.rel='outbox_health' and p.action='delete');
end $$;
rollback;
