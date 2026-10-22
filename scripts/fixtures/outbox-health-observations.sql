-- Isolated fixtures only: aggregate alerts, ordering, privacy boundaries, retention.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000008001';
set test.analytics_admin='yes';
set role authenticated;
-- A real browser session keeps its start timestamp fixed across requests.
-- psql autocommit gives each statement a different now(), unlike one exec batch.
select set_config('test.outbox_started_at',(now()-interval '1 hour')::text,false);
select public.lumen_record_outbox_health(auth.uid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
 current_setting('test.outbox_started_at')::timestamptz,1,'android-pwa','pending',2,1,now()-interval '30 minutes','1.11.1+489');
select public.lumen_record_outbox_health(auth.uid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
 current_setting('test.outbox_started_at')::timestamptz,2,'android-pwa','pending',2,3,now()-interval '1 minute','1.11.1+489');
do $$declare r jsonb;k text;begin
 r:=public.lumen_admin_sync_health();
 assert r->'outbox'->>'stalled_players'='1';assert r->'outbox'->>'recurrent_players'='1';
 k:=r->'outbox'->'alerts'->0->>'key';assert k is not null;
 assert k=(public.lumen_admin_sync_health()->'outbox'->'alerts'->0->>'key');
 begin perform 1 from lumen_commands.outbox_health;raise exception 'raw telemetry exposed';exception when insufficient_privilege then null;end;
 begin perform lumen_commands.prune_sync_observations();raise exception 'player could prune';exception when insufficient_privilege then null;end;
end $$;
-- An old retry packet must not reopen a resolved incident.
select public.lumen_record_outbox_health(auth.uid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
 current_setting('test.outbox_started_at')::timestamptz,3,'android-pwa','confirmed',0,0,null,'1.11.1+489');
select public.lumen_record_outbox_health(auth.uid(),'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',
 current_setting('test.outbox_started_at')::timestamptz,2,'android-pwa','pending',2,3,now()-interval '30 minutes','1.11.1+489');
do $$begin assert public.lumen_admin_sync_health()->'outbox'->>'pending_players'='0';end $$;
set test.analytics_admin='no';
do $$begin
 begin perform public.lumen_admin_sync_health();raise exception 'non-admin saw cockpit';exception when insufficient_privilege then null;end;
end $$;
reset role;
update lumen_commands.outbox_health set updated_at=now()-interval '31 days';
select lumen_commands.prune_sync_observations();
do $$begin assert not exists(select 1 from lumen_commands.outbox_health);end $$;
