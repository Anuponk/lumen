-- #974: constellation and adventure rankings. Disposable database, invented players,
-- rolled back. The materialized aggregates must always equal a from-scratch
-- computation over the same visible qualifying scores.
do $$begin
 if current_database()<>'lumen_test' then raise exception 'Disposable rankings fixture requires lumen_test';end if;
end $$;
begin;
create function pg_temp.expected_constellation(c text) returns table(user_id uuid, points bigint, quests bigint) language sql as $$
 with visible as (
  select s.user_id, s.quest_id, rank() over (partition by s.quest_id order by s.score) place
  from lumen_commands.ranking_scores s join lumen_commands.quest_rules q on q.quest_id=s.quest_id and q.grid_revision=s.grid_revision
  join lumen_commands.ranking_members m on m.user_id=s.user_id join lumen.profiles p on p.user_id=s.user_id
  join lumen_commands.ranking_groups g on g.quest_id=s.quest_id
  where g.constellation_id=c and m.participating and p.nickname_ready and not p.ranking_opted_out)
 select user_id, sum(lumen_commands.ranking_points(place::integer)), count(*) from visible group by user_id
$$;
create function pg_temp.consistent(c text, a text) returns boolean language sql as $$
 select not exists (
   (select user_id, points::bigint, quests::bigint from lumen_commands.ranking_constellation_totals where constellation_id=c)
   except (select * from pg_temp.expected_constellation(c)))
 and not exists ((select * from pg_temp.expected_constellation(c))
   except (select user_id, points::bigint, quests::bigint from lumen_commands.ranking_constellation_totals where constellation_id=c))
 and not exists (
   select 1 from lumen_commands.ranking_adventure_totals t
   cross join lateral (select sum(q.points)::integer s, count(*)::integer n from lumen_commands.ranking_quest_points q join lumen_commands.ranking_groups g using(quest_id)
     where g.adventure_id=a and q.user_id=t.user_id) e
   where t.adventure_id=a and (t.points, t.quests) is distinct from (e.s, e.n))
$$;
do $test$
declare c text; a text; qa text; qb text; qc text; ra integer; rb integer; rc integer; players uuid[] := '{}'; u uuid; i integer;
        r jsonb; before jsonb; rebuilt jsonb; total integer;
begin
 -- Scale (owner, 24/11): 100 80 65 55 50, then -2 per place, floor 10.
 assert lumen_commands.ranking_points(1)=100 and lumen_commands.ranking_points(2)=80 and lumen_commands.ranking_points(3)=65;
 assert lumen_commands.ranking_points(4)=55 and lumen_commands.ranking_points(5)=50 and lumen_commands.ranking_points(6)=48;
 assert lumen_commands.ranking_points(7)=46 and lumen_commands.ranking_points(8)=44 and lumen_commands.ranking_points(9)=42;
 assert lumen_commands.ranking_points(10)=40 and lumen_commands.ranking_points(24)=12 and lumen_commands.ranking_points(25)=10;
 assert lumen_commands.ranking_points(26)=10 and lumen_commands.ranking_points(500)=10 and lumen_commands.ranking_points(0)=0;
 -- Privileges: derived rows and maintenance are private; one read RPC for players.
 assert not has_table_privilege('authenticated','lumen_commands.ranking_constellation_totals','select');
 assert not has_table_privilege('authenticated','lumen_commands.ranking_quest_points','select');
 assert not has_function_privilege('authenticated','lumen_commands.ranking_refresh_quest(text)','execute');
 assert not has_function_privilege('authenticated','lumen_commands.ranking_rebuild()','execute');
 assert not has_function_privilege('anon','public.lumen_group_ranking(text,text,integer,integer)','execute');
 assert has_function_privilege('authenticated','public.lumen_group_ranking(text,text,integer,integer)','execute');
 assert (select count(*) from lumen_privacy.policy() where ns='lumen_commands' and rel in ('ranking_quest_points','ranking_constellation_totals','ranking_adventure_totals') and action='delete')=3,
  'derived rows erased and exported with the account';

 -- A constellation with three quests known to the server.
 select g.constellation_id, g.adventure_id into c, a from lumen_commands.ranking_groups g join lumen_commands.quest_rules q using(quest_id)
  group by 1,2 having count(*)>=3 order by 1 limit 1;
 assert c is not null, 'grouped quests exist';
 select (array_agg(g.quest_id order by g.quest_id))[1], (array_agg(g.quest_id order by g.quest_id))[2], (array_agg(g.quest_id order by g.quest_id))[3]
   into qa, qb, qc from lumen_commands.ranking_groups g join lumen_commands.quest_rules q using(quest_id) where g.constellation_id=c;
 select grid_revision into ra from lumen_commands.quest_rules where quest_id=qa;
 select grid_revision into rb from lumen_commands.quest_rules where quest_id=qb;
 select grid_revision into rc from lumen_commands.quest_rules where quest_id=qc;
 for i in 1..30 loop
  u := gen_random_uuid(); players := players || u;
  insert into auth.users(id) values (u);
  insert into lumen.profiles(user_id, nickname) values (u, 'Classement 974 ' || i);
  insert into lumen_commands.ranking_members values (u, 'Classement 974 ' || i, true);
 end loop;
 -- Quest A: 30 places (scores 10, 20, ...), with a tie between players 2 and 3.
 for i in 1..30 loop
  insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values (players[i], qa, ra, case when i=3 then 20 else i*10 end, 0);
 end loop;
 assert (select points from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[1])=100;
 assert (select array_agg(points order by user_id) from lumen_commands.ranking_quest_points where quest_id=qa and user_id in (players[2],players[3])) = array[80,80], 'ties share place and points';
 assert (select place from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[4])=4, 'the next place skips the tie';
 assert (select points from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[4])=55;
 assert (select points from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[30])=10, 'floor of 10';
 -- Quest B: only players 1..5; quest C: only player 30 (one quest each is enough to be ranked).
 for i in 1..5 loop insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values (players[i], qb, rb, 100-i, 0); end loop;
 insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values (players[30], qc, rc, 50, 0);
 assert pg_temp.consistent(c, a), 'aggregates equal a from-scratch computation';
 assert (select points=100+50 and quests=2 from lumen_commands.ranking_constellation_totals where constellation_id=c and user_id=players[1]);
 assert (select points=10+100 and quests=2 from lumen_commands.ranking_constellation_totals where constellation_id=c and user_id=players[30]), 'last on A, first on C';
 assert not exists (select 1 from lumen_commands.ranking_quest_points where user_id=players[6] and quest_id=qb), 'no points for an unplayed quest';

 -- A new record changes the places of everyone behind it, incrementally.
 update lumen_commands.ranking_scores set seconds=1 where user_id=players[20] and quest_id=qa;
 assert (select points from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[20])=100;
 assert (select points from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[1])=80, 'the former leader moves down';
 assert pg_temp.consistent(c, a);

 -- Visibility: withdrawal, opt-out and deleted accounts leave the rankings; others move up.
 update lumen_commands.ranking_members set participating=false where user_id=players[20];
 assert not exists (select 1 from lumen_commands.ranking_constellation_totals where user_id=players[20]);
 assert (select points from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[1])=100;
 update lumen_commands.ranking_members set participating=true where user_id=players[20];
 assert (select points from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[20])=100, 'rejoining restores the same points';
 update lumen.profiles set ranking_opted_out=true where user_id=players[20];
 assert not exists (select 1 from lumen_commands.ranking_quest_points where user_id=players[20]);
 update lumen.profiles set ranking_opted_out=false where user_id=players[20];
 delete from lumen_commands.ranking_scores where user_id=players[30] and quest_id=qc;
 assert (select quests=1 from lumen_commands.ranking_constellation_totals where constellation_id=c and user_id=players[30]);
 delete from auth.users where id=players[29];
 assert not exists (select 1 from lumen_commands.ranking_adventure_totals where user_id=players[29]);
 assert (select points from lumen_commands.ranking_quest_points where quest_id=qa and user_id=players[30])=10;
 assert pg_temp.consistent(c, a);

 -- A new grid revision: scores of the previous grid stop counting for that quest.
 update lumen_commands.quest_rules set grid_revision=grid_revision+1 where quest_id=qb;
 assert not exists (select 1 from lumen_commands.ranking_quest_points where quest_id=qb);
 update lumen_commands.quest_rules set grid_revision=rb where quest_id=qb;
 assert (select count(*) from lumen_commands.ranking_quest_points where quest_id=qb)=5;
 assert pg_temp.consistent(c, a);

 -- Reconstruction is idempotent and restores the same state after a loss.
 select jsonb_agg(to_jsonb(t) - 'updated_at' order by user_id) into before from lumen_commands.ranking_constellation_totals t where constellation_id=c;
 assert (lumen_commands.ranking_rebuild()->>'changed_quest_points')::integer=0, 'a second rebuild changes nothing';
 delete from lumen_commands.ranking_quest_points where quest_id in (qa,qb,qc);
 delete from lumen_commands.ranking_constellation_totals where constellation_id=c;
 delete from lumen_commands.ranking_adventure_totals where adventure_id=a;
 perform lumen_commands.ranking_rebuild();
 select jsonb_agg(to_jsonb(t) - 'updated_at' order by user_id) into rebuilt from lumen_commands.ranking_constellation_totals t where constellation_id=c;
 assert rebuilt=before, 'rebuild from historical qualifying scores';
 assert pg_temp.consistent(c, a);

 -- Reads: top 3 + my position (even far from the podium), pages on demand.
 perform set_config('request.jwt.claim.sub', '', true);
 begin perform public.lumen_group_ranking('constellation', c); raise exception 'guest read'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub', players[28]::text, true);
 r := public.lumen_group_ranking('constellation', c);
 select count(*) into total from lumen_commands.ranking_groups where constellation_id=c;
 assert (r->>'questTotal')::integer=total and (r->>'participants')::integer=29;
 assert jsonb_array_length(r->'top')=3 and r->'top'->0->>'place'='1' and (r->'top'->0->>'points')::integer>=(r->'top'->1->>'points')::integer;
 assert r->'personal'->>'place' is not null and (r->'personal'->>'points')::integer>0 and (r->'personal'->>'quests')::integer=1, 'my position off the podium';
 assert jsonb_array_length(r->'rows')=0 and not (r->>'more')::boolean, 'no page unless asked';
 assert not (r::text ~ players[1]::text), 'no account identifier';
 r := public.lumen_group_ranking('constellation', c, 25, 10);
 assert jsonb_array_length(r->'rows')=4 and not (r->>'more')::boolean;
 r := public.lumen_group_ranking('constellation', c, 0, 10);
 assert jsonb_array_length(r->'rows')=10 and (r->>'more')::boolean;
 r := public.lumen_group_ranking('adventure', a, 0, 5);
 assert (r->>'participants')::integer>=29 and jsonb_array_length(r->'rows')=5;
 begin perform public.lumen_group_ranking('constellation', 'missing-constellation'); raise exception 'unknown id';
 exception when invalid_parameter_value then null; end;
 begin perform public.lumen_group_ranking('galaxy', c); raise exception 'unknown kind';
 exception when invalid_parameter_value then null; end;
end $test$;
rollback;
