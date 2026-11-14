-- Disposable PostgreSQL only; synthetic accounts, no production identifiers.
do $$
declare uid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();q text;q2 text;q3 text;scope jsonb;f jsonb;
 before_profile jsonb;after_profile jsonb;other_profile jsonb;r jsonb;first_receipt jsonb;events bigint;
begin
 insert into auth.users values(uid),(other);
 select quest_id into q from lumen_commands.quest_rules where legacy_index is null and quest_id like 'pack-real-adventure-05-%' order by quest_id limit 1;
 select quest_id into q2 from lumen_commands.quest_rules where legacy_index is null and quest_id<>q order by quest_id limit 1;
 select quest_id into q3 from lumen_commands.quest_rules where legacy_index is null and quest_id like 'pack-real-adventure-05-%' and quest_id not in(q,q2) order by quest_id limit 1;
 assert q is not null and q2 is not null;
 scope:=jsonb_build_object(q,'real-adventure-05',q3,'real-adventure-05');
 insert into lumen.profile_snapshots(user_id,payload) values
 (uid,'{"xp":42,"shards":7,"autonomousWins":2,"solved":{},"badges":{},"stars":{},"challenges":{},"performances":{},"canonicalQuestState":{},"future":{"keep":true}}'),
 (other,'{"solved":{},"badges":{},"canonicalQuestState":{}}');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.lumen_commit_wallet_command('wallet-establish-v1',uid,'{"kind":"establish"}');
 f:=jsonb_build_object('seconds',15,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,'hintUsed',false,'challengeFailed',true,'qualifiedDay','2026-11-01','qualifiedAt','2026-11-01T10:00:00Z');
 first_receipt:=public.lumen_commit_quest_command('before-reset',uid,q,f);
 perform public.lumen_commit_quest_command('untouched',uid,q2,f);
 select payload into before_profile from lumen.profile_snapshots where user_id=uid;
 select payload into other_profile from lumen.profile_snapshots where user_id=other;
 select count(*) into events from lumen.canonical_reward_events where user_id=uid;
 r:=lumen_commands.reset_replaced_quests(uid,scope);
 assert r='{"changed":2,"completedReset":1}'::jsonb,'explicit reset count';
 select payload into after_profile from lumen.profile_snapshots where user_id=uid;
 assert after_profile->'canonicalQuestState'->q->>'solved'='false';
 assert after_profile->'canonicalQuestState'->q->'badges'='{}';
 assert after_profile->'canonicalQuestState'->q->'runPerformance'='{}';
 assert after_profile->'canonicalQuestState'->q2=before_profile->'canonicalQuestState'->q2;
 assert (after_profile-'canonicalQuestState'-'legacyVictoryRevision'-'legacyAdventureAccess')=(before_profile-'canonicalQuestState'-'legacyVictoryRevision'-'legacyAdventureAccess'),'unrelated metadata and balances unchanged';
 assert after_profile->'legacyAdventureAccess' ? 'real-adventure-05','started access survives';
 assert (select reset_info->'previous'=before_profile->'canonicalQuestState'->q from lumen_commands.quest_run_authority where user_id=uid and quest_id=q),'private original retained';
 assert (select count(*)=events from lumen.canonical_reward_events where user_id=uid),'reward events retained';
 assert (select payload=other_profile from lumen.profile_snapshots where user_id=other),'other player unchanged';
 begin
  update lumen.profile_snapshots set payload=before_profile where user_id=uid;
  raise exception 'stale snapshot accepted';
 exception when check_violation or invalid_parameter_value then null;end;
 begin
  update lumen.profile_snapshots set payload=jsonb_set(payload,array['canonicalQuestState',q,'solved'],'true') where user_id=uid;
  raise exception 'forged reset completion accepted';
 exception when check_violation then null;end;
 begin perform public.lumen_commit_quest_command('before-reset',uid,q,f);raise exception 'old receipt resurrected';exception when check_violation then null;end;
 begin perform public.lumen_commit_canonical_victory(q,'{"mastery":true}',null);raise exception 'old badge API accepted';exception when check_violation then null;end;
 begin perform public.lumen_commit_quest_command('qr1.stale-facts',uid,q,f);raise exception 'predating facts accepted';exception when check_violation then null;end;
 r:=lumen_commands.reconcile_acquisitions(uid,after_profile,before_profile);
 assert r->'profile'->'canonicalQuestState'->q=after_profile->'canonicalQuestState'->q,'recovery cannot resurrect obsolete acquisitions';
 -- Refresh after acquisition cursor advancement. New slow run owns its records.
 f:=f||jsonb_build_object('seconds',120,'qualifiedDay',(now() at time zone 'Europe/Paris')::date::text,'qualifiedAt',clock_timestamp());
 r:=public.lumen_commit_quest_command('qr1.new-run',uid,q,f);
 assert r->'outcome'->>'firstCompletion'='true';
 assert r->'profile'->'xp'=before_profile->'xp' and r->'profile'->'shards'=before_profile->'shards','no duplicate economic grants';
 assert r->'profile'->'autonomousWins'=before_profile->'autonomousWins','no duplicate milestone';
 assert r->'profile'->'canonicalQuestState'->q->'runPerformance'->>'bestTime'='120','record reset';
 assert r->'profile'->'canonicalQuestState'->q->'badges'->>'speed'='false','old speed gone';
 assert (select count(*)=events from lumen.canonical_reward_events where user_id=uid);
 assert public.lumen_commit_quest_command('qr1.new-run',uid,q,f)=r,'response-loss retry exact';
 assert lumen_commands.reset_replaced_quests(uid,scope)->>'changed'='0','operator rerun does not erase replay';
 assert (select payload=r->'profile' from lumen.profile_snapshots where user_id=uid);
 assert public.lumen_get_quest_command('before-reset',uid)->'outcome'=first_receipt->'outcome','historical receipts immutable';
 r:=public.lumen_commit_quest_command('qr1.unplayed-run',uid,q3,f);
 assert (r->'profile'->>'xp')::integer=(before_profile->>'xp')::integer+15,'previously unplayed quest earns first XP';
 assert (select count(*)=events+1 from lumen.canonical_reward_events where user_id=uid);
 assert not has_function_privilege('authenticated','lumen_commands.reset_replaced_quests(uuid,jsonb)','EXECUTE');
 assert not has_function_privilege('anon','lumen_commands.reset_replaced_quests(uuid,jsonb)','EXECUTE');
 assert not has_table_privilege('authenticated','lumen_commands.quest_run_authority','SELECT');
end $$;
