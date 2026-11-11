-- Disposable PostgreSQL only; never execute fixtures against player accounts.
do $test$
declare u uuid;q text;idx integer;revision integer;f jsonb;r jsonb;rec jsonb;receipt jsonb;n integer;path text[];old jsonb;
begin
 assert lumen_commands.merge_official_times('{"0":150,"2":80}','{"0":135,"3":90}')='{"0":135,"2":80,"3":90}';
 assert lumen_commands.recover_performance('{"officialTimes":{"0":150,"2":80}}','{"officialTimes":{"0":135,"3":90}}')->'officialTimes'='{"0":135,"2":80,"3":90}';
 for n in 1..2 loop
  u:=gen_random_uuid();insert into auth.users values(u);
  select quest_id,legacy_index,grid_revision into q,idx,revision from lumen_commands.quest_rules
   where grid_revision=0 and (legacy_index is not null)=(n=1) order by quest_id limit 1;
  assert q is not null;
  insert into lumen.profile_snapshots(user_id,payload) values(u,'{"solved":{},"badges":{},"stars":{},"performances":{},"challenges":{},"canonicalQuestState":{},"xp":0,"shards":7,"future":true}');
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.lumen_commit_wallet_command('wallet-establish-v1',u,'{"kind":"establish"}');
  f:=jsonb_build_object('seconds',150,'assistanceUsed',false,'hintUsed',false,'mistakeCommitted',false,'qualifying',false,'challengeFailed',true,'qualifiedDay','2026-11-11','qualifiedAt','2026-11-11T10:00:00Z');
  r:=public.lumen_commit_quest_command('old-immutable',u,q,f);
  receipt:=r->'request';
  path:=case when idx is null then array['canonicalQuestState',q,'runPerformance'] else array['performances',idx::text] end;
  f:=f||jsonb_build_object('seconds',60,'assistanceUsed',true,'hintUsed',true,'timing',jsonb_build_object('version',1,'gridRevision',revision,'helpUses','{"hint":5,"verify":0,"guided":0}'::jsonb));
  r:=public.lumen_commit_quest_command('official-135',u,q,f);rec:=r->'profile'#>path;
  assert rec->'bestTime'='60' and rec->'officialTimes'->'0'='135','Technical raw retained, official 2:15';
  assert r->'outcome'->'priorPerformance'->'officialTimes'->'0'='150','Comparable historical zero-penalty baseline in new receipt';
  assert rec->'bestUnassistedTime'='150','Badge/assistance record unchanged';
  assert public.lumen_commit_quest_command('official-135',u,q,f)=r,'Duplicate returns identical transaction result';
  begin perform public.lumen_commit_quest_command('official-135',u,q,jsonb_set(f,'{timing,helpUses,hint}','4'));raise exception 'forged replay accepted';exception when invalid_parameter_value then null;end;
  r:=public.lumen_commit_quest_command('official-equal',u,q,f);
  assert r->'outcome'->'priorPerformance'->'officialTimes'->'0'='135','Equality cannot announce first record';
  f:=jsonb_set(f,'{timing,helpUses,hint}','3');
  r:=public.lumen_commit_quest_command('official-105',u,q,f);
  assert r->'profile'#>path->'officialTimes'->'0'='105';
  begin perform public.lumen_commit_quest_command('wrong-grid',u,q,jsonb_set(f,'{timing,gridRevision}','999'));raise exception 'wrong revision accepted';exception when invalid_parameter_value then null;end;
  begin perform public.lumen_commit_quest_command('free-penalty',u,q,jsonb_set(f,'{timing,penalty}','0'));raise exception 'free penalty accepted';exception when invalid_parameter_value then null;end;
  begin perform public.lumen_commit_quest_command('fractional-aid',u,q,jsonb_set(f,'{timing,helpUses,guided}','0.5'));raise exception 'fractional aid accepted';exception when invalid_parameter_value then null;end;
  assert (select request from lumen_commands.legacy_receipts where user_id=u and operation_id='old-immutable') is not distinct from case when idx is not null then receipt end;
  assert (select request from lumen_commands.canonical_receipts where user_id=u and operation_id='old-immutable') is not distinct from case when idx is null then receipt end;
  -- An already competitive penalized score is never reimported as raw seconds.
  insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values(u,q,0,60,75);
  assert lumen_commands.official_prior('{"bestTime":60}',u,q,0)='{"0":135}';
  assert lumen_commands.official_prior('{"bestTime":110}',u,q,0)='{"0":110}';
  assert lumen_commands.official_prior('{"bestTime":60}',u,q,2)='{}','Revision separation';
  assert lumen_commands.official_prior('{"officialTimes":{"0":110}}',u,q,0)='{"0":110}','Idempotent baseline';
  assert (select min(seconds) from lumen_commands.ranking_history_candidates where user_id=u and quest_id=q)=150,'Historical import uses the immutable pre-rollout baseline, never the new raw 60 or official 105';
  assert exists(select 1 from lumen_commands.ranking_history_candidates where user_id=u and quest_id=q and source='official_baseline' and seconds=150);
 end loop;
end $test$;

begin;
do $ranking$
declare u uuid:=gen_random_uuid();q text;t timestamptz:=clock_timestamp()-interval '2 minutes';f jsonb;r jsonb;p jsonb;
begin
 update lumen_commands.ranking_control set activated_at=clock_timestamp()-interval '1 day';
 insert into auth.users values(u);
 select quest_id into q from lumen_commands.quest_rules where grid_revision=0 order by quest_id limit 1;
 insert into lumen.profile_snapshots(user_id,payload) values(u,'{"solved":{},"badges":{},"stars":{},"performances":{},"challenges":{},"canonicalQuestState":{},"xp":0,"shards":7}');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.lumen_commit_wallet_command('wallet-establish-v1',u,'{"kind":"establish"}');
 perform public.lumen_set_nickname('Official clock QA');
 perform public.lumen_ranking_membership(true,null);
 assert public.lumen_ranking_begin('same-official-clock',q,0,t)->'eligible'='true';
 f:=jsonb_build_object('seconds',60,'assistanceUsed',true,'hintUsed',true,'mistakeCommitted',false,'qualifying',true,'challengeFailed',true,'qualifiedDay',current_date::text,'qualifiedAt',t,'timing','{"version":1,"gridRevision":0,"helpUses":{"hint":5,"verify":0,"guided":0}}'::jsonb);
 r:=public.lumen_commit_quest_command('same-official-clock',u,q,f);p:=r->'profile';
 begin perform public.lumen_ranking_finish('same-official-clock',4,0);raise exception 'Underreported hints accepted';exception when invalid_parameter_value then null;end;
 assert public.lumen_ranking_finish('same-official-clock',5,0)->>'status'='confirmed';
 assert (select seconds=60 and penalty=75 and score=135 from lumen_commands.ranking_scores where user_id=u and quest_id=q);
 assert public.lumen_get_official_records(q,0)->'officialTimes'->'0'='135';
 assert public.lumen_ranking_board(q,0)->'personal'->'score'='135','Personal and public use the same official time';
 assert public.lumen_ranking_finish('same-official-clock',5,0)->'improved'='false';
 assert (select payload=p from lumen.profile_snapshots where user_id=u),'Ranking leaves all acquisitions untouched';
 perform public.lumen_ranking_membership(false,null);
 assert public.lumen_get_official_records(q,0)->'officialTimes'->'0'='135','Withdrawal never erases private records';
 assert not has_function_privilege('anon','public.lumen_get_official_records(text,integer)','execute');
 assert not has_function_privilege('authenticated','lumen_commands.official_records(jsonb,jsonb,uuid,text)','execute');
 assert lumen_commands.official_time('{"seconds":60,"assistanceUsed":true,"hintUsed":true,"timing":{"version":1,"gridRevision":0,"helpUses":{"hint":1,"verify":1,"guided":1}}}',0)=85;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_get_official_records(q,0);raise exception 'Anonymous record access accepted';exception when insufficient_privilege then null;end;
end $ranking$;
rollback;
