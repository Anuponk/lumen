-- Disposable database only; never run this fixture against real accounts.
-- Stub capabilities to exercise the real RPC's authorization branch.
create function public.lumen_get_internal_capabilities() returns table(capability text)
language sql as $$ select 'analytics_cockpit'::text
 where current_setting('test.analytics_admin',true)='yes' $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003980',false);
select set_config('test.analytics_admin','yes',false);
insert into public.lumen_sync_health(user_id,event,outcome,reason,app_version,recorded_at) values
 ('00000000-0000-0000-0000-000000003981','hydration_reconciliation','blocked','mutable_balance','fixture',now()-interval '30 minutes'),
 ('00000000-0000-0000-0000-000000003981','hydration_failed',null,'network','fixture',now()-interval '1 minute'),
 ('00000000-0000-0000-0000-000000003982','hydration_failed',null,'network','fixture',now()-interval '40 minutes'),
 ('00000000-0000-0000-0000-000000003982','hydration_ready',null,null,'fixture',now()-interval '20 minutes'),
 ('00000000-0000-0000-0000-000000003983','hydration_failed',null,'network','fixture',now()-interval '1 minute'),
 ('00000000-0000-0000-0000-000000003984','hydration_reconciliation','blocked','reward_conflict','fixture',now()-interval '16 minutes'),
 ('00000000-0000-0000-0000-000000003985','hydration_failed',null,'network','fixture',now()-interval '100 days');
-- Equal timestamps must use identity order, including success -> new failure.
insert into public.lumen_sync_health(user_id,event,recorded_at) values
 ('00000000-0000-0000-0000-000000003986','hydration_failed',now()-interval '30 minutes'),
 ('00000000-0000-0000-0000-000000003986','hydration_ready',now()-interval '30 minutes'),
 ('00000000-0000-0000-0000-000000003987','hydration_ready',now()-interval '30 minutes'),
 ('00000000-0000-0000-0000-000000003987','hydration_failed',now()-interval '30 minutes');
do $$ declare r jsonb; begin
 r:=public.lumen_admin_sync_health(7);
 if (r->>'stalled_players')::int<>4 then raise exception 'missed unresolved incident: %',r; end if;
 if (r->>'affected_players')::int<>6 then raise exception 'blocked reconciliation omitted: %',r; end if;
 if (r->>'oldest_unresolved_at')::timestamptz<>(select min(recorded_at) from public.lumen_sync_health) then raise exception 'incident age reset'; end if;
 if not (r->'by_reason') @> '[{"reason":"reward_conflict","count":1}]' then raise exception 'reason aggregation omitted block'; end if;
end $$;
set role authenticated;
select public.lumen_record_sync_health('hydration_failed','network',null,'test');
do $$ begin
 begin
  insert into public.lumen_sync_health(user_id,event) values('00000000-0000-0000-0000-000000003981','hydration_ready');
  raise exception 'cross-user telemetry accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.lumen_sync_health;
  raise exception 'player can read private telemetry';
 exception when insufficient_privilege then null; end;
 begin
  perform public.lumen_record_sync_health('invented_event');
  raise exception 'invalid event accepted';
 exception when check_violation then null; end;
end $$;
select set_config('test.analytics_admin','no',false);
do $$ begin
 begin perform public.lumen_admin_sync_health(); raise exception 'non-admin dashboard accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
 begin perform public.lumen_admin_sync_health(); raise exception 'guest dashboard accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000003980',false);
select set_config('test.analytics_admin','yes',false);
-- A real ready event clears the old incident, including repeated failures.
insert into public.lumen_sync_health(user_id,event) values
 ('00000000-0000-0000-0000-000000003981','hydration_ready');
do $$ begin
 if (public.lumen_admin_sync_health()->>'stalled_players')::int<>3 then
  raise exception 'recovered player still stalled';
 end if;
end $$;
