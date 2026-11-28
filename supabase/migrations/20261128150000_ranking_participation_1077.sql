-- #1077 (with #974), owner decision 28/11/2026: every participating player who has
-- solved at least one quest of an adventure appears in that adventure's general
-- ranking with strictly positive points, whatever the age of the grid, the time
-- or the source of the resolution.
--
-- Audit 28/11 (production, before): 28 eligible players, 3 335 certain resolutions,
-- 1 028 without any quest points (19 players, 8 adventures), 10 player-adventures
-- absent from the general ranking (e.g. Badoune: 100 solved quests in « Horizons
-- lointains », 0 point). Causes: (a) the historical import of 11/11 ran ONCE: 494
-- usable records (grid unchanged, valid time, player participating) arrived or became
-- eligible later and were never imported; (b) a certain resolution without a usable
-- official time (revised grid without proof, missing time, unqualified run) produced
-- no score at all.
--
-- Rules (unchanged scale, #974 27/11): a timed result keeps 20 completion + 50
-- proportional performance + 15/15 durable badges. A CERTAIN resolution without a
-- usable official time on the current grid now gives PARTICIPATION points: 20
-- completion + the same durable badges (15/15), no speed place (place null), no time
-- and no change to the timed participants count (the others' points are unchanged).
-- Certain resolution = canonical projection solved, or legacy projection solved when
-- no scoped reset overrides it (same precedence as the badges).
--
-- Repair: idempotent and auditable. History is re-imported through the existing
-- import_ranking_history (backup per batch, rollback_ranking_history), quest points
-- are rebuilt from the sources. Rollback: re-apply 20261127051221 (previous rules)
-- then ranking_rebuild(); rollback_ranking_history('<batch>') for imported times.
-- Prevention: projection triggers also react to solved changes; joining the ranking
-- imports the player's history; lumen_commands.ranking_coverage_audit() detects any
-- certain resolution without points (CI fixture + cockpit).
begin;
set local lock_timeout='5s';
lock table lumen.profiles,lumen_commands.quest_rules,lumen_commands.ranking_members,
 lumen_commands.legacy_authority,lumen_commands.quest_run_authority,lumen_commands.ranking_scores,
 lumen_commands.ranking_quest_points,lumen_commands.ranking_constellation_totals,
 lumen_commands.ranking_adventure_totals in share row exclusive mode;

-- A participation row has no speed place.
alter table lumen_commands.ranking_quest_points alter column place drop not null;

-- Eligible certain solvers of one quest with their durable badge mask.
create or replace function lumen_commands.ranking_certain_solvers(p_quest_id text)
returns table(user_id uuid,bonus integer) language sql stable security definer set search_path='' as $$
 with r as (select legacy_index from lumen_commands.quest_rules where quest_id=p_quest_id),
 c as (select a.user_id,a.projection,a.reset_info from lumen_commands.quest_run_authority a where a.quest_id=p_quest_id),
 l as (select la.user_id,la.projection from lumen_commands.legacy_authority la cross join r where r.legacy_index is not null),
 s as (
  select coalesce(c.user_id,l.user_id) user_id,
   case when c.reset_info<>'{}' or (select legacy_index from r) is null then c.projection->'badges'
    else l.projection#>array['performances',(select legacy_index from r)::text,'badges'] end badges
  from c full join l on l.user_id=c.user_id
  where c.projection->>'solved'='true'
   or (l.projection->'solved'->>((select legacy_index from r)::text) in ('1','true') and coalesce(c.reset_info,'{}')='{}'))
 select s.user_id,lumen_commands.ranking_badge_mask(s.badges)
 from s join lumen_commands.ranking_members m using(user_id) join lumen.profiles p using(user_id)
 where m.participating and p.nickname_ready and not p.ranking_opted_out and exists(select 1 from auth.users u where u.id=s.user_id)
$$;
revoke all on function lumen_commands.ranking_certain_solvers(text) from public,anon,authenticated,service_role;

-- Quests a player has certainly solved (any adventure).
create or replace function lumen_commands.ranking_solved_quests(p_user uuid)
returns table(quest_id text) language sql stable security definer set search_path='' as $$
 select a.quest_id from lumen_commands.quest_run_authority a where a.user_id=p_user and a.projection->>'solved'='true'
 union
 select q.quest_id from lumen_commands.legacy_authority l join lumen_commands.quest_rules q on q.legacy_index is not null
  where l.user_id=p_user and l.projection->'solved'->>(q.legacy_index::text) in ('1','true')
   and not exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=p_user and a.quest_id=q.quest_id and a.reset_info<>'{}')
$$;
revoke all on function lumen_commands.ranking_solved_quests(uuid) from public,anon,authenticated,service_role;

create or replace function lumen_commands.ranking_refresh_quest(p_quest_id text)
returns integer language plpgsql security definer set search_path='' as $$
declare g lumen_commands.ranking_groups; v_revision integer; v_legacy integer; v_fresh jsonb; v_affected uuid[];
begin
 if p_quest_id is null then return 0; end if;
 select * into g from lumen_commands.ranking_groups where quest_id = p_quest_id;
 if not found then return 0; end if;
 perform pg_advisory_xact_lock(hashtextextended('lumen-ranking-adventure:'||g.adventure_id,0));
 perform pg_advisory_xact_lock(hashtextextended('lumen-ranking-quest:'||p_quest_id,0));
 select grid_revision,legacy_index into v_revision,v_legacy from lumen_commands.quest_rules where quest_id = p_quest_id;
 if not found then return 0; end if;
 with timed as (
  select s.user_id, rank() over (order by s.score)::integer as place,
         count(*) over()::integer as participants,lumen_commands.ranking_badge_mask(b.badges) as bonus
    from lumen_commands.ranking_scores s
    join lumen_commands.ranking_members m using (user_id)
    join lumen.profiles p using (user_id)
    left join lumen_commands.quest_run_authority a on a.user_id=s.user_id and a.quest_id=s.quest_id
    left join lumen_commands.legacy_authority l on l.user_id=s.user_id and v_legacy is not null
    cross join lateral (select case when a.reset_info<>'{}' or v_legacy is null then a.projection->'badges'
      else l.projection#>array['performances',v_legacy::text,'badges'] end as badges) b
   where s.quest_id = p_quest_id and s.grid_revision = v_revision
     and m.participating and p.nickname_ready and not p.ranking_opted_out),
 -- #1077: certain resolution without a usable official time on the current grid.
 participation as (
  select c.user_id,c.bonus from lumen_commands.ranking_certain_solvers(p_quest_id) c
   where not exists(select 1 from timed t where t.user_id=c.user_id))
 select coalesce(jsonb_agg(x),'[]'::jsonb) into v_fresh from (
  select jsonb_build_object('u',user_id,'p',place,'pt',lumen_commands.ranking_points(place,participants,(bonus & 1)=1,(bonus & 2)=2)) x from timed
  union all
  select jsonb_build_object('u',user_id,'p',null,'pt',20+case when (bonus & 1)=1 then 15 else 0 end+case when (bonus & 2)=2 then 15 else 0 end) from participation) z;
 select array_agg(distinct coalesce(n.u, o.user_id) order by coalesce(n.u, o.user_id)) into v_affected
   from jsonb_to_recordset(v_fresh) as n(u uuid, p integer, pt integer)
   full join (select user_id, place, points from lumen_commands.ranking_quest_points where quest_id = p_quest_id) o on o.user_id = n.u
  where n.u is null or o.user_id is null or n.p is distinct from o.place or n.pt <> o.points;
 if v_affected is null then return 0; end if;
 delete from lumen_commands.ranking_quest_points q
  where q.quest_id = p_quest_id and q.user_id = any(v_affected)
    and not exists (select 1 from jsonb_to_recordset(v_fresh) as n(u uuid, p integer, pt integer) where n.u = q.user_id);
 insert into lumen_commands.ranking_quest_points (quest_id, user_id, place, points)
 select p_quest_id, n.u, n.p, n.pt from jsonb_to_recordset(v_fresh) as n(u uuid, p integer, pt integer)
  where n.u = any(v_affected) order by n.u
 on conflict (quest_id, user_id) do update set place = excluded.place, points = excluded.points;
 perform lumen_commands.ranking_retotal(g.constellation_id, g.adventure_id, v_affected);
 return cardinality(v_affected);
end $$;
revoke all on function lumen_commands.ranking_refresh_quest(text) from public,anon,authenticated,service_role;

create or replace function lumen_commands.ranking_refresh_user(p_user uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare q text; n integer := 0;
begin
 for q in select ids.quest_id from (select s.quest_id from lumen_commands.ranking_scores s where s.user_id=p_user
          union select r.quest_id from lumen_commands.ranking_quest_points r where r.user_id=p_user
          union select x.quest_id from lumen_commands.ranking_solved_quests(p_user) x) ids
          join lumen_commands.ranking_groups g using(quest_id) order by g.adventure_id,ids.quest_id loop
  n := n + lumen_commands.ranking_refresh_quest(q);
 end loop;
 return n;
end $$;
revoke all on function lumen_commands.ranking_refresh_user(uuid) from public,anon,authenticated,service_role;

create or replace function lumen_commands.ranking_rebuild()
returns jsonb language plpgsql security definer set search_path='' as $$
declare q text; affected integer := 0; quests integer := 0; r record;
begin
 -- Every grouped quest: a certain resolution may exist without any score.
 for q in select g.quest_id from lumen_commands.ranking_groups g order by g.adventure_id,g.quest_id loop
  affected := affected + lumen_commands.ranking_refresh_quest(q); quests := quests + 1;
 end loop;
 for r in select distinct g.constellation_id, g.adventure_id from lumen_commands.ranking_groups g loop
  perform lumen_commands.ranking_retotal(r.constellation_id, r.adventure_id, array(
   select t.user_id from lumen_commands.ranking_constellation_totals t where t.constellation_id = r.constellation_id
   union select t.user_id from lumen_commands.ranking_adventure_totals t where t.adventure_id = r.adventure_id
   union select q.user_id from lumen_commands.ranking_quest_points q join lumen_commands.ranking_groups g using (quest_id)
          where g.constellation_id = r.constellation_id));
 end loop;
 return jsonb_build_object('quests', quests, 'changed_quest_points', affected);
end $$;
revoke all on function lumen_commands.ranking_rebuild() from public,anon,authenticated,service_role;

-- Projection triggers: a change of solved state, durable badges or reset refreshes
-- the quest, with or without an official score (participation points).
create or replace function lumen_commands.ranking_quest_badges_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if tg_op='INSERT' then
  for r in select distinct n.quest_id,g.adventure_id from new_badges n join lumen_commands.ranking_groups g using(quest_id)
   where n.projection->>'solved'='true' or n.reset_info<>'{}'
      or exists(select 1 from lumen_commands.ranking_scores s where s.user_id=n.user_id and s.quest_id=n.quest_id)
      or exists(select 1 from lumen_commands.ranking_quest_points q where q.user_id=n.user_id and q.quest_id=n.quest_id)
   order by g.adventure_id,n.quest_id loop perform lumen_commands.ranking_refresh_quest(r.quest_id);end loop;
 else
  for r in select distinct n.quest_id,g.adventure_id from new_badges n join old_badges o using(user_id,quest_id) join lumen_commands.ranking_groups g using(quest_id)
   where (n.projection->>'solved',n.projection#>'{badges,autonomy}',n.projection#>'{badges,noError}',n.reset_info)
     is distinct from (o.projection->>'solved',o.projection#>'{badges,autonomy}',o.projection#>'{badges,noError}',o.reset_info)
   order by g.adventure_id,n.quest_id loop perform lumen_commands.ranking_refresh_quest(r.quest_id);end loop;
 end if;
 return null;
end $$;
revoke all on function lumen_commands.ranking_quest_badges_changed() from public,anon,authenticated,service_role;

create or replace function lumen_commands.ranking_legacy_badges_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if tg_op='INSERT' then
  for r in select distinct q.quest_id,g.adventure_id from new_badges n
   join lumen_commands.quest_rules q on q.legacy_index is not null
   join lumen_commands.ranking_groups g on g.quest_id=q.quest_id
   where n.projection->'solved'->>(q.legacy_index::text) in ('1','true')
      or exists(select 1 from lumen_commands.ranking_scores s where s.user_id=n.user_id and s.quest_id=q.quest_id)
   order by g.adventure_id,q.quest_id loop perform lumen_commands.ranking_refresh_quest(r.quest_id);end loop;
 else
  for r in select distinct q.quest_id,g.adventure_id from new_badges n join old_badges o using(user_id)
   join lumen_commands.quest_rules q on q.legacy_index is not null
   join lumen_commands.ranking_groups g on g.quest_id=q.quest_id
   where not exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=n.user_id and a.quest_id=q.quest_id and a.reset_info<>'{}')
    and (n.projection->'solved'->>(q.legacy_index::text),n.projection#>array['performances',q.legacy_index::text,'badges','autonomy'],n.projection#>array['performances',q.legacy_index::text,'badges','noError'])
     is distinct from (o.projection->'solved'->>(q.legacy_index::text),o.projection#>array['performances',q.legacy_index::text,'badges','autonomy'],o.projection#>array['performances',q.legacy_index::text,'badges','noError'])
   order by g.adventure_id,q.quest_id loop perform lumen_commands.ranking_refresh_quest(r.quest_id);end loop;
 end if;
 return null;
end $$;
revoke all on function lumen_commands.ranking_legacy_badges_changed() from public,anon,authenticated,service_role;

-- Joining (or becoming visible in) the ranking imports the player's usable history,
-- with the original import's guards and backup, then refreshes all their quests.
create or replace function lumen_commands.import_ranking_history_user(p_user uuid,p_batch uuid default gen_random_uuid())
returns integer language plpgsql security definer set search_path='' as $$
declare r record; s lumen_commands.ranking_scores%rowtype; n integer:=0;
begin
 if p_user is null or not exists(select 1 from lumen_commands.ranking_control where historical_enabled) then return 0;end if;
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||p_user::text,0));
 if not exists(select 1 from lumen.profiles where user_id=p_user and nickname_ready and not ranking_opted_out)
  or not exists(select 1 from auth.users where id=p_user)
  or not exists(select 1 from lumen_commands.ranking_members where user_id=p_user and participating) then return 0;end if;
 for r in select quest_id,grid_revision,min(seconds) seconds from lumen_commands.ranking_history_candidates
  where user_id=p_user and exclusion is null group by 1,2 order by 1 loop
  select * into s from lumen_commands.ranking_scores where user_id=p_user and quest_id=r.quest_id and grid_revision=r.grid_revision for update;
  if s.score is not null and s.score<=r.seconds then continue;end if;
  insert into lumen_commands.ranking_import_backup values(p_batch,p_user,r.quest_id,r.grid_revision,case when s.user_id is not null then to_jsonb(s) end,r.seconds)
   on conflict do nothing;
  insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values(p_user,r.quest_id,r.grid_revision,r.seconds,0)
   on conflict(user_id,quest_id,grid_revision) do update set seconds=excluded.seconds,penalty=0 where lumen_commands.ranking_scores.score>excluded.seconds;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function lumen_commands.import_ranking_history_user(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function lumen_commands.ranking_visibility_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform lumen_commands.import_ranking_history_user(new.user_id);
 perform lumen_commands.ranking_refresh_user(new.user_id);
 return null;
end $$;
revoke all on function lumen_commands.ranking_visibility_changed() from public,anon,authenticated,service_role;

-- Coverage audit (aggregates only): certain resolutions without points, absent
-- player-adventures, totals not matching their quest points.
create or replace function lumen_commands.ranking_coverage_audit()
returns jsonb language sql stable security definer set search_path='' as $$
 with elig as (select m.user_id from lumen_commands.ranking_members m join lumen.profiles p using(user_id)
   where m.participating and p.nickname_ready and not p.ranking_opted_out and exists(select 1 from auth.users u where u.id=m.user_id)),
 solved as (select e.user_id,x.quest_id,g.adventure_id from elig e cross join lateral lumen_commands.ranking_solved_quests(e.user_id) x
   join lumen_commands.ranking_groups g on g.quest_id=x.quest_id),
 missing as (select s.* from solved s where not exists(select 1 from lumen_commands.ranking_quest_points q where q.user_id=s.user_id and q.quest_id=s.quest_id)),
 absent as (select distinct s.user_id,s.adventure_id from solved s where not exists(select 1 from lumen_commands.ranking_adventure_totals t
   where t.user_id=s.user_id and t.adventure_id=s.adventure_id and t.points>0)),
 sums as (select q.user_id,g.adventure_id,sum(q.points) pts,count(*) n from lumen_commands.ranking_quest_points q join lumen_commands.ranking_groups g using(quest_id) group by 1,2),
 mismatch as (select 1 from sums s full join lumen_commands.ranking_adventure_totals t on t.user_id=s.user_id and t.adventure_id=s.adventure_id
   where (s.pts,s.n) is distinct from (t.points,t.quests))
 select jsonb_build_object('eligiblePlayers',(select count(*) from elig),'solvedPairs',(select count(*) from solved),
  'missingPairs',(select count(*) from missing),'playersMissing',(select count(distinct user_id) from missing),
  'absentPlayerAdventures',(select count(*) from absent),'totalsMismatch',(select count(*) from mismatch),
  'participationRows',(select count(*) from lumen_commands.ranking_quest_points where place is null),
  'byAdventure',coalesce((select jsonb_object_agg(adventure_id,n) from (select adventure_id,count(*) n from missing group by 1) z),'{}'::jsonb))
$$;
revoke all on function lumen_commands.ranking_coverage_audit() from public,anon,authenticated,service_role;
create or replace function public.lumen_admin_ranking_coverage()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not lumen_commands.has_capability(auth.uid(),'analytics_cockpit') then
  raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 return lumen_commands.ranking_coverage_audit();
end $$;
revoke all on function public.lumen_admin_ranking_coverage() from public,anon;
grant execute on function public.lumen_admin_ranking_coverage() to authenticated;

-- Repair (idempotent): usable history first (traced batch), then every quest.
do $$
declare v_batch constant uuid:='10770000-0000-4000-8000-000000001077'; v jsonb;
begin
 if exists(select 1 from lumen_commands.ranking_control where historical_enabled) then
  v:=lumen_commands.import_ranking_history(true,v_batch);
  raise notice '#1077 history import %',v;
 end if;
 v:=lumen_commands.ranking_rebuild();
 raise notice '#1077 rebuild % · audit %',v,lumen_commands.ranking_coverage_audit();
end $$;

notify pgrst, 'reload schema';
commit;
