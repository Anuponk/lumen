begin;

-- Only the private campaign import sets a verifier. Identity and the verifier
-- are independent of the presentation calendar and never exposed to clients.
alter table lumen_commands.daily_puzzles add column guest_solution_hash bytea
  check (octet_length(guest_solution_hash) = 32);

insert into lumen_commands.feature_flags(name, enabled) values ('daily_guest', false)
on conflict (name) do nothing;

create table lumen_commands.daily_guest_runs (
  day date not null references lumen_commands.daily_puzzles(day),
  credential_hash bytea not null check (octet_length(credential_hash) = 32),
  operation_id uuid not null default gen_random_uuid() unique,
  bound_owner uuid references auth.users(id) on delete cascade,
  quest_id text not null,
  grid_revision integer not null,
  started_at timestamptz not null default clock_timestamp(),
  active_at timestamptz default clock_timestamp(),
  active_seconds numeric not null default 0 check (active_seconds >= 0),
  hints integer not null default 0 check (hints between 0 and 10000),
  checks integer not null default 0 check (checks between 0 and 10000),
  guided integer not null default 0 check (guided between 0 and 10000),
  event_number integer not null default 0,
  last_event uuid,
  status text not null default 'started' check (status in ('started','abandoned','completed','claimed')),
  finished_at timestamptz,
  score integer,
  primary key (day, credential_hash),
  unique (day, bound_owner)
);
alter table lumen_commands.daily_guest_runs enable row level security;
revoke all on lumen_commands.daily_guest_runs from public, anon, authenticated, service_role;

create function lumen_commands.daily_guest_enabled() returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select enabled from lumen_commands.feature_flags where name = 'daily_guest'), false)
$$;

create function lumen_commands.daily_guest_view(run lumen_commands.daily_guest_runs) returns jsonb
language sql volatile set search_path = '' as $$
  select jsonb_build_object(
    'day', run.day, 'status', run.status, 'operationId', run.operation_id, 'eventNumber', run.event_number,
    'active', run.active_at is not null,
    'seconds', floor(run.active_seconds + coalesce(extract(epoch from clock_timestamp() - run.active_at), 0))::integer,
    'score', run.score, 'deadline', lumen_commands.daily_closes_at(run.day) + interval '6 hours')
$$;

create or replace function public.lumen_daily_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare d date := lumen_commands.daily_today(); p lumen_commands.daily_puzzles%rowtype;
begin
  if not lumen_commands.daily_enabled_for(auth.uid()) then
    return jsonb_build_object('enabled',false,'day',d,'server_now',clock_timestamp());
  end if;
  select * into p from lumen_commands.daily_puzzles where day = d;
  return jsonb_build_object('enabled',p.day is not null,'day',d,'quest_id',p.quest_id,'grid_revision',p.grid_revision,
    'opens_at',lumen_commands.daily_opens_at(d),'closes_at',lumen_commands.daily_closes_at(d),'server_now',clock_timestamp(),
    'guest_eligible',p.guest_solution_hash is not null and lumen_commands.daily_guest_enabled());
end $$;

create function public.lumen_daily_guest_begin(p_day date, p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare puzzle lumen_commands.daily_puzzles%rowtype; run lumen_commands.daily_guest_runs; credential bytea;
begin
  if auth.uid() is not null or not lumen_commands.daily_enabled_for(null) or not lumen_commands.daily_guest_enabled() then
    return jsonb_build_object('status', 'ineligible');
  end if;
  if coalesce(p_key,'') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status', 'ineligible'); end if;
  if p_day < lumen_commands.daily_today() then return jsonb_build_object('status', 'rollover'); end if;
  if p_day is distinct from lumen_commands.daily_today() then
    return jsonb_build_object('status', 'ineligible');
  end if;
  credential := sha256(decode(p_key, 'hex'));
  select * into puzzle from lumen_commands.daily_puzzles where day = p_day and guest_solution_hash is not null;
  if not found then return jsonb_build_object('status', 'ineligible'); end if;
  insert into lumen_commands.daily_guest_runs(day, credential_hash, quest_id, grid_revision)
  values (p_day, credential, puzzle.quest_id, puzzle.grid_revision) on conflict (day, credential_hash) do nothing;
  select * into run from lumen_commands.daily_guest_runs where day = p_day and credential_hash = credential;
  if run.status = 'started' and clock_timestamp() >= run.started_at + interval '6 hours' then
    return jsonb_build_object('status','expired');
  end if;
  return lumen_commands.daily_guest_view(run);
end $$;

create function public.lumen_daily_guest_event(p_day date, p_key text, p_number integer, p_event uuid, p_action text, p_columns integer[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  run lumen_commands.daily_guest_runs; puzzle lumen_commands.daily_puzzles;
  instant timestamptz; elapsed integer; facts jsonb;
begin
  if auth.uid() is not null or coalesce(p_key,'') !~ '^[0-9a-f]{64}$' or p_event is null
     or coalesce(p_number,0) <= 0 or not lumen_commands.daily_guest_enabled() then
    return jsonb_build_object('status','ineligible');
  end if;
  select * into run from lumen_commands.daily_guest_runs
  where day = p_day and credential_hash = sha256(decode(p_key,'hex')) for update;
  if not found then return jsonb_build_object('status','ineligible'); end if;
  if p_number = run.event_number and p_event = run.last_event then return lumen_commands.daily_guest_view(run); end if;
  if run.status <> 'started' then return lumen_commands.daily_guest_view(run); end if;
  if p_number <> run.event_number + 1 then return jsonb_build_object('status','conflict'); end if;
  instant := clock_timestamp();
  if instant >= run.started_at + interval '6 hours' then return jsonb_build_object('status','expired'); end if;

  case p_action
    when 'pause' then
      if run.active_at is not null then
        run.active_seconds := run.active_seconds + extract(epoch from instant - run.active_at);
        run.active_at := null;
      end if;
    when 'resume' then run.active_at := coalesce(run.active_at, instant);
    when 'hint' then run.hints := least(10000, run.hints + 1);
    when 'verify' then run.checks := least(10000, run.checks + 1);
    when 'guided' then run.guided := least(10000, run.guided + 1);
    when 'abandon' then run.status := 'abandoned'; run.finished_at := instant; run.active_at := null;
    when 'finish' then
      select * into puzzle from lumen_commands.daily_puzzles where day = p_day and quest_id = run.quest_id and grid_revision = run.grid_revision;
      if not found or run.active_at is null or puzzle.guest_solution_hash is null or p_columns is null
        or coalesce(array_ndims(p_columns),0) <> 1 or cardinality(p_columns) not in (7, 8) or array_position(p_columns, null) is not null
        or puzzle.guest_solution_hash is distinct from sha256(convert_to(
          p_day::text || ':' || run.quest_id || ':' || run.grid_revision || ':' || array_to_string(p_columns, ','), 'UTF8')) then
        return jsonb_build_object('status','ineligible');
      end if;
      run.active_seconds := run.active_seconds + extract(epoch from instant - run.active_at);
      elapsed := floor(run.active_seconds)::integer;
      facts := jsonb_build_object('seconds',elapsed,'hintUsed',run.hints>0,'assistanceUsed',run.hints+run.checks+run.guided>0,
        'timing',jsonb_build_object('version',1,'gridRevision',run.grid_revision,
        'helpUses',jsonb_build_object('hint',run.hints,'verify',run.checks,'guided',run.guided)));
      if run.checks + run.guided > 10000 then return jsonb_build_object('status','ineligible'); end if;
      run.score := lumen_commands.official_time(facts,run.grid_revision);
      run.status := 'completed'; run.finished_at := instant; run.active_at := null;
    else return jsonb_build_object('status','ineligible');
  end case;
  update lumen_commands.daily_guest_runs set
    active_at = run.active_at, active_seconds = run.active_seconds, hints = run.hints, checks = run.checks, guided = run.guided,
    event_number = p_number, last_event = p_event, status = run.status, score = run.score, finished_at = run.finished_at
  where day = p_day and credential_hash = run.credential_hash returning * into run;
  return lumen_commands.daily_guest_view(run);
end $$;

-- Only the server-generated signup link can associate a receipt with the
-- account it just prepared. The client cannot supply an account to this RPC.
create function public.lumen_daily_guest_bind_signup(p_day date, p_key text, p_owner uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  if p_owner is null or coalesce(p_key,'') !~ '^[0-9a-f]{64}$' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('lumen-daily:' || p_owner::text, 0));
  if not exists(select 1 from auth.users where id = p_owner and email_confirmed_at is null)
    or exists(select 1 from lumen_commands.daily_runs where user_id = p_owner and day = p_day)
    or exists(select 1 from lumen_commands.daily_guest_runs where day = p_day and bound_owner = p_owner
      and credential_hash <> sha256(decode(p_key, 'hex'))) then return false; end if;
  update lumen_commands.daily_guest_runs set bound_owner = p_owner
   where day = p_day and credential_hash = sha256(decode(p_key, 'hex'))
     and (bound_owner is null or bound_owner = p_owner) and status = 'completed'
     and clock_timestamp() < lumen_commands.daily_closes_at(p_day) + interval '6 hours';
  get diagnostics changed = row_count;
  return changed = 1;
end $$;

create function public.lumen_daily_guest_claim(p_day date, p_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := lumen_commands.daily_caller();
  run lumen_commands.daily_guest_runs;
  ranked lumen_commands.daily_runs;
begin
  if p_day is null or (p_key is not null and p_key !~ '^[0-9a-f]{64}$') then return jsonb_build_object('status','ineligible'); end if;
  perform pg_advisory_xact_lock(hashtextextended('lumen-daily:' || owner_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('lumen-daily-finalize:' || p_day::text, 0));
  if p_key is null then
    if not exists(select 1 from auth.users where id = owner_id and email_confirmed_at is not null) then
      return jsonb_build_object('status','ineligible');
    end if;
    select * into run from lumen_commands.daily_guest_runs where day = p_day and bound_owner = owner_id for update;
  else
    select * into run from lumen_commands.daily_guest_runs where day = p_day and credential_hash = sha256(decode(p_key,'hex'))
      and (bound_owner is null or bound_owner = owner_id) for update;
  end if;
  if not found then return jsonb_build_object('status','ineligible'); end if;
  select * into ranked from lumen_commands.daily_runs where user_id = owner_id and day = p_day;
  if found then
    if ranked.operation_id = run.operation_id::text then return lumen_commands.daily_run_json(ranked); end if;
    return jsonb_build_object('status','already_played');
  end if;
  if run.status <> 'completed' then return jsonb_build_object('status','ineligible'); end if;
  if clock_timestamp() >= lumen_commands.daily_closes_at(p_day) + interval '6 hours'
    or exists(select 1 from lumen_commands.daily_finalized where day = p_day) then return jsonb_build_object('status','expired'); end if;
  perform lumen_commands.ranking_auto(clock_timestamp());
  insert into lumen_commands.daily_runs(user_id,day,operation_id,quest_id,grid_revision,started_at,status,seconds,hint,verify,guided,score,finished_at)
  values(owner_id,p_day,run.operation_id::text,run.quest_id,run.grid_revision,run.started_at,'completed',
    floor(run.active_seconds)::integer,run.hints,run.checks,run.guided,run.score,run.finished_at) returning * into ranked;
  update lumen_commands.daily_guest_runs set status = 'claimed' where day = p_day and credential_hash = run.credential_hash;
  return lumen_commands.daily_run_json(ranked);
end $$;

revoke all on function lumen_commands.daily_guest_enabled(), lumen_commands.daily_guest_view(lumen_commands.daily_guest_runs)
  from public, anon, authenticated, service_role;
revoke all on function public.lumen_daily_guest_begin(date,text),
  public.lumen_daily_guest_event(date,text,integer,uuid,text,integer[]), public.lumen_daily_guest_claim(date,text),
  public.lumen_daily_guest_bind_signup(date,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.lumen_daily_guest_begin(date,text),
  public.lumen_daily_guest_event(date,text,integer,uuid,text,integer[]) to anon;
grant execute on function public.lumen_daily_guest_claim(date,text) to authenticated;
grant execute on function public.lumen_daily_guest_bind_signup(date,text,uuid) to service_role;

do $$
begin
  if to_regprocedure('lumen_privacy.policy()') is not null then
    alter function lumen_privacy.policy() rename to policy_before_daily_guest;
    execute $policy$create function lumen_privacy.policy()
      returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
      language sql stable set search_path='' as $body$
        select * from lumen_privacy.policy_before_daily_guest()
        union all values ('lumen_commands','daily_guest_runs','bound_owner',null::text,null::text,'delete')
      $body$ $policy$;
    revoke all on function lumen_privacy.policy(), lumen_privacy.policy_before_daily_guest() from public, anon, authenticated, service_role;
    perform lumen_privacy.install_guards();
  end if;
end $$;

-- A fresh SQL-only maintenance pass once per day, without requests or exports.
do $$
begin
  if exists(select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('lumen-daily-guest-retention', '17 9 * * *',
      $job$delete from lumen_commands.daily_guest_runs where day < (clock_timestamp() at time zone 'Europe/Paris')::date - 1$job$);
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
