-- Disposable QA users only. Never run this fixture against player data.
do $test$
declare uid uuid; q text; idx integer; f jsonb; result jsonb; rec jsonb; saved jsonb; money jsonb; n integer; is_legacy boolean;
begin
 assert lumen_commands.personal_record_min('"2"','-1') is null,'Invalid times are not records';
 assert lumen_commands.personal_record_min('0','40')='0','Zero remains a valid elapsed time';
 assert lumen_commands.recover_performance('{"bestTime":20,"bestUnassistedTime":80}','{"bestTime":30,"bestUnassistedTime":50,"future":true}')->'bestUnassistedTime'='50','Independent unassisted minimum';
 assert lumen_commands.recover_performance('{"badges":{"autonomy":true}}','{}')->'bestUnassistedTime' is null,'No historical inference';
 for n in 1..2 loop
  is_legacy:=n=1;uid:=gen_random_uuid();insert into auth.users values(uid);
  if is_legacy then select quest_id,legacy_index into q,idx from lumen_commands.legacy_rules order by legacy_index limit 1;
  else select quest_id into q from lumen_commands.quest_rules where legacy_index is null order by quest_id limit 1;end if;
  insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"solved":{},"badges":{},"stars":{},"performances":{},"challenges":{},"canonicalQuestState":{},"xp":0,"shards":7,"future":true}');
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform public.lumen_commit_wallet_command('wallet-establish-v1',uid,'{"kind":"establish"}');
  f:=jsonb_build_object('seconds',100,'assistanceUsed',true,'hintUsed',true,'mistakeCommitted',false,'qualifying',false,'challengeFailed',true,'qualifiedDay','2026-11-04','qualifiedAt','2026-11-04T10:00:00.000Z');
  result:=public.lumen_commit_quest_command('records-assisted',uid,q,f);
  if is_legacy then rec:=result->'profile'->'performances'->idx::text;else rec:=result->'profile'->'canonicalQuestState'->q->'runPerformance';end if;
  assert rec->'bestTime'='100' and not(rec ? 'bestUnassistedTime'),'Assisted first completion has no unassisted record';
  money:=jsonb_build_object('xp',result->'profile'->'xp','shards',result->'profile'->'shards');
  f:=f||'{"seconds":80,"assistanceUsed":false,"hintUsed":false,"mistakeCommitted":true}';
  result:=public.lumen_commit_quest_command('records-unassisted',uid,q,f);
  if is_legacy then rec:=result->'profile'->'performances'->idx::text;else rec:=result->'profile'->'canonicalQuestState'->q->'runPerformance';end if;
  assert rec->'bestTime'='80' and rec->'bestUnassistedTime'='80','Non-qualifying, imperfect run establishes both records';
  assert jsonb_build_object('xp',result->'profile'->'xp','shards',result->'profile'->'shards')=money,'Records award no extra money';
  assert not exists(select 1 from jsonb_each(rec->'badges') where value='true'),'Record does not qualify badges';
  saved:=result->'profile';
  assert public.lumen_commit_quest_command('records-unassisted',uid,q,f)->'profile'=saved,'Idempotent receipt';
  result:=public.lumen_commit_quest_command('records-fast-assisted',uid,q,f||'{"seconds":40,"assistanceUsed":true}');
  if is_legacy then rec:=result->'profile'->'performances'->idx::text;else rec:=result->'profile'->'canonicalQuestState'->q->'runPerformance';end if;
  assert rec->'bestTime'='40' and rec->'bestUnassistedTime'='80','Faster assisted run preserves independent minimum';
  assert result->'profile'->'future'='true','Unknown metadata survives';
 end loop;
end $test$;
