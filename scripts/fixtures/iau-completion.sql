-- Disposable PostgreSQL only; synthetic accounts, no production data.
do $test$
declare uid uuid:=gen_random_uuid(); fresh uuid:=gen_random_uuid(); q text; f jsonb; r jsonb; saved jsonb;
begin
 assert (select count(*) from lumen_commands.quest_rules)=880,'Complete catalogue';
 assert (select count(*) from lumen_commands.quest_rules where (rules->>'ordinal')::integer>500)=380,'380 appended contracts';
 assert (select count(*) from lumen_commands.quest_rules where quest_id like 'pack-real-adventure-09-%')=80,'Eight-constellation finale';
 insert into auth.users values(uid),(fresh);
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"catalogueOrigin":3,"solved":{"0":1},"canonicalQuestState":{"pack-real-adventure-05-q100":{"solved":true,"stars":3}},"badges":{},"stars":{},"performances":{},"challenges":{},"xp":42,"shards":7,"future":{"keep":true}}');
 insert into lumen.profile_snapshots(user_id,payload) values(fresh,'{"solved":{}}');
 assert (select payload->>'catalogueOrigin' from lumen.profile_snapshots where user_id=fresh)='4','New cohort is revision 4';
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.lumen_commit_wallet_command('wallet-establish-v1',uid,'{"kind":"establish"}');
 f:='{"seconds":70,"assistanceUsed":false,"hintUsed":false,"mistakeCommitted":false,"qualifying":true,"challengeFailed":false,"qualifiedDay":"2026-11-06","qualifiedAt":"2026-11-06T12:00:00.000Z"}';
 for q in select quest_id from lumen_commands.quest_rules where (rules->>'ordinal')::integer>500 order by (rules->>'ordinal')::integer loop
  r:=public.lumen_commit_quest_command('iau88-offline-'||q,uid,q,f); saved:=r->'profile';
  assert saved->'canonicalQuestState'->q->'solved'='true','New win persisted';
  assert saved->>'catalogueOrigin'='3','Historical cohort preserved';
  assert saved->'solved'='{"0":1}' and saved->'future'='{"keep":true}','Historical data preserved';
  assert saved->'canonicalQuestState'->'pack-real-adventure-05-q100'='{"solved":true,"stars":3}','Historical rewards preserved';
  assert public.lumen_commit_quest_command('iau88-offline-'||q,uid,q,f)->'profile'=saved,'Retry same offline receipt is idempotent';
  r:=public.lumen_commit_quest_command('iau88-other-device-'||q,uid,q,f);
  assert r->'profile'->'xp'=saved->'xp' and r->'profile'->'shards'=saved->'shards','Second device cannot duplicate reward';
 end loop;
 assert (select count(*) from lumen.canonical_reward_events where user_id=uid)=380,'Exactly 380 grants';
 begin
  update lumen.profile_snapshots set payload=jsonb_set(payload,'{catalogueOrigin}','4') where user_id=uid;
  raise exception 'Historical origin rewritten';
 exception when check_violation then null;end;
end $test$;
