-- #974 hotfix (owner acceptance 27/11): expanding the adventure ranking beyond the
-- podium failed. A page request (p_limit>0) never assigns the personal record, yet
-- the returned expression reads its fields: on a connection whose PL/pgSQL plan had
-- not seen the record's structure, the RPC raised "record v_mine is not assigned
-- yet" and the client kept showing "Reessayer". Same body, scalar variables
-- instead of an unassigned record. Read-only behaviour, scores and grants unchanged.
begin;
create or replace function lumen_commands.group_ranking(p_kind text, p_id text, p_offset integer, p_limit integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid := auth.uid(); v_total integer; v_participants integer; v_mine_points integer; v_mine_quests integer; v_place integer;
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
  select points, quests into v_mine_points, v_mine_quests from lumen_commands.ranking_constellation_totals where constellation_id = p_id and user_id = u;
  if found then select 1 + count(*) into v_place from lumen_commands.ranking_constellation_totals where constellation_id = p_id and points > v_mine_points; end if;
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
  select points, quests into v_mine_points, v_mine_quests from lumen_commands.ranking_adventure_totals where adventure_id = p_id and user_id = u;
  if found then select 1 + count(*) into v_place from lumen_commands.ranking_adventure_totals where adventure_id = p_id and points > v_mine_points; end if;
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
  'personal', case when v_place is null then null else jsonb_build_object('place', v_place, 'points', v_mine_points, 'quests', v_mine_quests) end,
  'rows', coalesce(v_rows, '[]'::jsonb), 'offset', v_offset,
  'more', v_limit > 0 and v_offset + v_limit < v_participants);
end $$;
notify pgrst, 'reload schema';
commit;
