-- Applied to the Lumen Supabase project on 2026-10-03.
-- Server-authoritative daily streak and idempotent reward ledger.
create table if not exists lumen.engagement_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shards integer not null default 3 check (shards >= 0),
  rewarded_days jsonb not null default '{}'::jsonb,
  autonomy_milestones integer not null default 0 check (autonomy_milestones >= 0),
  updated_at timestamptz not null default now()
);
alter table lumen.engagement_state enable row level security;

create or replace function public.lumen_get_server_day() returns date language sql stable set search_path='' as $$
 select (now() at time zone 'Europe/Paris')::date
$$;

create or replace function public.lumen_claim_daily(p_puzzle_id integer)
returns table(server_day date, credited boolean, reward integer, streak integer)
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_day date:=(now() at time zone 'Europe/Paris')::date;
v_inserted integer:=0; v_streak integer:=0; v_prev date:=null; v_date date; v_reward integer:=0;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_puzzle_id<1 or p_puzzle_id>100 then raise exception 'invalid puzzle'; end if;
 insert into lumen.engagement_state(user_id) values(v_uid) on conflict(user_id) do nothing;
 perform 1 from lumen.engagement_state where user_id=v_uid for update;
 insert into lumen.daily_progress(user_id,play_date,puzzle_id) values(v_uid,v_day,p_puzzle_id)
 on conflict(user_id,play_date) do nothing;
 get diagnostics v_inserted=row_count;
 for v_date in select d.play_date from lumen.daily_progress d where d.user_id=v_uid and d.play_date<=v_day order by d.play_date desc limit 120 loop
  if v_prev is null then if v_day-v_date>2 then exit; end if; v_streak:=1;v_prev:=v_date;
  elsif v_prev-v_date in (1,2) then v_streak:=v_streak+1;v_prev:=v_date; else exit; end if;
 end loop;
 if v_inserted=1 then
  if v_streak>0 and v_streak%7=0 then v_reward:=2; elsif v_streak>0 and v_streak%7=3 then v_reward:=1; end if;
  if v_reward>0 then
   update lumen.engagement_state set shards=shards+v_reward,rewarded_days=rewarded_days||jsonb_build_object(v_day::text,v_reward),updated_at=now()
   where user_id=v_uid and not (rewarded_days ? v_day::text);
   if not found then v_reward:=0; end if;
  end if;
 end if;
 return query select v_day,(v_inserted=1),v_reward,v_streak;
end $$;

create or replace function public.lumen_get_engagement()
returns table(server_day date, shards integer, rewarded_days jsonb)
language sql security definer set search_path='' as $$
 select (now() at time zone 'Europe/Paris')::date,coalesce(e.shards,3),coalesce(e.rewarded_days,'{}'::jsonb)
 from (select 1) x left join lumen.engagement_state e on e.user_id=auth.uid() where auth.uid() is not null
$$;

create or replace function public.lumen_save_daily(p_play_date date,p_puzzle_id integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_day date:=(now() at time zone 'Europe/Paris')::date;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_puzzle_id<1 or p_puzzle_id>100 then raise exception 'invalid puzzle'; end if;
 insert into lumen.daily_progress(user_id,play_date,puzzle_id) values(v_uid,v_day,p_puzzle_id) on conflict(user_id,play_date) do nothing;
end $$;

create or replace function public.lumen_get_daily()
returns table(play_date date,puzzle_id integer,completed_at timestamptz)
language sql security definer set search_path='' as $$
 select d.play_date,d.puzzle_id,d.completed_at from lumen.daily_progress d where d.user_id=auth.uid() order by d.play_date desc limit 120
$$;

revoke all on function public.lumen_get_server_day() from public;
grant execute on function public.lumen_get_server_day() to anon,authenticated;
revoke all on function public.lumen_claim_daily(integer) from public;
grant execute on function public.lumen_claim_daily(integer) to authenticated;
revoke all on function public.lumen_get_engagement() from public;
grant execute on function public.lumen_get_engagement() to authenticated;
revoke all on function public.lumen_save_daily(date,integer) from public;
grant execute on function public.lumen_save_daily(date,integer) to authenticated;
revoke all on function public.lumen_get_daily() from public;
grant execute on function public.lumen_get_daily() to authenticated;


-- One-time conservative recovery of performance trophies from historical data.
create table if not exists lumen.historical_performance (
 player_key text not null,user_id uuid null references auth.users(id) on delete set null,anonymous_id text null,
 puzzle_id integer not null check(puzzle_id between 1 and 100),autonomy boolean not null default false,
 speed boolean not null default false,mastery boolean not null default false,
 source text not null default 'history_recovery_20261003',recovered_at timestamptz not null default now(),
 primary key(player_key,puzzle_id)
);
alter table lumen.historical_performance enable row level security;
-- The production migration additionally backfills this table from lumen.progress and
-- lumen.analytics_events. Only badges directly evidenced by stored hint/time data are credited.
create or replace function public.lumen_get_historical_performance(p_anonymous_id text)
returns table(puzzle_id integer,autonomy boolean,speed boolean,mastery boolean)
language sql security definer set search_path='' as $$
 select h.puzzle_id,bool_or(h.autonomy),bool_or(h.speed),bool_or(h.mastery)
 from lumen.historical_performance h
 where (auth.uid() is not null and h.user_id=auth.uid())
    or (p_anonymous_id is not null and h.anonymous_id=p_anonymous_id)
 group by h.puzzle_id order by h.puzzle_id
$$;
revoke all on function public.lumen_get_historical_performance(text) from public;
grant execute on function public.lumen_get_historical_performance(text) to anon,authenticated;
