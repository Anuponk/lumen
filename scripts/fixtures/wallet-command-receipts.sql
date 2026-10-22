-- Disposable database only. Never execute on player data.
insert into auth.users(id) values('00000000-0000-0000-0000-000000008001');
insert into lumen.profile_snapshots(user_id,payload) values('00000000-0000-0000-0000-000000008001',
 '{"solved":{},"badges":{},"shards":10,"xp":0,"daily":{"dates":{},"rewards":{}}}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000008001';
set role authenticated;
select public.lumen_commit_wallet_command('attempt-reset-0-hint-1',auth.uid(),'{"kind":"hint","attemptId":"attempt","resetCount":0,"sequence":1}');
-- Lost response: replay must return the original receipt, not debit again.
select public.lumen_commit_wallet_command('attempt-reset-0-hint-1',auth.uid(),'{"kind":"hint","attemptId":"attempt","resetCount":0,"sequence":1}');
do $$begin
 if public.lumen_get_wallet_command('attempt-reset-0-hint-1',auth.uid())->>'balance'<>'9'
 then raise exception 'spend receipt unverified';end if;
 begin
  perform public.lumen_commit_wallet_command('attempt-reset-0-hint-1',auth.uid(),'{"kind":"verify","attemptId":"attempt","resetCount":0,"sequence":1}');
  raise exception 'changed evidence accepted';
 exception when sqlstate '22023' then null;end;
 begin
  perform public.lumen_commit_wallet_command('attempt-reset-0-hint-2','00000000-0000-0000-0000-000000008002','{"kind":"hint","attemptId":"attempt","resetCount":0,"sequence":2}');
  raise exception 'wrong account accepted';
 exception when insufficient_privilege then null;end;
 begin perform 1 from lumen_commands.wallet_receipts;raise exception 'private receipts exposed';exception when insufficient_privilege then null;end;
 begin
  perform public.lumen_cas_profile(public.lumen_restore_profile(),public.lumen_restore_profile(),'00000000-0000-0000-0000-000000008002'::uuid);
  raise exception 'foreign profile CAS accepted';
 exception when insufficient_privilege then null;end;
 assert public.lumen_restore_profile(auth.uid())=public.lumen_restore_profile();
 begin
  perform public.lumen_restore_profile('00000000-0000-0000-0000-000000008002'::uuid);
  raise exception 'foreign profile read accepted';
 exception when insufficient_privilege then null;end;
 begin
  perform public.lumen_initialize_profile('{"solved":{},"badges":{}}','00000000-0000-0000-0000-000000008002'::uuid);
  raise exception 'foreign profile initialization accepted';
 exception when insufficient_privilege then null;end;
end $$;

reset role;
create function lumen_commands.fixture_fail_wallet() returns trigger language plpgsql as $$
begin if new.operation_id='rollback-reset-0-verify-1' then raise exception 'simulated wallet receipt failure';end if;return new;end $$;
create trigger fixture_fail_wallet before insert on lumen_commands.wallet_receipts for each row execute function lumen_commands.fixture_fail_wallet();
do $$declare before_profile jsonb;before_revision bigint;begin
 select payload into before_profile from lumen.profile_snapshots where user_id=auth.uid();
 select revision into before_revision from lumen_commands.wallet_authority where user_id=auth.uid();
 begin
  perform public.lumen_commit_wallet_command('rollback-reset-0-verify-1',auth.uid(),'{"kind":"verify","attemptId":"rollback","resetCount":0,"sequence":1}');
  raise exception 'receipt failure accepted';
 exception when raise_exception then assert sqlerrm='simulated wallet receipt failure';end;
 assert (select payload from lumen.profile_snapshots where user_id=auth.uid())=before_profile;
 assert (select revision from lumen_commands.wallet_authority where user_id=auth.uid())=before_revision;
end $$;
drop trigger fixture_fail_wallet on lumen_commands.wallet_receipts;
drop function lumen_commands.fixture_fail_wallet();
do $$declare p jsonb;begin
 select payload into p from lumen.profile_snapshots where user_id=auth.uid();
 if p->>'shards'<>'9' or (select count(*) from lumen_commands.wallet_receipts where user_id=auth.uid())<>1
 then raise exception 'duplicate debit';end if;
 begin update lumen.profile_snapshots set payload=jsonb_set(payload,'{shards}','10') where user_id=auth.uid();
  raise exception 'stale wallet overwrite accepted';exception when sqlstate '22023' then null;end;
 begin update lumen.profile_snapshots set payload=payload-'walletRevision' where user_id=auth.uid();
  raise exception 'wallet revision removal accepted';exception when sqlstate '22023' then null;end;
end $$;
insert into lumen.daily_progress(user_id,play_date,puzzle_id) values
 (auth.uid(),(now() at time zone 'Europe/Paris')::date-2,1),(auth.uid(),(now() at time zone 'Europe/Paris')::date-1,1);
set role authenticated;
select public.lumen_commit_wallet_command('day-1',auth.uid(),jsonb_build_object('kind','daily','day',(now() at time zone 'Europe/Paris')::date::text,'puzzleId',1));
select public.lumen_commit_wallet_command('day-1',auth.uid(),jsonb_build_object('kind','daily','day',(now() at time zone 'Europe/Paris')::date::text,'puzzleId',1));
select public.lumen_commit_wallet_command('day-another-quest',auth.uid(),jsonb_build_object('kind','daily','day',(now() at time zone 'Europe/Paris')::date::text,'puzzleId',2));
do $$begin
 assert public.lumen_get_wallet_command('day-1',auth.uid())->>'dailyReward'='1';
 begin perform public.lumen_claim_daily(1);raise exception 'old daily claim bypassed activation';exception when sqlstate '22023' then null;end;
 begin perform public.lumen_save_daily(current_date,1);raise exception 'old daily writer bypassed activation';exception when sqlstate '22023' then null;end;
end $$;
reset role;
-- Existing historical commands still work after wallet activation.
select public.lumen_commit_legacy_command('victory-after-spend',auth.uid(),'base-q001',
 jsonb_build_object('seconds',40,'assistanceUsed',false,'mistakeCommitted',false,'qualifying',true,
 'hintUsed',false,'challengeFailed',false,'qualifiedDay',(now() at time zone 'Europe/Paris')::date::text,'qualifiedAt',now()::text));
do $$declare p jsonb;begin
 select payload into p from lumen.profile_snapshots where user_id=auth.uid();
 if (p->>'walletRevision')::int<3 or p->>'shards'<>'10' or not(p->'solved' ? '0') then raise exception 'victory wallet projection failed';end if;
 if (select count(*) from lumen.daily_progress where user_id=auth.uid())<>3 then raise exception 'duplicate daily';end if;
end $$;

-- Activation must not guess whether a historical daily award is already in
-- the scalar balance. Preserve the ambiguous baseline without any authority.
insert into auth.users(id) values('00000000-0000-0000-0000-000000008002');
insert into lumen.profile_snapshots(user_id,payload) values('00000000-0000-0000-0000-000000008002',
 '{"solved":{},"badges":{},"shards":8,"daily":{"dates":{},"rewards":{}}}');
insert into lumen.engagement_state(user_id,rewarded_days) values('00000000-0000-0000-0000-000000008002','{"2026-10-01":1}');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000008002';
do $$declare before_profile jsonb;begin
 select payload into before_profile from lumen.profile_snapshots where user_id=auth.uid();
 begin
  perform public.lumen_commit_wallet_command('wallet-establish-v1',auth.uid(),'{"kind":"establish"}');
  raise exception 'ambiguous historical credit adopted';
 exception when sqlstate '22023' then null;end;
 assert (select payload from lumen.profile_snapshots where user_id=auth.uid())=before_profile;
 assert not exists(select 1 from lumen_commands.wallet_authority where user_id=auth.uid());
 assert not exists(select 1 from lumen_commands.wallet_receipts where user_id=auth.uid());
end $$;
-- Once an existing application receipt agrees, establish is zero-delta and
-- unions confirmed dates without another currency grant.
update lumen.profile_snapshots set payload=jsonb_set(payload,'{daily,rewards}','{"streak:2026-10-01":1}') where user_id=auth.uid();
insert into lumen.daily_progress(user_id,play_date,puzzle_id) values(auth.uid(),'2026-10-01',1);
select public.lumen_commit_wallet_command('wallet-establish-v1',auth.uid(),'{"kind":"establish"}');
do $$declare p jsonb;begin
 select payload into p from lumen.profile_snapshots where user_id=auth.uid();
 assert p->>'shards'='8' and p->'daily'->'dates' ? '2026-10-01';
 assert public.lumen_get_wallet_command('wallet-establish-v1',auth.uid())->>'balanceDelta'='0';
end $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000008001';
