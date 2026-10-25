-- Disposable database only. Synthetic identities, real command/guard functions.
do $$
declare a integer;b integer;l jsonb;r jsonb;joined jsonb;
begin
 for a in 0..15 loop for b in 0..15 loop
  l:=jsonb_build_object('speed',(a&1)>0,'autonomy',(a&2)>0,'noError',(a&4)>0,'mastery',(a&8)>0);
  r:=jsonb_build_object('speed',(b&1)>0,'autonomy',(b&2)>0,'noError',(b&4)>0,'mastery',(b&8)>0);
  joined:=lumen_commands.recover_positive_flags(l,r,true);
  assert joined=lumen_commands.recover_positive_flags(r,l,true),'badge merge commutative';
  assert joined=lumen_commands.recover_positive_flags(joined,joined,true),'badge merge idempotent';
  assert (joined->>'mastery')::boolean=((a&8)>0 or (b&8)>0),'no invented Mastery';
 end loop;end loop;
 joined:=lumen_commands.recover_performance('{"time":45,"bestTime":10,"autoUsed":true,"attempts":3}', '{"time":30,"bestTime":20,"autoUsed":false,"attempts":2}');
 assert joined->'time'='30' and joined->'autoUsed'='false','coherent fastest saved run, not combined assistance';
 assert joined->'bestTime'='10' and joined->'attempts'='3','independent monotone summary lower bounds';
 assert lumen_commands.recover_performance('{"time":0,"bestTime":0}', '{"time":5,"bestTime":5}')->'bestTime'='0';
end $$;
create function lumen_commands.fixture_recovery_failure() returns trigger language plpgsql as $$
begin
 if new.payload->'badges'->'recoveryRollback'='1'::jsonb then raise exception 'simulated recovery failure';end if;
 return new;
end $$;
create trigger zz_fixture_recovery_failure before update of payload on lumen.profile_snapshots
 for each row execute function lumen_commands.fixture_recovery_failure();
do $$
declare uid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();q text;q2 text;q3 text;idx integer;idx2 integer;
 p jsonb;l jsonb;r jsonb;again jsonb;f jsonb;money jsonb;initial jsonb;receipt jsonb;receipts integer;archives integer;
begin
 insert into auth.users values(uid),(other);
 select quest_id into q from lumen_commands.quest_rules where legacy_index is null order by quest_id limit 1;
 select quest_id into q2 from lumen_commands.quest_rules where legacy_index is null and quest_id<>q order by quest_id limit 1;
 select legacy_index into idx from lumen_commands.quest_rules where legacy_index is not null order by legacy_index limit 1;
 select legacy_index into idx2 from lumen_commands.quest_rules where legacy_index is not null and legacy_index<>idx order by legacy_index limit 1;
 select quest_id into q3 from lumen_commands.quest_rules where legacy_index=idx2;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 insert into lumen.profile_snapshots(user_id,payload) values(uid,'{"solved":{},"badges":{},"shards":10,"xp":0,"futureServer":{"keep":"exact"}}'::jsonb||jsonb_build_object('canonicalQuestState',jsonb_build_object(q2,'{"solved":false,"futureStart":"keep"}'::jsonb)));
 perform public.lumen_commit_wallet_command('wallet-establish-v1',uid,'{"kind":"establish"}');
 perform public.lumen_commit_wallet_command('recovery-spend-reset-0-hint-1',uid,'{"kind":"hint","attemptId":"recovery-spend","resetCount":0,"sequence":1}');
 f:='{"seconds":45,"assistanceUsed":false,"mistakeCommitted":true,"qualifying":true,"hintUsed":false,"challengeFailed":false,"qualifiedDay":"2026-10-24","qualifiedAt":"2026-10-24T10:00:00.000Z"}';
 perform public.lumen_commit_quest_command('committed-before-recovery',uid,q,f);
 receipt:=public.lumen_get_quest_command('committed-before-recovery',uid);
 select payload into p from lumen.profile_snapshots where user_id=uid;
 money:=p-'solved'-'performances'-'canonicalQuestState'-'badges';
 initial:=p->'canonicalQuestState'->q->'performance';
 select count(*) into receipts from lumen_commands.wallet_receipts where user_id=uid;
 l:=jsonb_build_object('solved',jsonb_build_object(idx,1),'badges','{"recovered":1}'::jsonb,
  'shards',999,'walletRevision',999,'xp',0,'futureLocal','{"uninterpreted":"preserve"}'::jsonb,
  'performances',jsonb_build_object(idx,'{"time":37,"bestTime":37,"version":3,"attempts":2,"badges":{"noError":true},"futureRun":{"keep":1}}'::jsonb),
  'canonicalQuestState',jsonb_build_object(q,jsonb_build_object('solved',true,'stars',1,
   'performance','{"seconds":30,"assisted":false,"bestTime":30}'::jsonb,'badges','{"noError":true}'::jsonb),
   q2,'{"solved":true,"stars":1,"performance":{"seconds":42,"assisted":true},"badges":{"speed":true}}'::jsonb));
 -- Reproduce the original protection: positive local facts cannot use old CAS.
 begin perform public.lumen_cas_profile(p,p||jsonb_build_object('solved',l->'solved'));
  raise exception 'ordinary writer bypassed authority';exception when invalid_parameter_value then null;end;
 r:=public.lumen_reconcile_acquisitions(uid,p,l)->'profile';
 assert r->'solved'->idx::text='1';
 assert r->'badges'->'recovered'='1';
 assert r->'canonicalQuestState'->q2->'solved'='true';
 assert r->'canonicalQuestState'->q2->'futureStart'='"keep"','uncompleted remote metadata retained';
 assert r->'canonicalQuestState'->q->'badges'->'noError'='true';
 assert r->'canonicalQuestState'->q->'badges'->'speed'='true';
 assert r->'canonicalQuestState'->q->'badges'->'mastery' is distinct from 'true'::jsonb,'never synthesize Mastery from different runs';
 assert r->'canonicalQuestState'->q->'performance'=initial,'first completion evidence remains immutable';
 assert r->'canonicalQuestState'->q->'runPerformance'->'bestTime'='30';
 assert r-'solved'-'performances'-'canonicalQuestState'-'badges'=money,'wallet/daily/cursors/XP and unknown server fields unchanged';
 assert not(r ? 'futureLocal'),'unknown local data is isolated in the archive';
 assert exists(select 1 from lumen_commands.acquisition_recovery_sources where user_id=uid and source=l);
 assert exists(select 1 from lumen_commands.acquisition_recovery_sources where user_id=uid and source=p);
 assert (select count(*)=receipts from lumen_commands.wallet_receipts where user_id=uid),'no Wallet operation minted';
 again:=public.lumen_reconcile_acquisitions(uid,r,l)->'profile';assert again=r,'idempotent lost-response replay';
 select count(*) into archives from lumen_commands.acquisition_recovery_sources where user_id=uid;
 perform public.lumen_reconcile_acquisitions(uid,r,l);
 assert (select count(*)=archives from lumen_commands.acquisition_recovery_sources where user_id=uid),'no duplicate source archive';
 assert public.lumen_reconcile_acquisitions(uid,p,l) is null,'stale device uses bounded CAS retry';
 -- A later command is a replay, never another first-win credit after import.
 again:=public.lumen_commit_quest_command('after-recovery',uid,q2,f);
 assert again->'outcome'->'firstCompletion'='false';
 assert again->'profile'->'xp'=r->'xp','recovered first win does not re-credit XP';
 again:=public.lumen_commit_wallet_command('recovery-spend-reset-0-hint-1',uid,'{"kind":"hint","attemptId":"recovery-spend","resetCount":0,"sequence":1}');
 assert again->'request' is not null;
 -- Committed receipts remain byte-for-byte immutable and spend is not repeated.
 assert public.lumen_get_quest_command('committed-before-recovery',uid)=receipt;
 select payload into p from lumen.profile_snapshots where user_id=uid;
 l:=jsonb_build_object('solved','{}'::jsonb,'badges','{}'::jsonb,'performances',jsonb_build_object(idx2,'{"future":true}'::jsonb),
  'canonicalQuestState',jsonb_build_object(q3,'{"solved":true,"stars":0,"badges":{"speed":true},"performance":{"seconds":29}}'::jsonb));
 r:=public.lumen_reconcile_acquisitions(uid,p,l)->'profile';assert r->'solved'->idx2::text='1','unknown run field does not block other progress';
 assert r->'performances'->idx2::text->'badges'->'speed'='true','stable identity restores its numeric compatibility performance';
 select count(*) into archives from lumen_commands.acquisition_recovery_sources where user_id=uid;
 begin
  perform public.lumen_reconcile_acquisitions(uid,r,l||'{"badges":{"recoveryRollback":1}}');
  raise exception 'failed snapshot committed';
 exception when raise_exception then if sqlerrm<>'simulated recovery failure' then raise;end if;end;
 assert (select payload=r from lumen.profile_snapshots where user_id=uid),'snapshot rollback';
 assert (select projection=lumen_commands.legacy_projection(r) from lumen_commands.legacy_authority where user_id=uid),'authority rollback';
 assert (select count(*)=archives from lumen_commands.acquisition_recovery_sources where user_id=uid),'failed recovery archive rollback';
 begin perform public.lumen_reconcile_acquisitions(other,r,l);raise exception 'foreign owner accepted';exception when insufficient_privilege then null;end;
 begin perform public.lumen_reconcile_acquisitions(uid,r,'{"solved":[],"badges":{}}');raise exception 'corrupt profile accepted';exception when invalid_parameter_value then null;end;
 -- Ordinary writers remain guarded against loss, even after the recovery RPC.
 begin perform public.lumen_cas_profile(r,r||'{"solved":{}}');raise exception 'old writer erased recovery';exception when invalid_parameter_value then null;end;
end $$;
drop trigger zz_fixture_recovery_failure on lumen.profile_snapshots;
drop function lumen_commands.fixture_recovery_failure();
-- Permission boundary: no unauthenticated RPC or direct archive/merge helper.
do $$begin
 assert not has_function_privilege('anon','public.lumen_reconcile_acquisitions(uuid,jsonb,jsonb)','execute');
 assert not has_table_privilege('authenticated','lumen_commands.acquisition_recovery_sources','select');
 assert not has_function_privilege('authenticated','lumen_commands.recover_performance(jsonb,jsonb)','execute');
 assert (select relrowsecurity from pg_class where oid='lumen_commands.acquisition_recovery_sources'::regclass);
end $$;
select set_config('request.jwt.claim.sub',user_id::text,false) from lumen.profile_snapshots
 where payload->'badges'->'recovered'='1'::jsonb limit 1;
set role authenticated;
do $$begin
 assert public.lumen_reconcile_acquisitions(auth.uid(),public.lumen_restore_profile(),'{"solved":{},"badges":{}}')->>'policy'='positive-acquisitions-v1';
 begin perform lumen_commands.recover_performance('{}','{}');raise exception 'private helper exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set role anon;
do $$begin
 begin perform public.lumen_reconcile_acquisitions(auth.uid(),'{}','{}');raise exception 'anonymous recovery exposed';exception when insufficient_privilege then null;end;
end $$;
reset role;
