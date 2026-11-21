insert into auth.users values
 ('00000000-0000-0000-0000-000000000001',now(),now(),'{"provider":"google"}'),
 ('00000000-0000-0000-0000-000000000002',now(),now(),'{"provider":"google"}'),
 ('00000000-0000-0000-0000-000000000003',now(),now(),'{"provider":"google","lumen_qa":true}');
insert into public.lumen_sync_health(user_id,recorded_at,event,reason,outcome) values
 ('00000000-0000-0000-0000-000000000001',now()-interval '30 minutes','hydration_failed','network','cloud_restore'),
 ('00000000-0000-0000-0000-000000000003',now()-interval '30 minutes','hydration_failed','storage_quota','local_install'),
 ('00000000-0000-0000-0000-000000000002',now()-interval '1 minute','hydration_failed','storage_quota','local_install');
insert into lumen_commands.outbox_health values
 ('00000000-0000-0000-0000-000000000001',now()-interval '30 minutes','auth',5,8),
 ('00000000-0000-0000-0000-000000000001',now()-interval '30 minutes','pending',5,0),
 ('00000000-0000-0000-0000-000000000003',now()-interval '30 minutes','critical',5,8);
do $test$
declare count_open integer; delivery record;
begin
 if has_function_privilege('anon','public.lumen_admin_critical_incidents()','EXECUTE')
    or has_function_privilege('authenticated','public.lumen_observe_critical_incidents(bigint,boolean,integer,integer,integer,integer)','EXECUTE') then
   raise exception 'incorrect grants';
 end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
 begin
  perform public.lumen_admin_ack_critical_incident('availability',1);
  raise exception 'non-admin ack allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.lumen_admin_critical_incidents();
  raise exception 'non-admin read allowed';
 exception when insufficient_privilege then null;
 end;
 perform public.lumen_observe_critical_incidents(1,false);
 perform public.lumen_observe_critical_incidents(1,false);
 if exists(select 1 from lumen_commands.activity_mail) then raise exception 'retry, QA or a transient failure was counted';end if;
 perform public.lumen_observe_critical_incidents(2,false);
 perform public.lumen_observe_critical_incidents(3,true);
 perform public.lumen_observe_critical_incidents(4,false);
 perform public.lumen_observe_critical_incidents(5,false);
 if exists(select 1 from lumen_commands.activity_mail) then raise exception 'availability lacked hysteresis';end if;
 perform public.lumen_observe_critical_incidents(6,false);
 if (select count(*) from lumen_commands.activity_mail where source_id='availability:1' and kind='incident_open')<>1 then
  raise exception 'availability did not open exactly once';
 end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 if not public.lumen_admin_ack_critical_incident('availability',1)
  or public.lumen_admin_ack_critical_incident('availability',2) then raise exception 'ack identity mismatch'; end if;

 insert into public.lumen_sync_health(user_id,recorded_at,event,reason,outcome) values
 ('00000000-0000-0000-0000-000000000002',now()-interval '20 minutes','hydration_reconciliation','mutable_ledger','blocked');
 insert into lumen_commands.outbox_health values
 ('00000000-0000-0000-0000-000000000002',now()-interval '20 minutes','review',0,2);
 perform public.lumen_observe_critical_incidents(7,true);
 select count(*) into count_open from public.lumen_admin_critical_incidents() where opened_at is not null and resolved_at is null;
 if count_open<>3 then raise exception 'a single persistent account must open hydration and outbox';end if;
 if exists(select 1 from lumen_commands.activity_mail where kind='incident_resolved') then raise exception 'premature recovery';end if;

 insert into public.lumen_sync_health(user_id,recorded_at,event) values
 ('00000000-0000-0000-0000-000000000002',now(),'hydration_ready');
 update lumen_commands.outbox_health set state='auth' where user_id::text like '%02';
 perform public.lumen_observe_critical_incidents(8,true);
 perform public.lumen_observe_critical_incidents(9,true);
 if exists(select 1 from lumen_ops.critical_incidents where signature='outbox' and resolved_at is not null) then
  raise exception 'authentication hold is not proof of recovery'; end if;
 update lumen_commands.outbox_health set state='confirmed';
 perform public.lumen_observe_critical_incidents(10,true);
 perform public.lumen_observe_critical_incidents(11,true);
 if (select count(*) from lumen_commands.activity_mail where kind='incident_resolved')<>3 then raise exception 'recovery not deduplicated';end if;
 perform public.lumen_observe_critical_incidents(12,false,15,2);
 perform public.lumen_observe_critical_incidents(13,false,15,2);
 if not exists(select 1 from public.lumen_admin_critical_incidents() where signature='availability' and episode=2 and acknowledged_at is null) then
  raise exception 'a relapse may not reuse an old acknowledgement';end if;

 insert into lumen_commands.outbox_health values
 ('00000000-0000-0000-0000-000000000002',now()-interval '20 minutes','pending',1,25);
 perform public.lumen_observe_critical_incidents(14,true);
 perform public.lumen_observe_critical_incidents(15,true);
 if exists(select 1 from lumen_commands.activity_mail where source_id='backlog:1') then
  raise exception 'backlog alone alerted without confirmation';end if;
 perform public.lumen_observe_critical_incidents(16,true);
 if not exists(select 1 from public.lumen_admin_critical_incidents() where signature='backlog' and severity='P2' and episode=1) then
  raise exception 'backlog P2 missing';end if;

 insert into lumen_commands.adventure_packs values ('real-adventure-02','locked');
 insert into lumen_commands.store_products values ('real-adventure-02','adventure','real-adventure-02');
 insert into lumen_commands.purchases values(40,'play','fixture-only',
  '00000000-0000-0000-0000-000000000002','real-adventure-02',100,'EUR','paid',now(),1.25,'CAD');
 insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload) values
  ('00000000-0000-0000-0000-000000000002','purchase_missing_access','40','{"access":"missing"}');
 perform public.lumen_observe_critical_incidents(17,true);
 if exists(select 1 from lumen_commands.activity_mail where kind='purchase_access_restored') then
  raise exception 'false payment recovery';end if;
 insert into lumen.entitlements values ('00000000-0000-0000-0000-000000000002','real-adventure-02',null);
 perform public.lumen_observe_critical_incidents(18,true);
 perform public.lumen_observe_critical_incidents(19,true);
 if (select count(*) from lumen_commands.activity_mail where kind='purchase_access_restored' and source_id='40')<>1 then
  raise exception 'payment recovery was not emitted exactly once';end if;

 select * into delivery from public.lumen_claim_activity_mail(now()-interval '1 hour',array['incident_open'],1,100);
 if delivery.kind is distinct from 'incident_open' or delivery.payload ? 'user_id' then raise exception 'invalid delivery payload'; end if;
 if not public.lumen_finish_activity_mail(delivery.id,delivery.lease,'unknown') then raise exception 'lost ambiguous result';end if;
 if public.lumen_finish_activity_mail(delivery.id,delivery.lease,'accepted') then raise exception 'replayed result applied';end if;
end $test$;
