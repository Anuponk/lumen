-- Remove historical campaign-size ceilings from server persistence.
-- Catalogue membership is owned by the application content registry. The database
-- only guards that a puzzle id is a positive, sane integer so future catalogue
-- growth does not require another schema migration.

alter table lumen.historical_performance
  drop constraint if exists historical_performance_puzzle_id_check;
alter table lumen.historical_performance
  add constraint historical_performance_puzzle_id_check
  check (puzzle_id between 1 and 10000);

alter table lumen.social_challenges
  drop constraint if exists social_challenges_puzzle_id_check;
alter table lumen.social_challenges
  add constraint social_challenges_puzzle_id_check
  check (puzzle_id between 1 and 10000);

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

create or replace function public.lumen_create_social_challenge(
 p_anonymous_id text,p_display_name text,p_puzzle_id integer,p_duration_seconds integer,
 p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,p_first_play boolean
) returns table(challenge_id uuid)
language plpgsql security definer set search_path=public,lumen as $$
declare v_name text:=trim(coalesce(p_display_name,'')); v_id uuid;
begin
 if p_puzzle_id not between 1 and 10000 then raise exception 'invalid_puzzle'; end if;
 if char_length(v_name)<2 or char_length(v_name)>24 then raise exception 'invalid_display_name'; end if;
 if coalesce(p_first_play,false) is not true then raise exception 'challenge_requires_first_play'; end if;
 insert into lumen.social_challenges(puzzle_id,sender_user_id,sender_anonymous_id,sender_display_name,source_duration_seconds,source_autonomy,source_speed,source_mastery,source_assistance_used)
 values(p_puzzle_id,auth.uid(),p_anonymous_id,v_name,greatest(0,p_duration_seconds),coalesce(p_autonomy,false),coalesce(p_speed,false),coalesce(p_mastery,false),coalesce(p_assistance_used,false))
 returning id into v_id;
 return query select v_id;
end $$;

grant execute on function public.lumen_claim_daily(integer) to authenticated;
grant execute on function public.lumen_save_daily(date,integer) to authenticated;
grant execute on function public.lumen_create_social_challenge(text,text,integer,integer,boolean,boolean,boolean,boolean,boolean) to anon,authenticated;
