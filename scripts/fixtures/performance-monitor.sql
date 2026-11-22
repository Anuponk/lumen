begin;
insert into auth.users (id,raw_app_meta_data)
select md5(i::text)::uuid,case when i=42 then '{"lumen_qa":true}'::jsonb else '{}'::jsonb end
from generate_series(1,45) i;
insert into lumen_commands.diagnostic_preferences
select md5(i::text)::uuid,true from generate_series(1,42) i;
do $$
begin
 perform set_config('request.jwt.claim.sub',md5('41')::uuid::text,true);
 if public.lumen_record_performance_sample('1.11.1+742','desktop','chromium','4g','{"url":"secret"}') then
  raise exception 'unexpected raw field';
 end if;
 if not public.lumen_record_performance_sample('1.11.1+742','desktop','chromium','4g','{"load":900}') then
  raise exception 'opted-in account rejected';
 end if;
 if public.lumen_record_performance_sample('1.11.1+743','desktop','chromium','4g','{"load":900}') then
  raise exception 'daily bound bypassed';
 end if;
 perform set_config('request.jwt.claim.sub',md5('42')::uuid::text,true);
 if public.lumen_record_performance_sample('1.11.1+743','desktop','chromium','4g','{"load":900}') then
  raise exception 'QA account accepted';
 end if;
 perform set_config('request.jwt.claim.sub',md5('43')::uuid::text,true);
 if public.lumen_record_performance_sample('1.11.1+743','desktop','chromium','4g','{"load":900}') then
  raise exception 'missing consent accepted';
 end if;
 begin
  perform public.lumen_admin_performance_health();
  raise exception 'ordinary user read performance data';
 exception when insufficient_privilege then null;
 end;
end $$;
insert into lumen_commands.performance_samples
 (owner_id,sample_day,recorded_at,version,build,platform,browser,network,metrics)
select md5(i::text)::uuid,current_date-1,now()-interval '1 day','1.11.1+742',742,'desktop','chromium','4g',
 case when i<=19 then '{"load":900,"grid_input":40,"grid_render":80}' else '{"load":900,"grid_render":80}' end::jsonb
from generate_series(1,20) i
union all
select md5(i::text)::uuid,current_date,now(),'1.11.1+743',743,'desktop','chromium','4g',
 jsonb_build_object('load',1800,'grid_input',100,'grid_render',75)
from generate_series(21,40) i
union all
select md5('45')::uuid,current_date-15,now()-interval '15 days','1.11.1+744',744,'desktop','chromium','4g','{"load":9000}';
do $$
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 if not exists(select 1 from jsonb_array_elements(public.lumen_admin_performance_health()) x
  where x->>'version'='1.11.1+743' and x->>'reference'='1.11.1+742' and x->>'metric'='load'
   and x->>'p90'='1800' and x->>'reference_p90'='900' and x->>'regression'='true') then
  raise exception 'expected comparable slowdown';
 end if;
 if (select count(*) from lumen_ops.performance_comparison(20) where regression)<>1 then
  raise exception 'small cohort or improvement alerted';
 end if;
 if lumen_commands.prune_sync_observations()<>1 then raise exception 'retention hook missing';end if;
 if public.lumen_observe_performance()<>1 then raise exception 'expected one alert';end if;
 if public.lumen_observe_performance()<>0 then raise exception 'duplicate alert';end if;
 insert into public.lumen_sync_health(user_id,recorded_at,event,app_version)
 select md5(i::text)::uuid,now(),case when i between 21 and 25 then 'hydration_failed' else 'hydration_ready' end,
  case when i<=20 then '1.11.1+742 · aabbccd' else '1.11.1+743 · 0123456' end from generate_series(1,40) i;
 if public.lumen_observe_performance()<>1 then raise exception 'failure-rate increase not alerted';end if;
 update lumen_commands.diagnostic_preferences set enabled=false where user_id=md5('41')::uuid;
 if exists(select 1 from lumen_commands.performance_samples where owner_id=md5('41')::uuid) then
  raise exception 'revocation did not erase optional measurements';
 end if;
 if has_function_privilege('authenticated','public.lumen_observe_performance()','execute')
  or has_table_privilege('service_role','lumen_commands.performance_samples','select')
  or has_function_privilege('anon','public.lumen_record_performance_sample(text,text,text,text,jsonb)','execute')
  then raise exception 'unexpected monitoring access';end if;
 if not exists(select 1 from lumen_privacy.policy() where rel='performance_samples' and action='delete') then
  raise exception 'erasure policy missing';
 end if;
end $$;
rollback;
