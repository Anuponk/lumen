-- #947/#948: thresholds configurable without redeploy, stale hydration failures no
-- longer active, performance compared by period with a confidence level.
-- Disposable fixture on top of the #950/#947/#948 bootstraps and migrations; rolled back.
begin;
insert into auth.users (id,created_at,email_confirmed_at,raw_app_meta_data)
select md5('mon'||i)::uuid,now(),now(),'{"provider":"google"}'::jsonb from generate_series(1,30) i;
insert into auth.users (id,created_at,email_confirmed_at,raw_app_meta_data)
values ('00000000-0000-0000-0000-000000000001',now(),now(),'{"provider":"google"}') on conflict do nothing;
insert into lumen_commands.diagnostic_preferences select md5('mon'||i)::uuid,true from generate_series(1,30) i;
do $$
declare s jsonb; c record; payload jsonb; ep integer; s0 bigint:=(extract(epoch from clock_timestamp())*1000)::bigint;
begin
 -- Defaults: 24 h hydration window, 5 accounts, ratio 1.5, recent 3 days.
 select to_jsonb(x)-'id'-'updated_at' into s from lumen_ops.monitor_settings x where x.id;
 if s<>'{"hydration_active_hours":24,"perf_min_accounts":5,"perf_ratio":1.5,"perf_recent_days":3}'::jsonb then
  raise exception 'unexpected defaults %',s; end if;

 -- #947: a failure from 3 days ago with no later success is history, not an active incident.
 insert into public.lumen_sync_health(user_id,recorded_at,event,reason) values
  (md5('mon1')::uuid,now()-interval '3 days','hydration_failed','storage_quota');
 if not public.lumen_observe_critical_incidents(s0,true) then raise exception 'observation busy'; end if;
 if (select affected from lumen_ops.critical_incidents where signature='hydration')<>0 then
  raise exception 'a stale failure (3 days, no activity since) is still counted as active'; end if;
 -- A recent failure (2 h) is active and opens the incident at once (failures=1 for hydration).
 insert into public.lumen_sync_health(user_id,recorded_at,event,reason) values
  (md5('mon2')::uuid,now()-interval '2 hours','hydration_failed','storage_quota');
 if not public.lumen_observe_critical_incidents(s0+1,true) then raise exception 'observation busy'; end if;
 if (select affected from lumen_ops.critical_incidents where signature='hydration')<>1
  or (select opened_at is null from lumen_ops.critical_incidents where signature='hydration') then
  raise exception 'a recent failure must be the single active account'; end if;
 -- Widening the window without a redeploy brings the old failure back into scope.
 update lumen_ops.monitor_settings set hydration_active_hours=96 where id;
 if not public.lumen_observe_critical_incidents(s0+2,true) then raise exception 'observation busy'; end if;
 if (select affected from lumen_ops.critical_incidents where signature='hydration')<>2 then
  raise exception 'hydration window setting ignored'; end if;
 update lumen_ops.monitor_settings set hydration_active_hours=24 where id;
 -- A later success clears the recent account; two healthy samples resolve the incident once.
 insert into public.lumen_sync_health(user_id,recorded_at,event) values (md5('mon2')::uuid,now(),'hydration_ready');
 perform public.lumen_observe_critical_incidents(s0+3,true);
 perform public.lumen_observe_critical_incidents(s0+4,true);
 select episode into ep from lumen_ops.critical_incidents where signature='hydration';
 if (select resolved_at is null from lumen_ops.critical_incidents where signature='hydration') then
  raise exception 'incident not resolved after two healthy samples'; end if;
 if (select count(*) from lumen_commands.activity_mail where kind='incident_resolved' and source_id='hydration:'||ep)<>1 then
  raise exception 'expected exactly one recovery notice'; end if;
 perform public.lumen_observe_critical_incidents(s0+5,true);
 if (select count(*) from lumen_commands.activity_mail where kind='incident_resolved' and source_id='hydration:'||ep)<>1 then
  raise exception 'recovery notice duplicated'; end if;
 -- Millisecond samples from two schedulers stay monotonic: an older sample is ignored.
 perform public.lumen_observe_critical_incidents(s0-1,false);
 if (select sample from lumen_ops.critical_incidents where signature='availability')<>s0+5 then
  raise exception 'an older sample overwrote a newer observation'; end if;

 -- #948: 4 accounts per period stay below the floor (low confidence, no alert).
 insert into lumen_commands.performance_samples(owner_id,sample_day,recorded_at,version,build,platform,browser,network,metrics)
 select md5('mon'||i)::uuid,current_date-6,now()-interval '6 days','1.11.1+780',780,'android-pwa','chromium','4g','{"load":1000}'::jsonb
 from generate_series(11,14) i
 union all
 select md5('mon'||i)::uuid,current_date,now(),case when i%2=0 then '1.11.1+785' else '1.11.1+781' end,
  case when i%2=0 then 785 else 781 end,'android-pwa','chromium','4g','{"load":2200}'::jsonb
 from generate_series(21,24) i;
 select * into c from lumen_ops.performance_comparison(null) x where x.metric='load';
 if c.regression or c.samples<>4 or c.reference_samples<>4 or lumen_ops.performance_confidence(c.samples,c.reference_samples)<>'low' then
  raise exception 'small periods must not alert: %',to_jsonb(c); end if;
 if public.lumen_observe_performance()<>0 then raise exception 'alert below the floor'; end if;
 -- Several builds a day: the recent period pools them (latest version reported).
 insert into lumen_commands.performance_samples(owner_id,sample_day,recorded_at,version,build,platform,browser,network,metrics)
 values (md5('mon15')::uuid,current_date-6,now()-interval '6 days','1.11.1+779',779,'android-pwa','chromium','4g','{"load":1000}'),
  (md5('mon25')::uuid,current_date,now(),'1.11.1+786',786,'android-pwa','chromium','4g','{"load":2200}');
 select * into c from lumen_ops.performance_comparison(null) x where x.metric='load';
 if not c.regression or c.version<>'1.11.1+786' or c.reference<>'1.11.1+780' or c.samples<>5 or c.reference_samples<>5 then
  raise exception 'pooled periods at the floor must alert: %',to_jsonb(c); end if;
 if public.lumen_observe_performance()<>1 then raise exception 'expected one alert'; end if;
 if public.lumen_observe_performance()<>0 then raise exception 'duplicate alert'; end if;
 select m.payload into payload from lumen_commands.activity_mail m where m.kind='performance_regression' and m.source_id like '1.11.1+786:%';
 if payload->>'confidence'<>'medium' or payload->>'severity'<>'P1' or payload->>'samples'<>'5' then
  raise exception 'alert payload lacks confidence or sizes: %',payload; end if;
 -- Raising the floor without a redeploy silences the same data.
 update lumen_ops.monitor_settings set perf_min_accounts=6 where id;
 if (select regression from lumen_ops.performance_comparison(null) x where x.metric='load') then
  raise exception 'min accounts setting ignored'; end if;
 update lumen_ops.monitor_settings set perf_min_accounts=5 where id;

 -- Admin RPCs: capability required, bounds enforced, values returned.
 perform set_config('request.jwt.claim.sub',md5('mon3')::uuid::text,true);
 begin perform public.lumen_admin_set_monitor_settings(p_perf_min_accounts=>3); raise exception 'non-admin changed thresholds';
 exception when insufficient_privilege then null; end;
 begin perform public.lumen_admin_monitor_settings(); raise exception 'non-admin read thresholds';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 s:=public.lumen_admin_set_monitor_settings(p_perf_min_accounts=>8,p_perf_recent_days=>2);
 if (s->>'perf_min_accounts')::int<>8 or (s->>'perf_recent_days')::int<>2 or (s->>'hydration_active_hours')::int<>24 then
  raise exception 'partial update must keep other values: %',s; end if;
 begin perform public.lumen_admin_set_monitor_settings(p_perf_min_accounts=>1); raise exception 'out-of-bounds floor accepted';
 exception when check_violation then null; end;
 if (select x->>'confidence' from jsonb_array_elements(public.lumen_admin_performance_health()) x limit 1) is null then
  raise exception 'cockpit rows lack confidence'; end if;
 if has_table_privilege('authenticated','lumen_ops.monitor_settings','select')
  or has_function_privilege('anon','public.lumen_admin_set_monitor_settings(integer,integer,numeric,integer)','execute')
  or has_function_privilege('anon','public.lumen_admin_monitor_settings()','execute') then
  raise exception 'unexpected settings access'; end if;
end $$;
rollback;
