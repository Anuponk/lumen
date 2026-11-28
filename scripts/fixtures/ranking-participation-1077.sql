-- Disposable PostgreSQL only; synthetic players, rolled back. #1077: every
-- participating player with a certain resolution appears in the adventure's general
-- ranking with positive points; a resolution without a usable official time gives
-- participation points (no time, no speed place, timed players unchanged); history
-- is imported on joining; projection changes keep the chain consistent; audit = 0.
begin;
do $$
declare
 ids uuid[] := array(select ('00000000-0000-4000-8000-0000107700'||lpad(g::text,2,'0'))::uuid from generate_series(1,7) g);
 a uuid; b uuid; c uuid; d uuid; e uuid; f uuid; o uuid;
 lq text; lidx integer; adv text; cq text; adv2 text; r jsonb; pts integer; owner_ uuid:='00000000-0000-4000-8000-000010779999';
begin
 a:=ids[1];b:=ids[2];c:=ids[3];d:=ids[4];e:=ids[5];f:=ids[6];o:=ids[7];
 -- A legacy quest on its original grid, and a canonical quest of the same adventure.
 select q.quest_id,q.legacy_index,g.adventure_id into lq,lidx,adv from lumen_commands.quest_rules q join lumen_commands.ranking_groups g using(quest_id)
  where q.legacy_index is not null order by q.legacy_index limit 1;
 update lumen_commands.quest_rules set grid_revision=0 where quest_id=lq;
 -- A canonical-only quest (no legacy index): its badges come from its own projection.
 select q.quest_id,g.adventure_id into cq,adv2 from lumen_commands.quest_rules q join lumen_commands.ranking_groups g using(quest_id)
  where q.legacy_index is null order by q.quest_id limit 1;
 assert lq is not null and cq is not null,'fixture quests';
 update lumen_commands.ranking_control set historical_enabled=true;
 insert into auth.users(id) select unnest(ids||owner_);
 insert into lumen.profiles(user_id,nickname) select ids[i],'P1077_'||i from generate_series(1,7) i;
 insert into lumen_commands.ranking_members(user_id,nickname,participating) select ids[i],'P1077_'||i,true from generate_series(1,5) i
  on conflict (user_id) do update set participating=true;
 update lumen.profiles set ranking_opted_out=true where user_id=c;
 insert into lumen.internal_capabilities(user_id,capability) values(owner_,'analytics_cockpit');

 -- b: timed result on the legacy quest (the only timed participant).
 insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values(b,lq,0,50,0);
 assert (select points from lumen_commands.ranking_quest_points where user_id=b and quest_id=lq)=70,'one timed participant = 20 + 50';
 -- a: legacy resolution without any time, with the durable autonomy badge.
 insert into lumen_commands.legacy_authority(user_id,revision,projection) values
  (a,1,jsonb_build_object('solved',jsonb_build_object(lidx::text,1),'performances',jsonb_build_object(lidx::text,jsonb_build_object('badges',jsonb_build_object('autonomy',true))))),
  -- c: opted out; d: legacy solved but a scoped reset overrides it.
  (c,1,jsonb_build_object('solved',jsonb_build_object(lidx::text,1),'performances','{}'::jsonb)),
  (d,1,jsonb_build_object('solved',jsonb_build_object(lidx::text,1),'performances','{}'::jsonb));
 insert into lumen_commands.quest_run_authority(user_id,quest_id,projection,reset_info) values(d,lq,'{"solved":false}','{"resetRevision":0}');
 select points into pts from lumen_commands.ranking_quest_points where user_id=a and quest_id=lq;
 assert pts=35,'participation = 20 + durable autonomy badge, got '||coalesce(pts::text,'none');
 assert (select place from lumen_commands.ranking_quest_points where user_id=a and quest_id=lq) is null,'no speed place without a time';
 assert (select points from lumen_commands.ranking_quest_points where user_id=b and quest_id=lq)=70,'the timed player is unchanged';
 assert not exists(select 1 from lumen_commands.ranking_scores where user_id=a),'no invented time';
 assert not exists(select 1 from lumen_commands.ranking_quest_points where user_id=c),'opted-out players stay out';
 assert not exists(select 1 from lumen_commands.ranking_quest_points where user_id=d),'a scoped reset overrides the legacy resolution';
 assert (select points from lumen_commands.ranking_adventure_totals where user_id=a and adventure_id=adv)=35,'a appears in the general ranking';

 -- e: canonical quest solved later (late sync) -> participation through the trigger.
 insert into lumen_commands.quest_run_authority(user_id,quest_id,projection) values(e,cq,'{"solved":false}');
 assert not exists(select 1 from lumen_commands.ranking_quest_points where user_id=e),'not solved, no points';
 update lumen_commands.quest_run_authority set projection='{"solved":true,"badges":{"noError":true}}' where user_id=e and quest_id=cq;
 assert (select points from lumen_commands.ranking_quest_points where user_id=e and quest_id=cq)=35,'late resolution gets participation';
 -- A later official time replaces the participation row (one row per quest, no double points).
 insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty)
  select e,cq,grid_revision,90,0 from lumen_commands.quest_rules where quest_id=cq;
 assert (select count(*) from lumen_commands.ranking_quest_points where user_id=e and quest_id=cq)=1;
 assert (select place from lumen_commands.ranking_quest_points where user_id=e and quest_id=cq)=1,'timed place once a time exists';
 assert (select points from lumen_commands.ranking_adventure_totals where user_id=e and adventure_id=adv2)=85,'20 + 50 + 15';

 -- f: usable history (cloud snapshot, original grid) imported when joining the ranking.
 insert into lumen.profile_snapshots(user_id,payload) values(f,jsonb_build_object('performances',jsonb_build_object(lidx::text,jsonb_build_object('bestTime',40))));
 insert into lumen_commands.legacy_authority(user_id,revision,projection) values(f,1,jsonb_build_object('solved',jsonb_build_object(lidx::text,1),'performances','{}'::jsonb));
 assert not exists(select 1 from lumen_commands.ranking_quest_points where user_id=f),'not participating yet';
 insert into lumen_commands.ranking_members(user_id,nickname,participating) values(f,'P1077_6',true) on conflict (user_id) do update set participating=true;
 assert (select seconds from lumen_commands.ranking_scores where user_id=f and quest_id=lq)=40,'history imported on joining';
 assert exists(select 1 from lumen_commands.ranking_import_backup where user_id=f and quest_id=lq),'traced import';
 assert (select place from lumen_commands.ranking_quest_points where user_id=f and quest_id=lq)=1,'faster than b';

 -- Withdrawal removes every point, including participation.
 update lumen_commands.ranking_members set participating=false where user_id=a;
 assert not exists(select 1 from lumen_commands.ranking_quest_points where user_id=a),'withdrawal respected';
 assert not exists(select 1 from lumen_commands.ranking_adventure_totals where user_id=a and adventure_id=adv);
 update lumen_commands.ranking_members set participating=true where user_id=a;
 assert (select points from lumen_commands.ranking_adventure_totals where user_id=a and adventure_id=adv)=35,'back on rejoining';

 -- Idempotent rebuild and a clean audit.
 r:=lumen_commands.ranking_rebuild();
 r:=lumen_commands.ranking_rebuild();
 assert (r->>'changed_quest_points')::int=0,'second rebuild changes nothing: '||r::text;
 r:=lumen_commands.ranking_coverage_audit();
 assert (r->>'missingPairs')::int=0 and (r->>'absentPlayerAdventures')::int=0 and (r->>'totalsMismatch')::int=0,'audit: '||r::text;
 -- The audit detects a resolution left without points.
 delete from lumen_commands.ranking_quest_points where user_id=a;
 r:=lumen_commands.ranking_coverage_audit();
 assert (r->>'missingPairs')::int>=1 and (r->>'totalsMismatch')::int>=1,'audit detects: '||r::text;
 perform lumen_commands.ranking_refresh_user(a);
 r:=lumen_commands.ranking_coverage_audit();
 assert (r->>'missingPairs')::int=0 and (r->>'totalsMismatch')::int=0,'repaired: '||r::text;

 -- Cockpit access: capability only, aggregates only.
 assert not has_function_privilege('anon','public.lumen_admin_ranking_coverage()','EXECUTE');
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin perform public.lumen_admin_ranking_coverage();raise exception 'player read the audit';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_::text,true);
 r:=public.lumen_admin_ranking_coverage();
 assert position(a::text in r::text)=0,'no identifier';
end $$;
rollback;
