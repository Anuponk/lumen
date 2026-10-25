-- Disposable database only; verify public endpoints under the real client role.
begin;
insert into auth.users(id) values('00000000-0000-0000-0000-000000009101');
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009101';
set local role authenticated;
do $$begin
 assert public.lumen_guest_claim_version()=0;
 begin perform public.lumen_claim_guest_profile(auth.uid(),jsonb_build_object('claimId',gen_random_uuid()));raise exception 'inactive endpoint accepted';exception when sqlstate '55000' then null;end;
 begin perform lumen_commands.claim_guest_profile_v1(auth.uid(),'{}');raise exception 'old implementation exposed';exception when insufficient_privilege then null;end;
 begin perform lumen_commands.set_sync_cohort(auth.uid(),'active',repeat('a',40),repeat('b',64));raise exception 'browser activated itself';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into lumen_commands.sync_release_approvals values(repeat('a',40),1,repeat('b',64),now());
do $$begin
 perform lumen_commands.set_sync_cohort(auth.uid(),'shadow',repeat('a',40),repeat('b',64));
 assert public.lumen_guest_claim_version()=0;
 begin perform lumen_commands.set_sync_cohort(auth.uid(),'active',repeat('a',40),repeat('b',64));raise exception 'paused activation accepted';exception when sqlstate '55000' then null;end;
 begin perform lumen_commands.set_sync_cohort(auth.uid(),'active',repeat('a',40),repeat('c',64));raise exception 'unapproved evidence accepted';exception when invalid_parameter_value then null;end;
end $$;
update lumen_commands.sync_rollout_control set allow_new_activations=true;
select lumen_commands.set_sync_cohort(auth.uid(),'active',repeat('a',40),repeat('b',64));
update lumen_commands.sync_rollout_control set allow_new_activations=false;
select lumen_commands.set_sync_cohort(auth.uid(),'active',repeat('a',40),repeat('b',64));
do $$begin
 assert (select count(*) from lumen_commands.sync_cohort_events where user_id=auth.uid())=2;
 begin perform lumen_commands.set_sync_cohort(auth.uid(),'shadow',repeat('a',40),repeat('b',64));raise exception 'active cohort downgraded';exception when invalid_parameter_value then null;end;
end $$;
set local role authenticated;
do $$declare m jsonb;r jsonb;raw text:='{"solved":{"0":1},"badges":{},"shards":2,"xp":10}';begin
 assert public.lumen_guest_claim_version()=1;
 m:=jsonb_build_object('version',1,'userId',auth.uid(),'claimId',gen_random_uuid(),'policy','new-profile-net-balance-v1','sourceRaw',raw,'seedRaw',raw,'sourceDigest',encode(sha256(convert_to(raw,'UTF8')),'hex'),'seedDigest',encode(sha256(convert_to(raw,'UTF8')),'hex'));
 r:=public.lumen_claim_guest_profile(auth.uid(),m);
 assert r->>'status'='initialized';
 assert public.lumen_claim_guest_profile(auth.uid(),m)=r;
end $$;
reset role;
rollback;
