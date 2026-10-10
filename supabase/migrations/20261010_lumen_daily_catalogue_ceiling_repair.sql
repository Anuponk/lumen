-- Live Supabase drift repair: historical 100-quest ceiling persisted in daily_progress and RPCs.
-- Keep all existing rows and rewards, and only widen allowed puzzle IDs.
alter table lumen.daily_progress drop constraint if exists daily_progress_puzzle_id_check;
alter table lumen.daily_progress add constraint daily_progress_puzzle_id_check check (puzzle_id between 1 and 10000);

create or replace function public.lumen_claim_daily(p_puzzle_id integer)
returns table(server_day date, credited boolean, reward integer, streak integer)
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_day date:=(now() at time zone 'Europe/Paris')::date;
v_inserted integer:=0; v_streak integer:=0; v_prev date:=null; v_date date; v_reward integer:=0;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_puzzle_id<1 or p_puzzle_id>10000 then raise exception 'invalid puzzle'; end if;
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

create or replace function public.lumen_save_daily(p_play_date date,p_puzzle_id integer)
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid();v_day date:=(now() at time zone 'Europe/Paris')::date;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_puzzle_id<1 or p_puzzle_id>10000 then raise exception 'invalid puzzle'; end if;
 insert into lumen.daily_progress(user_id,play_date,puzzle_id) values(v_uid,v_day,p_puzzle_id) on conflict(user_id,play_date) do nothing;
end $$;

