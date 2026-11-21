-- #887 · A challenge stays pinned to the board its sender actually played.
--
-- Audit (production, 21/11/2026, aggregates only): historical numbered quests
-- 3-7 moved to grid revision 1 (#650 / #692, 14/11/2026), but the qualifying
-- writer forced revision 0 on the numbered path. The 4 challenges created on
-- those quests after the switch were played by their sender on revision 1
-- (each sender's own official run started 0-2 min earlier) and replayed by
-- recipients on revision 0. The one created before the switch is correct.
--
-- Additive and idempotent (applied twice in CI):
-- * the numbered path accepts the registered revision, as the stable path does;
--   an older client still sending 0 is corrected from the sender's own
--   official run on that quest (same evidence rule as the one-time repair);
-- * one-time repair: only grid_revision changes, and only with that evidence;
-- * results already played on the other board keep every value and are
--   flagged board_mismatch so no winner is ever derived from them.
-- No score, time, badge, ranking, purchase, link or progression is changed.
begin;

alter table lumen.social_challenge_participations
 add column if not exists board_mismatch boolean not null default false;

-- Revision of the sender's own official run on this quest, started at most
-- 30 minutes before the challenge (a challenge is offered on the victory
-- screen of that run). Null when there is no such evidence.
create or replace function lumen.challenge_played_revision(p_sender uuid,p_quest_id text,p_at timestamptz)
returns integer language sql stable security definer set search_path='' as $$
 select r.grid_revision from lumen_commands.ranking_runs r
 where p_sender is not null and r.user_id=p_sender and r.quest_id=p_quest_id
  and r.started_at<=p_at and r.started_at>p_at-interval '30 minutes'
 order by r.started_at desc limit 1;
$$;
revoke all on function lumen.challenge_played_revision(uuid,text,timestamptz) from public,anon,authenticated;

create or replace function public.lumen_create_qualifying_challenge(
 p_anonymous_id text,p_display_name text,p_puzzle_id integer,p_quest_id text,p_grid_revision integer,
 p_duration_seconds integer,p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,
 p_first_play boolean,p_qualifying boolean
) returns table(challenge_id uuid)
language plpgsql security definer set search_path='' as $$
declare created uuid;name text:=trim(regexp_replace(coalesce(p_display_name,''),'\s+',' ','g'));
 legacy integer;registered integer;numbered_quest text;revision integer:=coalesce(p_grid_revision,0);
begin
 if not coalesce(p_qualifying,false) then raise exception 'challenge_requires_qualifying_run';end if;
 if char_length(name)<2 or char_length(name)>24 then raise exception 'invalid_display_name';end if;
 if auth.uid() is null and coalesce(length(p_anonymous_id),0)<8 then raise exception 'anonymous_identity_required';end if;
 if p_duration_seconds is null or p_duration_seconds<0 then raise exception 'invalid_duration';end if;
 if p_quest_id is null then
  -- Historical numeric identity. #887: pin the board the sender played.
  if p_puzzle_id is null or p_puzzle_id<1 then raise exception 'invalid_puzzle';end if;
  select q.quest_id,q.grid_revision into numbered_quest,registered from lumen_commands.quest_rules q where q.legacy_index=p_puzzle_id-1;
  registered:=coalesce(registered,0);
  if revision=0 and registered>0 and auth.uid() is not null then
   -- Older clients always send 0: trust the sender's own official run instead.
   revision:=coalesce(nullif(lumen.challenge_played_revision(auth.uid(),numbered_quest,now()),0),0);
   if revision<>registered then revision:=0;end if;
  end if;
  if revision not in (0,registered) then raise exception 'invalid_grid_revision';end if;
  insert into lumen.social_challenges(puzzle_id,grid_revision,sender_user_id,sender_anonymous_id,sender_display_name,
   source_duration_seconds,source_autonomy,source_speed,source_mastery,source_assistance_used,source_first_play)
  values(p_puzzle_id,revision,auth.uid(),p_anonymous_id,name,p_duration_seconds,coalesce(p_autonomy,false),coalesce(p_speed,false),
   coalesce(p_mastery,false),coalesce(p_assistance_used,false),coalesce(p_first_play,false))
  returning id into created;
 else
  select q.legacy_index,q.grid_revision into legacy,registered from lumen_commands.quest_rules q where q.quest_id=p_quest_id;
  if not found then raise exception 'invalid_quest';end if;
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

-- One-time repair, evidence only. A second run finds nothing left to change.
-- Private function so the exact same rule is replayed by the CI fixture.
create or replace function lumen.repair_challenge_grid_revisions_887()
returns integer language plpgsql security definer set search_path='' as $$
declare fixed integer;
begin
 -- Returns the number of challenges changed by this call (0 when re-run).
 with repaired as (
  update lumen.social_challenges c set grid_revision=q.grid_revision
  from lumen_commands.quest_rules q
  where q.legacy_index=c.puzzle_id-1 and q.grid_revision>0 and c.grid_revision=0
   and (c.stable_quest_id is null or c.stable_quest_id=q.quest_id)
   and lumen.challenge_played_revision(c.sender_user_id,q.quest_id,c.created_at)=q.grid_revision
  returning c.id
 ), flagged as (
  update lumen.social_challenge_participations p set board_mismatch=true
  from repaired where p.challenge_id=repaired.id returning p.id
 )
 select count(*) into fixed from repaired;
 return fixed;
end $$;
revoke all on function lumen.repair_challenge_grid_revisions_887() from public,anon,authenticated;
select lumen.repair_challenge_grid_revisions_887();

-- Readers expose the flag; the caller's own participation only on get, the
-- sender's own participants only on list (unchanged visibility).
create or replace function public.lumen_get_quest_challenge_v2(p_challenge_id uuid,p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision,
  'source_first_play',c.source_first_play,'participant_started_at',mine.started_at,'server_now',now(),
  'participant_board_mismatch',coalesce(mine.board_mismatch,false))
 from public.lumen_get_social_challenge(p_challenge_id,p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1
 left join lumen.social_challenge_participations mine on mine.challenge_id=c.id
  and mine.participant_key=case when auth.uid() is not null then 'u:'||auth.uid()::text else 'a:'||coalesce(p_anonymous_id,'') end;
$$;
create or replace function public.lumen_list_quest_challenges_v2(p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision,
  'source_first_play',c.source_first_play,
  'participants',coalesce((select jsonb_agg(jsonb_build_object('name',p.participant_display_name,'status',p.status,'duration_seconds',p.duration_seconds,
    'autonomy',p.autonomy,'speed',p.speed,'mastery',p.mastery,'previously_played',p.previously_played,'completed_at',p.completed_at,
    'board_mismatch',p.board_mismatch) order by p.completed_at desc)
   from lumen.social_challenge_participations p where p.challenge_id=c.id),'[]'::jsonb)) order by visible.created_at desc),'[]')
 from public.lumen_list_social_challenges(p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1;
$$;
revoke all on function public.lumen_get_quest_challenge_v2(uuid,text,text),public.lumen_list_quest_challenges_v2(text,text) from public;
grant execute on function public.lumen_get_quest_challenge_v2(uuid,text,text),public.lumen_list_quest_challenges_v2(text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
