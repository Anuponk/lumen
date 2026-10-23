-- Disposable PostgreSQL only; never run fixtures against real accounts.
do $$begin
 assert not has_table_privilege('authenticated','public.lumen_sync_health','INSERT'),
  'raw INSERT bypasses sanitisation and quotas';
 assert to_regprocedure('public.lumen_record_diagnostics(uuid,jsonb)') is not null,
  'missing persistent diagnostic ingestion';
end $$;
insert into auth.users(id) values('00000000-0000-0000-0000-000000053401'),('00000000-0000-0000-0000-000000053402') on conflict do nothing;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000053401';
set test.analytics_admin='yes';
set role authenticated;
do $$declare r jsonb;e jsonb;duplicate_packet jsonb;begin
 e:=jsonb_build_array(jsonb_build_object('id','00000000-0000-0000-0000-000000000001','session','00000000-0000-0000-0000-000000000002','trace','00000000-0000-0000-0000-000000000003','seq',1,'at',clock_timestamp(),'code','guided_error','stage','guided','kind','unknown','platform','desktop','browser','chromium','version','1.11.1+501','before','ready','after','blocked','retry',0));
 assert not (public.lumen_diagnostic_preference()->>'enabled')::boolean;
 r:=public.lumen_record_diagnostics(auth.uid(),e);assert r->>'disabled'='true';
 perform public.lumen_diagnostic_preference(true);
 e:=jsonb_set(e,'{0,at}',to_jsonb(clock_timestamp()));
 duplicate_packet:=jsonb_set(e,'{0,id}','"00000000-0000-0000-0000-000000999999"');
 begin
  perform public.lumen_record_diagnostics(auth.uid(),duplicate_packet||jsonb_set(duplicate_packet,'{0,code}','"unhandled_rejection"'));
  raise exception 'duplicate batch identity accepted with different evidence';
 exception when invalid_parameter_value then null;end;
 r:=public.lumen_record_diagnostics(auth.uid(),e);assert jsonb_array_length(r->'accepted')=1;
 perform set_config('test.old_diagnostic_packet',e::text,false);
 r:=public.lumen_record_diagnostics(auth.uid(),e);assert jsonb_array_length(r->'accepted')=1;
 begin
  perform public.lumen_record_diagnostics(auth.uid(),jsonb_set(e,'{0,email}','"forbidden@example.invalid"'));
  raise exception 'arbitrary private context accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.lumen_record_diagnostics('00000000-0000-0000-0000-000000053402',e);
  raise exception 'another account accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.lumen_record_diagnostics(auth.uid(),jsonb_set(e,'{0,code}','"runtime_exception"'));
  raise exception 'same identity changed evidence';
 exception when invalid_parameter_value then null;end;
 begin perform 1 from lumen_commands.diagnostic_events;raise exception 'raw diagnostic read allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from lumen_commands.diagnostic_preferences;raise exception 'raw preference read allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin assert (select count(*) from lumen_commands.diagnostic_events)=1,'lost response duplicated event';end $$;
set role authenticated;
do $$declare r jsonb;begin
 r:=public.lumen_admin_sync_health();
 assert r->'diagnostics'->>'events'='1';
 assert r->'diagnostics'->'timeline'->0->>'code'='guided_error';
 assert not (r->'diagnostics')::text like '%053401%','account identity in diagnostics';
end $$;
set test.analytics_admin='no';
do $$begin
 begin perform public.lumen_admin_sync_health();raise exception 'non-admin diagnostics access';exception when insufficient_privilege then null;end;
end $$;
select public.lumen_diagnostic_preference(false);
reset role;
do $$begin assert not exists(select 1 from lumen_commands.diagnostic_events),'withdrawal did not erase details';end $$;
-- Legacy callers cannot inject email/token-like reason/outcome/version strings.
set role authenticated;
select public.lumen_record_sync_health('hydration_failed','forbidden@example.invalid','Bearer secret','Bearer secret');
reset role;
do $$begin
 assert not exists(select 1 from public.lumen_sync_health where reason like '%@%' or app_version like '%Bearer%');
end $$;
-- Exhaustion must not strand a recovered account in #398. Repeated ready is
-- coalesced, so this exception cannot become an unbounded ingestion bypass.
update lumen_commands.diagnostic_budgets set calls=120,events=200 where lane='health' and subject='00000000-0000-0000-0000-000000053401';
set role authenticated;
select public.lumen_record_sync_health('hydration_ready',null,null,'1.11.1+501');
select public.lumen_record_sync_health('hydration_ready',null,null,'1.11.1+501');
reset role;
do $$begin
 assert (select count(*) from public.lumen_sync_health where user_id='00000000-0000-0000-0000-000000053401' and event='hydration_ready')=1;
end $$;
-- Five #533 transitions use one episode; repeated Undo is not collapsed.
create function pg_temp.diagnostic_packet(p_code text,p_seq integer) returns jsonb
language sql as $$select jsonb_build_array(jsonb_build_object(
 'id',gen_random_uuid(),'session','00000000-0000-0000-0000-000000000002','trace','00000000-0000-0000-0000-000000000003',
 'seq',p_seq,'at',clock_timestamp(),'code',p_code,'stage','guided','kind','unknown','platform','desktop','browser','chromium',
 'version','1.11.1+501','before','blocked','after',case when p_code='guided_input_released' then 'ready' else 'blocked' end,'retry',0))$$;
set role authenticated;
select public.lumen_diagnostic_preference(true);
select public.lumen_record_diagnostics(auth.uid(),current_setting('test.old_diagnostic_packet')::jsonb);
reset role;
do $$begin assert not exists(select 1 from lumen_commands.diagnostic_events),'stale pre-consent queue replayed after opt-in';end $$;
set role authenticated;
do $$declare e jsonb;r jsonb;begin
 e:=pg_temp.diagnostic_packet('guided_error',1)||pg_temp.diagnostic_packet('guided_undo',2)||pg_temp.diagnostic_packet('guided_input_blocked',3)||pg_temp.diagnostic_packet('guided_undo',4)||pg_temp.diagnostic_packet('guided_input_released',5);
 r:=public.lumen_record_diagnostics(auth.uid(),e);assert jsonb_array_length(r->'accepted')=5;
end $$;
reset role;
do $$declare timeline text[];begin
 select array_agg(code order by sequence) into timeline from lumen_commands.diagnostic_events where user_id='00000000-0000-0000-0000-000000053401';
 assert timeline=array['guided_error','guided_undo','guided_input_blocked','guided_undo','guided_input_released'],'#533 transition evidence incomplete';
end $$;
set role authenticated;
do $$declare r jsonb;limited boolean:=false;begin
 for i in 1..15 loop
  r:=public.lumen_record_diagnostics(auth.uid(),pg_temp.diagnostic_packet('runtime_exception',10+i));
  if r->>'limited'='true' then limited:=true;end if;
 end loop;
 assert limited,'minute quota not enforced';
 begin perform lumen_commands.prune_diagnostics();raise exception 'player could prune diagnostics';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- A second opted-in account cannot consume past the global event ceiling.
update lumen_commands.diagnostic_budgets set events=5000 where lane='details' and subject='global';
set request.jwt.claim.sub='00000000-0000-0000-0000-000000053402';
set role authenticated;
select public.lumen_diagnostic_preference(true);
do $$declare r jsonb;begin
 r:=public.lumen_record_diagnostics(auth.uid(),pg_temp.diagnostic_packet('runtime_exception',1));assert r->>'limited'='true';
end $$;
reset role;
-- Retention deletes expired details/counters; old unresolved #398 evidence stays.
update lumen_commands.diagnostic_events set received_at=now()-interval '8 days' where sequence=1;
insert into lumen_commands.diagnostic_budgets(lane,subject,day,minute) values('details','expired-fixture',current_date-5,now());
select lumen_commands.prune_sync_observations();
do $$begin
 assert not exists(select 1 from lumen_commands.diagnostic_events where received_at<now()-interval '7 days');
 assert exists(select 1 from lumen_commands.diagnostic_events),'retention erased recent diagnostics';
 assert not exists(select 1 from lumen_commands.diagnostic_budgets where subject='expired-fixture');
 assert exists(select 1 from public.lumen_sync_health where user_id='00000000-0000-0000-0000-000000003985'),'old unresolved incident erased';
end $$;
-- Auth deletion cascades only in this disposable fixture, never production.
delete from auth.users where id='00000000-0000-0000-0000-000000053402';
do $$begin assert not exists(select 1 from lumen_commands.diagnostic_preferences where user_id='00000000-0000-0000-0000-000000053402');end $$;
set role anon;
do $$begin
 begin perform public.lumen_diagnostic_preference(true);raise exception 'guest consent RPC allowed';exception when insufficient_privilege then null;end;
 begin perform public.lumen_record_diagnostics(null,'[]');raise exception 'guest diagnostic ingestion allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
