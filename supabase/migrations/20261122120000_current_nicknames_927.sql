-- #927 · One account = its current nickname everywhere, history included.
--
-- Audit (production, 21/11/2026): rankings, the daily board, the challenge
-- inbox and friends already read lumen.profiles. Challenges did not:
-- lumen_get_social_challenge returned the sender and caller names stored at
-- creation/participation, and lumen_list_social_challenges the participants'
-- stored names, so a renamed player kept their old name in « Mes défis » and
-- in challenge links (and so did the v2 wrappers built on them).
--
-- Resolution at read time by account ID (no mass rewrite): an authenticated
-- sender/participant with a ready nickname shows that nickname; the stored
-- snapshot is the fallback for guests/anonymous players (never matched by name)
-- and for accounts without a ready nickname. Erased accounts are already
-- anonymized (« Compte supprimé ») or removed by Lumen erasure. Snapshots stay
-- in the database unchanged. No time, rank, badge, status, link or owner
-- changes; only the nickname (already public in rankings) is exposed.
begin;

create or replace function lumen.public_nickname(p_user uuid,p_fallback text) returns text
language sql stable security definer set search_path='' as $$
 select coalesce((select btrim(p.nickname) from lumen.profiles p where p_user is not null and p.user_id=p_user and p.nickname_ready),p_fallback);
$$;
revoke all on function lumen.public_nickname(uuid,text) from public,anon,authenticated,service_role;

create or replace function public.lumen_get_social_challenge(p_challenge_id uuid,p_anonymous_id text default null,p_display_name text default null)
returns table(challenge_id uuid,puzzle_id integer,sender_display_name text,created_at timestamptz,participant_status text,participant_display_name text,
 previously_played boolean,source_duration_seconds integer,source_autonomy boolean,source_speed boolean,source_mastery boolean,source_assistance_used boolean,
 participant_duration_seconds integer,participant_autonomy boolean,participant_speed boolean,participant_mastery boolean,participant_assistance_used boolean)
language sql security definer set search_path=public,lumen,auth as $$
 with me as (
  select case when auth.uid() is not null then 'u:'||auth.uid()::text else 'a:'||coalesce(p_anonymous_id,'') end k
 ), x as (
  select c.*,p.status pstatus,lumen.public_nickname(p.participant_user_id,p.participant_display_name) pname,p.previously_played pp,
    p.duration_seconds pdur,p.autonomy paut,p.speed pspd,p.mastery pmas,p.assistance_used passist,
    ((auth.uid() is not null and c.sender_user_id=auth.uid()) or c.sender_anonymous_id=coalesce(p_anonymous_id,'')) owner
  from lumen.social_challenges c cross join me
  left join lumen.social_challenge_participations p on p.challenge_id=c.id and p.participant_key=me.k
  where c.id=p_challenge_id
 )
 select id,puzzle_id,lumen.public_nickname(sender_user_id,sender_display_name),created_at,pstatus,pname,pp,
   case when owner or pstatus in ('completed','abandoned') then source_duration_seconds end,
   case when owner or pstatus in ('completed','abandoned') then source_autonomy end,
   case when owner or pstatus in ('completed','abandoned') then source_speed end,
   case when owner or pstatus in ('completed','abandoned') then source_mastery end,
   case when owner or pstatus in ('completed','abandoned') then source_assistance_used end,
   pdur,paut,pspd,pmas,passist
 from x
$$;

create or replace function public.lumen_list_social_challenges(p_anonymous_id text default null,p_display_name text default null)
returns table(challenge_id uuid,puzzle_id integer,created_at timestamptz,source_duration_seconds integer,source_autonomy boolean,source_speed boolean,
 source_mastery boolean,participant_count bigint,unread_count bigint,participants jsonb)
language sql security definer set search_path=public,lumen,auth as $$
 select c.id,c.puzzle_id,c.created_at,c.source_duration_seconds,c.source_autonomy,c.source_speed,c.source_mastery,
   count(p.id),count(p.id) filter(where p.completed_at is not null and p.sender_read_at is null),
   coalesce(jsonb_agg(jsonb_build_object('name',lumen.public_nickname(p.participant_user_id,p.participant_display_name),'status',p.status,
     'duration_seconds',p.duration_seconds,'autonomy',p.autonomy,'speed',p.speed,'mastery',p.mastery,'previously_played',p.previously_played,
     'completed_at',p.completed_at) order by p.completed_at desc) filter(where p.id is not null),'[]'::jsonb)
 from lumen.social_challenges c
 left join lumen.social_challenge_participations p on p.challenge_id=c.id
 where (auth.uid() is not null and c.sender_user_id=auth.uid()) or c.sender_anonymous_id=coalesce(p_anonymous_id,'')
 group by c.id order by c.created_at desc limit 50
$$;

-- list_v2 rebuilds the participant array (#887 board flag): same resolution.
create or replace function public.lumen_list_quest_challenges_v2(p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision,
  'source_first_play',c.source_first_play,
  'participants',coalesce((select jsonb_agg(jsonb_build_object('name',lumen.public_nickname(p.participant_user_id,p.participant_display_name),
    'status',p.status,'duration_seconds',p.duration_seconds,'autonomy',p.autonomy,'speed',p.speed,'mastery',p.mastery,
    'previously_played',p.previously_played,'completed_at',p.completed_at,'board_mismatch',p.board_mismatch) order by p.completed_at desc)
   from lumen.social_challenge_participations p where p.challenge_id=c.id),'[]'::jsonb)) order by visible.created_at desc),'[]')
 from public.lumen_list_social_challenges(p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1;
$$;

revoke all on function public.lumen_get_social_challenge(uuid,text,text),public.lumen_list_social_challenges(text,text),
 public.lumen_list_quest_challenges_v2(text,text) from public;
grant execute on function public.lumen_get_social_challenge(uuid,text,text),public.lumen_list_social_challenges(text,text),
 public.lumen_list_quest_challenges_v2(text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;
