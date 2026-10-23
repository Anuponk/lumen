-- Disposable PostgreSQL only; never execute on player data.
create function lumen_commands.fixture_fail_counter_after_update() returns trigger language plpgsql as $$
begin
 if new.payload#>>'{performances,0,attempts}'='8' then raise exception 'simulated post-update failure';end if;
 return new;
end $$;
create trigger fixture_fail_counter_after_update after update on lumen.profile_snapshots
 for each row execute function lumen_commands.fixture_fail_counter_after_update();
do $$
declare u uuid:=gen_random_uuid();other_u uuid:=gen_random_uuid();q text;f jsonb;
 original jsonb;latest jsonb;candidate jsonb;receipt jsonb;r jsonb;bad jsonb;
 projection_before jsonb;receipt_count bigint;authority_revision bigint;
begin
 insert into auth.users values(u),(other_u);
 original:='{"solved":{},"badges":{},"stars":{},"performances":{},"noHint":{},"challenges":{},"xp":0,"shards":3,"skyScore":0,"skyHistoryVersion":4}';
 insert into lumen.profile_snapshots(user_id,payload) values(u,original),(other_u,original);
 select quest_id into q from lumen_commands.legacy_rules where legacy_index=0;
 f:=jsonb_build_object('seconds',45,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,'hintUsed',false,'challengeFailed',false,'qualifiedDay',(now() at time zone 'Europe/Paris')::date::text,'qualifiedAt',now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 r:=public.lumen_commit_legacy_command('before-counter',u,q,f);
 latest:=r->'profile';receipt:=public.lumen_get_legacy_command('before-counter',u);
 select revision,projection into authority_revision,projection_before from lumen_commands.legacy_authority where user_id=u;
 select count(*) into receipt_count from lumen_commands.legacy_receipts where user_id=u;
 -- Reproduce a valid local cumulative replay count with identical rewards.
 candidate:=jsonb_set(latest,'{performances,0,attempts}','4');
 assert public.lumen_cas_profile(latest,candidate),'counter-only reconciliation must succeed';
 assert not public.lumen_cas_profile(latest,candidate),'stale CAS still refuses';
 assert (select payload from lumen.profile_snapshots where user_id=u)=candidate;
 assert public.lumen_get_legacy_command('before-counter',u)=receipt,'immutable receipt changed';
 assert (select count(*) from lumen_commands.legacy_receipts where user_id=u)=receipt_count;
 assert (select revision from lumen_commands.legacy_authority where user_id=u)=authority_revision;
 assert (select projection from lumen_commands.legacy_authority where user_id=u)=lumen_commands.legacy_projection(candidate);
 assert ((candidate#>'{performances,0}')-'attempts')=((latest#>'{performances,0}')-'attempts');
 assert (candidate-'performances')=(latest-'performances');
 latest:=candidate;
 assert public.lumen_cas_profile(latest,latest),'same count is idempotent';
 -- Invalid/lower/deleted counters cannot erase a cumulative statistic.
 for bad in select value from jsonb_array_elements('[3,-1,1.5,null,"5",true,{},2147483648]') loop
  begin
   perform public.lumen_cas_profile(latest,jsonb_set(latest,'{performances,0,attempts}',bad));
   raise exception 'invalid counter accepted: %',bad;
  exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.lumen_backup_profile(latest#-'{performances,0,attempts}');raise exception 'counter deletion accepted';exception when invalid_parameter_value then null;end;
 -- A valid count must not smuggle any reward, evidence, schema or cursor change.
 for candidate in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_set(latest,'{solved,1}','1'),jsonb_set(latest,'{stars,0}','9'),
  jsonb_set(latest,'{performances,0,badges,mastery}',to_jsonb(not (latest#>>'{performances,0,badges,mastery}')::boolean)),
  jsonb_set(latest,'{performances,0,bestTime}','1'),jsonb_set(latest,'{performances,0,version}','2'),
  jsonb_set(latest,'{challenges,invented}','true'),jsonb_set(latest,'{noHint,0}','true'),
  jsonb_set(latest,'{autonomousWins}','999'),jsonb_set(latest,'{legacyVictoryRevision}','99'),
  jsonb_set(latest,'{xp}','0'))) loop
  candidate:=jsonb_set(candidate,'{performances,0,attempts}','5');
  begin perform public.lumen_cas_profile(latest,candidate);raise exception 'protected change accepted';exception when invalid_parameter_value then null;end;
  assert (select payload from lumen.profile_snapshots where user_id=u)=latest;
  assert (select projection from lumen_commands.legacy_authority where user_id=u)=lumen_commands.legacy_projection(latest),'failed write changed authority';
 end loop;
 -- Same-count compatibility plus monotonic backup, no other-account mutation.
 perform public.lumen_backup_profile(jsonb_set(latest,'{performances,0,attempts}','5'));
 latest:=jsonb_set(latest,'{performances,0,attempts}','5');
 assert (select payload from lumen.profile_snapshots where user_id=other_u)=original;
 -- A failure AFTER the authority update must roll back both records together.
 begin
  perform public.lumen_cas_profile(latest,jsonb_set(latest,'{performances,0,attempts}','8'));
  raise exception 'post-update failure did not fire';
 exception when raise_exception then assert sqlerrm='simulated post-update failure';end;
 assert (select payload from lumen.profile_snapshots where user_id=u)=latest;
 assert (select projection from lumen_commands.legacy_authority where user_id=u)=lumen_commands.legacy_projection(latest);
 -- A new exact command counts from the reconciled summary, without a second win.
 r:=public.lumen_commit_legacy_command('after-counter',u,q,f);
 assert r->'profile'->'performances'->'0'->>'attempts'='6';
 assert r->'profile'->>'xp'=latest->>'xp';assert r->'profile'->>'shards'=latest->>'shards';
 assert r->'outcome'->>'firstCompletion'='false';
 assert public.lumen_get_legacy_command('before-counter',u)=receipt;
 assert (select projection from lumen_commands.legacy_authority where user_id=u)=lumen_commands.legacy_projection(r->'profile');
 assert not has_function_privilege('anon','lumen_commands.legacy_attempt_count(jsonb)','execute');
 assert not has_function_privilege('authenticated','lumen_commands.legacy_attempt_count(jsonb)','execute');
 assert not has_function_privilege('anon','lumen_commands.legacy_reward_projection(jsonb)','execute');
 assert not has_function_privilege('authenticated','lumen_commands.legacy_reward_projection(jsonb)','execute');
 assert not has_function_privilege('anon','lumen_commands.protect_legacy_authority()','execute');
 assert not has_function_privilege('authenticated','lumen_commands.protect_legacy_authority()','execute');
end $$;

drop trigger fixture_fail_counter_after_update on lumen.profile_snapshots;
drop function lumen_commands.fixture_fail_counter_after_update();
