-- Disposable users only, run after the real complete migration chain.
begin;
do $test$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();other uuid;q text;rev integer;f jsonb;r jsonb;b jsonb;p jsonb;i integer;t timestamptz:=clock_timestamp()-interval '2 minutes';
begin
 update lumen_commands.ranking_control set activated_at=clock_timestamp()-interval '1 day';
 insert into auth.users values(u),(v);
 select quest_id,grid_revision into q,rev from lumen_commands.quest_rules where legacy_index is null order by quest_id limit 1;
 insert into lumen.profile_snapshots(user_id,payload) values(u,'{"solved":{},"badges":{},"stars":{},"performances":{},"challenges":{},"canonicalQuestState":{},"xp":0,"shards":7,"future":true}');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.lumen_commit_wallet_command('wallet-establish-v1',u,'{"kind":"establish"}');
 b:=public.lumen_ranking_board(q,rev);
 assert jsonb_array_length(b->'rows')=10,'Ten labeled echoes before any human';
 assert (select bool_and((x->>'virtual')::boolean) from jsonb_array_elements(b->'rows') x),'Echoes always identified';
 assert b->'rows'->0->'user_id' is null and b->'rows'->0->'key' is null,'No technical identities exposed';
 r:=public.lumen_ranking_begin('ranking-first',q,rev,t);assert r->'eligible'='true','First attempt eligible';
 assert public.lumen_ranking_begin('ranking-first',q,rev,t)=r,'Idempotent begin';
 begin perform public.lumen_ranking_begin('ranking-first',q,rev,t-interval '1 second');raise exception 'Changed launch accepted';exception when invalid_parameter_value then null;end;
 r:=public.lumen_ranking_finish('ranking-first',1,2);assert r->>'status'='membership_required','No implicit publication';
 perform public.lumen_ranking_membership(true,'Test player');
 assert public.lumen_ranking_finish('ranking-first',1,2)->>'status'='pending','No victory no score';
 f:=jsonb_build_object('seconds',60,'assistanceUsed',true,'hintUsed',true,'mistakeCommitted',false,'qualifying',true,'challengeFailed',true,'qualifiedDay',current_date::text,'qualifiedAt',t);
 r:=public.lumen_commit_quest_command('ranking-first',u,q,f);p:=r->'profile';
 r:=public.lumen_ranking_finish('ranking-first',1,2);assert r->>'status'='confirmed' and r->'improved'='true','Published after receipt';
 assert (select score=85 and seconds=60 and penalty=25 from lumen_commands.ranking_scores where user_id=u and quest_id=q),'Server computes +15 and two +5 penalties';
 assert (select payload=p from lumen.profile_snapshots where user_id=u),'Ranking cannot change progress or wallet';
 assert public.lumen_ranking_finish('ranking-first',1,2)->'improved'='false','Retry does not repeat celebration';
 begin perform public.lumen_ranking_finish('ranking-first',0,2);raise exception 'Changed counters accepted';exception when invalid_parameter_value then null;end;
 r:=public.lumen_ranking_begin('ranking-too-soon',q,rev,clock_timestamp());assert r->'eligible'='false','Cooldown enforced at launch';
 -- Time passing after an ineligible launch cannot change its eligibility.
 update lumen_commands.ranking_runs set issued_at=issued_at-interval '1 hour',started_at=started_at-interval '1 hour' where user_id=u and operation_id='ranking-first';
 assert public.lumen_ranking_begin('ranking-too-soon',q,rev,(select started_at from lumen_commands.ranking_runs where user_id=u and operation_id='ranking-too-soon'))->'eligible'='false','Launch stays frozen';
 r:=public.lumen_ranking_begin('ranking-later',q,rev,clock_timestamp()-interval '1 minute');assert r->'eligible'='true','After fifteen minutes a new launch can compete';
 perform set_config('request.jwt.claim.sub',v::text,true);
 begin perform public.lumen_ranking_finish('ranking-first',1,2);raise exception 'Another player finished the run';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.lumen_ranking_membership(false,null);
 assert not exists(select 1 from lumen_commands.ranking_scores where user_id=u),'Withdrawal removes public scores';
 assert (select count(*) from lumen_commands.ranking_runs where user_id=u)=3,'Withdrawal cannot reset cooldown';
 begin perform public.lumen_ranking_membership(true,'someone@example.org');raise exception 'Email accepted as public name';exception when invalid_parameter_value then null;end;
 assert (select count(*)=3 from lumen_privacy.policy() where rel in ('ranking_members','ranking_runs','ranking_scores')),'Privacy inventory covers every new table';
 perform public.lumen_ranking_membership(true,'Test player');
 insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values(u,q,rev,205,0);
 for i in 1..37 loop
  other:=gen_random_uuid();insert into auth.users values(other);
  insert into lumen_commands.ranking_members values(other,'Player '||i,true);
  insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values(other,q,rev,i*10,0);
 end loop;
 b:=public.lumen_ranking_board(q,rev);
 assert jsonb_array_length(b->'rows')=11 and b->'rows'->0->'place'='1' and b->'rows'->1->'place'='16' and b->'rows'->6->'mine'='true' and b->'rows'->10->'place'='25','First plus five better and four following';
 assert (select bool_and(x->'virtual'='false') from jsonb_array_elements(b->'rows') x),'Ten real players retire all virtual opponents';
 update lumen_commands.ranking_scores set seconds=1 where user_id=u;
 b:=public.lumen_ranking_board(q,rev);assert jsonb_array_length(b->'rows')=10 and b->'rows'->0->'mine'='true','Top-ten view';
 update lumen_commands.ranking_scores set seconds=1000 where user_id=u;
 b:=public.lumen_ranking_board(q,rev);assert b->'rows'->1->'place'='29' and b->'rows'->10->'mine'='true','Bottom boundary fills ten neighbors';
 update lumen_commands.ranking_scores set seconds=370 where user_id=u;
 b:=public.lumen_ranking_board(q,rev);assert (select x->'place'='37' from jsonb_array_elements(b->'rows') x where x->'mine'='true'),'Equal scores share rank';
 perform set_config('request.jwt.claim.sub','',true);
 perform lumen_privacy.erase_account(u,array[]::text[],'ERASE LUMEN '||u::text);
 assert not exists(select 1 from lumen_commands.ranking_members where user_id=u) and not exists(select 1 from lumen_commands.ranking_runs where user_id=u) and not exists(select 1 from lumen_commands.ranking_scores where user_id=u),'Existing erasure covers all ranking data';
 assert exists(select 1 from lumen_commands.ranking_scores where user_id=other),'Other player remains intact';
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin perform public.lumen_ranking_membership(true,'Resurrection');raise exception 'Erased player re-enrolled';exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED';end;
end $test$;
set local role anon;
do $$begin
 begin perform public.lumen_ranking_board('quest',0);raise exception 'Anonymous API access';exception when insufficient_privilege then null;end;
 begin perform * from lumen_commands.ranking_scores;raise exception 'Anonymous table access';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$begin
 begin perform * from lumen_commands.ranking_scores;raise exception 'Direct table access';exception when insufficient_privilege then null;end;
end $$;
rollback;
