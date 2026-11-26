-- Disposable clock: exercise two fully closed Paris weeks during rollout week.
begin;
-- Earlier ledger fixtures leave their synthetic daily attempts in this shared
-- test database. Isolate the two weeks, then rollback restores every row.
delete from lumen_commands.daily_week_friends where monday between date '2026-11-23' and date '2026-11-30';
delete from lumen_commands.daily_week_standings where monday between date '2026-11-23' and date '2026-11-30';
delete from lumen_commands.daily_week_finalized where monday between date '2026-11-23' and date '2026-11-30';
delete from lumen_commands.daily_standings where day between date '2026-11-23' and date '2026-12-06';
delete from lumen_commands.daily_finalized where day between date '2026-11-23' and date '2026-12-06';
delete from lumen_commands.daily_runs where day between date '2026-11-23' and date '2026-12-06';
create or replace function lumen_commands.daily_today() returns date
language sql stable set search_path='' as $$select date '2026-12-07'$$;
create or replace function lumen_commands.daily_closes_at(p_day date) returns timestamptz
language sql immutable set search_path='' as $$select (p_day+1)::timestamp at time zone 'Europe/Paris'
 +case when p_day>=date '2026-12-07' then interval '30 days' else interval '-30 days' end$$;

do $$
declare
 a uuid:='00000000-0000-4000-8000-000000001151';
 b uuid:='00000000-0000-4000-8000-000000001152';
 c uuid:='00000000-0000-4000-8000-000000001153';
 q text;rev integer;result jsonb;before_count bigint;
begin
 insert into auth.users(id) values(a),(b),(c);
 insert into lumen.profiles(user_id,nickname) values(a,'Ana1015'),(b,'Bo1015'),(c,'Cy1015');
 insert into lumen_commands.ranking_members(user_id,nickname,participating) values(a,'Ana1015',true),(b,'Bo1015',true),(c,'Cy1015',true);
 insert into lumen.social_friend_edges(user_id,friend_user_id,state) values(a,b,'friends'),(b,a,'friends');
 update lumen_commands.feature_flags set enabled=true where name='daily_challenge';
 select quest_id,grid_revision into q,rev from lumen_commands.quest_rules order by quest_id limit 1;
 insert into lumen_commands.daily_puzzles(day,quest_id,grid_revision)
 select date '2026-11-23'+i,q,rev from generate_series(0,13) i on conflict(day) do nothing;
 insert into lumen_commands.daily_runs(user_id,day,operation_id,quest_id,grid_revision,status,seconds,score)
 select u.id,date '2026-11-23'+i,'week-'||i||'-'||u.id,q,rev,'completed',u.score,u.score
 from (values(a,60),(b,60),(c,120)) u(id,score) cross join generate_series(0,13) i;
 update lumen_commands.daily_runs set seconds=80,score=80 where user_id=b and day>=date '2026-11-30';
 -- Positions 4 through 12 exercise both the four-point and two-point bands.
 insert into auth.users(id)
 select ('00000000-0000-4000-8000-'||lpad((1200+i)::text,12,'0'))::uuid from generate_series(1,9) i;
 insert into lumen.profiles(user_id,nickname)
 select id,'Extra1015-'||right(id::text,4) from auth.users where id::text between
  '00000000-0000-4000-8000-000000001201' and '00000000-0000-4000-8000-000000001209';
 insert into lumen_commands.ranking_members(user_id,nickname,participating)
 select user_id,nickname,true from lumen.profiles where nickname like 'Extra1015-%';
 insert into lumen_commands.daily_runs(user_id,day,operation_id,quest_id,grid_revision,status,seconds,score)
 select p.user_id,date '2026-11-23'+i,'extra-'||i||'-'||p.user_id,q,rev,'completed',200+right(p.user_id::text,4)::integer,200+right(p.user_id::text,4)::integer
 from lumen.profiles p cross join generate_series(0,6) i where nickname like 'Extra1015-%';
 perform set_config('request.jwt.claim.sub',a::text,true);
 result:=public.lumen_daily_week_board('2026-11-23');
 assert result->>'final'='true';
 assert result#>>'{general,me,points}'='70','seven tied first places give 70 points';
 assert result#>>'{general,me,played}'='7';
 assert result#>>'{general,me,rank}'='1';
 assert result#>>'{general,top,2,points}'='42','third places give 6 points each';
 assert result#>>'{friends,participants}'='2';
 assert result#>>'{friends,top,1,rank}'='1','equal points, participation and time share rank';
 assert (select points from lumen_commands.daily_week_standings where user_id='00000000-0000-4000-8000-000000001201')=28,'fourth places give four points';
 assert (select points from lumen_commands.daily_week_standings where user_id='00000000-0000-4000-8000-000000001207')=28,'tenth places give four points';
 assert (select points from lumen_commands.daily_week_standings where user_id='00000000-0000-4000-8000-000000001209')=14,'twelfth places give two points';
 assert public.lumen_daily_week_board('2026-11-30')->>'final'='true';
 assert (select points from lumen_commands.daily_week_standings where user_id=b and monday='2026-11-30')=56,'second places give eight points';
 assert not result::text like '%'||b::text||'%','only public nicknames, no account IDs';
 select count(*) into before_count from lumen_commands.daily_week_standings;
 delete from lumen.social_friend_edges where user_id=a;
 update lumen_commands.ranking_members set participating=false where user_id=b;
 assert public.lumen_daily_week_board('2026-11-23')#>'{general,me}'=result#>'{general,me}','frozen ranks and points are stable';
 assert not public.lumen_daily_week_board('2026-11-23')::text like '%Bo1015%','withdrawn players leave public boards';
 assert (select count(*) from lumen_commands.daily_week_standings)=before_count,'idempotent materialization';
 assert public.lumen_daily_week_board('2026-12-07')->>'final'='false','open week has no final ranking';
 -- Latest week suppresses seven older daily windows, across devices.
 result:=public.lumen_daily_recap();
 assert result->>'kind'='week' and result->>'day'='2026-11-30';
 assert public.lumen_daily_recap() is null,'second device cannot claim the same recap';
 perform set_config('request.jwt.claim.sub',c::text,true);
 assert public.lumen_daily_recap()->>'kind'='week','another account has its own watermark';
 -- A completed day after the acknowledged week remains eligible.
 update lumen_commands.daily_recap_seen set day='2026-12-05',monday='2026-11-30' where user_id=c;
 assert public.lumen_daily_recap()->>'kind'='day';
 assert public.lumen_daily_recap() is null;
 assert not has_table_privilege('authenticated','lumen_commands.daily_recap_seen','select');
 assert not has_function_privilege('anon','public.lumen_daily_recap()','execute');
 assert not has_function_privilege('authenticated','lumen_commands.daily_week_finalize(date)','execute');
 perform set_config('request.jwt.claim.sub','',true);
 perform lumen_privacy.review_erasure(b,array[]::text[]);
 perform lumen_privacy.erase_account(b,array[]::text[],'ERASE LUMEN '||b::text);
 assert not exists(select 1 from lumen_commands.daily_week_standings where user_id=b);
 assert not exists(select 1 from lumen_commands.daily_week_friends where user_id=b or member_id=b);
 begin
  insert into lumen_commands.daily_week_friends values('2026-11-23',a,b,1,2);
  raise exception 'erased member recreated';
 exception when insufficient_privilege then
  if sqlerrm<>'LUMEN_ACCOUNT_ERASED' then raise;end if;
 end;
 assert exists(select 1 from lumen_commands.daily_week_standings where user_id=a),'other players keep their history';
end $$;
rollback;
