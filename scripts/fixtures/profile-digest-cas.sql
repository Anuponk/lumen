-- Disposable PostgreSQL only; never execute against player data.
-- Digest CAS: an exact digest runs the usual CAS; any mismatch writes nothing.
do $$
declare uid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();base jsonb;next jsonb;r jsonb;digest text;
begin
 insert into auth.users values(uid),(other);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"xp":0,"shards":0,"solved":{},"badges":{},"stars":{},"challenges":{},"performances":{},"canonicalQuestState":{}}');
 select payload into base from lumen.profile_snapshots where user_id=uid;
 digest:=encode(sha256(convert_to(base::text,'UTF8')),'hex');
 next:=base||'{"future":{"keep":true}}';
 r:=public.lumen_cas_profile_digest(repeat('0',64),next,uid);
 assert r='{"version":1,"matched":false,"applied":false}'::jsonb,'a wrong digest is a mismatch';
 assert (select payload=base from lumen.profile_snapshots where user_id=uid),'a mismatch writes nothing';
 r:=public.lumen_cas_profile_digest(digest,next,uid);
 assert r->>'matched'='true' and r->>'applied'='true','the exact digest applies the usual CAS';
 assert (select payload->'future'->>'keep'='true' from lumen.profile_snapshots where user_id=uid);
 r:=public.lumen_cas_profile_digest(digest,base,uid);
 assert r->>'matched'='false','a stale digest after another write is refused';
 begin
  perform public.lumen_cas_profile_digest(digest,next,other);raise exception 'other account accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.lumen_cas_profile_digest('not-a-digest',next,uid);raise exception 'invalid digest accepted';
 exception when invalid_parameter_value then null;end;
 -- The usual guards still apply (size ceiling through lumen_cas_profile).
 select payload into base from lumen.profile_snapshots where user_id=uid;
 begin
  perform public.lumen_cas_profile_digest(encode(sha256(convert_to(base::text,'UTF8')),'hex'),base||jsonb_build_object('huge',repeat('x',1100000)),uid);
  raise exception 'oversized profile accepted';
 exception when raise_exception then if sqlerrm<>'invalid Lumen profile' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.lumen_cas_profile_digest(digest,next,uid);raise exception 'anonymous accepted';
 exception when insufficient_privilege then null;end;
 assert not has_function_privilege('anon','public.lumen_cas_profile_digest(text,jsonb,uuid)','execute');
 assert has_function_privilege('authenticated','public.lumen_cas_profile_digest(text,jsonb,uuid)','execute');
end $$;
