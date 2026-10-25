-- Synthetic accounts only, disposable DB. Run after the diagnostic migration.
insert into auth.users(id) values('00000000-0000-0000-0000-000000057401'),('00000000-0000-0000-0000-000000057402'),('00000000-0000-0000-0000-000000057403');
insert into lumen.internal_capabilities(user_id,capability) values('00000000-0000-0000-0000-000000057403','analytics_cockpit');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000057401';
set role authenticated;
do $$begin
 assert public.lumen_support(auth.uid(),'activate')->>'state'='unavailable','operator gate must default closed';
 assert not has_table_privilege('authenticated','lumen_commands.support_contents','SELECT');
 assert not has_table_privilege('authenticated','lumen_commands.support_cases','INSERT');
 assert not has_function_privilege('anon','public.lumen_support(uuid,text,uuid,uuid,jsonb,uuid)','EXECUTE');
 assert not has_function_privilege('authenticated','lumen_commands.prune_support()','EXECUTE');
end $$;
reset role;
update lumen_commands.support_control set enabled=true;
set role authenticated;
do $$declare c jsonb;r jsonb;p jsonb:='{"format":1,"events":[],"version":"unknown","code":"manual","copies":[{"source":"local","facts":[{"quest":1,"metric":"solved","value":true}]}]}';begin
 begin perform public.lumen_support('00000000-0000-0000-0000-000000057402','activate');raise exception 'cross owner';exception when insufficient_privilege then null;end;
 begin perform public.lumen_support(auth.uid(),'capture',gen_random_uuid(),gen_random_uuid(),p);raise exception 'no consent';exception when insufficient_privilege then null;end;
 c:=public.lumen_support(auth.uid(),'activate');assert c->>'state'='active';
 assert public.lumen_support(auth.uid(),'activate')->>'id'=c->>'id','activation retry must reuse consent';
 perform set_config('test.support_case',c->>'id',false);
 r:=public.lumen_support(auth.uid(),'capture',(c->>'id')::uuid,'00000000-0000-0000-0000-000000000574',p);
 assert r=public.lumen_support(auth.uid(),'capture',(c->>'id')::uuid,'00000000-0000-0000-0000-000000000574',p),'lost response must be idempotent';
 begin perform public.lumen_support(auth.uid(),'capture',(c->>'id')::uuid,gen_random_uuid(),p);raise exception 'minute quota';exception when program_limit_exceeded then null;end;
 begin perform public.lumen_support(auth.uid(),'capture',(c->>'id')::uuid,'00000000-0000-0000-0000-000000000574',jsonb_set(p,'{version}','"1.0.0+1"'));raise exception 'identity conflict';exception when invalid_parameter_value then null;end;
 for p in select x from jsonb_array_elements('[{"format":1,"events":[],"code":"manual","version":"unknown","copies":[{"source":"local","facts":[{"quest":1,"metric":"shards","value":"FAKE_AUTH_SECRET"}]}]},{"format":1,"events":[],"code":"manual","version":"unknown","copies":[{"source":"local","facts":[],"archive":{"token":"FAKE_REFRESH"}}]}]') x loop
  begin perform public.lumen_support(auth.uid(),'capture',(c->>'id')::uuid,gen_random_uuid(),p);raise exception 'nested secret';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.lumen_support(auth.uid(),'list',null,null,null,auth.uid());raise exception 'ordinary support read';exception when insufficient_privilege then null;end;
end $$;
reset role;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000057402';
set role authenticated;
do $$declare p jsonb:='{"format":1,"events":[],"version":"unknown","code":"manual","copies":[{"source":"local","facts":[]}]}';begin
 begin perform public.lumen_support(auth.uid(),'capture',current_setting('test.support_case')::uuid,gen_random_uuid(),p);raise exception 'foreign guessed ref';exception when insufficient_privilege then null;end;
end $$;
reset role;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000057403';
set role authenticated;
do $$declare r jsonb;begin
 r:=public.lumen_support(auth.uid(),'list',null,null,null,'00000000-0000-0000-0000-000000057401');assert jsonb_array_length(r->'captures')=1;
 r:=public.lumen_support(auth.uid(),'download',current_setting('test.support_case')::uuid,null,null,'00000000-0000-0000-0000-000000057401');
 assert r->'captures'->0->>'sha256'=encode(sha256(convert_to(r->'captures'->0->>'content','UTF8')),'hex');
 assert r::text not like '%FAKE_%';
end $$;
reset role;
do $$begin
 assert (select count(*) from lumen_commands.support_access where case_id=current_setting('test.support_case')::uuid)=2;
 update lumen.internal_capabilities set expires_at=now()-interval '1 second' where user_id='00000000-0000-0000-0000-000000057403';
end $$;
set role authenticated;
do $$begin
 begin perform public.lumen_support(auth.uid(),'download',current_setting('test.support_case')::uuid,null,null,'00000000-0000-0000-0000-000000057401');raise exception 'expired admin';exception when insufficient_privilege then null;end;
end $$;
reset role;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000057401';
-- Retained-account quota; operator-only synthetic metadata, no save content.
update lumen_commands.support_captures set received_at=now()-interval '2 minutes';
insert into lumen_commands.support_cases(user_id) values('00000000-0000-0000-0000-000000057402');
insert into lumen_commands.support_captures(id,case_id,received_at,bytes,sha256,code)
 select gen_random_uuid(),c.id,now()-interval '2 minutes',524288,'global-budget','manual'
 from lumen_commands.support_cases c cross join generate_series(1,64) where c.user_id='00000000-0000-0000-0000-000000057402';
set role authenticated;
do $$begin
 begin perform public.lumen_support(auth.uid(),'capture',current_setting('test.support_case')::uuid,gen_random_uuid(),'{"format":1,"events":[],"version":"unknown","code":"manual","copies":[{"source":"local","facts":[]}]}');raise exception 'global budget bypass';exception when program_limit_exceeded then null;end;
end $$;
reset role;
delete from lumen_commands.support_cases where user_id='00000000-0000-0000-0000-000000057402';
insert into lumen_commands.support_captures(id,case_id,received_at,bytes,sha256,code)
 select gen_random_uuid(),current_setting('test.support_case')::uuid,now()-interval '2 minutes',1,'synthetic','manual' from generate_series(1,7);
set role authenticated;
do $$begin
 begin perform public.lumen_support(auth.uid(),'capture',current_setting('test.support_case')::uuid,gen_random_uuid(),'{"format":1,"events":[],"version":"unknown","code":"manual","copies":[{"source":"local","facts":[]}]}');raise exception 'retained quota bypass';exception when program_limit_exceeded then null;end;
end $$;
reset role;
delete from lumen_commands.support_captures where sha256='synthetic';
-- A partial deletion failure rolls back revocation and the entire content delete.
create function pg_temp.support_delete_failure() returns trigger language plpgsql as $$begin raise exception using errcode='23514',message='synthetic delete failure';end $$;
create trigger synthetic_support_failure before delete on lumen_commands.support_contents for each row execute function pg_temp.support_delete_failure();
set role authenticated;
do $$begin
 begin perform public.lumen_support(auth.uid(),'revoke');raise exception 'delete failure ignored';exception when check_violation then null;end;
end $$;
reset role;
do $$begin
 assert (select count(*) from lumen_commands.support_contents)=1,'failed deletion must preserve content';
 assert (select revoked_at is null from lumen_commands.support_cases where id=current_setting('test.support_case')::uuid),'failed revoke must roll back';
end $$;
drop trigger synthetic_support_failure on lumen_commands.support_contents;
set role authenticated;
do $$declare c uuid:=current_setting('test.support_case')::uuid;begin
 assert public.lumen_support(auth.uid(),'revoke')->>'state'='deleted';
 begin perform public.lumen_support(auth.uid(),'capture',c,gen_random_uuid(),'{"format":1,"events":[],"version":"unknown","code":"manual","copies":[{"source":"local","facts":[]}]}');raise exception 'revoked upload';exception when insufficient_privilege then null;end;
 assert public.lumen_support(auth.uid(),'activate')->>'id'<>c::text,'new opt-in gets new reference';
end $$;
reset role;
do $$begin
 assert (select count(*) from lumen_commands.support_contents)=0,'revocation removes actual payload';
 update lumen_commands.support_cases set activated_at=now()-interval '8 days',expires_at=now()-interval '7 days';
 assert lumen_commands.prune_support()=2;
 assert (select count(*) from lumen_commands.support_cases)=0;
 assert (select relrowsecurity from pg_class where oid='lumen_commands.support_contents'::regclass);
 assert position('prune_support' in pg_get_functiondef('lumen_commands.prune_sync_observations()'::regprocedure))>0;
end $$;
