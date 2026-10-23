-- #522: stable quest references; historical numeric links and one-shot attempts
-- keep the same tables, identities, privacy filtering and terminal handlers.
alter table lumen.social_challenges add column stable_quest_id text references lumen_commands.quest_rules(quest_id);
alter table lumen.social_challenges alter column puzzle_id drop not null;
alter table lumen.social_challenges add constraint social_challenge_quest_identity check(puzzle_id is not null or stable_quest_id is not null);
create function public.lumen_create_quest_challenge(
 p_anonymous_id text,p_display_name text,p_quest_id text,p_duration_seconds integer,
 p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,p_first_play boolean
) returns table(challenge_id uuid)
language plpgsql security definer set search_path='' as $$
declare id uuid;name text:=trim(regexp_replace(coalesce(p_display_name,''),'\s+',' ','g'));legacy integer;
begin
 if not coalesce(p_first_play,false) then raise exception 'challenge_requires_first_play';end if;
 select legacy_index into legacy from lumen_commands.quest_rules where quest_id=p_quest_id;
 if not found then raise exception 'invalid_quest';end if;
 if char_length(name)<2 or char_length(name)>24 then raise exception 'invalid_display_name';end if;
 if auth.uid() is null and coalesce(length(p_anonymous_id),0)<8 then raise exception 'anonymous_identity_required';end if;
 insert into lumen.social_challenges(puzzle_id,stable_quest_id,sender_user_id,sender_anonymous_id,sender_display_name,
  source_duration_seconds,source_autonomy,source_speed,source_mastery,source_assistance_used)
 values(legacy+1,p_quest_id,auth.uid(),p_anonymous_id,name,greatest(0,p_duration_seconds),coalesce(p_autonomy,false),
  coalesce(p_speed,false),coalesce(p_mastery,false),coalesce(p_assistance_used,false)) returning social_challenges.id into id;
 return query select id;
end $$;
create function public.lumen_get_quest_challenge(p_challenge_id uuid,p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id))
 from public.lumen_get_social_challenge(p_challenge_id,p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1;
$$;
create function public.lumen_list_quest_challenges(p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id)) order by visible.created_at desc),'[]')
 from public.lumen_list_social_challenges(p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1;
$$;
revoke all on function public.lumen_create_quest_challenge(text,text,text,integer,boolean,boolean,boolean,boolean,boolean),
 public.lumen_get_quest_challenge(uuid,text,text),public.lumen_list_quest_challenges(text,text) from public;
grant execute on function public.lumen_create_quest_challenge(text,text,text,integer,boolean,boolean,boolean,boolean,boolean),
 public.lumen_get_quest_challenge(uuid,text,text),public.lumen_list_quest_challenges(text,text) to anon,authenticated;
notify pgrst,'reload schema';
