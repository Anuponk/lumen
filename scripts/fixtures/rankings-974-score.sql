-- New 20/50/30 score, authoritative durable badges and historical upgrade.
-- Synthetic identities only. Transport, profile and ranking source records remain private.
do $$begin if current_database()<>'lumen_test' then raise exception 'Disposable rankings fixture requires lumen_test';end if;end$$;
begin;
do $test$
declare meta record;ids uuid[];q text;lq text;loadq text;legacy integer;a text;c text;rev integer;abandoned uuid:=gen_random_uuid();started timestamptz;
 result jsonb;source_hash text;before_tid text;before_rebuild jsonb;after_rebuild jsonb;
begin
 select * into strict meta from ranking_974_upgrade;ids:=meta.players;q:=meta.quest;a:=meta.adventure;c:=meta.constellation;
 assert (select points=70 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1]),'old first place without badges becomes 70';
 assert (select points=75 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[2]),'durable badges can put a regular performer ahead';
 assert (select points=20 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[3]);
 select md5(jsonb_agg(to_jsonb(s) order by s.user_id)::text) into source_hash from lumen_commands.ranking_scores s where s.quest_id=q;
 assert source_hash=meta.source_hash,'migration never rewrites chronometric records';
 assert lumen_commands.ranking_points(1,1,false,false)=70;
 assert lumen_commands.ranking_points(1,1,true,true)=100;
 assert lumen_commands.ranking_points(2,5,false,false)=58,'round halves up';
 assert lumen_commands.ranking_points(51,101,true,true)=75;
 assert lumen_commands.ranking_points(101,101,true,true)=50;
 assert lumen_commands.ranking_points(1,2147483647,true,true)=100,'no integer overflow';
 assert lumen_commands.ranking_points(0,3,true,true)=0 and lumen_commands.ranking_points(4,3,true,true)=0;
 assert not has_function_privilege('authenticated','lumen_commands.ranking_badge_mask(jsonb)','execute');
 assert not has_function_privilege('authenticated','lumen_commands.ranking_points(integer,integer,boolean,boolean)','execute');
 assert not has_table_privilege('authenticated','lumen_commands.ranking_quest_points','select');
 assert (select relrowsecurity from pg_class where oid='lumen_commands.ranking_quest_points'::regclass);
 insert into auth.users(id) values(abandoned);
 insert into lumen.profiles(user_id,nickname) values(abandoned,'Unranked974');
 insert into lumen_commands.quest_run_authority(user_id,quest_id,projection)
  values(abandoned,q,'{"badges":{"autonomy":true,"noError":true}}');
 insert into lumen_commands.ranking_runs(user_id,operation_id,quest_id,grid_revision,started_at,eligible,result)
  select abandoned,'fixture-abandon974',q,grid_revision,now(),false,'{"qualified":false}'::jsonb from lumen_commands.quest_rules where quest_id=q;
 assert not exists(select 1 from lumen_commands.ranking_quest_points where user_id=abandoned),'unranked or abandoned run has zero points even with badges';

 -- No badges may be inferred from an old zero-penalty time. Add a durable badge
 -- after a slower qualified attempt: the official time stays untouched.
 insert into lumen_commands.quest_run_authority(user_id,quest_id,projection)
  values(ids[1],q,'{"badges":{"autonomy":true},"runPerformance":{"bestTime":999}}');
 assert (select points=85 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1]);
 update lumen_commands.quest_run_authority set projection=jsonb_set(projection,'{badges,noError}','true') where user_id=ids[1] and quest_id=q;
 assert (select points=100 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1]);
 select ctid::text into before_tid from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1];
 update lumen_commands.quest_run_authority set projection=jsonb_set(projection,'{badges,speed}','true') where user_id=ids[1] and quest_id=q;
 update lumen_commands.quest_run_authority set projection=jsonb_set(projection,'{badges,mastery}','true') where user_id=ids[1] and quest_id=q;
 update lumen_commands.quest_run_authority set projection=projection where user_id=ids[1] and quest_id=q;
 assert (select ctid::text=before_tid and points=100 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1]),'replays/speed/mastery create no extra points or writes';
 select md5(jsonb_agg(to_jsonb(s) order by s.user_id)::text) into source_hash from lumen_commands.ranking_scores s where s.quest_id=q;
 assert source_hash=meta.source_hash,'badge changes preserve source record and qualification';

 -- Reset drops only the current durable badge bonus; chrono qualification is
 -- still the existing source contract, never reconstructed from an old badge.
 update lumen_commands.quest_run_authority set projection='{"badges":{},"solved":false}',reset_info='{"revision":1}' where user_id=ids[1] and quest_id=q;
 assert (select points=70 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1]);

 -- Equal official times use rank(), with N distinct visible players.
 update lumen_commands.ranking_scores set seconds=10 where quest_id=q and user_id=ids[2];
 assert (select points=100 and place=1 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[2]);
 assert (select place=1 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1]);
 assert (select place=3 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[3]);
 update lumen_commands.ranking_members set participating=false where user_id=ids[2];
 assert not exists(select 1 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[2]);
 assert (select points=20 and place=2 from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[3]);
 update lumen_commands.ranking_members set participating=true where user_id=ids[2];

 -- Legacy badges are read from the server's legacy projection, never from
 -- unversioned raw autonomy/noError flags or from the client profile.
 select quest_id,legacy_index,grid_revision into strict lq,legacy,rev from lumen_commands.quest_rules
 where legacy_index is not null and quest_id in(select quest_id from lumen_commands.ranking_groups)
 and not exists(select 1 from lumen_commands.ranking_scores s where s.quest_id=lumen_commands.quest_rules.quest_id) order by quest_id limit 1;
 insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values(ids[1],lq,rev,15,0);
 assert (select points=70 from lumen_commands.ranking_quest_points where quest_id=lq and user_id=ids[1]);
 insert into lumen_commands.legacy_authority(user_id,revision,projection)
 values(ids[1],1,jsonb_build_object('performances',jsonb_build_object(legacy::text,jsonb_build_object('version',3,'badges',jsonb_build_object('autonomy',true,'noError',true)))));
 assert (select points=100 from lumen_commands.ranking_quest_points where quest_id=lq and user_id=ids[1]);
 update lumen_commands.legacy_authority set projection=jsonb_build_object('performances',jsonb_build_object(legacy::text,'{"version":1,"autonomy":true,"noError":true}'::jsonb)) where user_id=ids[1];
 assert (select points=70 from lumen_commands.ranking_quest_points where quest_id=lq and user_id=ids[1]),'unknown old badges are not invented';
 update lumen_commands.legacy_authority set projection=jsonb_build_object('performances',jsonb_build_object(legacy::text,'{"version":3,"badges":{"autonomy":true,"noError":true}}'::jsonb)) where user_id=ids[1];
 insert into lumen_commands.quest_run_authority(user_id,quest_id,projection,reset_info)
 values(ids[1],lq,'{"badges":{}}','{"revision":1}');
 assert (select points=70 from lumen_commands.ranking_quest_points where quest_id=lq and user_id=ids[1]),'reset overrides legacy badge recovery';

 -- A newer grid cannot accidentally inherit a chronometric score. The old
 -- source remains for history, but contributes no points to the current grid.
 select grid_revision into rev from lumen_commands.quest_rules where quest_id=q;
 update lumen_commands.quest_rules set grid_revision=rev+1 where quest_id=q;
 assert not exists(select 1 from lumen_commands.ranking_quest_points where quest_id=q);
 update lumen_commands.quest_rules set grid_revision=rev where quest_id=q;

 perform set_config('request.jwt.claim.sub',ids[1]::text,true);
 set local role authenticated;
 result:=public.lumen_group_ranking('adventure',a);
 assert result->>'scoringVersion'='2';
 assert (result->>'maxPoints')::integer=100*(result->>'questTotal')::integer;
 assert jsonb_array_length(result->'rows')=0,'default view does not fetch a page';
 assert result->'personal'->>'place' is not null;
 assert result::text not like '%'||ids[1]::text||'%','no account identifiers';
 result:=public.lumen_group_ranking('adventure',a,3,10);
 assert jsonb_array_length(result->'rows')=0,'three players need no duplicated rows';
 assert jsonb_array_length(result->'top')=0 and result->'personal'='null'::jsonb,'pages do not reread or resend cached podium and personal summary';
 reset role;

 -- A large quest refresh remains local. Each statement coalesces all its rows;
 -- N and rank changes must refresh every affected score, never another quest.
 select g.quest_id into strict loadq from lumen_commands.ranking_groups g join lumen_commands.quest_rules r using(quest_id)
 where g.adventure_id=a and g.quest_id<>q and r.legacy_index is null
 and not exists(select 1 from lumen_commands.ranking_scores s where s.quest_id=g.quest_id) order by g.quest_id limit 1;
 insert into auth.users(id) select md5('load974-'||i)::uuid from generate_series(1,1001) i;
 insert into lumen.profiles(user_id,nickname) select md5('load974-'||i)::uuid,'Load974_'||i from generate_series(1,1001) i;
 insert into lumen_commands.ranking_members select md5('load974-'||i)::uuid,'Load974_'||i,true from generate_series(1,1001) i;
 select grid_revision into rev from lumen_commands.quest_rules where quest_id=loadq;
 select ctid::text into before_tid from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1];
 started:=clock_timestamp();
 insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty)
  select md5('load974-'||i)::uuid,loadq,rev,i,0 from generate_series(1,1000) i;
 raise notice '#974 1000-player statement refresh ms=%',extract(epoch from clock_timestamp()-started)*1000;
 assert (select count(*)=1000 and min(points)=20 and max(points)=70 from lumen_commands.ranking_quest_points where quest_id=loadq);
 insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty)
  values(md5('load974-1001')::uuid,loadq,rev,1001,0);
 assert not exists(select 1 from lumen_commands.ranking_quest_points where quest_id=loadq
  and points<>20+round(50::numeric*(1001-place)/1000)::integer),'N changes refresh every proportional score';
 assert (select ctid::text=before_tid from lumen_commands.ranking_quest_points where quest_id=q and user_id=ids[1]),'no write to an unrelated quest';

 -- An explicit rebuild, repeated, is a no-op after incremental updates.
 select jsonb_agg(to_jsonb(t)-'updated_at' order by adventure_id,user_id) into before_rebuild from lumen_commands.ranking_adventure_totals t;
 perform lumen_commands.ranking_rebuild();perform lumen_commands.ranking_rebuild();
 select jsonb_agg(to_jsonb(t)-'updated_at' order by adventure_id,user_id) into after_rebuild from lumen_commands.ranking_adventure_totals t;
 assert before_rebuild=after_rebuild,'incremental totals equal reconstruction';
 assert not exists(select 1 from lumen_commands.ranking_adventure_totals t cross join lateral (
  select sum(p.points)::integer points,count(*)::integer quests from lumen_commands.ranking_quest_points p join lumen_commands.ranking_groups g using(quest_id)
  where p.user_id=t.user_id and g.adventure_id=t.adventure_id) expected where (t.points,t.quests) is distinct from (expected.points,expected.quests));
 delete from auth.users where id=ids[3];
 assert not exists(select 1 from lumen_commands.ranking_quest_points where user_id=ids[3]);
end
$test$;
rollback;
-- Remove only the synthetic upgrade accounts committed before the migration.
delete from auth.users where id=any((select players from ranking_974_upgrade)::uuid[]);
drop table ranking_974_upgrade;
