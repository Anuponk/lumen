-- #889 / #888 (EPIC #881, Lot 2 PR A). Additive and backward compatible:
-- * a challenge may come from any qualifying run (first win or qualifying
--   replay); source_first_play now records which one, honestly;
-- * readers expose that provenance and the caller's participation start so a
--   resumed attempt on another device never restarts from a blank clock.
-- Existing RPCs keep their first-play contract for older clients; no row is
-- rewritten and existing challenges keep source_first_play=true.
begin;

-- Relax only the "first play" invariant. The column, its default and every
-- historical value are unchanged.
alter table lumen.social_challenges drop constraint if exists social_challenges_source_first_play_check;

-- One versioned writer for every challenge kind. The client declares the run
-- facts it already sends to the victory command (qualifying, first play);
-- the server refuses non-qualifying runs and stores the provenance as given.
create or replace function public.lumen_create_qualifying_challenge(
 p_anonymous_id text,p_display_name text,p_puzzle_id integer,p_quest_id text,p_grid_revision integer,
 p_duration_seconds integer,p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,
 p_first_play boolean,p_qualifying boolean
) returns table(challenge_id uuid)
language plpgsql security definer set search_path='' as $$
declare created uuid;name text:=trim(regexp_replace(coalesce(p_display_name,''),'\s+',' ','g'));
 legacy integer;registered integer;revision integer:=coalesce(p_grid_revision,0);
begin
 if not coalesce(p_qualifying,false) then raise exception 'challenge_requires_qualifying_run';end if;
 if char_length(name)<2 or char_length(name)>24 then raise exception 'invalid_display_name';end if;
 if auth.uid() is null and coalesce(length(p_anonymous_id),0)<8 then raise exception 'anonymous_identity_required';end if;
 if p_duration_seconds is null or p_duration_seconds<0 then raise exception 'invalid_duration';end if;
 if p_quest_id is null then
  -- Historical numeric identity: same contract as lumen_create_social_challenge
  -- (live legacy board, revision 0).
  if p_puzzle_id is null or p_puzzle_id<1 then raise exception 'invalid_puzzle';end if;
  if revision<>0 then raise exception 'invalid_grid_revision';end if;
  insert into lumen.social_challenges(puzzle_id,sender_user_id,sender_anonymous_id,sender_display_name,
   source_duration_seconds,source_autonomy,source_speed,source_mastery,source_assistance_used,source_first_play)
  values(p_puzzle_id,auth.uid(),p_anonymous_id,name,p_duration_seconds,coalesce(p_autonomy,false),coalesce(p_speed,false),
   coalesce(p_mastery,false),coalesce(p_assistance_used,false),coalesce(p_first_play,false))
  returning id into created;
 else
  select q.legacy_index,q.grid_revision into legacy,registered from lumen_commands.quest_rules q where q.quest_id=p_quest_id;
  if not found then raise exception 'invalid_quest';end if;
  -- A stable challenge pins the registered board revision, or revision 0 (the
  -- original board, always resolvable) like lumen_create_quest_challenge.
  if revision not in (0,registered) then raise exception 'invalid_grid_revision';end if;
  insert into lumen.social_challenges(puzzle_id,stable_quest_id,grid_revision,sender_user_id,sender_anonymous_id,sender_display_name,
   source_duration_seconds,source_autonomy,source_speed,source_mastery,source_assistance_used,source_first_play)
  values(legacy+1,p_quest_id,revision,auth.uid(),p_anonymous_id,name,p_duration_seconds,coalesce(p_autonomy,false),coalesce(p_speed,false),
   coalesce(p_mastery,false),coalesce(p_assistance_used,false),coalesce(p_first_play,false))
  returning id into created;
 end if;
 return query select created;
end $$;
revoke all on function public.lumen_create_qualifying_challenge(text,text,integer,text,integer,integer,boolean,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.lumen_create_qualifying_challenge(text,text,integer,text,integer,integer,boolean,boolean,boolean,boolean,boolean,boolean) to anon,authenticated;

-- Readers: provenance for everyone; the caller's own participation start and
-- the server clock only for the caller (never another participant's data).
create or replace function public.lumen_get_quest_challenge_v2(p_challenge_id uuid,p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision,
  'source_first_play',c.source_first_play,'participant_started_at',mine.started_at,'server_now',now())
 from public.lumen_get_social_challenge(p_challenge_id,p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1
 left join lumen.social_challenge_participations mine on mine.challenge_id=c.id
  and mine.participant_key=case when auth.uid() is not null then 'u:'||auth.uid()::text else 'a:'||coalesce(p_anonymous_id,'') end;
$$;
create or replace function public.lumen_list_quest_challenges_v2(p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision,
  'source_first_play',c.source_first_play) order by visible.created_at desc),'[]')
 from public.lumen_list_social_challenges(p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1;
$$;
revoke all on function public.lumen_get_quest_challenge_v2(uuid,text,text),public.lumen_list_quest_challenges_v2(text,text) from public;
grant execute on function public.lumen_get_quest_challenge_v2(uuid,text,text),public.lumen_list_quest_challenges_v2(text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
