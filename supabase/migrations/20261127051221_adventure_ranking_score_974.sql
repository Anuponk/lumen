-- #974 owner decision 27/11: 20 completion + 50 proportional performance + 15/15 durable badges.
-- No source record, receipt, qualification, wallet or achievement is changed.
begin;
set local lock_timeout='5s';
-- Drain existing score/badge writers before replacing functions, so an in-flight
-- old-scale transaction cannot overwrite the rebuilt points after cutover.
-- Reads remain possible; a busy database aborts this migration after 5 seconds.
lock table lumen.profiles,lumen_commands.quest_rules,lumen_commands.ranking_members,
 lumen_commands.legacy_authority,lumen_commands.quest_run_authority,lumen_commands.ranking_scores,
 lumen_commands.ranking_quest_points,lumen_commands.ranking_constellation_totals,
 lumen_commands.ranking_adventure_totals in share row exclusive mode;
create or replace function lumen_commands.ranking_points(p_place integer,p_participants integer,p_autonomy boolean,p_no_error boolean)
returns integer language sql immutable set search_path='' as $$
 select case when p_place is null or p_participants is null or p_place<1 or p_participants<p_place then 0
 else 20+case when p_participants=1 then 50
  else round(50::numeric*(p_participants-p_place)/(p_participants-1))::integer end
  +case when p_autonomy then 15 else 0 end+case when p_no_error then 15 else 0 end end
$$;
revoke all on function lumen_commands.ranking_points(integer,integer,boolean,boolean) from public,anon,authenticated,service_role;

-- Durable badges, not the latest run and never inferred from a historical time.
-- A reset projection overrides legacy recovery, even when all its badges are empty.
create or replace function lumen_commands.ranking_badge_mask(p_badges jsonb)
returns integer language sql immutable set search_path='' as $$
 select (case when p_badges->>'autonomy' in ('true','1') then 1 else 0 end)
  +(case when p_badges->>'noError' in ('true','1') then 2 else 0 end)
$$;
revoke all on function lumen_commands.ranking_badge_mask(jsonb) from public,anon,authenticated,service_role;

create or replace function lumen_commands.ranking_refresh_quest(p_quest_id text)
returns integer language plpgsql security definer set search_path='' as $$
declare g lumen_commands.ranking_groups; v_revision integer; v_legacy integer; v_fresh jsonb; v_affected uuid[];
begin
 if p_quest_id is null then return 0; end if;
 select * into g from lumen_commands.ranking_groups where quest_id = p_quest_id;
 if not found then return 0; end if;
 -- Serialize totals shared by different quests in this adventure, then this quest.
 perform pg_advisory_xact_lock(hashtextextended('lumen-ranking-adventure:'||g.adventure_id,0));
 perform pg_advisory_xact_lock(hashtextextended('lumen-ranking-quest:'||p_quest_id,0));
 select grid_revision,legacy_index into v_revision,v_legacy from lumen_commands.quest_rules where quest_id = p_quest_id;
 if not found then return 0; end if;
 -- Same population as lumen_commands.ranking_board (echoes are never scored).
 select coalesce(jsonb_agg(jsonb_build_object('u', r.user_id, 'p', r.place, 'pt', lumen_commands.ranking_points(r.place,r.participants,
       (r.bonus & 1)=1,(r.bonus & 2)=2))), '[]'::jsonb)
   into v_fresh
   from (select s.user_id, rank() over (order by s.score)::integer as place,
           count(*) over()::integer as participants,lumen_commands.ranking_badge_mask(b.badges) as bonus
           from lumen_commands.ranking_scores s
           join lumen_commands.ranking_members m using (user_id)
           join lumen.profiles p using (user_id)
           left join lumen_commands.quest_run_authority a on a.user_id=s.user_id and a.quest_id=s.quest_id
           left join lumen_commands.legacy_authority l on l.user_id=s.user_id and v_legacy is not null
           cross join lateral (select case when a.reset_info<>'{}' or v_legacy is null then a.projection->'badges'
             else l.projection#>array['performances',v_legacy::text,'badges'] end as badges) b
          where s.quest_id = p_quest_id and s.grid_revision = v_revision
            and m.participating and p.nickname_ready and not p.ranking_opted_out) r;
 select array_agg(distinct coalesce(n.u, o.user_id) order by coalesce(n.u, o.user_id)) into v_affected
   from jsonb_to_recordset(v_fresh) as n(u uuid, p integer, pt integer)
   full join (select user_id, place, points from lumen_commands.ranking_quest_points where quest_id = p_quest_id) o on o.user_id = n.u
  where n.u is null or o.user_id is null or n.p <> o.place or n.pt <> o.points;
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
create or replace function lumen_commands.ranking_refresh_user(p_user uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare q text; n integer := 0;
begin
 for q in select ids.quest_id from (select s.quest_id from lumen_commands.ranking_scores s where s.user_id=p_user
          union select r.quest_id from lumen_commands.ranking_quest_points r where r.user_id=p_user) ids
          join lumen_commands.ranking_groups g using(quest_id) order by g.adventure_id,ids.quest_id loop
  n := n + lumen_commands.ranking_refresh_quest(q);
 end loop;
 return n;
end $$;
create or replace function lumen_commands.ranking_scores_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare q text;
begin
 if tg_op = 'INSERT' then
  for q in select n.quest_id from (select distinct quest_id from new_rows) n join lumen_commands.ranking_groups g using(quest_id) order by g.adventure_id,n.quest_id loop perform lumen_commands.ranking_refresh_quest(q); end loop;
 elsif tg_op = 'DELETE' then
  for q in select n.quest_id from (select distinct quest_id from old_rows) n join lumen_commands.ranking_groups g using(quest_id) order by g.adventure_id,n.quest_id loop perform lumen_commands.ranking_refresh_quest(q); end loop;
 else
  for q in select n.quest_id from (select quest_id from new_rows union select quest_id from old_rows) n join lumen_commands.ranking_groups g using(quest_id) order by g.adventure_id,n.quest_id loop perform lumen_commands.ranking_refresh_quest(q); end loop;
 end if;
 return null;
end $$;
create or replace function lumen_commands.ranking_rebuild()
returns jsonb language plpgsql security definer set search_path='' as $$
declare q text; affected integer := 0; quests integer := 0; r record;
begin
 for q in select ids.quest_id from (select quest_id from lumen_commands.ranking_scores union select quest_id from lumen_commands.ranking_quest_points) ids join lumen_commands.ranking_groups g using(quest_id) order by g.adventure_id,ids.quest_id loop
  affected := affected + lumen_commands.ranking_refresh_quest(q); quests := quests + 1;
 end loop;
 -- Totals not backed by any quest point (e.g. regrouped quests) are re-summed.
 for r in select distinct g.constellation_id, g.adventure_id from lumen_commands.ranking_groups g loop
  perform lumen_commands.ranking_retotal(r.constellation_id, r.adventure_id, array(
   select t.user_id from lumen_commands.ranking_constellation_totals t where t.constellation_id = r.constellation_id
   union select t.user_id from lumen_commands.ranking_adventure_totals t where t.adventure_id = r.adventure_id
   union select q.user_id from lumen_commands.ranking_quest_points q join lumen_commands.ranking_groups g using (quest_id)
          where g.constellation_id = r.constellation_id));
 end loop;
 return jsonb_build_object('quests', quests, 'changed_quest_points', affected);
end $$;
create or replace function lumen_commands.group_ranking(p_kind text, p_id text, p_offset integer, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := auth.uid(); v_total integer; v_participants integer; v_mine record; v_place integer;
        v_offset integer := greatest(0, least(coalesce(p_offset, 0), 100000)); v_limit integer := greatest(0, least(coalesce(p_limit, 0), 50));
        v_top jsonb:='[]'::jsonb; v_rows jsonb;
begin
 if u is null then raise insufficient_privilege; end if;
 if p_kind not in ('constellation', 'adventure') or p_id is null then raise invalid_parameter_value; end if;
 if p_kind = 'constellation' then
  select count(*) into v_total from lumen_commands.ranking_groups where constellation_id = p_id;
  if v_total = 0 then raise invalid_parameter_value; end if;
  select count(*) into v_participants from lumen_commands.ranking_constellation_totals where constellation_id = p_id;
  if v_limit=0 then
  select points, quests into v_mine from lumen_commands.ranking_constellation_totals where constellation_id = p_id and user_id = u;
  if found then select 1 + count(*) into v_place from lumen_commands.ranking_constellation_totals where constellation_id = p_id and points > v_mine.points; end if;
  select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'points', t.points, 'quests', t.quests, 'mine', t.user_id = u,
          'place', 1 + (select count(*) from lumen_commands.ranking_constellation_totals x where x.constellation_id = p_id and x.points > t.points))
          order by t.points desc, t.user_id), '[]'::jsonb) into v_top
   from (select * from lumen_commands.ranking_constellation_totals where constellation_id = p_id order by points desc, user_id limit 3) t
   join lumen.profiles p using (user_id);
  end if;
  if v_limit > 0 then
   select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'points', t.points, 'quests', t.quests, 'mine', t.user_id = u,
           'place', 1 + (select count(*) from lumen_commands.ranking_constellation_totals x where x.constellation_id = p_id and x.points > t.points))
           order by t.points desc, t.user_id), '[]'::jsonb) into v_rows
    from (select * from lumen_commands.ranking_constellation_totals where constellation_id = p_id order by points desc, user_id offset v_offset limit v_limit) t
    join lumen.profiles p using (user_id);
  end if;
 else
  select count(*) into v_total from lumen_commands.ranking_groups where adventure_id = p_id;
  if v_total = 0 then raise invalid_parameter_value; end if;
  select count(*) into v_participants from lumen_commands.ranking_adventure_totals where adventure_id = p_id;
  if v_limit=0 then
  select points, quests into v_mine from lumen_commands.ranking_adventure_totals where adventure_id = p_id and user_id = u;
  if found then select 1 + count(*) into v_place from lumen_commands.ranking_adventure_totals where adventure_id = p_id and points > v_mine.points; end if;
  select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'points', t.points, 'quests', t.quests, 'mine', t.user_id = u,
          'place', 1 + (select count(*) from lumen_commands.ranking_adventure_totals x where x.adventure_id = p_id and x.points > t.points))
          order by t.points desc, t.user_id), '[]'::jsonb) into v_top
   from (select * from lumen_commands.ranking_adventure_totals where adventure_id = p_id order by points desc, user_id limit 3) t
   join lumen.profiles p using (user_id);
  end if;
  if v_limit > 0 then
   select coalesce(jsonb_agg(jsonb_build_object('nickname', p.nickname, 'points', t.points, 'quests', t.quests, 'mine', t.user_id = u,
           'place', 1 + (select count(*) from lumen_commands.ranking_adventure_totals x where x.adventure_id = p_id and x.points > t.points))
           order by t.points desc, t.user_id), '[]'::jsonb) into v_rows
    from (select * from lumen_commands.ranking_adventure_totals where adventure_id = p_id order by points desc, user_id offset v_offset limit v_limit) t
    join lumen.profiles p using (user_id);
  end if;
 end if;
 return jsonb_build_object('scoringVersion',2,'maxPoints',v_total*100,'kind', p_kind, 'id', p_id, 'questTotal', v_total, 'participants', v_participants,
  'participating', exists(select 1 from lumen_commands.ranking_members m where m.user_id = u and m.participating),
  'top', v_top,
  'personal', case when v_place is null then null else jsonb_build_object('place', v_place, 'points', v_mine.points, 'quests', v_mine.quests) end,
  'rows', coalesce(v_rows, '[]'::jsonb), 'offset', v_offset,
  'more', v_limit > 0 and v_offset + v_limit < v_participants);
end $$;
create or replace function lumen_commands.ranking_quest_badges_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
 if tg_op='INSERT' then
  for r in select distinct n.quest_id,g.adventure_id from new_badges n

 join lumen_commands.ranking_groups g using(quest_id)
 where exists(select 1 from lumen_commands.ranking_scores s where s.user_id=n.user_id and s.quest_id=n.quest_id)

 order by g.adventure_id,n.quest_id loop perform lumen_commands.ranking_refresh_quest(r.quest_id);end loop;
 else
  for r in select distinct n.quest_id,g.adventure_id from new_badges n
 join old_badges o using(user_id,quest_id)
 join lumen_commands.ranking_groups g using(quest_id)
 where exists(select 1 from lumen_commands.ranking_scores s where s.user_id=n.user_id and s.quest_id=n.quest_id)
 and (n.projection#>'{badges,autonomy}',n.projection#>'{badges,noError}',n.reset_info) is distinct from (o.projection#>'{badges,autonomy}',o.projection#>'{badges,noError}',o.reset_info)
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
  for r in select distinct s.quest_id,g.adventure_id from new_badges n

 join lumen_commands.ranking_scores s on s.user_id=n.user_id
 join lumen_commands.quest_rules q on q.quest_id=s.quest_id and q.legacy_index is not null
 join lumen_commands.ranking_groups g on g.quest_id=s.quest_id
 where not exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=s.user_id and a.quest_id=s.quest_id and a.reset_info<>'{}')

 order by g.adventure_id,s.quest_id loop perform lumen_commands.ranking_refresh_quest(r.quest_id);end loop;
 else
  for r in select distinct s.quest_id,g.adventure_id from new_badges n
 join old_badges o using(user_id)
 join lumen_commands.ranking_scores s on s.user_id=n.user_id
 join lumen_commands.quest_rules q on q.quest_id=s.quest_id and q.legacy_index is not null
 join lumen_commands.ranking_groups g on g.quest_id=s.quest_id
 where not exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=s.user_id and a.quest_id=s.quest_id and a.reset_info<>'{}')
 and (n.projection#>array['performances',q.legacy_index::text,'badges','autonomy'],n.projection#>array['performances',q.legacy_index::text,'badges','noError']) is distinct from (o.projection#>array['performances',q.legacy_index::text,'badges','autonomy'],o.projection#>array['performances',q.legacy_index::text,'badges','noError'])
 order by g.adventure_id,s.quest_id loop perform lumen_commands.ranking_refresh_quest(r.quest_id);end loop;
 end if;
 return null;
end $$;
revoke all on function lumen_commands.ranking_legacy_badges_changed() from public,anon,authenticated,service_role;

drop trigger if exists ranking_badges_on_insert on lumen_commands.quest_run_authority;
drop trigger if exists ranking_badges_on_update on lumen_commands.quest_run_authority;
create trigger ranking_badges_on_insert after insert on lumen_commands.quest_run_authority
 referencing new table as new_badges for each statement execute function lumen_commands.ranking_quest_badges_changed();
create trigger ranking_badges_on_update after update on lumen_commands.quest_run_authority
 referencing new table as new_badges old table as old_badges for each statement execute function lumen_commands.ranking_quest_badges_changed();

drop trigger if exists ranking_badges_on_insert on lumen_commands.legacy_authority;
drop trigger if exists ranking_badges_on_update on lumen_commands.legacy_authority;
create trigger ranking_badges_on_insert after insert on lumen_commands.legacy_authority
 referencing new table as new_badges for each statement execute function lumen_commands.ranking_legacy_badges_changed();
create trigger ranking_badges_on_update after update on lumen_commands.legacy_authority
 referencing new table as new_badges old table as old_badges for each statement execute function lumen_commands.ranking_legacy_badges_changed();

-- One explicit rebuild at rollout; reads never rebuild. Old one-argument points
-- remains only for migration/history compatibility, no longer drives aggregates.
select lumen_commands.ranking_rebuild();
notify pgrst,'reload schema';
commit;
