-- Disposable PostgreSQL only; synthetic accounts. #724 admin Adventure access.
insert into auth.users(id) values('00000000-0000-0000-0000-000000072401'),('00000000-0000-0000-0000-000000072402'),
 ('00000000-0000-0000-0000-000000072403'),('00000000-0000-0000-0000-000000072404');
insert into lumen.internal_capabilities(user_id,capability) values('00000000-0000-0000-0000-000000072403','analytics_cockpit');
insert into lumen.internal_capabilities(user_id,capability,expires_at) values('00000000-0000-0000-0000-000000072404','analytics_cockpit',now()-interval '1 day');

-- An ordinary player, or an administrator whose capability expired, can neither read nor change access.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000072401';
set role authenticated;
do $$begin
 assert not has_table_privilege('authenticated','lumen_commands.adventure_access_audit','SELECT'),'audit is private';
 assert not has_function_privilege('anon','public.lumen_admin_adventure_access(uuid,text,uuid,text,text)','EXECUTE'),'anon cannot call';
 begin perform public.lumen_admin_adventure_access(auth.uid(),'grant','00000000-0000-0000-0000-000000072402','real-adventure-02','beta test');
  raise exception 'player granted access';exception when insufficient_privilege then null;end;
 begin perform public.lumen_admin_adventure_access(auth.uid(),'grant',auth.uid(),'real-adventure-02','self grant');
  raise exception 'player granted itself';exception when insufficient_privilege then null;end;
 begin perform public.lumen_admin_adventure_access(auth.uid(),'list','00000000-0000-0000-0000-000000072402');
  raise exception 'player listed access';exception when insufficient_privilege then null;end;
end $$;
reset role;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000072404';
set role authenticated;
do $$begin
 begin perform public.lumen_admin_adventure_access(auth.uid(),'list','00000000-0000-0000-0000-000000072402');
  raise exception 'expired capability accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;

set request.jwt.claim.sub='00000000-0000-0000-0000-000000072403';
set role authenticated;
do $$declare r jsonb;t uuid:='00000000-0000-0000-0000-000000072402';bad text;begin
 begin perform public.lumen_admin_adventure_access('00000000-0000-0000-0000-000000072401','list',t);
  raise exception 'expected account mismatch accepted';exception when insufficient_privilege then null;end;
 begin perform public.lumen_admin_adventure_access(auth.uid(),'delete',t,'real-adventure-02','beta test');
  raise exception 'unknown action accepted';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_admin_adventure_access(auth.uid(),'grant',gen_random_uuid(),'real-adventure-02','beta test');
  raise exception 'unknown player accepted';exception when invalid_parameter_value then null;end;
 foreach bad in array array['base-real-sky','real-adventure-01','real-adventure-2','real-adventure-02;drop','unlimited_shards'] loop
  begin perform public.lumen_admin_adventure_access(auth.uid(),'grant',t,bad,'beta test');
   raise exception 'invalid adventure accepted: %',bad;exception when invalid_parameter_value then null;end;
 end loop;
 foreach bad in array array['','   ','ab',repeat('x',201)] loop
  begin perform public.lumen_admin_adventure_access(auth.uid(),'grant',t,'real-adventure-02',bad);
   raise exception 'invalid reason accepted';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.lumen_admin_adventure_access(auth.uid(),'grant',t,'real-adventure-02',null);
  raise exception 'missing reason accepted';exception when invalid_parameter_value then null;end;

 r:=public.lumen_admin_adventure_access(auth.uid(),'list',t);
 assert r->'adventures'='[]'::jsonb and r->'history'='[]'::jsonb and (r->>'changed')::boolean=false,'empty list';
 r:=public.lumen_admin_adventure_access(auth.uid(),'grant',t,'real-adventure-02','  bêta-test  ');
 assert (r->>'changed')::boolean,'grant changes';
 assert r->'adventures'->0->>'adventure'='real-adventure-02' and (r->'adventures'->0->>'active')::boolean and r->'adventures'->0->>'source'='admin','grant is active';
 assert r->'history'->0->>'reason'='bêta-test','reason is trimmed';
 r:=public.lumen_admin_adventure_access(auth.uid(),'grant',t,'real-adventure-02','retry');
 assert not (r->>'changed')::boolean and jsonb_array_length(r->'history')=1,'grant retry is idempotent and not audited';
 r:=public.lumen_admin_adventure_access(auth.uid(),'revoke',t,'real-adventure-02','fin du test');
 assert (r->>'changed')::boolean and not (r->'adventures'->0->>'active')::boolean,'revoke expires access';
 r:=public.lumen_admin_adventure_access(auth.uid(),'revoke',t,'real-adventure-02','retry');
 assert not (r->>'changed')::boolean and jsonb_array_length(r->'history')=2,'revoke retry is idempotent';
 r:=public.lumen_admin_adventure_access(auth.uid(),'grant',t,'real-adventure-02','de retour');
 assert (r->>'changed')::boolean and (r->'adventures'->0->>'active')::boolean,'re-grant restores access';
 assert r->'history'->0->>'action'='grant' and r->'history'->1->>'action'='revoke' and jsonb_array_length(r->'history')=3,'history newest first';
 r:=public.lumen_admin_adventure_access(auth.uid(),'grant',t,'real-adventure-09','aventure 9');
 assert jsonb_array_length(r->'adventures')=2,'several adventures';
end $$;
reset role;

do $$begin
 assert (select count(*) from lumen.entitlements where user_id='00000000-0000-0000-0000-000000072402' and (expires_at is null or expires_at>now()))=2,'player owns two active adventures';
 assert (select count(*) from lumen_commands.adventure_access_audit where actor='00000000-0000-0000-0000-000000072403')=4,'
 assert not exists(select 1 from lumen.entitlements where user_id='00000000-0000-0000-0000-000000072401'),'refused calls wrote nothing';
 assert exists(select 1 from lumen_privacy.policy() where ns='lumen_commands' and rel='adventure_access_audit' and action='delete'),'audit is in the erasure policy';
end $$;
