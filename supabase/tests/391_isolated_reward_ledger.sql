-- Reproducible #391 tests. Execute only against isolated lumen_391_test.
-- Entire test, including fake user and allowlist entries, is rolled back.
begin;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',true);
insert into lumen_391_test.canonical_quest_allowlist(quest_id)
 values ('test-quest-001'),('test-quest-002') on conflict do nothing;
insert into lumen_391_test.profile_snapshots(user_id,payload)
 values ('aaaaaaaa-1111-4111-8111-111111111111',
 '{"solved":{},"badges":{},"canonicalQuestState":{},"xp":0}'::jsonb);
do $$
declare first_result jsonb; again jsonb; second_result jsonb;
 balance integer; events integer; rejected integer:=0;
begin
 first_result:=lumen_391_test.commit_canonical_victory('test-quest-001','{"autonomy":true}'::jsonb,null);
 again:=lumen_391_test.commit_canonical_victory('test-quest-001','{"autonomy":true}'::jsonb,null);
 second_result:=lumen_391_test.commit_canonical_victory('test-quest-002','{"autonomy":false}'::jsonb,null);
 select (payload->>'xp')::int into balance from lumen_391_test.profile_snapshots
  where user_id='aaaaaaaa-1111-4111-8111-111111111111';
 select count(*) into events from lumen_391_test.canonical_reward_events;
 if first_result->>'newlyCompleted'<>'true'
  or again->>'alreadySaved'<>'true'
  or second_result->>'newlyCompleted'<>'true'
  or balance<>25 or events<>2
 then raise exception 'Ledger idempotence failed';end if;
 begin
  perform lumen_391_test.commit_canonical_victory('not-allowlisted','{}'::jsonb,null);
 exception when others then rejected:=rejected+1;end;
 begin
  perform lumen_391_test.commit_canonical_victory('test-quest-001','[]'::jsonb,null);
 exception when others then rejected:=rejected+1;end;
 begin
  perform lumen_391_test.commit_canonical_victory('test-quest-001','{}'::jsonb,'[]'::jsonb);
 exception when others then rejected:=rejected+1;end;
 if rejected<>3 then raise exception 'Invalid payload accepted (% rejected)',rejected;end if;
end $$;
rollback;
