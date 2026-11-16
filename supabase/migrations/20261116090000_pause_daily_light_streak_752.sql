-- #752: pause the Série de lumière rewards without deleting code or history.
-- Every server route that records a qualified day (lumen_claim_daily, the wallet
-- command, commit_quest and the legacy victory command) goes through
-- lumen_commands.claim_quest_daily. While the flag is off it still records the
-- day in lumen.daily_progress (history and analytics are kept) but never adds a
-- streak reward to lumen.engagement_state.
--
-- Reactivation: update lumen_commands.feature_flags set enabled=true,
-- updated_at=now() where name='daily_light_streak'; and set
-- DAILY_LIGHT_STREAK_ENABLED=true in src/campaign/feature-flags.js.
-- A reward is only ever computed when a day is first inserted, so days played
-- during the pause are never credited retroactively. Idempotent.
create table if not exists lumen_commands.feature_flags(
 name text primary key check(name ~ '^[a-z_]{1,64}$'),
 enabled boolean not null,
 updated_at timestamptz not null default now()
);
revoke all on table lumen_commands.feature_flags from public,anon,authenticated;
insert into lumen_commands.feature_flags(name,enabled) values('daily_light_streak',false) on conflict(name) do nothing;

create or replace function lumen_commands.claim_quest_daily(p_puzzle_id integer,p_quest_id text)
returns table(server_day date,credited boolean,reward integer,streak integer)
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();day date:=(now() at time zone 'Europe/Paris')::date;
 inserted integer:=0;s integer:=0;prev date;d date;amount integer:=0;
 rewards_enabled boolean:=coalesce((select f.enabled from lumen_commands.feature_flags f where f.name='daily_light_streak'),false);
begin
 if uid is null then raise exception using errcode='42501',message='authentication required';end if;
 if not exists(select 1 from lumen_commands.quest_rules q where
  (p_puzzle_id is not null and q.legacy_index=p_puzzle_id-1 and p_quest_id is null) or
  (p_puzzle_id is null and q.quest_id=p_quest_id))
 then raise exception using errcode='22023',message='unknown daily quest';end if;
 insert into lumen.engagement_state(user_id) values(uid) on conflict(user_id) do nothing;
 perform 1 from lumen.engagement_state where user_id=uid for update;
 insert into lumen.daily_progress(user_id,play_date,puzzle_id,stable_quest_id) values(uid,day,p_puzzle_id,p_quest_id) on conflict(user_id,play_date) do nothing;
 get diagnostics inserted=row_count;
 for d in select play_date from lumen.daily_progress where user_id=uid and play_date<=day order by play_date desc limit 120 loop
  if prev is null then if day-d>2 then exit;end if;s:=1;prev:=d;
  elsif prev-d in (1,2) then s:=s+1;prev:=d;else exit;end if;
 end loop;
 -- #752: no streak reward while the Série de lumière is paused.
 if inserted=1 and rewards_enabled then
  if s>0 and s%7=0 then amount:=2;elsif s>0 and s%7=3 then amount:=1;end if;
  if amount>0 then
   update lumen.engagement_state set shards=shards+amount,rewarded_days=rewarded_days||jsonb_build_object(day::text,amount),updated_at=now()
   where user_id=uid and not(rewarded_days ? day::text);
   if not found then amount:=0;end if;
  end if;
 end if;
 return query select day,(inserted=1),amount,s;
end $$;
revoke all on function lumen_commands.claim_quest_daily(integer,text) from public,anon,authenticated;
