-- Disposable PostgreSQL only; run after the real RPC migrations + guard.
do $$
declare
 uid uuid := gen_random_uuid();
 other_uid uuid := gen_random_uuid();
 q text := 'snapshot-guard-fixture';
 original jsonb;
 committed jsonb;
 candidate jsonb;
 result jsonb;
begin
 insert into auth.users values(uid),(other_uid);
 insert into lumen.canonical_quest_allowlist values(q);
 insert into lumen.profile_snapshots(user_id,payload) values
 (uid,'{"solved":{},"badges":{},"xp":10,"shards":8,"entitlements":["refundable"],"canonicalQuestState":{}}'),
 (other_uid,'{"solved":{},"badges":{},"xp":0}');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 original := public.lumen_restore_profile();
 result := public.lumen_commit_canonical_victory(q,'{"autonomy":true,"speed":false}');
 committed := result->'profile';
 assert committed->>'xp'='25';
 -- A stale CAS returns false and cannot overwrite a concurrent ledger commit.
 assert not public.lumen_cas_profile(original,original), 'stale CAS must fail';
 -- Even a matching expected profile may not erase an acknowledged quest.
 begin
  perform public.lumen_cas_profile(committed,original);
  raise exception 'destructive CAS accepted';
 exception when check_violation then null;
 end;
 assert public.lumen_restore_profile()=committed;
 -- The legacy unconditional RPC must be covered as well as the new CAS path.
 begin
  perform public.lumen_backup_profile(original);
  raise exception 'destructive backup accepted';
 exception when check_violation then null;
 end;
 -- A snapshot cannot remove just an earned badge or alter a first reward.
 foreach candidate in array array[
  jsonb_set(committed,array['canonicalQuestState',q,'badges','autonomy'],'false'),
  committed #- array['canonicalQuestState',q,'badges'],
  jsonb_set(committed,array['canonicalQuestState',q,'stars'],'2'),
  jsonb_set(committed,'{canonicalQuestState}','null'),
  jsonb_set(committed,'{canonicalQuestState}','[]')
 ] loop
  begin
   perform public.lumen_cas_profile(committed,candidate);
   raise exception 'destructive field write accepted';
  exception when check_violation then null;
  end;
  assert public.lumen_restore_profile()=committed;
 end loop;
 -- Legitimate noncanonical spends/refunds/revocations remain possible.
 candidate := jsonb_set(jsonb_set(committed,'{shards}','2'),'{entitlements}','[]');
 assert public.lumen_cas_profile(committed,candidate), 'valid spend and revoke must pass';
 committed := candidate;
 result := public.lumen_commit_canonical_victory(q,'{"speed":true}');
 assert result->'profile'->'canonicalQuestState'->q->'badges' @> '{"autonomy":true,"speed":true}';
 assert result->'profile'->>'xp'='25', 'replay must not credit again';
 assert (select count(*) from lumen.canonical_reward_events where user_id=uid)=1;
 assert (select payload->>'xp' from lumen.profile_snapshots where user_id=other_uid)='0';
 -- No blanket restriction on players with historical-only snapshots.
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 original := public.lumen_restore_profile();
 assert public.lumen_cas_profile(original,original||'{"legacySetting":true}');
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.lumen_cas_profile(original,original);
  raise exception 'anonymous CAS accepted';
 exception when others then assert sqlerrm='authentication required';
 end;
end $$;
