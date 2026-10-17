-- Executed after the real ledger migrations in a disposable PostgreSQL database.
do $$
declare
 uid uuid := gen_random_uuid();
 other_uid uuid := gen_random_uuid();
 q text;
 result jsonb;
 before_profile jsonb;
 after_profile jsonb;
 before_events integer;
begin
 insert into auth.users values (uid),(other_uid);
 insert into lumen.profile_snapshots(user_id,payload) values
 (uid,'{"xp":42,"shards":7,"skills":{"hint":true},"entitlements":["paid"],"future":{"keep":true},"canonicalQuestState":{}}'),
 (other_uid,'{"xp":9,"canonicalQuestState":{}}');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 foreach q in array array['planned-real-01-q09','planned-real-01-q10'] loop
  insert into lumen.canonical_quest_allowlist values (q);
  result := public.lumen_commit_canonical_victory(q,'{"autonomy":true}','{"seconds":120}');
  assert result->>'newlyCompleted'='true', 'first completion is credited';
  select payload into before_profile from lumen.profile_snapshots where user_id=uid;
  select count(*) into before_events from lumen.canonical_reward_events where user_id=uid;
  result := public.lumen_commit_canonical_victory(q,'{"speed":true,"noError":true,"autonomy":false}','{"seconds":20}');
  after_profile := result->'profile';
  assert result->>'newlyCompleted'='false', 'replay is not first completion';
  assert after_profile->'canonicalQuestState'->q->'badges' @> '{"autonomy":true,"speed":true,"noError":true}', 'new badges saved and old badges preserved';
  assert coalesce(after_profile->'canonicalQuestState'->q->'badges'->>'mastery','false')='false', 'never synthesize mastery across runs';
  assert (after_profile #- array['canonicalQuestState',q,'badges']) = (before_profile #- array['canonicalQuestState',q,'badges']), 'only badges may change on replay';
  assert (select count(*) from lumen.canonical_reward_events where user_id=uid)=before_events, 'no second reward event';
  before_profile := after_profile;
  result := public.lumen_commit_canonical_victory(q,'{"mastery":true,"speed":true,"noError":true,"autonomy":true}');
  assert result->'profile'->'canonicalQuestState'->q->'badges'->>'mastery'='true', 'mastery explicitly earned on one run';
  before_profile := result->'profile';
  result := public.lumen_commit_canonical_victory(q,'{"speed":false,"noError":false,"mastery":false,"autonomy":false}');
  assert result->'profile'=before_profile, 'false flags cannot revoke earned badges';
  assert result->>'alreadySaved'='true', 'no-op replay is idempotent';
 end loop;
 assert (select payload->>'xp' from lumen.profile_snapshots where user_id=uid)='72', 'exactly two first-completion rewards';
 assert (select payload from lumen.profile_snapshots where user_id=other_uid)='{"xp":9,"canonicalQuestState":{}}'::jsonb, 'other accounts untouched';
 -- Imported completed quests need no historical reward event or new XP grant.
 q := 'imported-fixture';
 insert into lumen.canonical_quest_allowlist values(q);
 update lumen.profile_snapshots set payload=jsonb_set(payload,array['canonicalQuestState',q],'{"solved":true,"stars":3,"future":"preserved"}') where user_id=uid;
 result := public.lumen_commit_canonical_victory(q,'{"speed":true}');
 assert result->'profile'->'canonicalQuestState'->q @> '{"solved":true,"stars":3,"future":"preserved","badges":{"speed":true}}', 'pre-ledger progress can improve badges';
 assert not exists(select 1 from lumen.canonical_reward_events where quest_id=q), 'no retroactive reward credit';
 assert result->'profile'->>'xp'='72';
 assert not has_function_privilege('anon','public.lumen_commit_canonical_victory(text,jsonb,jsonb)','execute'), 'anonymous access denied';
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.lumen_commit_canonical_victory(q,'{}');
  raise exception 'unauthenticated call accepted';
 exception when others then
  assert sqlerrm='authentication required';
 end;
end $$;
