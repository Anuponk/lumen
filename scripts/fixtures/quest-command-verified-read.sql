-- Disposable PostgreSQL only; never execute against player data.
-- #697: the combined verification read equals the two independent reads.
do $$
declare uid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();q text;f jsonb;v jsonb;before_profile jsonb;
begin
 insert into auth.users values(uid),(other);
 select quest_id into q from lumen_commands.quest_rules where legacy_index is null order by (rules->>'ordinal')::integer limit 1;
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"xp":42,"shards":7,"autonomousWins":2,"solved":{},"badges":{},"stars":{},"challenges":{},"performances":{},"canonicalQuestState":{},"future":{"keep":true}}');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.lumen_commit_wallet_command('wallet-establish-v1',uid,'{"kind":"establish"}');
 f:=jsonb_build_object('seconds',45,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,'hintUsed',false,'challengeFailed',false,'qualifiedDay','2026-10-22','qualifiedAt','2026-10-22T10:00:00.000Z');
 select payload into before_profile from lumen.profile_snapshots where user_id=uid;
 v:=public.lumen_get_quest_command_verified('verified-read',uid);
 assert v='{"version":1,"receipt":null,"profile":null}'::jsonb,'missing receipt returns no profile';
 assert (select payload=before_profile from lumen.profile_snapshots where user_id=uid),'verified read never writes';
 perform public.lumen_commit_quest_command('verified-read',uid,q,f);
 v:=public.lumen_get_quest_command_verified('verified-read',uid);
 assert v->>'version'='1';
 assert v->'receipt'=public.lumen_get_quest_command('verified-read',uid),'receipt equals the independent receipt read';
 assert v->'profile'=public.lumen_restore_profile(uid),'profile equals the independent profile read';
 assert v->'profile'->'canonicalQuestState'->q->>'solved' in ('true','1'),'profile reflects the committed command';
 assert v->'profile'->'future'->>'keep'='true','unknown fields survive';
 begin
  perform public.lumen_get_quest_command_verified('verified-read',other);raise exception 'other account accepted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',other::text,true);
 assert public.lumen_get_quest_command_verified('verified-read',other)='{"version":1,"receipt":null,"profile":null}'::jsonb,'another account never sees this receipt';
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.lumen_get_quest_command_verified('verified-read',uid);raise exception 'anonymous read accepted';
 exception when insufficient_privilege then null;end;
end $$;
do $$
begin
 assert not has_function_privilege('anon','public.lumen_get_quest_command_verified(text,uuid)','execute'),'anon cannot read';
 assert has_function_privilege('authenticated','public.lumen_get_quest_command_verified(text,uuid)','execute'),'players can read';
end $$;
