-- Full current migration chain, isolated PostgreSQL only. No real accounts.
reset role;
set request.jwt.claim.sub='';
-- #593's old purge can leave audit references without a case. Never report a
-- complete erasure when attribution has already been lost.
do $$begin
 insert into lumen_commands.support_access(case_id,action) values(null,'list');
 -- Fixtures from the pre-privacy support test contain purged cases already.
 if exists(select 1 from lumen_commands.support_access a where case_id is not null and privacy_owner_id is null and not exists(select 1 from lumen_commands.support_cases c where c.id=a.case_id)) then
  begin perform lumen_privacy.review_erasure(gen_random_uuid(),array[]::text[]);raise exception 'Orphan audit silently ignored';
  exception when raise_exception then assert sqlerrm='LUMEN_ERASURE_SUPPORT_AUDIT_REVIEW_REQUIRED';end;
  -- Synthetic fixture cleanup only, never an operator/production instruction.
  delete from lumen_commands.support_access a where case_id is not null and privacy_owner_id is null and not exists(select 1 from lumen_commands.support_cases c where c.id=a.case_id);
 end if;
end $$;
-- Trigger name/function alone are insufficient if its actor arguments drift.
drop trigger lumen_erasure_guard on lumen.analytics_events;
create trigger lumen_erasure_guard before insert or update on lumen.analytics_events
 for each row execute function lumen_privacy.guard_write('user_id','','');
do $$begin
 begin perform lumen_privacy.review_erasure(gen_random_uuid(),array[]::text[]);raise exception 'Wrong guard arguments accepted';
 exception when raise_exception then assert sqlerrm='LUMEN_ERASURE_GUARD_REVIEW_REQUIRED';end;
end $$;
drop trigger lumen_erasure_guard on lumen.analytics_events;
select lumen_privacy.install_guards();
do $$declare
 u uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid(); admin_uid uuid:=gen_random_uuid();
 c uuid; other_case uuid; capture uuid:=gen_random_uuid(); expired uuid:=gen_random_uuid();
 report jsonb; r record; n bigint;
 p jsonb:='{"format":1,"events":[],"version":"unknown","code":"manual","copies":[{"source":"local","facts":[{"quest":1,"metric":"solved","value":true}]}]}';
begin
 insert into auth.users(id) values(u),(other_uid),(admin_uid);
 insert into fixture_other_app.records values(u,'{"keep":"shared application"}');
 insert into lumen.profile_snapshots(user_id,payload) values(u,'{"solved":{},"badges":{},"shards":3}'),(other_uid,'{"solved":{},"badges":{},"shards":7}');
 insert into lumen.internal_capabilities(user_id,capability) values(admin_uid,'analytics_cockpit');
 insert into lumen_commands.diagnostic_preferences(user_id,enabled) values(u,true),(other_uid,true);
 insert into lumen_commands.diagnostic_budgets(lane,subject,day,minute) values('details',u::text,current_date,now());
 insert into lumen_commands.acquisition_recovery_sources(user_id,digest,source) values(u,decode('1234','hex'),'{"private":"copy"}');
 insert into lumen_commands.quest_run_authority(user_id,quest_id,projection) select u,quest_id,'{}' from lumen_commands.quest_rules limit 1;
 insert into lumen_commands.guest_claim_receipts(claim_id,user_id,manifest) values(gen_random_uuid(),u,'{}');
 update lumen_commands.support_control set enabled=true;
 perform set_config('request.jwt.claim.sub',u::text,true);
 c:=(public.lumen_support(u,'activate')->>'id')::uuid;
 perform public.lumen_support(u,'capture',c,capture,p);
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 other_case:=(public.lumen_support(other_uid,'activate')->>'id')::uuid;
 perform public.lumen_support(other_uid,'capture',other_case,gen_random_uuid(),p);
 perform set_config('request.jwt.claim.sub',admin_uid::text,true);
 perform public.lumen_support(admin_uid,'download',c,null,null,u);
 perform public.lumen_support(admin_uid,'download',other_case,null,null,other_uid);
 perform set_config('request.jwt.claim.sub','',true);
 -- Expired/revoked cases and logs still retain attribution before erasure.
 insert into lumen_commands.support_cases(id,user_id,activated_at,expires_at,revoked_at) values(expired,u,now()-interval '8 days',now()-interval '7 days',now()-interval '7 days');
 insert into lumen_commands.support_access(actor,case_id,action) values(admin_uid,expired,'purge');
 perform set_config('test.privacy_user',u::text,false);
 perform set_config('test.privacy_other',other_uid::text,false);
 perform set_config('test.privacy_case',c::text,false);
 perform set_config('test.privacy_admin',admin_uid::text,false);
 perform set_config('test.privacy_expired',expired::text,false);
 -- Any partial failure rolls back support payloads, original saves and barriers.
 create function fixture_other_app.fail_current_delete() returns trigger language plpgsql as $fn$
 begin raise exception using errcode='ZX001',message='fixture rollback';end $fn$;
 create trigger fixture_current_failure before delete on lumen.profile_snapshots for each row execute function fixture_other_app.fail_current_delete();
 begin
  perform lumen_privacy.erase_account(u,array[]::text[],'ERASE LUMEN '||u);
  raise exception 'Partial failure accepted';
 exception when sqlstate 'ZX001' then null;end;
 drop trigger fixture_current_failure on lumen.profile_snapshots;
 drop function fixture_other_app.fail_current_delete();
 assert exists(select 1 from lumen_commands.support_contents where capture_id=capture);
 assert not exists(select 1 from lumen_privacy.erased_identifiers where digest=lumen_privacy.fingerprint(u::text));
 assert exists(select 1 from lumen.profile_snapshots where user_id=u);
 -- Revocation is support-only and leaves business backup bytes untouched.
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 perform public.lumen_support(other_uid,'revoke');
 assert (select payload->>'shards' from lumen.profile_snapshots where user_id=other_uid)='7';
 perform set_config('request.jwt.claim.sub','',true);
end $$;

begin isolation level repeatable read read only;
do $$declare e jsonb;begin
 e:=lumen_privacy.export_account(current_setting('test.privacy_user')::uuid,array[]::text[]);
 assert jsonb_array_length(e->'tables'->'lumen_commands.support_contents')=1;
 assert jsonb_array_length(e->'tables'->'lumen_commands.support_cases')=2;
 assert e->'tables'->'lumen_commands.support_access'->0->'actor' is null,'Support operator identity leaked';
 assert e->'tables'->'lumen_commands.support_access'->0->'privacy_owner_id' is null;
 assert e->'tables'->'lumen_commands.support_access'->0->'case_id' is null;
 assert position(current_setting('test.privacy_other') in e::text)=0,'Other player leaked';
 assert position(current_setting('test.privacy_admin') in e::text)=0,'Operator identity leaked';
end $$;
commit;

do $$declare u uuid:=current_setting('test.privacy_user')::uuid;other_uid uuid:=current_setting('test.privacy_other')::uuid;
 c uuid:=current_setting('test.privacy_case')::uuid;r record;n bigint;report jsonb;begin
 perform lumen_commands.prune_support();
 assert exists(select 1 from lumen_commands.support_access where case_id=current_setting('test.privacy_expired')::uuid and privacy_owner_id=u),'Purged case lost audit attribution';
 report:=lumen_privacy.erase_account(u,array[]::text[],'ERASE LUMEN '||u);
 assert report->>'status'='erased';
 assert not exists(select 1 from lumen_commands.support_cases where user_id=u);
 assert not exists(select 1 from lumen_commands.support_access where case_id=c);
 assert not exists(select 1 from lumen_commands.support_contents sc join lumen_commands.support_captures cp on cp.id=sc.capture_id join lumen_commands.support_cases cs on cs.id=cp.case_id where cs.user_id=u);
 assert exists(select 1 from lumen_commands.support_cases where user_id=other_uid);
 assert exists(select 1 from lumen_commands.support_access where case_id in(select id from lumen_commands.support_cases where user_id=other_uid));
 assert exists(select 1 from auth.users where id=u),'Shared Auth removed';
 assert exists(select 1 from fixture_other_app.records where user_id=u),'Other app removed';
 assert (select payload->>'shards' from lumen.profile_snapshots where user_id=other_uid)='7';
 for r in select * from lumen_privacy.policy() where action='delete' loop
  execute format('select count(*) from %I.%I where %s',r.ns,r.rel,lumen_privacy.scope_predicate(r.ns,r.rel,r.uid_col,r.actor_col,r.key_col)) into n using u,array[]::text[],array['u:'||u];
  assert n=0,'Remaining owned data in '||r.rel;
 end loop;
 -- Old JWT and privileged delayed upload/log do not recreate an erased scope.
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin perform public.lumen_support(u,'activate');raise exception 'Old account activated support';exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED';end;
 begin perform public.lumen_diagnostic_preference(true);raise exception 'Old account reenabled diagnostics';exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED';end;
 perform set_config('request.jwt.claim.sub','',true);
 begin insert into lumen_commands.support_access(case_id,action) values(c,'download');raise exception 'Delayed case log resurrected';exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED';end;
 begin insert into lumen_commands.support_captures(id,case_id,bytes,sha256,code) values(gen_random_uuid(),c,1,'fixture','manual');raise exception 'Delayed capture resurrected';exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED';end;
 assert lumen_privacy.erase_account(u,array[]::text[],'ERASE LUMEN '||u)->>'status'='erased';
 -- Every current guarded table blocks stale JWT writes, even another row UID.
 perform set_config('request.jwt.claim.sub',u::text,true);
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') loop
  begin execute format('insert into %I.%I default values',r.ns,r.rel);raise exception 'Stale JWT accepted in %',r.rel;
  exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED';end;
 end loop;
 perform set_config('request.jwt.claim.sub','',true);
end $$;
