-- Historical recovery for the legacy "Sans erreur" performance badge.
-- Original mistake counters were client-only and are no longer available.
-- Product decision: restore the badge on a deterministic 80 percent sample
-- of historical Mastery rows (all of which are eligible quests >= 6).

alter table lumen.historical_performance
  add column if not exists no_error boolean not null default false;

with ranked as (
  select
    player_key,
    puzzle_id,
    row_number() over (order by md5(player_key || ':' || puzzle_id::text), player_key, puzzle_id) as rn,
    count(*) over () as total
  from lumen.historical_performance
  where mastery = true and puzzle_id >= 6
)
update lumen.historical_performance h
set no_error = true
from ranked r
where h.player_key = r.player_key
  and h.puzzle_id = r.puzzle_id
  and r.rn <= round(r.total * 0.80);

drop function if exists public.lumen_get_historical_performance(text);

create function public.lumen_get_historical_performance(p_anonymous_id text)
returns table(puzzle_id integer, autonomy boolean, speed boolean, no_error boolean, mastery boolean)
language sql security definer set search_path=''
as $$
 select h.puzzle_id,bool_or(h.autonomy),bool_or(h.speed),bool_or(h.no_error),bool_or(h.mastery)
 from lumen.historical_performance h
 where (auth.uid() is not null and h.user_id=auth.uid())
    or (p_anonymous_id is not null and h.anonymous_id=p_anonymous_id)
 group by h.puzzle_id order by h.puzzle_id
$$;

revoke all on function public.lumen_get_historical_performance(text) from public;
grant execute on function public.lumen_get_historical_performance(text) to anon, authenticated, service_role;
