-- Isolated PostgreSQL only. Transaction/mirror/daily/authority tests.
create function lumen_commands.fixture_fail_legacy() returns trigger language plpgsql as $$
begin if new.operation_id='fail-receipt' then raise exception 'simulated receipt write failure';end if;return new;end $$;
create trigger fixture_fail_legacy before insert on lumen_commands.legacy_receipts for each row execute function lumen_commands.fixture_fail_legacy();
do $$
declare u uuid:=gen_random_uuid();other_u uuid:=gen_random_uuid();q text;f jsonb;
 original jsonb;r jsonb;receipt jsonb;latest jsonb;day date:=(now() at time zone 'Europe/Paris')::date;
begin
 insert into auth.users values(u),(other_u);
 original:='{"solved":{},"badges":{},"stars":{},"performances":{},"noHint":{},"challenges":{},"xp":42,"shards":7,"skyScore":0,"skyHistoryVersion":4,"future":{"keep":true}}';
 insert into lumen.profile_snapshots(user_id,payload) values(u,original);
 select quest_id into q from lumen_commands.legacy_rules where legacy_index=0;
 f:=jsonb_build_object('seconds',45,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,'hintUsed',false,'challengeFailed',false,'qualifiedDay',day::text,'qualifiedAt',now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin perform public.lumen_commit_legacy_command('fail-receipt',u,q,f);raise exception 'failure did not roll back';exception when raise_exception then assert sqlerrm='simulated receipt write failure';end;
 assert (select payload from lumen.profile_snapshots where user_id=u)=original;
 assert not exists(select 1 from lumen_commands.legacy_authority where user_id=u);
 assert not exists(select 1 from lumen.progress where user_id=u);
 assert not exists(select 1 from lumen.daily_progress where user_id=u);
 -- Existing server daily streak reaches day 3. One reward and receipt together.
 insert into lumen.daily_progress(user_id,play_date,puzzle_id) values(u,day-2,1),(u,day-1,1);
 r:=public.lumen_commit_legacy_command('first-reset-0',u,q,f);receipt:=public.lumen_get_legacy_command('first-reset-0',u);
 assert r->'request'=receipt->'request' and r->'outcome'=receipt->'outcome';
 assert r->'profile'->>'xp'='57' and r->'profile'->>'shards'='8';
 assert r->'profile'->'daily'->'rewards'->>('streak:'||day::text)='1';
 assert r->'profile'->'performances'->'0'->>'attempts'='1';
 -- A later legitimate spend is retained on duplicate response/retry.
 update lumen.profile_snapshots set payload=jsonb_set(payload,'{shards}','6') where user_id=u;
 select payload into latest from lumen.profile_snapshots where user_id=u;
 r:=public.lumen_commit_legacy_command('first-reset-0',u,q,f);
 assert r->'profile'=latest and r->'outcome'=receipt->'outcome';
 begin perform public.lumen_commit_legacy_command('first-reset-0',u,q,f||'{"seconds":44}');raise exception 'changed evidence accepted';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_commit_legacy_command('other-owner',other_u,q,f);raise exception 'other owner accepted';exception when insufficient_privilege then null;end;
 begin perform public.lumen_get_legacy_command('first-reset-0',null);raise exception 'null owner accepted';exception when insufficient_privilege then null;end;
 -- Reset is a distinct badge run, still no second first-win/daily reward.
 r:=public.lumen_commit_legacy_command('first-reset-1',u,q,f||'{"seconds":60,"assistanceUsed":true}');
 assert r->'outcome'->>'firstCompletion'='false';assert r->'profile'->>'xp'='57';assert r->'profile'->>'shards'='6';
 assert r->'profile'->'performances'->'0'->>'attempts'='2';
 -- Both full-profile CAS and unconditional old backup must reject legacy wins.
 select payload into latest from lumen.profile_snapshots where user_id=u;
 begin perform public.lumen_cas_profile(latest,jsonb_set(latest,'{solved,1}','1'));raise exception 'snapshot win accepted';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_backup_profile(original);raise exception 'stale backup accepted';exception when invalid_parameter_value then null;end;
 assert (select payload from lumen.profile_snapshots where user_id=u)=latest;
 -- Cooldown metadata, preferences and a valid spend remain mutable.
 assert public.lumen_cas_profile(latest,jsonb_set(jsonb_set(latest,'{performances,0,lastQualifiedAt}',to_jsonb(now())),'{shards}','5'));
 assert not has_table_privilege('authenticated','lumen_commands.legacy_receipts','select,insert,update,delete');
 assert not has_table_privilege('authenticated','lumen_commands.legacy_authority','select,insert,update,delete');
 assert not has_function_privilege('anon','public.lumen_commit_legacy_command(text,uuid,text,jsonb)','execute');
 assert not has_function_privilege('authenticated','lumen_commands.legacy_projection(jsonb)','execute');
 set local role authenticated;
 assert public.lumen_legacy_command_version()=1;
 assert public.lumen_get_legacy_command('first-reset-0',u)=receipt;
 r:=public.lumen_commit_legacy_command('first-reset-0',u,q,f);assert r->'outcome'=receipt->'outcome';
 perform set_config('request.jwt.claim.sub',other_u::text,true);
 assert public.lumen_get_legacy_command('first-reset-0',other_u) is null;
 reset role;
end $$;
drop trigger fixture_fail_legacy on lumen_commands.legacy_receipts;
drop function lumen_commands.fixture_fail_legacy();
