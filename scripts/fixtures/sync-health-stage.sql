-- Disposable PostgreSQL only; never execute against player data.
-- #711: a failed hydration keeps its stage (fixed list); other outcomes stay unknown.
do $$
declare uid uuid:=gen_random_uuid();
begin
 insert into auth.users values(uid);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.lumen_record_sync_health('hydration_failed','storage_quota','owner_backup','1.11.1+614');
 assert (select outcome='owner_backup' and reason='storage_quota' from public.lumen_sync_health where user_id=uid order by recorded_at desc,id desc limit 1),'stage and fine reason are kept';
 perform public.lumen_record_sync_health('hydration_failed','not-a-reason','free text stage','1.11.1+614');
 assert (select outcome='unknown' and reason='unknown' from public.lumen_sync_health where user_id=uid order by recorded_at desc,id desc limit 1),'free text is never stored';
end $$;
