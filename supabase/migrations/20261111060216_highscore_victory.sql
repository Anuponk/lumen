begin;
set local lock_timeout='5s';
-- Activation is a separately reviewed production operation, never a side effect
-- of installing this migration. The timestamps are the published notice boundary.
alter table lumen_commands.ranking_control add column if not exists automatic_after timestamptz;
alter table lumen_commands.ranking_control add column if not exists historical_enabled boolean not null default false;
alter table lumen.profiles add column if not exists ranking_opted_out boolean not null default false;
alter table lumen.profiles add column if not exists nickname_ready boolean not null default false;
-- This migration never renames a player. All members of a collision must choose.
update lumen.profiles p set nickname_ready=true where char_length(btrim(p.nickname)) between 3 and 20
 and p.nickname ~ '^[[:alnum:]][[:alnum:] _.-]*$'
 and not exists(select 1 from lumen.profiles other where other.user_id<>p.user_id and lower(btrim(other.nickname))=lower(btrim(p.nickname)));
create unique index if not exists lumen_nickname_unique on lumen.profiles(lower(btrim(nickname))) where nickname_ready;
-- Conservatively preserve historical withdrawals: the old API deleted membership.
insert into lumen.profiles(user_id,ranking_opted_out)
 select distinct r.user_id,true from lumen_commands.ranking_runs r join auth.users a on a.id=r.user_id
 where not exists(select 1 from lumen.profiles p where p.user_id=r.user_id)
 and not exists(select 1 from lumen_commands.ranking_members m where m.user_id=r.user_id)
 on conflict do nothing;
update lumen.profiles p set ranking_opted_out=true where not exists(select 1 from lumen_commands.ranking_members m where m.user_id=p.user_id)
 and exists(select 1 from lumen_commands.ranking_runs r where r.user_id=p.user_id);

create or replace function lumen_commands.profile_nickname_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.nickname is not distinct from old.nickname and new.nickname_ready=old.nickname_ready then
  new.nickname_ready:=old.nickname_ready;return new;
 end if;
 if nullif(btrim(new.nickname),'') is null then new.nickname_ready:=false;return new;end if;
 new.nickname:=btrim(new.nickname);
 if char_length(new.nickname) not between 3 and 20 or new.nickname !~ '^[[:alnum:]][[:alnum:] _.-]*$' then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('lumen-nickname:'||lower(new.nickname),0));
 if exists(select 1 from lumen.profiles p where p.user_id<>new.user_id and lower(btrim(p.nickname))=lower(new.nickname)) then raise unique_violation using message='nickname_unavailable';end if;
 new.nickname_ready:=true;return new;
end $$;
revoke all on function lumen_commands.profile_nickname_guard() from public,anon,authenticated,service_role;
drop trigger if exists lumen_nickname_guard on lumen.profiles;
create trigger lumen_nickname_guard before insert or update on lumen.profiles for each row execute function lumen_commands.profile_nickname_guard();

create or replace function lumen_commands.set_nickname(p_nickname text) returns text
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();v text:=btrim(p_nickname);
begin
 if u is null then raise insufficient_privilege;end if;
 if v is null or char_length(v) not between 3 and 20 or v !~ '^[[:alnum:]][[:alnum:] _.-]*$' then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||u::text,0));
 insert into lumen.profiles(user_id,nickname) values(u,v) on conflict(user_id) do update set nickname=excluded.nickname,nickname_ready=true,updated_at=clock_timestamp();
 -- Existing unresolved duplicates can claim a different nickname, never a
 -- colliding spelling. No score/attempt identity changes when the name changes.
 update lumen_commands.ranking_members set nickname=v where user_id=u;
 return v;
end $$;
create or replace function public.lumen_set_nickname(p_nickname text) returns text
language sql security invoker set search_path='' as $$select lumen_commands.set_nickname(p_nickname)$$;

create or replace function lumen_commands.ranking_account() returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('nicknameRequired',not coalesce(p.nickname_ready,false),'withdrawn',coalesce(p.ranking_opted_out,false),'participating',exists(select 1 from lumen_commands.ranking_members m where m.user_id=auth.uid() and m.participating))
 from (select auth.uid() u) a left join lumen.profiles p on p.user_id=a.u where a.u is not null
$$;
create or replace function public.lumen_ranking_account() returns jsonb language sql security invoker set search_path='' as $$select lumen_commands.ranking_account()$$;

create or replace function lumen_commands.ranking_membership(p_enabled boolean,p_nickname text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p lumen.profiles%rowtype;
begin
 if u is null then raise insufficient_privilege;end if;
 if p_enabled is null then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||u::text,0));
 -- Persist opposition even if no nickname/profile was ever created.
 insert into lumen.profiles(user_id) values(u) on conflict do nothing;
 select * into p from lumen.profiles where user_id=u for update;
 if p_enabled then
  if not p.nickname_ready then raise invalid_parameter_value using message='nickname_required';end if;
  update lumen.profiles set ranking_opted_out=false where user_id=u;
  insert into lumen_commands.ranking_members values(u,btrim(p.nickname),true) on conflict(user_id) do update set nickname=excluded.nickname,participating=true;
 else
  update lumen.profiles set ranking_opted_out=true where user_id=u;
  delete from lumen_commands.ranking_scores where user_id=u;
  delete from lumen_commands.ranking_members where user_id=u;
 end if;
 return jsonb_build_object('participating',p_enabled);
end $$;

create or replace function lumen_commands.ranking_auto(p_started_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();p lumen.profiles%rowtype;
begin
 if u is null then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||u::text,0));
 if not exists(select 1 from lumen_commands.ranking_control where p_started_at>=automatic_after) then return;end if;
 select * into p from lumen.profiles where user_id=u for update;
 if not found or p.ranking_opted_out or not p.nickname_ready then return;end if;
 insert into lumen_commands.ranking_members values(u,btrim(p.nickname),true) on conflict(user_id) do update set nickname=excluded.nickname,participating=true;
end $$;
revoke all on function lumen_commands.ranking_auto(timestamptz) from public,anon,authenticated,service_role;

create or replace function lumen_commands.ranking_begin(p_operation_id text,p_quest_id text,p_grid_revision integer,p_started_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();r lumen_commands.ranking_runs%rowtype;last_run lumen_commands.ranking_runs%rowtype;current_revision integer;allowed boolean;
begin
 if u is null then raise insufficient_privilege;end if;
 if p_operation_id is null or p_operation_id !~ '^[A-Za-z0-9._-]{1,120}$' or p_started_at is null or not isfinite(p_started_at)
  or p_started_at>clock_timestamp()+interval '5 seconds' then raise invalid_parameter_value;end if;
 select grid_revision into current_revision from lumen_commands.quest_rules where quest_id=p_quest_id;
 if not found or p_grid_revision is distinct from current_revision then raise invalid_parameter_value;end if;
 if p_started_at<(select activated_at from lumen_commands.ranking_control) then raise invalid_parameter_value;end if;
 perform lumen_commands.ranking_auto(p_started_at);
 perform pg_advisory_xact_lock(hashtextextended('ranking:'||u::text,0));
 select * into r from lumen_commands.ranking_runs where user_id=u and operation_id=p_operation_id;
 if found then
  if r.quest_id<>p_quest_id or r.grid_revision<>p_grid_revision or r.started_at<>p_started_at then raise invalid_parameter_value;end if;
  return jsonb_build_object('eligible',r.eligible);
 end if;
 select * into last_run from lumen_commands.ranking_runs where user_id=u and quest_id=p_quest_id and grid_revision=p_grid_revision and eligible order by issued_at desc limit 1;
 allowed:=last_run.operation_id is null or (p_started_at>=last_run.started_at+interval '15 minutes' and clock_timestamp()>=last_run.issued_at+interval '15 minutes');
 insert into lumen_commands.ranking_runs(user_id,operation_id,quest_id,grid_revision,started_at,eligible) values(u,p_operation_id,p_quest_id,p_grid_revision,p_started_at,allowed);
 return jsonb_build_object('eligible',allowed);
end $$;


create or replace function lumen_commands.ranking_board(p_quest_id text,p_grid_revision integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();reference integer;result jsonb;
begin
 if u is null then raise insufficient_privilege;end if;
 select ranking_reference_seconds into reference from lumen_commands.quest_rules where quest_id=p_quest_id and grid_revision=p_grid_revision;
 if not found then raise invalid_parameter_value;end if;
 with humans as (
  select s.user_id::text as key,p.nickname,s.score,s.seconds,s.penalty,s.user_id=u as mine,false as virtual
  from lumen_commands.ranking_scores s join lumen_commands.ranking_members m using(user_id) join lumen.profiles p using(user_id)
  where s.quest_id=p_quest_id and s.grid_revision=p_grid_revision and m.participating and p.nickname_ready and not p.ranking_opted_out
 ), echoes as (
  select 'echo-'||i as key,'Écho '||(array['Alcyone','Atlas','Maïa','Mérope','Électre','Taygète','Céléno','Pléioné','Astérope','Séléné'])[i] as nickname,
   (reference*(0.65+i*0.13))::integer as score,(reference*(0.65+i*0.13))::integer as seconds,0 as penalty,false as mine,true as virtual
  from generate_series(1,greatest(0,10-(select count(*)::integer from humans))) i
 ), ranked as (
  select *,rank() over(order by score) as place,row_number() over(order by score,key collate "C") as position from (select * from humans union all select * from echoes) all_rows
 ), packed as (
 select position,mine,jsonb_build_object('nickname',nickname,'score',score,'mine',mine,'virtual',virtual,'place',place,'position',position) as row from ranked
 ) select jsonb_build_object('participating',exists(select 1 from lumen_commands.ranking_members where user_id=u and participating),
 'withdrawn',coalesce((select ranking_opted_out from lumen.profiles where user_id=u),false),
 'realParticipants',(select count(*) from humans),
 'top',coalesce((select jsonb_agg(row order by position) from packed where position<=3),'[]'),
 'personal',(select row from packed where mine),
 'rows',coalesce((select jsonb_agg(row order by position) from packed where position<=3 or mine),'[]')) into result;
 return result;
end $$;

-- Only revision 0 records have an unambiguous original grid identity. A later
-- state.gridRevision does NOT prove the revision of its all-time bestTime.
create or replace view lumen_commands.ranking_history_candidates with (security_invoker=true) as
with snapshots as (
 select user_id,payload,'cloud'::text as source from lumen.profile_snapshots
 union all select user_id,projection,'legacy_authority' from lumen_commands.legacy_authority
), records as (
 select s.user_id,s.source,e.key as reference,false as canonical,e.value as record from snapshots s cross join lateral jsonb_each(coalesce(s.payload->'performances','{}')) e
 union all
 select s.user_id,s.source,e.key,true,coalesce(e.value->'runPerformance','{}') from snapshots s cross join lateral jsonb_each(coalesce(s.payload->'canonicalQuestState','{}')) e
 union all
 select h.user_id,'historical_badges',(h.puzzle_id-1)::text,false,'{}'::jsonb from lumen.historical_performance h
), identified as (
 select r.*,q.quest_id,q.grid_revision,
 case when jsonb_typeof(r.record->'bestTime')='number' and r.record->>'bestTime' ~ '^[0-9]{1,6}$' then (r.record->>'bestTime')::integer end as seconds
 from records r left join lumen_commands.quest_rules q on
 (r.canonical and q.quest_id=r.reference) or (not r.canonical and q.legacy_index::text=r.reference)
)
select i.*,case
 when i.user_id is null then 'unlinked_identity'
 when not exists(select 1 from auth.users a where a.id=i.user_id) then 'deleted_account'
 when p.ranking_opted_out then 'withdrawn'
 when not coalesce(p.nickname_ready,false) then 'nickname_required'
 when not exists(select 1 from lumen_commands.ranking_members m where m.user_id=i.user_id and m.participating) then 'not_participating'
 when i.quest_id is null then 'unknown_quest'
 when i.grid_revision<>0 then 'ambiguous_revision'
 when i.seconds is null or i.seconds>86400 then 'missing_or_invalid_time'
 else null end as exclusion
from identified i left join lumen.profiles p on p.user_id=i.user_id;
revoke all on lumen_commands.ranking_history_candidates from public,anon,authenticated,service_role;

create table if not exists lumen_commands.ranking_import_backup (
 batch_id uuid not null,user_id uuid not null references auth.users(id) on delete cascade,
 quest_id text not null,grid_revision integer not null,
 previous jsonb, imported_seconds integer not null,
 primary key(batch_id,user_id,quest_id,grid_revision)
);
alter table lumen_commands.ranking_import_backup enable row level security;
revoke all on lumen_commands.ranking_import_backup from public,anon,authenticated,service_role;

create or replace function lumen_commands.import_ranking_history(p_apply boolean default false,p_batch uuid default gen_random_uuid()) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r record;s lumen_commands.ranking_scores%rowtype;imported integer:=0;improved integer:=0;unchanged integer:=0;report jsonb;
begin
 select jsonb_build_object('batch',p_batch,'dryRun',not p_apply,
 'players',(select count(distinct user_id) from lumen_commands.ranking_history_candidates),
 'identified',(select count(*) from lumen_commands.ranking_history_candidates),
 'excluded',(select count(*) from lumen_commands.ranking_history_candidates where exclusion is not null),
 'reasons',(select coalesce(jsonb_object_agg(exclusion,n),'{}') from (select exclusion,count(*) n from lumen_commands.ranking_history_candidates where exclusion is not null group by exclusion) a),
 'eligible',(select count(*) from (select user_id,quest_id,grid_revision from lumen_commands.ranking_history_candidates where exclusion is null group by 1,2,3) a)) into report;
 if p_apply and not exists(select 1 from lumen_commands.ranking_control where historical_enabled) then raise insufficient_privilege using message='historical_prerequisites_not_verified';end if;
 for r in select user_id,quest_id,grid_revision,min(seconds) seconds from lumen_commands.ranking_history_candidates where exclusion is null group by 1,2,3 order by user_id,quest_id loop
  -- Same owner lock as withdrawal, finish and erasure guards. Recheck after wait.
  perform pg_advisory_xact_lock(hashtextextended('ranking:'||r.user_id::text,0));
  perform 1 from lumen.profiles where user_id=r.user_id and nickname_ready and not ranking_opted_out for update;
  if not found or not exists(select 1 from auth.users where id=r.user_id) or not exists(select 1 from lumen_commands.ranking_members where user_id=r.user_id and participating) then continue;end if;
  select * into s from lumen_commands.ranking_scores where user_id=r.user_id and quest_id=r.quest_id and grid_revision=r.grid_revision for update;
  if s.score is not null and s.score<=r.seconds then unchanged:=unchanged+1;continue;end if;
  if s.score is not null then improved:=improved+1;end if;
  imported:=imported+1;
  if p_apply then
   insert into lumen_commands.ranking_import_backup values(p_batch,r.user_id,r.quest_id,r.grid_revision,case when s.user_id is not null then to_jsonb(s) end,r.seconds);
   insert into lumen_commands.ranking_scores(user_id,quest_id,grid_revision,seconds,penalty) values(r.user_id,r.quest_id,r.grid_revision,r.seconds,0)
    on conflict(user_id,quest_id,grid_revision) do update set seconds=excluded.seconds,penalty=0 where lumen_commands.ranking_scores.score>excluded.seconds;
  end if;
 end loop;
 return report||jsonb_build_object('imported',imported,'improved',improved,'unchanged',unchanged);
end $$;
revoke all on function lumen_commands.import_ranking_history(boolean,uuid) from public,anon,authenticated,service_role;

-- Rollback is conditional: no newer competitive result, withdrawal or erasure
-- may be undone. No snapshot/progression/reward bytes are ever restored.
create or replace function lumen_commands.rollback_ranking_history(p_batch uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare r record;n integer:=0;
begin
 for r in select * from lumen_commands.ranking_import_backup where batch_id=p_batch order by user_id,quest_id loop
  perform pg_advisory_xact_lock(hashtextextended('ranking:'||r.user_id::text,0));
  perform 1 from lumen.profiles where user_id=r.user_id and not ranking_opted_out for update;
  if not found or not exists(select 1 from lumen_commands.ranking_members where user_id=r.user_id and participating) then continue;end if;
  perform 1 from lumen_commands.ranking_scores where user_id=r.user_id and quest_id=r.quest_id and grid_revision=r.grid_revision and seconds=r.imported_seconds and penalty=0 for update;
  if not found then continue;end if;
  if r.previous is null then delete from lumen_commands.ranking_scores where user_id=r.user_id and quest_id=r.quest_id and grid_revision=r.grid_revision;
  else update lumen_commands.ranking_scores set seconds=(r.previous->>'seconds')::integer,penalty=(r.previous->>'penalty')::integer where user_id=r.user_id and quest_id=r.quest_id and grid_revision=r.grid_revision;end if;
  delete from lumen_commands.ranking_import_backup where batch_id=p_batch and user_id=r.user_id and quest_id=r.quest_id and grid_revision=r.grid_revision;
  n:=n+1;
 end loop;
 return n;
end $$;
revoke all on function lumen_commands.rollback_ranking_history(uuid) from public,anon,authenticated,service_role;

-- Keep inventory, erasure/export and anti-resurrection on the new private backup.
do $$begin
 if to_regprocedure('lumen_privacy.policy_before_highscore()') is null then
  alter function lumen_privacy.policy() rename to policy_before_highscore;
 end if;
end $$;
create or replace function lumen_privacy.policy()
returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
language sql stable set search_path='' as $$
 select * from lumen_privacy.policy_before_highscore()
 union all select 'lumen_commands','ranking_import_backup','user_id',null,null,'delete'
 union all select 'lumen_commands','ranking_history_candidates',null,null,null,'derived-view'
$$;
revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_highscore() from public,anon,authenticated,service_role;
select lumen_privacy.install_guards();
revoke all on function lumen_commands.set_nickname(text),lumen_commands.ranking_account(),public.lumen_set_nickname(text),public.lumen_ranking_account() from public,anon,authenticated;
grant execute on function lumen_commands.set_nickname(text),lumen_commands.ranking_account(),public.lumen_set_nickname(text),public.lumen_ranking_account() to authenticated;
notify pgrst,'reload schema';
commit;
