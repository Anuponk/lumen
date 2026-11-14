-- Disposable PostgreSQL only. Current clients remain valid during preparation.
do $$
declare uid uuid:='64300000-0000-0000-0000-000000000001';q text:='pack-real-adventure-05-q004';f jsonb;link uuid;
begin
 assert (select grid_revision=1 from lumen_commands.quest_rules where quest_id=q);
 assert not exists(select 1 from lumen_commands.quest_rules where grid_revision>1),'DDL does not activate new grids';
 insert into auth.users values(uid);
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"xp":42,"shards":7,"autonomousWins":2,"solved":{},"badges":{},"stars":{},"challenges":{},"performances":{},"canonicalQuestState":{},"future":{"mixedFixture":true}}');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.lumen_commit_wallet_command('wallet-establish-v1',uid,'{"kind":"establish"}');
 f:=jsonb_build_object('seconds',15,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,'hintUsed',false,'challengeFailed',true,'qualifiedDay',(now() at time zone 'Europe/Paris')::date::text,'qualifiedAt',clock_timestamp());
 perform public.lumen_commit_quest_command('first-v1',uid,q,f);
 perform public.lumen_commit_quest_command('unchanged-v1',uid,'pack-real-adventure-05-q001',f);
 perform public.lumen_commit_quest_command('protected-original',uid,'base-q001',f||'{"assistanceUsed":true,"hintUsed":true}');
 perform lumen_commands.reset_replaced_quests(uid,jsonb_build_object(q,'real-adventure-05'));
 f:=f||jsonb_build_object('seconds',20,'qualifiedAt',clock_timestamp());
 perform public.lumen_commit_quest_command('qr1.after-first-reset',uid,q,f);
 select challenge_id into link from public.lumen_create_quest_challenge_v2(null,'Historical source',q,20,true,true,true,false,true,1);
 assert (select grid_revision=1 from lumen.social_challenges where id=link);
end $$;
