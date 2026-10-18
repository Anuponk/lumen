-- Disposable PostgreSQL only, after the real ledger and snapshot migrations.
create function lumen_commands.fixture_fail_receipt() returns trigger language plpgsql as $$
begin
 if new.operation_id='receipt-fail' then raise exception 'simulated receipt failure'; end if;
 return new;
end $$;
create trigger fixture_fail_receipt before insert on lumen_commands.canonical_receipts
 for each row execute function lumen_commands.fixture_fail_receipt();
do $$
declare
 uid uuid := gen_random_uuid(); other_uid uuid := gen_random_uuid();
 q text := 'command-fixture-a'; q2 text := 'command-fixture-b';
 result jsonb; original jsonb; receipt jsonb; latest jsonb;
begin
 insert into auth.users values(uid),(other_uid);
 insert into lumen.profile_snapshots(user_id,payload) values
  (uid,'{"solved":{},"badges":{},"xp":42,"shards":7,"skills":{"hint":true},"future":{"keep":true},"canonicalQuestState":{}}'),
  (other_uid,'{"xp":9,"canonicalQuestState":{}}');
 insert into lumen.canonical_quest_allowlist values(q),(q2);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 assert public.lumen_canonical_command_version()=1;
 assert public.lumen_get_canonical_command('unknown',uid) is null;
 result := public.lumen_commit_canonical_command('first',uid,q,'{"speed":true,"autonomy":true}','{"seconds":20,"assisted":false}');
 receipt := public.lumen_get_canonical_command('first',uid);
 assert result->'receipt'=receipt, 'independent lookup confirms exact receipt';
 assert receipt @> '{"operationId":"first","version":1,"newlyCompleted":true}', 'receipt identifies original result';
 assert result->'profile'->>'xp'='57', 'one first reward';
 original := result->'profile';
 -- Change unrelated progress after original commit; a retry must return the latest view.
 update lumen.profile_snapshots set payload=jsonb_set(payload,'{future}','{"keep":true,"later":true}') where user_id=uid;
 select payload into latest from lumen.profile_snapshots where user_id=uid;
 result := public.lumen_commit_canonical_command('first',uid,q,'{"autonomy":true,"speed":true}','{"assisted":false,"seconds":20}');
 assert result->'receipt'=receipt and result->>'replayed'='true', 'same JSON evidence/order-independent retry returns original receipt';
 assert result->'profile'=latest, 'never return an obsolete stored snapshot';
 assert (select count(*) from lumen_commands.canonical_receipts where user_id=uid)=1;
 begin
  perform public.lumen_commit_canonical_command('first',uid,q,'{"mastery":true}','{"seconds":20}');
  raise exception 'changed badges accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.lumen_commit_canonical_command('first',uid,q,'{"autonomy":true,"speed":true}','{"seconds":19}');
  raise exception 'changed performance accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.lumen_commit_canonical_command('first',uid,q2,'{"autonomy":true,"speed":true}','{"seconds":20,"assisted":false}');
  raise exception 'changed quest accepted';
 exception when invalid_parameter_value then null; end;
 assert public.lumen_get_canonical_command('first',uid)=receipt, 'mismatch cannot replace receipt';
 assert (select payload from lumen.profile_snapshots where user_id=uid)=latest;
 begin
  perform public.lumen_commit_canonical_command('late-account',other_uid,q,'{}');
  raise exception 'wrong expected account accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.lumen_get_canonical_command('first',other_uid);
  raise exception 'wrong receipt account accepted';
 exception when insufficient_privilege then null; end;
 begin
  perform public.lumen_get_canonical_command('first',null);
  raise exception 'null receipt account accepted';
 exception when insufficient_privilege then null; end;
 assert public.lumen_get_canonical_command('late-account',uid) is null;
 assert (select payload from lumen.profile_snapshots where user_id=uid)=latest;
 result := public.lumen_commit_canonical_command('badge-run',uid,q,'{"noError":true}');
 assert result->'receipt'->>'newlyCompleted'='false';
 assert result->'profile'->>'xp'='57';
 assert coalesce(result->'profile'->'canonicalQuestState'->q->'badges'->>'mastery','false')='false', 'separate runs cannot manufacture mastery';
 assert (select count(*) from lumen.canonical_reward_events where user_id=uid)=1;
 original := result->'profile';
 begin
  perform public.lumen_commit_canonical_command('receipt-fail',uid,q2,'{}');
  raise exception 'receipt failure did not abort';
 exception when others then assert sqlerrm='simulated receipt failure'; end;
 assert not exists(select 1 from lumen.canonical_reward_events where user_id=uid and quest_id=q2), 'receipt and reward roll back together';
 assert public.lumen_get_canonical_command('receipt-fail',uid) is null;
 assert (select payload from lumen.profile_snapshots where user_id=uid)=original;
 begin
  perform public.lumen_commit_canonical_command('invalid-quest',uid,'not-allowlisted','{}');
  raise exception 'invalid quest accepted';
 exception when others then assert sqlerrm='unknown canonical quest'; end;
 assert public.lumen_get_canonical_command('invalid-quest',uid) is null;
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 assert public.lumen_get_canonical_command('first',other_uid) is null, 'receipt lookup is scoped to auth identity';
 result := public.lumen_commit_canonical_command('first',other_uid,q,'{}');
 assert result->'profile'->>'xp'='19', 'same operation identity allowed for another user only';
 assert (select payload from lumen.profile_snapshots where user_id=uid)=original;
 assert not has_table_privilege('authenticated','lumen_commands.canonical_receipts','select');
 assert not has_table_privilege('authenticated','lumen_commands.canonical_receipts','insert');
 assert not has_function_privilege('anon','public.lumen_commit_canonical_command(text,uuid,text,jsonb,jsonb)','execute');
 assert not has_function_privilege('anon','lumen_commands.get_canonical(text,uuid)','execute');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 set local role authenticated;
 assert public.lumen_canonical_command_version()=1;
 assert public.lumen_get_canonical_command('first',uid)=receipt, 'public invoker wrapper reaches private definer';
 result := public.lumen_commit_canonical_command('first',uid,q,'{"autonomy":true,"speed":true}','{"seconds":20,"assisted":false}');
 assert result->>'replayed'='true';
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.lumen_get_canonical_command('first',uid);
  raise exception 'missing auth accepted';
 exception when insufficient_privilege then null; end;
 reset role;
end $$;
drop trigger fixture_fail_receipt on lumen_commands.canonical_receipts;
drop function lumen_commands.fixture_fail_receipt();
