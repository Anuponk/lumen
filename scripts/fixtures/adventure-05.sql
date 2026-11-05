-- Disposable PostgreSQL only. No live account identifiers.
do $test$
declare uid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();q text;f jsonb;r jsonb;saved jsonb;
begin
 assert (select count(*) from lumen_commands.quest_rules where (rules->>'ordinal')::integer>400)=100,'Exactly 100 appended rules';
 assert (select max((rules->>'ordinal')::integer) from lumen_commands.quest_rules)=500,'Contiguous appended tail';
 insert into auth.users values(uid),(other);
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"catalogueOrigin":2,"solved":{"0":1},"badges":{},"stars":{},"performances":{},"canonicalQuestState":{},"challenges":{},"xp":42,"shards":7,"future":{"keep":true}}');
 insert into lumen.profile_snapshots(user_id,payload) values(other,'{"solved":{},"badges":{}}');
 assert (select payload->>'catalogueOrigin' from lumen.profile_snapshots where user_id=other)='3','New empty account gets current origin';
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.lumen_commit_wallet_command('wallet-establish-v1',uid,'{"kind":"establish"}');
 select quest_id into q from lumen_commands.quest_rules where (rules->>'ordinal')::integer=401;
 f:='{"seconds":70,"assistanceUsed":false,"hintUsed":false,"mistakeCommitted":false,"qualifying":true,"challengeFailed":false,"qualifiedDay":"2026-11-04","qualifiedAt":"2026-11-04T12:00:00.000Z"}';
 r:=public.lumen_commit_quest_command('adventure05-first',uid,q,f);saved:=r->'profile';
 assert saved->'canonicalQuestState'->q->'solved'='true','Real appended command grants the stable quest';
 assert saved->'canonicalQuestState'->q->'runPerformance'->'bestUnassistedTime'='70','Records apply to the new pack';
 assert saved->'solved'='{"0":1}' and saved->'future'='{"keep":true}','Old progress and unknown metadata preserved';
 assert saved->>'catalogueOrigin'='2','Existing cohort never rewritten';
 assert public.lumen_commit_quest_command('adventure05-first',uid,q,f)->'profile'=saved,'Same receipt grants once';
 r:=public.lumen_commit_quest_command('adventure05-replay',uid,q,f||'{"seconds":60,"qualifying":false}');
 assert r->'profile'->'xp'=saved->'xp' and r->'profile'->'shards'=saved->'shards','Replay cannot grant again';
 assert r->'profile'->'canonicalQuestState'->q->'runPerformance'->'bestTime'='60','Replay can improve time';
 assert (select count(*) from lumen.canonical_reward_events where user_id=uid and quest_id=q)=1,'Single ledger grant';
 begin
  perform public.lumen_commit_quest_command('adventure05-wrong-user',other,q,f);
  raise exception 'Wrong account accepted';
 exception when insufficient_privilege then null;end;
 begin
  update lumen.profile_snapshots set payload=jsonb_set(payload,'{catalogueOrigin}','3') where user_id=uid;
  raise exception 'Existing cohort rewritten';
 exception when check_violation then null;end;
end $test$;
