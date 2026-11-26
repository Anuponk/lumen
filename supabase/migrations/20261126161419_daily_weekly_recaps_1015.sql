begin;

-- #1015: one aggregate per closed Paris week, built from frozen daily ranks.
create table if not exists lumen_commands.daily_week_finalized(
 monday date primary key, finalized_at timestamptz not null default now()
);
create table if not exists lumen_commands.daily_week_standings(
 monday date not null, user_id uuid not null references auth.users(id) on delete cascade,
 points integer not null, played integer not null, seconds bigint not null, best_score integer,
 general_rank integer, general_total integer not null,
 primary key(user_id,monday)
);
create index if not exists daily_week_standings_monday on lumen_commands.daily_week_standings(monday,general_rank);
create table if not exists lumen_commands.daily_week_friends(
 monday date not null, user_id uuid not null references auth.users(id) on delete cascade,
 member_id uuid not null references auth.users(id) on delete cascade,
 place integer not null, total integer not null,
 primary key(user_id,monday,member_id)
);
create index if not exists daily_week_friends_member on lumen_commands.daily_week_friends(member_id);
create table if not exists lumen_commands.daily_recap_seen(
 user_id uuid primary key references auth.users(id) on delete cascade,
 day date, monday date
);
alter table lumen_commands.daily_week_finalized enable row level security;
alter table lumen_commands.daily_week_standings enable row level security;
alter table lumen_commands.daily_week_friends enable row level security;
alter table lumen_commands.daily_recap_seen enable row level security;
revoke all on lumen_commands.daily_week_finalized,lumen_commands.daily_week_standings,
 lumen_commands.daily_week_friends,lumen_commands.daily_recap_seen from public,anon,authenticated,service_role;

-- The generic privacy guard checks the row owner. This second identity is a
-- different account and must also stay erased after a concurrent finalization.
create or replace function lumen_commands.guard_daily_week_member() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception using errcode='25000',message='LUMEN_WRITE_REQUIRES_READ_COMMITTED';end if;
 if exists(select 1 from lumen_privacy.erased_identifiers where kind='user'
  and digest=lumen_privacy.fingerprint(new.member_id::text)) then
  raise exception using errcode='42501',message='LUMEN_ACCOUNT_ERASED';end if;
 return new;
end $$;
drop trigger if exists daily_week_member_guard on lumen_commands.daily_week_friends;
create trigger daily_week_member_guard before insert or update on lumen_commands.daily_week_friends
 for each row execute function lumen_commands.guard_daily_week_member();
revoke all on function lumen_commands.guard_daily_week_member() from public,anon,authenticated,service_role;

create or replace function lumen_commands.daily_week_finalize(p_monday date) returns boolean
language plpgsql security definer set search_path='' as $$
declare d date;
begin
 if extract(isodow from p_monday)<>1 or p_monday<date '2026-11-23'
  or clock_timestamp()<lumen_commands.daily_closes_at(p_monday+6)+interval '6 hours' then return false;end if;
 if exists(select 1 from lumen_commands.daily_week_finalized where monday=p_monday) then return true;end if;
 perform pg_advisory_xact_lock(hashtextextended('lumen-daily-week:'||p_monday::text,0));
 if exists(select 1 from lumen_commands.daily_week_finalized where monday=p_monday) then return true;end if;
 for i in 0..6 loop
  d:=p_monday+i;
  if not lumen_commands.daily_finalize(d) then return false;end if;
 end loop;
 with totals as (
  select r.user_id,
   sum(case when s.general_rank=1 then 10 when s.general_rank=2 then 8 when s.general_rank=3 then 6
    when s.general_rank<=10 then 4 else 2 end)::integer as points,
   count(*)::integer as played,sum(r.score)::bigint as seconds,min(r.score)::integer as best_score,
   bool_or(s.general_rank is not null) as ranked
  from lumen_commands.daily_runs r join lumen_commands.daily_standings s using(user_id,day)
  where r.day between p_monday and p_monday+6 and r.status='completed'
  group by r.user_id
 ), placed as (
  select *,rank() over(partition by ranked order by points desc,played desc,seconds) as place,
   count(*) over(partition by ranked) as total from totals
 )
 insert into lumen_commands.daily_week_standings
 select p_monday,user_id,points,played,seconds,best_score,
  case when ranked then place::integer end,case when ranked then total::integer else 0 end from placed;
 -- Freeze each participant's friends cohort and tie-break ranks once as well.
 insert into lumen_commands.daily_week_friends(monday,user_id,member_id,place,total)
 select p_monday,owner.user_id,member.user_id,
  rank() over(partition by owner.user_id order by member.points desc,member.played desc,member.seconds)::integer,
  count(*) over(partition by owner.user_id)::integer
 from lumen_commands.daily_week_standings owner
 join lumen_commands.daily_week_standings member on member.monday=owner.monday and
  (member.user_id=owner.user_id or (member.general_rank is not null and exists(
   select 1 from lumen.social_friend_edges e where e.user_id=owner.user_id
    and e.friend_user_id=member.user_id and e.state='friends')))
 where owner.monday=p_monday;
 insert into lumen_commands.daily_week_finalized(monday) values(p_monday);
 return true;
end $$;

create or replace function public.lumen_daily_week_board(p_day date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen_commands.daily_caller();anchor date:=coalesce(p_day,lumen_commands.daily_today());
 v_monday date;mine lumen_commands.daily_week_standings%rowtype;friend_place integer;friend_total integer;
 g jsonb;f jsonb;gt integer;
begin
 v_monday:=anchor-(extract(isodow from anchor)::integer-1);
 if v_monday<date '2026-11-23' or anchor>lumen_commands.daily_today() then
  raise exception using errcode='22023',message='daily_not_open';end if;
 if not lumen_commands.daily_week_finalize(v_monday) then
  return jsonb_build_object('monday',v_monday,'final',false);end if;
 select * into mine from lumen_commands.daily_week_standings s where s.user_id=me and s.monday=v_monday;
 select x.place,x.total into friend_place,friend_total from lumen_commands.daily_week_friends x
  where x.user_id=me and x.member_id=me and x.monday=v_monday;
 select max(s.general_total) into gt from lumen_commands.daily_week_standings s where s.monday=v_monday;
 select coalesce(jsonb_agg(x.row order by x.place,x.nickname collate "C"),'[]') into g from (
  select s.general_rank as place,p.nickname,jsonb_build_object('rank',s.general_rank,'nickname',p.nickname,
   'points',s.points,'played',s.played,'score',s.seconds,'best_score',s.best_score,'mine',s.user_id=me) as row
  from lumen_commands.daily_week_standings s join lumen.profiles p on p.user_id=s.user_id and p.nickname_ready
  join lumen_commands.ranking_members m on m.user_id=s.user_id and m.participating
  where s.monday=v_monday and s.general_rank is not null order by s.general_rank,p.nickname collate "C" limit 3
 ) x;
 select coalesce(jsonb_agg(x.row order by x.place,x.nickname collate "C"),'[]') into f from (
  select c.place,p.nickname,jsonb_build_object('rank',c.place,'nickname',p.nickname,
   'points',s.points,'played',s.played,'score',s.seconds,'best_score',s.best_score,'mine',s.user_id=me) as row
  from lumen_commands.daily_week_friends c join lumen_commands.daily_week_standings s
   on s.monday=c.monday and s.user_id=c.member_id
  join lumen.profiles p on p.user_id=c.member_id and p.nickname_ready
  left join lumen_commands.ranking_members m on m.user_id=c.member_id
  where c.monday=v_monday and c.user_id=me and (c.member_id=me or m.participating)
  order by c.place,p.nickname collate "C" limit 3
 ) x;
 return jsonb_build_object('monday',v_monday,'final',true,
  'general',jsonb_build_object('participants',coalesce(gt,0),'top',g,'me',case when mine.user_id is not null then
   jsonb_build_object('rank',mine.general_rank,'points',mine.points,'played',mine.played,'score',mine.seconds,'best_score',mine.best_score) end),
  'friends',jsonb_build_object('participants',coalesce(friend_total,0),'top',f,'me',case when mine.user_id is not null then
   jsonb_build_object('rank',friend_place,'points',mine.points,'played',mine.played,'score',mine.seconds,'best_score',mine.best_score) end));
end $$;

-- Atomic account watermark: latest relevant recap only, shared by all devices.
create or replace function public.lumen_daily_recap() returns jsonb
language plpgsql security definer set search_path='' as $$
declare me uuid:=lumen_commands.daily_caller();today date:=lumen_commands.daily_today();
 last_day date;last_week date;seen lumen_commands.daily_recap_seen%rowtype;board jsonb;
begin
 insert into lumen_commands.daily_recap_seen(user_id) values(me) on conflict do nothing;
 select * into seen from lumen_commands.daily_recap_seen where user_id=me for update;
 select max(r.day) into last_day from lumen_commands.daily_runs r where r.user_id=me and r.status='completed'
  and r.day<today and lumen_commands.daily_closes_at(r.day)+interval '6 hours'<=clock_timestamp();
 if last_day is null then return null;end if;
 select max(r.day-(extract(isodow from r.day)::integer-1)) into last_week
  from lumen_commands.daily_runs r where r.user_id=me and r.status='completed' and r.day<=last_day
  and lumen_commands.daily_closes_at(r.day+(7-extract(isodow from r.day)::integer))+interval '6 hours'<=clock_timestamp();
 if last_week is not null and (seen.monday is null or seen.monday<last_week) then
  board:=public.lumen_daily_week_board(last_week);
  if (board->>'final')::boolean then
   update lumen_commands.daily_recap_seen set monday=last_week,day=greatest(day,last_week+6) where user_id=me;
   return jsonb_build_object('kind','week','day',last_week,'board',board);
  end if;
 end if;
 if seen.day is null or seen.day<last_day then
  board:=public.lumen_daily_board(last_day);
  update lumen_commands.daily_recap_seen set day=last_day where user_id=me;
  return jsonb_build_object('kind','day','day',last_day,'board',board);
 end if;
 return null;
end $$;

revoke all on function lumen_commands.daily_week_finalize(date),public.lumen_daily_week_board(date),
 public.lumen_daily_recap() from public,anon,authenticated,service_role;
grant execute on function public.lumen_daily_week_board(date),public.lumen_daily_recap() to authenticated;

do $$begin
 if to_regprocedure('lumen_privacy.policy_before_daily_recaps_1015()') is null then
  alter function lumen_privacy.policy() rename to policy_before_daily_recaps_1015;
 end if;
end $$;
create or replace function lumen_privacy.policy()
returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
language sql stable security definer set search_path='' as $$
 select * from lumen_privacy.policy_before_daily_recaps_1015()
 union all values
 ('lumen_commands','daily_week_finalized',null::text,null::text,null::text,'retain-rule'),
 ('lumen_commands','daily_week_standings','user_id',null,null,'delete'),
 ('lumen_commands','daily_week_friends','user_id',null,null,'delete'),
 ('lumen_commands','daily_recap_seen','user_id',null,null,'delete')
$$;
revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_daily_recaps_1015() from public,anon,authenticated,service_role;
do $$begin
 if to_regprocedure('lumen_privacy.scope_predicate_before_recaps_1015(text,text,text,text,text)') is null then
  alter function lumen_privacy.scope_predicate(text,text,text,text,text) rename to scope_predicate_before_recaps_1015;
 end if;
end $$;
create or replace function lumen_privacy.scope_predicate(ns text,rel text,uid_col text,actor_col text,key_col text)
returns text language plpgsql immutable set search_path='' as $$
begin
 if ns='lumen_commands' and rel='daily_week_friends' then return 'user_id=$1 or member_id=$1';end if;
 return lumen_privacy.scope_predicate_before_recaps_1015(ns,rel,uid_col,actor_col,key_col);
end $$;
revoke all on function lumen_privacy.scope_predicate(text,text,text,text,text),
 lumen_privacy.scope_predicate_before_recaps_1015(text,text,text,text,text) from public,anon,authenticated,service_role;
select lumen_privacy.install_guards();
notify pgrst,'reload schema';
commit;
