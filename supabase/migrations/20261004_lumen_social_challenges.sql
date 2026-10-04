-- #18 Social challenges: first-play challenge snapshots, one participation per identity,
-- challenge result inbox and push ownership. Live migration: lumen_social_challenges.
-- The public RPCs are SECURITY DEFINER and are the only client write surface; RLS remains enabled.
-- See docs/DATA_AND_ARCHITECTURE.md for the product/security contract.

create table if not exists lumen.social_challenges (
 id uuid primary key default gen_random_uuid(),
 puzzle_id integer not null check (puzzle_id between 1 and 100),
 sender_user_id uuid references auth.users(id) on delete set null,
 sender_anonymous_id text,
 sender_display_name text not null check (char_length(sender_display_name) between 2 and 24),
 source_duration_seconds integer not null check (source_duration_seconds >= 0),
 source_autonomy boolean not null default false,
 source_speed boolean not null default false,
 source_mastery boolean not null default false,
 source_assistance_used boolean not null default false,
 source_first_play boolean not null default true check (source_first_play),
 created_at timestamptz not null default now()
);
alter table lumen.social_challenges enable row level security;

create table if not exists lumen.social_challenge_participations (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references lumen.social_challenges(id) on delete cascade,
 participant_user_id uuid references auth.users(id) on delete set null,
 participant_anonymous_id text,
 participant_key text not null,
 participant_display_name text not null check (char_length(participant_display_name) between 2 and 24),
 previously_played boolean not null default false,
 status text not null default 'started' check (status in ('started','completed','abandoned')),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 duration_seconds integer,
 autonomy boolean,
 speed boolean,
 mastery boolean,
 assistance_used boolean,
 sender_read_at timestamptz,
 push_notified_at timestamptz,
 unique(challenge_id,participant_key)
);
alter table lumen.social_challenge_participations enable row level security;

alter table public.lumen_push_subscriptions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.lumen_push_subscriptions add column if not exists anonymous_id text;
alter table public.lumen_push_subscriptions add column if not exists social_enabled boolean not null default true;

create index if not exists social_challenge_sender_user_idx on lumen.social_challenges(sender_user_id,created_at desc);
create index if not exists social_challenge_sender_anon_idx on lumen.social_challenges(sender_anonymous_id,created_at desc);
create index if not exists social_participation_challenge_idx on lumen.social_challenge_participations(challenge_id,completed_at desc);
create index if not exists lumen_push_user_idx on public.lumen_push_subscriptions(user_id) where enabled and social_enabled;
create index if not exists lumen_push_anon_idx on public.lumen_push_subscriptions(anonymous_id) where enabled and social_enabled;

create or replace function public.lumen_create_social_challenge(
 p_anonymous_id text,p_display_name text,p_puzzle_id integer,p_duration_seconds integer,
 p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,p_first_play boolean
) returns table(challenge_id uuid)
language plpgsql security definer set search_path=public,lumen,auth as $
declare v_id uuid; v_name text:=trim(regexp_replace(coalesce(p_display_name,''),'\\s+',' ','g'));
begin
 if not coalesce(p_first_play,false) then raise exception 'challenge_requires_first_play'; end if;
 if p_puzzle_id not between 1 and 100 then raise exception 'invalid_puzzle'; end if;
 if char_length(v_name)<2 or char_length(v_name)>24 then raise exception 'invalid_display_name'; end if;
 if auth.uid() is null and coalesce(length(p_anonymous_id),0)<8 then raise exception 'anonymous_identity_required'; end if;
 insert into lumen.social_challenges(puzzle_id,sender_user_id,sender_anonymous_id,sender_display_name,source_duration_seconds,source_autonomy,source_speed,source_mastery,source_assistance_used)
 values(p_puzzle_id,auth.uid(),p_anonymous_id,v_name,greatest(0,p_duration_seconds),coalesce(p_autonomy,false),coalesce(p_speed,false),coalesce(p_mastery,false),coalesce(p_assistance_used,false))
 returning id into v_id;
 return query select v_id;
end $;

create or replace function public.lumen_start_social_challenge(
 p_challenge_id uuid,p_anonymous_id text,p_display_name text,p_previously_played boolean default false
) returns table(participation_id uuid,status text)
language plpgsql security definer set search_path=public,lumen,auth as $
declare v_key text; v_id uuid; v_status text; v_name text:=trim(regexp_replace(coalesce(p_display_name,''),'\\s+',' ','g'));
begin
 if not exists(select 1 from lumen.social_challenges where id=p_challenge_id) then raise exception 'challenge_not_found'; end if;
 if char_length(v_name)<2 or char_length(v_name)>24 then raise exception 'display_name_required'; end if;
 v_key:=case when auth.uid() is not null then 'u:'||auth.uid()::text else 'a:'||coalesce(p_anonymous_id,'') end;
 if length(v_key)<10 then raise exception 'anonymous_identity_required'; end if;
 insert into lumen.social_challenge_participations(challenge_id,participant_user_id,participant_anonymous_id,participant_key,participant_display_name,previously_played)
 values(p_challenge_id,auth.uid(),p_anonymous_id,v_key,v_name,coalesce(p_previously_played,false))
 on conflict(challenge_id,participant_key) do update set participant_display_name=excluded.participant_display_name
 returning id,lumen.social_challenge_participations.status into v_id,v_status;
 return query select v_id,v_status;
end $;

create or replace function public.lumen_finish_social_challenge(
 p_challenge_id uuid,p_anonymous_id text,p_display_name text,p_status text,p_duration_seconds integer,
 p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean
) returns table(participation_id uuid,status text)
language plpgsql security definer set search_path=public,lumen,auth as $
declare v_key text; v_id uuid; v_existing text;
begin
 if p_status not in ('completed','abandoned') then raise exception 'invalid_status'; end if;
 v_key:=case when auth.uid() is not null then 'u:'||auth.uid()::text else 'a:'||coalesce(p_anonymous_id,'') end;
 select id,scp.status into v_id,v_existing from lumen.social_challenge_participations scp where challenge_id=p_challenge_id and participant_key=v_key for update;
 if v_id is null then raise exception 'participation_not_started'; end if;
 if v_existing in ('completed','abandoned') then return query select v_id,v_existing; return; end if;
 update lumen.social_challenge_participations set status=p_status,completed_at=now(),duration_seconds=greatest(0,coalesce(p_duration_seconds,0)),autonomy=coalesce(p_autonomy,false),speed=coalesce(p_speed,false),mastery=coalesce(p_mastery,false),assistance_used=coalesce(p_assistance_used,false),participant_display_name=coalesce(nullif(trim(p_display_name),''),participant_display_name) where id=v_id;
 return query select v_id,p_status;
end $;

create or replace function public.lumen_get_social_challenge(
 p_challenge_id uuid,p_anonymous_id text default null,p_display_name text default null
) returns table(challenge_id uuid,puzzle_id integer,sender_display_name text,created_at timestamptz,participant_status text,participant_display_name text,previously_played boolean,source_duration_seconds integer,source_autonomy boolean,source_speed boolean,source_mastery boolean,source_assistance_used boolean,participant_duration_seconds integer,participant_autonomy boolean,participant_speed boolean,participant_mastery boolean,participant_assistance_used boolean)
language sql security definer set search_path=public,lumen,auth as $
 with me as (select case when auth.uid() is not null then 'u:'||auth.uid()::text else 'a:'||coalesce(p_anonymous_id,'') end k),
 x as (
  select c.*,p.status pstatus,p.participant_display_name pname,p.previously_played pp,p.duration_seconds pdur,p.autonomy paut,p.speed pspd,p.mastery pmas,p.assistance_used passist,
    ((auth.uid() is not null and c.sender_user_id=auth.uid()) or c.sender_anonymous_id=coalesce(p_anonymous_id,'')) owner
  from lumen.social_challenges c cross join me left join lumen.social_challenge_participations p on p.challenge_id=c.id and p.participant_key=me.k where c.id=p_challenge_id
 )
 select id,puzzle_id,sender_display_name,created_at,pstatus,pname,pp,
 case when owner or pstatus in ('completed','abandoned') then source_duration_seconds end,
 case when owner or pstatus in ('completed','abandoned') then source_autonomy end,
 case when owner or pstatus in ('completed','abandoned') then source_speed end,
 case when owner or pstatus in ('completed','abandoned') then source_mastery end,
 case when owner or pstatus in ('completed','abandoned') then source_assistance_used end,
 pdur,paut,pspd,pmas,passist from x
$;

create or replace function public.lumen_list_social_challenges(p_anonymous_id text default null,p_display_name text default null)
returns table(challenge_id uuid,puzzle_id integer,created_at timestamptz,source_duration_seconds integer,source_autonomy boolean,source_speed boolean,source_mastery boolean,participant_count bigint,unread_count bigint,participants jsonb)
language sql security definer set search_path=public,lumen,auth as $
 select c.id,c.puzzle_id,c.created_at,c.source_duration_seconds,c.source_autonomy,c.source_speed,c.source_mastery,count(p.id),count(p.id) filter(where p.completed_at is not null and p.sender_read_at is null),
 coalesce(jsonb_agg(jsonb_build_object('name',p.participant_display_name,'status',p.status,'duration_seconds',p.duration_seconds,'autonomy',p.autonomy,'speed',p.speed,'mastery',p.mastery,'previously_played',p.previously_played,'completed_at',p.completed_at) order by p.completed_at desc) filter(where p.id is not null),'[]'::jsonb)
 from lumen.social_challenges c left join lumen.social_challenge_participations p on p.challenge_id=c.id
 where (auth.uid() is not null and c.sender_user_id=auth.uid()) or c.sender_anonymous_id=coalesce(p_anonymous_id,'')
 group by c.id order by c.created_at desc limit 50
$;

create or replace function public.lumen_mark_social_challenge_read(p_challenge_id uuid,p_anonymous_id text default null,p_display_name text default null)
returns integer language plpgsql security definer set search_path=public,lumen,auth as $
declare n integer;
begin
 update lumen.social_challenge_participations p set sender_read_at=now() from lumen.social_challenges c
 where p.challenge_id=c.id and c.id=p_challenge_id and p.completed_at is not null
 and ((auth.uid() is not null and c.sender_user_id=auth.uid()) or c.sender_anonymous_id=coalesce(p_anonymous_id,''));
 get diagnostics n=row_count; return n;
end $;

revoke all on function public.lumen_create_social_challenge(text,text,integer,integer,boolean,boolean,boolean,boolean,boolean) from public;
revoke all on function public.lumen_start_social_challenge(uuid,text,text,boolean) from public;
revoke all on function public.lumen_finish_social_challenge(uuid,text,text,text,integer,boolean,boolean,boolean,boolean) from public;
grant execute on function public.lumen_create_social_challenge(text,text,integer,integer,boolean,boolean,boolean,boolean,boolean) to anon,authenticated;
grant execute on function public.lumen_start_social_challenge(uuid,text,text,boolean) to anon,authenticated;
grant execute on function public.lumen_finish_social_challenge(uuid,text,text,text,integer,boolean,boolean,boolean,boolean) to anon,authenticated;
grant execute on function public.lumen_get_social_challenge(uuid,text,text) to anon,authenticated;
grant execute on function public.lumen_list_social_challenges(text,text) to anon,authenticated;
grant execute on function public.lumen_mark_social_challenge_read(uuid,text,text) to anon,authenticated;
