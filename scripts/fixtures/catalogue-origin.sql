-- Disposable PostgreSQL only. No player data, no production fixture execution.
do $$
declare fresh uuid:=gen_random_uuid(); historical uuid:=gen_random_uuid(); imported uuid:=gen_random_uuid();
 before_profile jsonb; after_profile jsonb;
begin
 assert not (select payload?'catalogueOrigin' from lumen.profile_snapshots where user_id='47000000-0000-0000-0000-000000000002'), 'No player backfill';
 update lumen.profile_snapshots set payload=payload||'{"solved":{"0":1},"xp":10}' where user_id='47000000-0000-0000-0000-000000000001';
 assert (select payload->'catalogueOrigin' from lumen.profile_snapshots where user_id='47000000-0000-0000-0000-000000000001')='2', 'Classify existing empty profile before first old-client victory';
 insert into auth.users values(fresh),(historical),(imported);
 insert into lumen.profile_snapshots(user_id,payload) values(fresh,'{"solved":{},"badges":{},"xp":0,"shards":3}');
 select payload into before_profile from lumen.profile_snapshots where user_id=fresh;
 assert before_profile->'catalogueOrigin'='2';
 -- Old writers may read the cohort but cannot remove it with a full snapshot.
 perform set_config('request.jwt.claim.sub',fresh::text,true);
 begin
  perform public.lumen_backup_profile(before_profile-'catalogueOrigin');
  raise exception 'Old backup erased cohort';
 exception when check_violation then null;end;
 begin
  perform public.lumen_cas_profile(before_profile,before_profile-'catalogueOrigin');
  raise exception 'Old CAS erased cohort';
 exception when check_violation then null;end;
 begin
  update lumen.profile_snapshots set payload=jsonb_set(payload,'{catalogueOrigin}','1') where user_id=fresh;
  raise exception 'Cohort rewriting succeeded';
 exception when check_violation then null;end;
 assert (select payload from lumen.profile_snapshots where user_id=fresh)=before_profile;
 -- Same-cohort preference/spend updates remain legitimate; metadata grants no reward.
 assert public.lumen_cas_profile(before_profile,before_profile||'{"shards":2,"sound":false}');
 select payload into after_profile from lumen.profile_snapshots where user_id=fresh;
 assert after_profile->'shards'='2' and after_profile->'xp'='0' and after_profile->'solved'='{}';
 assert after_profile->'catalogueOrigin'='2';
 -- An old nonempty import remains an old cohort, with its exact reward facts.
 insert into lumen.profile_snapshots(user_id,payload) values(historical,'{"solved":{"0":1},"badges":{"kept":1},"xp":10,"shards":5}');
 select payload into before_profile from lumen.profile_snapshots where user_id=historical;
 assert not before_profile?'catalogueOrigin';
 update lumen.profile_snapshots set payload=payload||'{"catalogueOrigin":1}' where user_id=historical;
 select payload into after_profile from lumen.profile_snapshots where user_id=historical;
 assert after_profile-'catalogueOrigin'=before_profile;
 begin
  update lumen.profile_snapshots set payload=payload||'{"catalogueOrigin":99}' where user_id=historical;
  raise exception 'Unknown catalogue accepted';
 exception when invalid_parameter_value then null;end;
 insert into lumen.profile_snapshots(user_id,payload) values(imported,'{"solved":{"0":1},"badges":{}}');
 begin
  update lumen.profile_snapshots set payload=payload||'{"catalogueOrigin":2}' where user_id=imported;
  raise exception 'Existing old cohort relabelled as new';
 exception when check_violation then null;end;
 assert (select payload->'solved' from lumen.profile_snapshots where user_id=imported)='{"0":1}';
end $$;
