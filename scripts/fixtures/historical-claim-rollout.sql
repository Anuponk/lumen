-- Disposable PostgreSQL only; all users and saves are synthetic.
insert into auth.users(id) values('00000000-0000-0000-0000-000000009001'),('00000000-0000-0000-0000-000000009002'),('00000000-0000-0000-0000-000000009003');
create function lumen_commands.fixture_guest_manifest(owner uuid,cid uuid) returns jsonb language sql as $$
 select jsonb_build_object('version',1,'userId',owner,'claimId',cid,'policy','new-profile-net-balance-v1',
  'sourceRaw',raw,'seedRaw',raw,'sourceDigest',encode(sha256(convert_to(raw,'UTF8')),'hex'),'seedDigest',encode(sha256(convert_to(raw,'UTF8')),'hex'))
 from (values ('{"solved":{"0":1},"badges":{},"shards":2,"xp":10,"unknown":{"original":"étoile"}}')) as s(raw)
$$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000009001';
set role authenticated;
do $$begin
 begin perform 1 from lumen_commands.guest_claim_receipts;raise exception 'private claim exposed';exception when insufficient_privilege then null;end;
 begin perform 1 from lumen_commands.sync_cohorts;raise exception 'private cohorts exposed';exception when insufficient_privilege then null;end;
 assert public.lumen_sync_contract(auth.uid())->>'stage'='compatibility';
 begin perform public.lumen_sync_contract('00000000-0000-0000-0000-000000009002');raise exception 'foreign contract';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$declare m jsonb;r jsonb;begin
 m:=lumen_commands.fixture_guest_manifest(auth.uid(),'10000000-0000-0000-0000-000000000001');
 r:=public.lumen_claim_guest_profile(auth.uid(),m);
 assert r->>'status'='initialized';
 assert public.lumen_claim_guest_profile(auth.uid(),m)=r;
 assert public.lumen_get_guest_claim(auth.uid(),(m->>'claimId')::uuid)=r;
 assert (select count(*) from lumen_commands.guest_claim_receipts where user_id=auth.uid())=1;
 assert public.lumen_restore_profile()->'unknown'='{"original":"étoile"}';
 begin perform public.lumen_claim_guest_profile(auth.uid(),m||'{"policy":"add-balance"}');raise exception 'changed policy';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_claim_guest_profile(auth.uid(),m||'{"sourceDigest":"bad"}');raise exception 'bad digest';exception when invalid_parameter_value then null;end;
 begin perform public.lumen_claim_guest_profile('00000000-0000-0000-0000-000000009002',m);raise exception 'wrong account';exception when insufficient_privilege then null;end;
 assert public.lumen_claim_guest_profile(auth.uid(),lumen_commands.fixture_guest_manifest(auth.uid(),'10000000-0000-0000-0000-000000000002'))->>'status'='review_required';
 assert (select count(*) from lumen_commands.guest_claim_receipts where user_id=auth.uid())=1;
end $$;
-- Receipt insertion failure must roll back the profile creation too.
create function lumen_commands.fixture_reject_guest_receipt() returns trigger language plpgsql as $$
begin if new.user_id='00000000-0000-0000-0000-000000009002' then raise exception 'synthetic receipt refusal';end if;return new;end $$;
create trigger fixture_reject_guest_receipt before insert on lumen_commands.guest_claim_receipts for each row execute function lumen_commands.fixture_reject_guest_receipt();
set request.jwt.claim.sub='00000000-0000-0000-0000-000000009002';
do $$begin
 begin perform public.lumen_claim_guest_profile(auth.uid(),lumen_commands.fixture_guest_manifest(auth.uid(),'10000000-0000-0000-0000-000000000003'));raise exception 'receipt failure ignored';
 exception when raise_exception then assert sqlerrm='synthetic receipt refusal';end;
 assert public.lumen_restore_profile() is null;
end $$;
drop trigger fixture_reject_guest_receipt on lumen_commands.guest_claim_receipts;
drop function lumen_commands.fixture_reject_guest_receipt();
-- Existing profile remains byte/field-equivalent, without sum/max or receipt.
insert into lumen.profile_snapshots(user_id,payload) values(auth.uid(),'{"solved":{},"badges":{},"shards":1,"other":true}');
do $$begin
 assert public.lumen_claim_guest_profile(auth.uid(),lumen_commands.fixture_guest_manifest(auth.uid(),'10000000-0000-0000-0000-000000000004'))->>'status'='review_required';
 assert public.lumen_restore_profile()->>'shards'='1';
 assert public.lumen_restore_profile()->>'other'='true';
 assert not exists(select 1 from lumen_commands.guest_claim_receipts where user_id=auth.uid());
end $$;
-- Administrative activation is durable and cannot be changed by a browser.
insert into lumen_commands.sync_cohorts(user_id,stage,protocol,revision,evidence_digest) values(auth.uid(),'shadow',1,repeat('a',40),repeat('b',64));
update lumen_commands.sync_cohorts set stage='active' where user_id=auth.uid();
do $$begin
 begin update lumen_commands.sync_cohorts set stage='shadow' where user_id=auth.uid();raise exception 'activation downgraded';exception when invalid_parameter_value then null;end;
 begin delete from lumen_commands.sync_cohorts where user_id=auth.uid();raise exception 'activation deleted';exception when invalid_parameter_value then null;end;
end $$;
set role authenticated;
do $$begin
 assert public.lumen_sync_contract(auth.uid())->>'stage'='active';
 begin update lumen_commands.sync_cohorts set stage='shadow';raise exception 'browser activated';exception when insufficient_privilege then null;end;
 begin perform public.lumen_get_guest_claim('00000000-0000-0000-0000-000000009001','10000000-0000-0000-0000-000000000001');raise exception 'foreign receipt';exception when insufficient_privilege then null;end;
end $$;
reset role;
set role anon;
do $$begin
 begin perform public.lumen_guest_claim_version();raise exception 'anonymous claim protocol';exception when insufficient_privilege then null;end;
end $$;
reset role;
drop function lumen_commands.fixture_guest_manifest(uuid,uuid);
