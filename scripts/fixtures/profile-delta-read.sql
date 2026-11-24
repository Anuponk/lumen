-- Disposable PostgreSQL only; never execute against player data.
-- #1000 lot 2: the delta rebuilds the stored profile from the client's base.
do $$
declare uid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();base jsonb;cur jsonb;r jsonb;p jsonb;
begin
 insert into auth.users values(uid),(other);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 base:='{"xp":3,"shards":1,"solved":{"1":1,"2":1},"performances":{"1":{"a":1},"2":{"b":2}},"badges":{},"gone":true,"é":"😀"}';
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"xp":28,"shards":1,"solved":{"1":1,"2":1,"3":1},"performances":{"1":{"a":1},"3":{"c":3}},"badges":"replaced","new":[1,2],"é":"😀"}');
 select payload into cur from lumen.profile_snapshots where user_id=uid;
 r:=public.lumen_profile_delta(uid,base);
 assert r->>'sha256'=encode(sha256(convert_to(cur::text,'UTF8')),'hex'),'digest of the stored text';
 p:=r->'patch';
 assert p @> '[{"op":"set","path":["xp"],"value":28}]','scalar change';
 assert p @> '[{"op":"set","path":["solved","3"],"value":1}]','second-level addition';
 assert p @> '[{"op":"remove","path":["performances","2"]}]','second-level removal';
 assert p @> '[{"op":"set","path":["performances","3"],"value":{"c":3}}]';
 assert p @> '[{"op":"set","path":["badges"],"value":"replaced"}]','type change replaces the key';
 assert p @> '[{"op":"remove","path":["gone"]}]' and p @> '[{"op":"set","path":["new"],"value":[1,2]}]';
 assert not (p @> '[{"path":["shards"]}]') and not (p @> '[{"path":["solved","1"]}]'),'unchanged entries are not sent';
 assert jsonb_array_length(public.lumen_profile_delta(uid,cur)->'patch')=0,'identical base: empty delta';
 begin perform public.lumen_profile_delta(other,base);raise exception 'other account accepted';
 exception when insufficient_privilege then null;end;
 begin perform public.lumen_profile_delta(uid,'[1]'::jsonb);raise exception 'non-object base accepted';
 exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_profile_delta(uid,base);raise exception 'anonymous accepted';
 exception when insufficient_privilege then null;end;
 assert not has_function_privilege('anon','public.lumen_profile_delta(uuid,jsonb)','execute');
 assert has_function_privilege('authenticated','public.lumen_profile_delta(uuid,jsonb)','execute');
 assert not has_function_privilege('authenticated','lumen_commands.profile_delta(jsonb,jsonb)','execute');
end $$;
