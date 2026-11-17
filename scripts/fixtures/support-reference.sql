-- Disposable users only. The entire fixture rolls back; never run on production.
begin;
do $$declare player uuid:=gen_random_uuid(); admin uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); c jsonb; p jsonb:='{"format":1,"events":[],"version":"unknown","code":"manual","copies":[{"source":"local","facts":[]}]}';begin
 insert into auth.users(id) values(player),(admin),(other);
 insert into lumen.internal_capabilities(user_id,capability) values(admin,'analytics_cockpit');
 update lumen_commands.support_control set enabled=true;
 perform set_config('test.support_player',player::text,true);
 perform set_config('test.support_admin',admin::text,true);
 perform set_config('test.support_other',other::text,true);
 perform set_config('request.jwt.claim.sub',player::text,true);
 c:=public.lumen_support(player,'activate');
 perform set_config('test.support_reference',c->>'id',true);
 perform public.lumen_support(player,'capture',(c->>'id')::uuid,gen_random_uuid(),p);
 update lumen_commands.support_cases set expires_at=clock_timestamp()-interval '1 second' where id=(c->>'id')::uuid;
 c:=public.lumen_support(player,'activate');
 assert c->>'id'<>current_setting('test.support_reference'),'A newer dossier exists';
end $$;
set local role authenticated;
do $$declare r jsonb; ref uuid:=current_setting('test.support_reference')::uuid;begin
 perform set_config('request.jwt.claim.sub',current_setting('test.support_other'),true);
 begin perform public.lumen_support(auth.uid(),'list',ref);raise exception 'Non-admin reference lookup accepted';exception when insufficient_privilege then null;end;
 begin perform public.lumen_support(auth.uid(),'download',ref);raise exception 'Non-admin download accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('test.support_admin'),true);
 r:=public.lumen_support(auth.uid(),'list',ref);
 assert r->>'id'=ref::text and jsonb_array_length(r->'captures')=1,'Exact older reference, not latest dossier';
 r:=public.lumen_support(auth.uid(),'download',ref);
 assert r->>'reference'=ref::text and jsonb_array_length(r->'captures')=1;
 assert r->'captures'->0->>'sha256'=encode(sha256(convert_to(r->'captures'->0->>'content','UTF8')),'hex');
 begin perform public.lumen_support(auth.uid(),'list',ref,null,null,current_setting('test.support_other')::uuid);raise exception 'Mismatched owner accepted';exception when insufficient_privilege then null;end;
 begin perform public.lumen_support(auth.uid(),'list',gen_random_uuid());raise exception 'Unknown reference accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$begin
 assert (select count(*)>=2 from lumen_commands.support_access where case_id=current_setting('test.support_reference')::uuid),'Lookup and download audited';
 update lumen.internal_capabilities set expires_at=clock_timestamp()-interval '1 second' where user_id=current_setting('test.support_admin')::uuid;
end $$;
set local role authenticated;
do $$begin
 begin perform public.lumen_support(auth.uid(),'list',current_setting('test.support_reference')::uuid);raise exception 'Expired capability accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
update lumen.internal_capabilities set expires_at=null where user_id=current_setting('test.support_admin')::uuid;
update lumen_commands.support_cases set revoked_at=clock_timestamp() where id=current_setting('test.support_reference')::uuid;
set local role authenticated;
do $$begin
 begin perform public.lumen_support(auth.uid(),'download',current_setting('test.support_reference')::uuid);raise exception 'Revoked content returned';exception when insufficient_privilege then null;end;
end $$;
reset role;
update lumen_commands.support_cases set activated_at=clock_timestamp()-interval '8 days' where id=current_setting('test.support_reference')::uuid;
set local role authenticated;
do $$begin
 begin perform public.lumen_support(auth.uid(),'list',current_setting('test.support_reference')::uuid);raise exception 'Expired reference returned';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
