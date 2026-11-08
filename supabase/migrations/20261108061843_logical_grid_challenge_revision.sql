-- #640. Prepared only: explicit activation requires independent production authorization.
-- Old clients continue creating revision-0 challenges against their old grids.
alter table lumen.social_challenges add column grid_revision integer not null default 0
 check(grid_revision>=0);

create function public.lumen_create_quest_challenge_v2(
 p_anonymous_id text,p_display_name text,p_quest_id text,p_duration_seconds integer,
 p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,p_first_play boolean,
 p_grid_revision integer
) returns table(challenge_id uuid)
language plpgsql security definer set search_path='' as $$
declare created uuid;
begin
 -- Frozen scope of this explicit replacement migration, not a future catalogue limit.
 if p_grid_revision is distinct from 1 or p_quest_id is null or
    p_quest_id !~ '^pack-real-adventure-0[5-8]-q[0-9]{3}$' then
  raise exception 'invalid_grid_revision';
 end if;
 -- Existing API owns identity, first-play, name validation and quest allowlisting.
 select c.challenge_id into created from public.lumen_create_quest_challenge(
  p_anonymous_id,p_display_name,p_quest_id,p_duration_seconds,
  p_autonomy,p_speed,p_mastery,p_assistance_used,p_first_play) c;
 update lumen.social_challenges set grid_revision=p_grid_revision where id=created;
 return query select created;
end $$;
revoke all on function public.lumen_create_quest_challenge_v2(text,text,text,integer,boolean,boolean,boolean,boolean,boolean,integer) from public;
grant execute on function public.lumen_create_quest_challenge_v2(text,text,text,integer,boolean,boolean,boolean,boolean,boolean,integer) to anon,authenticated;

create function public.lumen_get_quest_challenge_v2(p_challenge_id uuid,p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision)
 from public.lumen_get_social_challenge(p_challenge_id,p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1;
$$;
create function public.lumen_list_quest_challenges_v2(p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(visible)||jsonb_build_object('stable_quest_id',coalesce(c.stable_quest_id,q.quest_id),'grid_revision',c.grid_revision) order by visible.created_at desc),'[]')
 from public.lumen_list_social_challenges(p_anonymous_id,p_display_name) visible
 join lumen.social_challenges c on c.id=visible.challenge_id
 left join lumen_commands.quest_rules q on q.legacy_index=c.puzzle_id-1;
$$;
-- A pre-revision client would ignore an extra JSON field and play its old grid.
-- Keep its canonical inbox/read limited to revision 0. Updated clients use v2.
create or replace function public.lumen_get_quest_challenge(p_challenge_id uuid,p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select result from (select public.lumen_get_quest_challenge_v2(p_challenge_id,p_anonymous_id,p_display_name) result) r
 where (result->>'grid_revision')::integer=0;
$$;
create or replace function public.lumen_list_quest_challenges(p_anonymous_id text default null,p_display_name text default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(item order by position),'[]')
 from jsonb_array_elements(public.lumen_list_quest_challenges_v2(p_anonymous_id,p_display_name)) with ordinality a(item,position)
 where (item->>'grid_revision')::integer=0;
$$;

-- Preserve the established one-shot implementations privately. Every public
-- writer must acknowledge the exact grid revision before it can reach them.
alter function public.lumen_start_social_challenge(uuid,text,text,boolean) set schema lumen;
alter function public.lumen_finish_social_challenge(uuid,text,text,text,integer,boolean,boolean,boolean,boolean) set schema lumen;
revoke all on function lumen.lumen_start_social_challenge(uuid,text,text,boolean),
 lumen.lumen_finish_social_challenge(uuid,text,text,text,integer,boolean,boolean,boolean,boolean)
 from public,anon,authenticated,service_role;

create function public.lumen_start_social_challenge(p_challenge_id uuid,p_anonymous_id text,p_display_name text,p_previously_played boolean default false)
returns table(participation_id uuid,status text) language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from lumen.social_challenges where id=p_challenge_id and grid_revision<>0) then raise exception 'challenge_grid_update_required';end if;
 return query select * from lumen.lumen_start_social_challenge(p_challenge_id,p_anonymous_id,p_display_name,p_previously_played);
end $$;
create function public.lumen_start_quest_challenge_v2(p_challenge_id uuid,p_anonymous_id text,p_display_name text,p_previously_played boolean,p_grid_revision integer)
returns table(participation_id uuid,status text) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from lumen.social_challenges where id=p_challenge_id and grid_revision=p_grid_revision) then raise exception 'challenge_grid_update_required';end if;
 return query select * from lumen.lumen_start_social_challenge(p_challenge_id,p_anonymous_id,p_display_name,p_previously_played);
end $$;
create function public.lumen_finish_social_challenge(p_challenge_id uuid,p_anonymous_id text,p_display_name text,p_status text,p_duration_seconds integer,p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean)
returns table(participation_id uuid,status text) language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from lumen.social_challenges where id=p_challenge_id and grid_revision<>0) then raise exception 'challenge_grid_update_required';end if;
 return query select * from lumen.lumen_finish_social_challenge(p_challenge_id,p_anonymous_id,p_display_name,p_status,p_duration_seconds,p_autonomy,p_speed,p_mastery,p_assistance_used);
end $$;
create function public.lumen_finish_quest_challenge_v2(p_challenge_id uuid,p_anonymous_id text,p_display_name text,p_status text,p_duration_seconds integer,p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,p_grid_revision integer)
returns table(participation_id uuid,status text) language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from lumen.social_challenges where id=p_challenge_id and grid_revision=p_grid_revision) then raise exception 'challenge_grid_update_required';end if;
 return query select * from lumen.lumen_finish_social_challenge(p_challenge_id,p_anonymous_id,p_display_name,p_status,p_duration_seconds,p_autonomy,p_speed,p_mastery,p_assistance_used);
end $$;
revoke all on function public.lumen_get_quest_challenge_v2(uuid,text,text),public.lumen_list_quest_challenges_v2(text,text),
 public.lumen_start_social_challenge(uuid,text,text,boolean),public.lumen_start_quest_challenge_v2(uuid,text,text,boolean,integer),
 public.lumen_finish_social_challenge(uuid,text,text,text,integer,boolean,boolean,boolean,boolean),
 public.lumen_finish_quest_challenge_v2(uuid,text,text,text,integer,boolean,boolean,boolean,boolean,integer) from public;
grant execute on function public.lumen_get_quest_challenge_v2(uuid,text,text),public.lumen_list_quest_challenges_v2(text,text),
 public.lumen_start_social_challenge(uuid,text,text,boolean),public.lumen_start_quest_challenge_v2(uuid,text,text,boolean,integer),
 public.lumen_finish_social_challenge(uuid,text,text,text,integer,boolean,boolean,boolean,boolean),
 public.lumen_finish_quest_challenge_v2(uuid,text,text,text,integer,boolean,boolean,boolean,boolean,integer) to anon,authenticated;
-- If erasure has independently been activated, an outdated private review must
-- block this whole migration rather than leave its schema unsupported.
do $$begin
 if to_regprocedure('lumen_privacy.review_erasure(uuid,text[])') is not null then
  execute 'select lumen_privacy.review_erasure($1,$2)'
   using '00000000-0000-0000-0000-000000000000'::uuid,array[]::text[];
 end if;
end $$;
notify pgrst,'reload schema';
