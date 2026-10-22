-- Synthetic, disposable database only. This test must fail before the migration.
do $$
begin
 assert to_regprocedure('lumen_privacy.erase_account(uuid,text[],text)') is not null,
   'Missing Lumen-scoped erasure; deleting shared Auth is not a substitute';
end $$;

-- The real command migrations run before this fixture in PostgreSQL 17 CI.
reset role;
set request.jwt.claim.sub='';
do $$declare
 uid uuid:='00000000-0000-0000-0000-000000009901';
 other_uid uuid:='00000000-0000-0000-0000-000000009902';
 actor text:='00000000-0000-0000-0000-000000009911';
 challenge uuid:='00000000-0000-0000-0000-000000009921';
 r record; n bigint; predicate text; report jsonb;
begin
 insert into auth.users values(uid),(other_uid);
 insert into fixture_other_app.records values(uid,'{"keep":"other application"}');
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"solved":{},"badges":{},"shards":3}'),(other_uid,'{"keep":"other player"}');
 insert into lumen.analytics_events(user_id,anonymous_id,properties) values(uid,actor,'{"personal":"erase"}');
 -- Same anonymous device in a former guest session, without a user FK.
 insert into lumen.analytics_events(user_id,anonymous_id) values(null,actor);
 insert into lumen.analytics_excluded_actors values(actor::uuid,'fixture');
 insert into lumen.canonical_quest_allowlist values('erasure-fixture');
 insert into lumen.canonical_reward_events(user_id,quest_id,xp_credited) values(uid,'erasure-fixture',10);
 insert into lumen.daily_progress(user_id,play_date,puzzle_id) values(uid,current_date,1);
 insert into lumen.difficulty_ratings(user_id,anonymous_id,rating) values(uid,actor,'easy');
 insert into lumen.engagement_state(user_id,shards) values(uid,3);
 insert into lumen.entitlements(user_id,entitlement) values(uid,'fixture');
 insert into lumen.feedback(user_id,anonymous_id,message) values(uid,actor,'private fixture message');
 insert into lumen.historical_performance(player_key,user_id,anonymous_id,puzzle_id) values('u:'||uid,uid,actor,1),('a:'||actor,null,actor,1);
 insert into lumen.internal_capabilities(user_id,capability) values(uid,'fixture');
 insert into lumen.profiles values(uid,'Private name');
 insert into lumen.progress(user_id,puzzle_id) values(uid,1);
 insert into lumen.recovery_backups(user_id,payload) values(uid,'{"private":"backup"}');
 insert into lumen.social_challenges values(challenge,uid,actor,'Private name');
 insert into lumen.social_challenge_participations values
  (gen_random_uuid(),challenge,uid,actor,'u:'||uid,'Private name'),
  (gen_random_uuid(),challenge,other_uid,null,'u:'||other_uid,'Other player');
 insert into lumen.users values(uid);
 insert into lumen_commands.canonical_receipts(user_id,operation_id,request,outcome) values(uid,'erase-fixture','{}','{}');
 insert into lumen_commands.legacy_authority values(uid,1,'{}');
 insert into lumen_commands.legacy_receipts(user_id,operation_id,request,outcome) values(uid,'erase-fixture','{}','{}');
 insert into lumen_commands.wallet_authority values(uid,1,3,'{}');
 insert into lumen_commands.wallet_receipts(user_id,operation_id,request,outcome) values(uid,'erase-fixture','{}','{}');
 insert into lumen_commands.outbox_health(user_id,client_id,session_id,session_started,sequence,platform,state,pending,failures,app_version)
 values(uid,gen_random_uuid(),gen_random_uuid(),now(),1,'android-pwa','pending',1,0,'fixture');
 insert into public.lumen_admin_player_snapshot values('u:'||uid,'Private name'),('a:'||actor,'Private name');
 insert into public.lumen_push_subscriptions values(uid,actor,'https://example.invalid/push');
 insert into public.lumen_sync_health(user_id,event) values(uid,'hydration_failed');

 -- Neither an unverified scope nor a collision can delete somebody else's data.
 begin
  perform lumen_privacy.erase_account(uid,array[actor],'yes');
  raise exception 'Missing explicit confirmation was accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform lumen_privacy.review_erasure(uid,array[]::text[]);
  raise exception 'Missing linked actor was accepted';
 exception when raise_exception then
  if sqlerrm not like 'LUMEN_ERASURE_ACTOR_REVIEW_REQUIRED%' then raise; end if;
 end;
 insert into lumen.analytics_events(user_id,anonymous_id) values(other_uid,actor);
 begin
  perform lumen_privacy.erase_account(uid,array[actor],'ERASE LUMEN '||uid);
  raise exception 'Shared actor was accepted';
 exception when raise_exception then
  if sqlerrm not like 'LUMEN_ERASURE_SHARED_ACTOR%' then raise; end if;
 end;
 delete from lumen.analytics_events where user_id=other_uid;
 insert into lumen.historical_performance(player_key,user_id,anonymous_id,puzzle_id)
 values('a:'||actor,other_uid,null,2);
 begin
  perform lumen_privacy.erase_account(uid,array[actor],'ERASE LUMEN '||uid);
  raise exception 'Player key contradicting account owner was accepted';
 exception when raise_exception then
  if sqlerrm not like 'LUMEN_ERASURE_SHARED_ACTOR%' then raise; end if;
 end;
 delete from lumen.historical_performance where user_id=other_uid;
 assert not exists(select 1 from lumen_privacy.erased_identifiers);
 create table lumen.fixture_unreviewed(user_id uuid);
 begin
  perform lumen_privacy.erase_account(uid,array[actor],'ERASE LUMEN '||uid);
  raise exception 'Unknown table silently skipped';
 exception when raise_exception then
  if sqlerrm<>'LUMEN_ERASURE_SCHEMA_REVIEW_REQUIRED' then raise; end if;
 end;
 drop table lumen.fixture_unreviewed;
 alter table lumen.social_challenges add column fixture_sender_email text;
 begin
  perform lumen_privacy.review_erasure(uid,array[actor]);
  raise exception 'New identifying challenge column silently skipped';
 exception when raise_exception then
  if sqlerrm<>'LUMEN_ERASURE_SOCIAL_REVIEW_REQUIRED' then raise; end if;
 end;
 alter table lumen.social_challenges drop column fixture_sender_email;
 alter table lumen.profiles disable trigger lumen_erasure_guard;
 begin
  perform lumen_privacy.review_erasure(uid,array[actor]);
  raise exception 'Disabled anti-resurrection guard accepted';
 exception when raise_exception then
  if sqlerrm<>'LUMEN_ERASURE_GUARD_REVIEW_REQUIRED' then raise; end if;
 end;
 alter table lumen.profiles enable trigger lumen_erasure_guard;

 -- A failure during deletion must roll back earlier rows AND the barrier.
 create function fixture_other_app.fail_delete() returns trigger language plpgsql as $fn$
 begin raise exception using errcode='ZX001',message='synthetic mid-operation failure'; end $fn$;
 create trigger fixture_erasure_failure before delete on lumen.profiles
  for each row execute function fixture_other_app.fail_delete();
 begin
  perform lumen_privacy.erase_account(uid,array[actor],'ERASE LUMEN '||uid);
  raise exception 'Expected synthetic failure did not occur';
 exception when sqlstate 'ZX001' then null; end;
 drop trigger fixture_erasure_failure on lumen.profiles;
 drop function fixture_other_app.fail_delete();
 assert exists(select 1 from lumen.profiles where user_id=uid);
 assert exists(select 1 from lumen.analytics_events where user_id=uid);
 assert not exists(select 1 from lumen_privacy.erased_identifiers);

 report:=lumen_privacy.erase_account(uid,array[actor],'ERASE LUMEN '||uid);
 assert report->>'status'='erased';
 for r in select * from lumen_privacy.policy() where action='delete' loop
  predicate:=concat_ws(' or ',
   case when r.uid_col is not null then format('%I=$1',r.uid_col) end,
   case when r.actor_col is not null then format('%I::text=$2',r.actor_col) end,
   case when r.key_col is not null then format('%I in ($3,$4)',r.key_col) end);
  execute format('select count(*) from %I.%I where %s',r.ns,r.rel,predicate) into n
   using uid,actor,'u:'||uid,'a:'||actor;
  assert n=0,'Incomplete erasure in '||r.ns||'.'||r.rel;
  assert (report->'tables'->(r.ns||'.'||r.rel)->>'rows')::int>0,'Fixture must seed every owned table';
 end loop;
 assert exists(select 1 from auth.users where id=uid),'Shared Auth was deleted';
 assert (select payload->>'keep' from fixture_other_app.records where user_id=uid)='other application';
 assert (select payload->>'keep' from lumen.profile_snapshots where user_id=other_uid)='other player';
 assert exists(select 1 from lumen.canonical_quest_allowlist where quest_id='erasure-fixture');
 assert exists(select 1 from lumen.social_challenges where id=challenge and sender_user_id is null and sender_anonymous_id is null and sender_display_name='Compte supprimé');
 assert (select count(*) from lumen.social_challenge_participations where challenge_id=challenge)=1;
 assert exists(select 1 from lumen.social_challenge_participations where challenge_id=challenge and participant_user_id=other_uid);
 assert (select count(*) from lumen_privacy.erased_identifiers)=4,'Only UID, actor and their two cache keys are retained as fingerprints';
 assert lumen_privacy.erase_account(uid,array[actor],'ERASE LUMEN '||uid)->>'status'='erased','Retry not idempotent';
 -- Old anonymous clients, privileged writers and an existing JWT cannot resurrect.
 begin
  insert into lumen.analytics_events(anonymous_id) values(actor);
  raise exception 'Anonymous old actor resurrected';
 exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED'; end;
 begin
  insert into public.lumen_admin_player_snapshot values('a:'||actor,'Old cache');
  raise exception 'Derived cache resurrected';
 exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED'; end;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 begin
  perform lumen_privacy.review_erasure(other_uid,array[]::text[]);
  raise exception 'JWT-bearing operator session was accepted';
 exception when insufficient_privilege then assert sqlerrm='Operator database session required'; end;
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') loop
  begin
   execute format('insert into %I.%I default values',r.ns,r.rel);
   raise exception 'Old JWT could write to %.%',r.ns,r.rel;
  exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED'; end;
 end loop;
 begin
  insert into lumen.profiles values(other_uid,'Forged new account');
  raise exception 'Old JWT resurrected data with another row identity';
 exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED'; end;
 if to_regprocedure('public.lumen_backup_profile(jsonb)') is not null then
  begin
   perform public.lumen_backup_profile('{"solved":{},"badges":{},"shards":3}');
   raise exception 'Old real backup RPC resurrected data';
  exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED'; end;
 end if;
 perform set_config('request.jwt.claim.sub','',true);
end $$;

-- New, non-erased players still spend/restore normally after guard installation.
do $$declare u uuid:=gen_random_uuid();r jsonb;begin
 if to_regprocedure('public.lumen_commit_wallet_command(text,uuid,jsonb)') is not null then
  insert into auth.users values(u);
  insert into lumen.profile_snapshots(user_id,payload) values(u,'{"solved":{},"badges":{},"shards":3}');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.lumen_commit_wallet_command('privacy-reset-0-hint-1',u,'{"kind":"hint","attemptId":"privacy","resetCount":0,"sequence":1}');
  perform public.lumen_commit_wallet_command('privacy-reset-0-hint-1',u,'{"kind":"hint","attemptId":"privacy","resetCount":0,"sequence":1}');
  assert public.lumen_get_wallet_command('privacy-reset-0-hint-1',u)->>'balance'='2';
  assert (select count(*) from lumen_commands.wallet_receipts where user_id=u)=1;
  r:=public.lumen_restore_profile();assert r->>'shards'='2';
  perform set_config('request.jwt.claim.sub','',true);
  -- Lumen-only identity, with no other-app row: Auth still isn't globally deleted.
  perform lumen_privacy.erase_account(u,array[]::text[],'ERASE LUMEN '||u);
  assert not exists(select 1 from lumen.profile_snapshots where user_id=u);
  assert exists(select 1 from auth.users where id=u);
 end if;
end $$;

-- Direct access must fail even with a known UID and operator confirmation text.
set role authenticated;
do $$begin
 begin perform lumen_privacy.erase_account('00000000-0000-0000-0000-000000009902',array[]::text[],'ERASE LUMEN 00000000-0000-0000-0000-000000009902');
  raise exception 'Player erased account'; exception when insufficient_privilege then null; end;
 begin perform 1 from lumen_privacy.erased_identifiers;raise exception 'Private barrier exposed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$declare r text;begin
 foreach r in array array['anon','authenticated','service_role'] loop
  assert not has_schema_privilege(r,'lumen_privacy','usage');
  assert not has_function_privilege(r,'lumen_privacy.erase_account(uuid,text[],text)','execute');
  assert not has_function_privilege(r,'lumen_privacy.review_erasure(uuid,text[])','execute');
  assert not has_table_privilege(r,'lumen_privacy.erased_identifiers','select');
 end loop;
end $$;

-- A pre-erasure repeatable snapshot cannot bypass the committed barrier.
begin isolation level repeatable read;
do $$begin
 begin perform lumen_privacy.erase_account('00000000-0000-0000-0000-000000009999',array[]::text[],
  'ERASE LUMEN 00000000-0000-0000-0000-000000009999');
  raise exception 'Erasure accepted an obsolete transaction snapshot';
 exception when invalid_transaction_state then assert sqlerrm='LUMEN_WRITE_REQUIRES_READ_COMMITTED'; end;
 begin insert into lumen.analytics_events(anonymous_id) values('unrelated-new-device');
  raise exception 'Unsafe snapshot write was accepted';
 exception when invalid_transaction_state then assert sqlerrm='LUMEN_WRITE_REQUIRES_READ_COMMITTED'; end;
end $$;
rollback;
