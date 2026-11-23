-- Disposable PostgreSQL only; never execute against player data.
-- #1000: the read digest equals the hash of the restored profile text.
do $$
declare uid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();r jsonb;
begin
 insert into auth.users values(uid),(other);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 r:=public.lumen_profile_digest(uid);
 assert r='{"version":1,"sha256":null}'::jsonb,'no profile: null digest';
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"xp":3,"shards":0,"solved":{"1":1},"badges":{},"stars":{},"challenges":{},"performances":{},"canonicalQuestState":{},"é":"😀"}');
 r:=public.lumen_profile_digest(uid);
 assert r->>'sha256'=encode(sha256(convert_to(public.lumen_restore_profile()::text,'UTF8')),'hex'),'digest of the restored text';
 assert r->>'sha256' ~ '^[0-9a-f]{64}$';
 begin
  perform public.lumen_profile_digest(other);raise exception 'other account accepted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.lumen_profile_digest(uid);raise exception 'anonymous accepted';
 exception when insufficient_privilege then null;end;
 assert not has_function_privilege('anon','public.lumen_profile_digest(uuid)','execute');
 assert has_function_privilege('authenticated','public.lumen_profile_digest(uuid)','execute');
end $$;
