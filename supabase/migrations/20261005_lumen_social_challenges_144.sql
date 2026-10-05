-- Extend social challenges to the current 144-quest campaign.
-- The original challenge schema was created when Lumen had only 100 quests.

alter table lumen.social_challenges
  drop constraint if exists social_challenges_puzzle_id_check;

alter table lumen.social_challenges
  add constraint social_challenges_puzzle_id_check
  check (puzzle_id between 1 and 144);

create or replace function public.lumen_create_social_challenge(
  p_anonymous_id text,p_display_name text,p_puzzle_id integer,p_duration_seconds integer,
  p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,p_first_play boolean
) returns table(challenge_id uuid)
language plpgsql security definer set search_path=public,lumen as $$
declare v_name text:=trim(coalesce(p_display_name,'')); v_id uuid;
begin
  if char_length(v_name) not between 2 and 24 then raise exception 'invalid_display_name'; end if;
  if p_puzzle_id not between 1 and 144 then raise exception 'invalid_puzzle'; end if;
  if coalesce(p_first_play,false) is not true then raise exception 'challenge_requires_first_play'; end if;
  insert into lumen.social_challenges(
    puzzle_id,sender_user_id,sender_anonymous_id,sender_display_name,source_duration_seconds,
    source_autonomy,source_speed,source_mastery,source_assistance_used
  ) values(
    p_puzzle_id,auth.uid(),p_anonymous_id,v_name,greatest(0,p_duration_seconds),
    coalesce(p_autonomy,false),coalesce(p_speed,false),coalesce(p_mastery,false),coalesce(p_assistance_used,false)
  ) returning id into v_id;
  return query select v_id;
end $$;

grant execute on function public.lumen_create_social_challenge(text,text,integer,integer,boolean,boolean,boolean,boolean,boolean) to anon,authenticated;
