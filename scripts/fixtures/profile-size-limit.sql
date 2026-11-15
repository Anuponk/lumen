-- Disposable PostgreSQL only; never execute against player data.
-- Profiles up to 1 MiB are accepted; above it the existing refusal remains.
do $$
declare uid uuid:=gen_random_uuid();base jsonb;big jsonb;huge jsonb;current jsonb;
begin
 assert not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','lumen_commands') and p.prosrc like '%524288%' and p.proname<>'validate_support'),'no 512 KiB profile ceiling remains';
 assert exists(select 1 from pg_proc where proname='validate_support' and prosrc like '%524288%') or not exists(select 1 from pg_proc where proname='validate_support'),'support captures keep their own limit';
 assert (select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='lumen_cas_profile' and pronargs=2),'SECURITY DEFINER preserved';
 assert has_function_privilege('authenticated','public.lumen_cas_profile(jsonb,jsonb)','execute'),'grants preserved';
 insert into auth.users values(uid);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 base:='{"xp":0,"shards":0,"solved":{},"badges":{},"stars":{},"challenges":{},"performances":{},"canonicalQuestState":{}}';
 insert into lumen.profile_snapshots(user_id,payload) values(uid,base);
 big:=base||jsonb_build_object('future',repeat('x',700000));
 assert public.lumen_cas_profile(base,big),'a 700 KB profile is accepted';
 select payload into current from lumen.profile_snapshots where user_id=uid;
 assert current=big;
 huge:=base||jsonb_build_object('future',repeat('x',1100000));
 begin
  perform public.lumen_cas_profile(big,huge);raise exception 'oversized profile accepted';
 exception when raise_exception then if sqlerrm<>'invalid Lumen profile' then raise;end if;end;
 assert (select payload=big from lumen.profile_snapshots where user_id=uid),'a refused write changes nothing';
end $$;
