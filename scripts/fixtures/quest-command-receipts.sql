-- Disposable PostgreSQL only; never execute against player data.
create function lumen_commands.fixture_quest_receipt_failure() returns trigger language plpgsql as $$
begin if new.operation_id='quest-rollback' then raise exception 'simulated receipt failure';end if;return new;end $$;
create trigger fixture_quest_receipt_failure before insert on lumen_commands.canonical_receipts
 for each row execute function lumen_commands.fixture_quest_receipt_failure();
do $$
declare uid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();q text;q2 text;q3 text;f jsonb;r jsonb;before_profile jsonb;latest jsonb;counter integer;
begin
 insert into auth.users values(uid),(other);
 select quest_id into q from lumen_commands.quest_rules where legacy_index is null order by (rules->>'ordinal')::integer limit 1;
 select quest_id into q2 from lumen_commands.quest_rules where legacy_index is null and quest_id<>q order by (rules->>'ordinal')::integer limit 1;
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"xp":42,"shards":7,"autonomousWins":2,"solved":{},"badges":{},"stars":{},"challenges":{},"performances":{},"canonicalQuestState":{},"future":{"keep":true}}');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.lumen_commit_wallet_command('wallet-establish-v1',uid,'{"kind":"establish"}');
 f:=jsonb_build_object('seconds',45,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,'hintUsed',false,'challengeFailed',false,'qualifiedDay','2026-10-22','qualifiedAt','2026-10-22T10:00:00.000Z');
 select payload into before_profile from lumen.profile_snapshots where user_id=uid;
 begin
  perform public.lumen_commit_quest_command('quest-rollback',uid,q,f);raise exception 'receipt rollback was accepted';
 exception when raise_exception then if sqlerrm<>'simulated receipt failure' then raise;end if;end;
 assert (select payload=before_profile from lumen.profile_snapshots where user_id=uid),'receipt failure rolls back snapshot';
 assert not exists(select 1 from lumen_commands.quest_run_authority where user_id=uid),'receipt failure rolls back run authority';
 assert not exists(select 1 from lumen.canonical_reward_events where user_id=uid),'receipt failure rolls back first-win ledger';
 assert not exists(select 1 from lumen.daily_progress where user_id=uid),'receipt failure rolls back daily';
 r:=public.lumen_commit_quest_command('first',uid,q,f);
 assert r->'profile'->>'xp'='57' and r->'profile'->>'shards'='8';
 assert r->'profile'->>'autonomousWins'='3';
 assert r->'outcome'->>'autonomyShard'='1';
 assert (r->'profile'->>'walletRevision')::integer>(before_profile->>'walletRevision')::integer;
 assert (select count(*)=1 from lumen.daily_progress where user_id=uid and stable_quest_id=q and puzzle_id is null),'stable daily identity retained';
 perform public.lumen_commit_quest_command('second',uid,q2,f);
 select payload into latest from lumen.profile_snapshots where user_id=uid;
 assert public.lumen_commit_quest_command('first',uid,q,f)->'profile'=latest,'retry returns current profile';
 assert public.lumen_get_quest_command('first',uid)->'outcome'=r->'outcome','receipt is immutable';
 assert (select count(*)=1 from lumen.daily_progress where user_id=uid),'one daily activity across quests';
 begin perform public.lumen_commit_quest_command('first',uid,q,f||'{"seconds":46}');raise exception 'changed evidence accepted';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_commit_quest_command('wrong-account',other,q,f);raise exception 'wrong account accepted';exception when insufficient_privilege then null;end;
 begin perform public.lumen_commit_quest_command('invalid',uid,q,f||'{"seconds":-1}');raise exception 'invalid time accepted';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_commit_quest_command('unknown',uid,'missing-quest',f);raise exception 'unknown quest accepted';exception when invalid_parameter_value then null;end;
 begin
  update lumen.profile_snapshots set payload=jsonb_set(payload,array['canonicalQuestState',q,'runPerformance','attempts'],'999') where user_id=uid;
  raise exception 'forged summary accepted';
 exception when check_violation then null;end;
 begin
  update lumen.profile_snapshots set payload=jsonb_set(payload,array['canonicalQuestState',q,'performance','seconds'],'1') where user_id=uid;
  raise exception 'first completion overwritten';
 exception when check_violation then null;end;
 assert (select payload=latest from lumen.profile_snapshots where user_id=uid),'rejected writes preserve originals';
 select quest_id into q3 from lumen_commands.quest_rules where legacy_index is null and quest_id not in(q,q2) order by (rules->>'ordinal')::integer limit 1;
 perform public.lumen_commit_quest_command('compat-first',uid,q3,f||'{"assistanceUsed":true,"qualifying":false}');
 select payload into before_profile from lumen.profile_snapshots where user_id=uid;
 perform public.lumen_commit_canonical_command('old-pending-replay',uid,q3,'{"speed":true}','{"seconds":20}');
 select payload into latest from lumen.profile_snapshots where user_id=uid;
 assert latest->'canonicalQuestState'->q3->'badges'->'speed'='true','captured V1 badge replay remains recoverable';
 assert latest->'canonicalQuestState'->q3->'runPerformance'=before_profile->'canonicalQuestState'->q3->'runPerformance','V1 never changes V2 run statistics';
 assert latest->'xp'=before_profile->'xp' and latest->'shards'=before_profile->'shards','V1 recovery never repeats rewards';
 assert not has_function_privilege('anon','public.lumen_commit_quest_command(text,uuid,text,jsonb)','EXECUTE');
 assert not has_function_privilege('authenticated','lumen_commands.claim_quest_daily(integer,text)','EXECUTE');
 assert not has_table_privilege('authenticated','lumen_commands.quest_run_authority','SELECT');
 perform set_config('request.jwt.claim.sub',other::text,true);
 assert public.lumen_get_quest_command('first',other) is null,'other account cannot read receipt';
 insert into lumen.profile_snapshots(user_id,payload) values(other,'{"solved":{},"badges":{},"xp":0,"shards":3}');
 perform public.lumen_commit_quest_command('slow-autonomous',other,q,f||'{"seconds":80}');
 perform public.lumen_commit_quest_command('fast-assisted',other,q,f||'{"seconds":20,"assistanceUsed":true,"qualifiedAt":"2026-10-22T10:16:00Z"}');
 select payload into latest from lumen.profile_snapshots where user_id=other;
 assert latest->'canonicalQuestState'->q->'badges'->'autonomy'='true' and latest->'canonicalQuestState'->q->'badges'->'speed'='true';
 assert latest->'canonicalQuestState'->q->'badges'->'mastery'='false','separate runs never manufacture Mastery';
 assert latest->'canonicalQuestState'->q->'performance'->>'seconds'='80','first completion performance stays immutable';
 assert latest->'canonicalQuestState'->q->'runPerformance'->>'bestTime'='20';
end $$;
