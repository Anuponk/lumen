-- Upgrade fixture on the real OLD scoring schema; never run against players.
do $$begin if current_database()<>'lumen_test' then raise exception 'Disposable rankings fixture requires lumen_test';end if;end$$;
begin;
create temporary table ranking_974_upgrade(quest text,constellation text,adventure text,players uuid[],source_hash text);
do $$
declare q text;c text;a text;ids uuid[]:=array['00000000-0000-4000-8000-000000009741'::uuid,
 '00000000-0000-4000-8000-000000009742'::uuid,'00000000-0000-4000-8000-000000009743'::uuid];u uuid;i integer;
begin
 select g.quest_id,g.constellation_id,g.adventure_id into strict q,c,a
 from lumen_commands.ranking_groups g join lumen_commands.quest_rules r using(quest_id)
 where r.legacy_index is null and not exists(select 1 from lumen_commands.ranking_scores s where s.quest_id=g.quest_id)
 order by g.quest_id limit 1;
 for i in 1..3 loop
  u:=ids[i];insert into auth.users(id) values(u);
  insert into lumen.profiles(user_id,nickname) values(u,'Upgrade974_'||i);
  insert into lumen_commands.ranking_members values(u,'Upgrade974_'||i,true);
  insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty)
   select u,q,grid_revision,i*10,0 from lumen_commands.quest_rules where quest_id=q;
 end loop;
 insert into lumen_commands.quest_run_authority(user_id,quest_id,projection)
  values(ids[2],q,'{"badges":{"autonomy":true,"noError":true},"runPerformance":{}}');
 insert into ranking_974_upgrade select q,c,a,ids,
  md5(jsonb_agg(to_jsonb(s) order by s.user_id)::text) from lumen_commands.ranking_scores s where s.quest_id=q;
end$$;
commit;
