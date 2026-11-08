-- Disposable database only: export and erasure of both reset epochs.
reset role;
set request.jwt.claim.sub='';
begin isolation level repeatable read read only;
do $$
declare report jsonb;entry jsonb;
begin
 report:=lumen_privacy.export_account('64300000-0000-0000-0000-000000000001',array[]::text[]);
 select value into entry from jsonb_array_elements(report->'tables'->'lumen_commands.quest_run_authority')
  where value->>'quest_id'='pack-real-adventure-05-q004';
 assert entry->'reset_info'->>'revision'='2';
 assert entry->'reset_info'->'history'->0->'previous'->'runPerformance'->>'bestTime'='15','Original epoch is exportable';
 assert entry->'reset_info'->'previous'->'runPerformance'->>'bestTime'='20','Previous epoch is exportable';
 assert entry->'projection'->'runPerformance'->>'bestTime'='120','Current record is exportable';
end $$;
commit;
begin;
do $$
declare uid uuid:='64300000-0000-0000-0000-000000000001';
begin
 perform lumen_privacy.erase_account(uid,array[]::text[],'ERASE LUMEN '||uid);
 assert not exists(select 1 from lumen_commands.quest_run_authority where user_id=uid),'All reset epochs are erased together';
 assert not exists(select 1 from lumen.profile_snapshots where user_id=uid);
 assert exists(select 1 from auth.users where id=uid),'Lumen erasure does not erase shared Auth';
 assert (select grid_revision=2 from lumen_commands.quest_rules where quest_id='pack-real-adventure-05-q004'),'Reference catalogue remains intact';
end $$;
rollback;
