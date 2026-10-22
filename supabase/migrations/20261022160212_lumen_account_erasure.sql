-- Lumen-only operator erasure. Never deletes auth.users or another application.
-- Apply only after explicit production authorization; fixtures use disposable SQL.
create schema lumen_privacy;
revoke all on schema lumen_privacy from public, anon, authenticated, service_role;

create table lumen_privacy.erased_identifiers (
 kind text not null check (kind in ('user','actor','key')),
 digest text not null check (digest ~ '^[0-9a-f]{64}$'),
 erased_at timestamptz not null default now(),
 primary key(kind,digest)
);
alter table lumen_privacy.erased_identifiers enable row level security;
revoke all on lumen_privacy.erased_identifiers from public, anon, authenticated, service_role;
comment on table lumen_privacy.erased_identifiers is
 'Private pseudonymous anti-resurrection barrier, not anonymous analytics. No email, profile or receipt. Retain while old clients/shared identities can write; removal requires explicit reviewed reenrollment.';

create function lumen_privacy.fingerprint(p_value text) returns text
language sql immutable strict set search_path='' as $$
 select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_value,'UTF8')),'hex');
$$;

-- Explicit ownership policy. Unknown tables fail review rather than being guessed.
create function lumen_privacy.policy()
returns table(ns text, rel text, uid_col text, actor_col text, key_col text, action text)
language sql immutable set search_path='' as $$
 values
 ('lumen','analytics_events','user_id','anonymous_id',null,'delete'),
 ('lumen','analytics_excluded_actors',null,'anonymous_id',null,'delete'),
 ('lumen','canonical_quest_allowlist',null,null,null,'retain-rule'),
 ('lumen','canonical_reward_events','user_id',null,null,'delete'),
 ('lumen','daily_progress','user_id',null,null,'delete'),
 ('lumen','difficulty_ratings','user_id','anonymous_id',null,'delete'),
 ('lumen','engagement_state','user_id',null,null,'delete'),
 ('lumen','entitlements','user_id',null,null,'delete'),
 ('lumen','feedback','user_id','anonymous_id',null,'delete'),
 ('lumen','historical_performance','user_id','anonymous_id','player_key','delete'),
 ('lumen','internal_capabilities','user_id',null,null,'delete'),
 ('lumen','player_analytics',null,null,null,'derived-view'),
 ('lumen','profile_snapshots','user_id',null,null,'delete'),
 ('lumen','profiles','user_id',null,null,'delete'),
 ('lumen','progress','user_id',null,null,'delete'),
 ('lumen','recovery_backups','user_id',null,null,'delete'),
 ('lumen','social_challenge_participations','participant_user_id','participant_anonymous_id','participant_key','delete'),
 ('lumen','social_challenges','sender_user_id','sender_anonymous_id',null,'anonymize'),
 ('lumen','users','user_id',null,null,'delete'),
 ('lumen_commands','canonical_receipts','user_id',null,null,'delete'),
 ('lumen_commands','legacy_authority','user_id',null,null,'delete'),
 ('lumen_commands','legacy_receipts','user_id',null,null,'delete'),
 ('lumen_commands','legacy_rules',null,null,null,'retain-rule'),
 ('lumen_commands','outbox_health','user_id',null,null,'delete'),
 ('lumen_commands','wallet_authority','user_id',null,null,'delete'),
 ('lumen_commands','wallet_receipts','user_id',null,null,'delete'),
 ('public','lumen_admin_player_snapshot',null,null,'player_key','delete'),
 ('public','lumen_push_subscriptions','user_id','anonymous_id',null,'delete'),
 ('public','lumen_sync_health','user_id',null,null,'delete');
$$;

create function lumen_privacy.guard_write() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_row jsonb := to_jsonb(new); v_uid text := auth.uid()::text;
begin
 -- Trigger queries need a fresh committed view after an erasure's table lock.
 -- Old long-lived repeatable-read snapshots may not observe its barrier.
 if current_setting('transaction_isolation') <> 'read committed' then
  raise exception using errcode='25000',message='LUMEN_WRITE_REQUIRES_READ_COMMITTED';
 end if;
 if exists (
  select 1 from lumen_privacy.erased_identifiers e
  where (e.kind='user' and e.digest in (
    lumen_privacy.fingerprint(v_uid),lumen_privacy.fingerprint(v_row->>tg_argv[0])))
   or (e.kind='actor' and e.digest=lumen_privacy.fingerprint(v_row->>tg_argv[1]))
   or (e.kind='key' and e.digest=lumen_privacy.fingerprint(v_row->>tg_argv[2]))
 ) then
  raise exception using errcode='42501',message='LUMEN_ACCOUNT_ERASED';
 end if;
 return new;
end $$;

-- Called by both the read-only review and the transaction, including after locks.
create function lumen_privacy.review_erasure(p_user_id uuid,p_verified_actors text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; n bigint; actors text[] := coalesce(p_verified_actors,array[]::text[]);
 keys text[]; missing text[]; collision boolean; predicate text; counts jsonb := '{}';
begin
 if auth.uid() is not null then
  raise exception using errcode='42501',message='Operator database session required';
 end if;
 if p_user_id is null or cardinality(actors)>200 or exists (
  select 1 from unnest(actors) a where a is null or length(a) not between 1 and 256
 ) then raise exception using errcode='22023',message='Invalid verified scope'; end if;
 if exists (
  select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace
  where (s.nspname in ('lumen','lumen_commands') or (s.nspname='public' and c.relname like 'lumen\_%' escape '\'))
   and c.relkind in ('r','p','v','m','f') and not exists (
    select 1 from lumen_privacy.policy() p where p.ns=s.nspname and p.rel=c.relname)
 ) then raise exception 'LUMEN_ERASURE_SCHEMA_REVIEW_REQUIRED'; end if;
 keys := array['u:'||p_user_id::text] || array(select 'a:'||a from unnest(actors) a);
 for r in select * from lumen_privacy.policy() order by ns,rel loop
  if to_regclass(format('%I.%I',r.ns,r.rel)) is null then
   raise exception 'LUMEN_ERASURE_SCHEMA_REVIEW_REQUIRED';
  end if;
  if r.action in ('retain-rule','derived-view') then continue; end if;
  if not exists(select 1 from pg_trigger t
   where t.tgrelid=to_regclass(format('%I.%I',r.ns,r.rel))
    and t.tgname='lumen_erasure_guard' and t.tgenabled in ('O','A')
    and t.tgfoid='lumen_privacy.guard_write()'::regprocedure) then
   raise exception 'LUMEN_ERASURE_GUARD_REVIEW_REQUIRED';
  end if;
  if r.action='anonymize' and exists (
   select 1 from pg_attribute a where a.attrelid=to_regclass(format('%I.%I',r.ns,r.rel))
    and a.attnum>0 and not a.attisdropped and a.attname not in (
     'id','puzzle_id','sender_user_id','sender_anonymous_id','sender_display_name',
     'source_duration_seconds','source_autonomy','source_speed','source_mastery',
     'source_assistance_used','source_first_play','created_at')
  ) then raise exception 'LUMEN_ERASURE_SOCIAL_REVIEW_REQUIRED'; end if;
  if r.uid_col is not null and r.actor_col is not null then
   execute format('select array_agg(distinct %1$I::text) from %2$I.%3$I where %4$I=$1 and %1$I is not null and not (%1$I::text=any($2))',
    r.actor_col,r.ns,r.rel,r.uid_col) into missing using p_user_id,actors;
   if cardinality(missing)>0 then
    -- Operator-only review error contains no profile or actor values.
    raise exception 'LUMEN_ERASURE_ACTOR_REVIEW_REQUIRED in %.%',r.ns,r.rel;
   end if;
  end if;
  predicate := concat_ws(' or ',
   case when r.uid_col is not null then format('%I=$1',r.uid_col) end,
   case when r.actor_col is not null then format('%I::text=any($2)',r.actor_col) end,
   case when r.key_col is not null then format('%I=any($3)',r.key_col) end);
  if r.uid_col is not null then
   execute format('select exists(select 1 from %I.%I where %I is not null and %I<>$1 and (%s))',
    r.ns,r.rel,r.uid_col,r.uid_col,predicate) into collision using p_user_id,actors,keys;
   if collision then raise exception 'LUMEN_ERASURE_SHARED_ACTOR in %.%',r.ns,r.rel; end if;
  end if;
  execute format('select count(*) from %I.%I where %s',r.ns,r.rel,predicate)
   into n using p_user_id,actors,keys;
  counts:=counts||jsonb_build_object(r.ns||'.'||r.rel,jsonb_build_object('action',r.action,'rows',n));
 end loop;
 return jsonb_build_object('scope','Lumen only','tables',counts,'authDeleted',false);
end $$;

create function lumen_privacy.erase_account(p_user_id uuid,p_verified_actors text[],p_confirmation text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; report jsonb; actors text[] := coalesce(p_verified_actors,array[]::text[]);
 keys text[]; predicate text;
begin
 if current_setting('transaction_isolation') <> 'read committed' then
  raise exception using errcode='25000',message='LUMEN_WRITE_REQUIRES_READ_COMMITTED';
 end if;
 if p_confirmation is distinct from 'ERASE LUMEN '||p_user_id::text then
  raise exception using errcode='22023',message='Explicit scope confirmation required';
 end if;
 report:=lumen_privacy.review_erasure(p_user_id,actors);
 -- Rare manual operation: lock every owned table, in one stable order, to close
 -- writer/actor-discovery races. Lock failure rolls back; never skip a table.
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') order by ns,rel loop
  execute format('lock table %I.%I in share row exclusive mode',r.ns,r.rel);
 end loop;
 report:=lumen_privacy.review_erasure(p_user_id,actors);
 keys:=array['u:'||p_user_id::text]||array(select 'a:'||a from unnest(actors) a);
 insert into lumen_privacy.erased_identifiers(kind,digest)
 select 'user',lumen_privacy.fingerprint(p_user_id::text)
 union select 'actor',lumen_privacy.fingerprint(a) from unnest(actors) a
 union select 'key',lumen_privacy.fingerprint(k) from unnest(keys) k
 on conflict do nothing;
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') order by ns,rel loop
  predicate:=concat_ws(' or ',
   case when r.uid_col is not null then format('%I=$1',r.uid_col) end,
   case when r.actor_col is not null then format('%I::text=any($2)',r.actor_col) end,
   case when r.key_col is not null then format('%I=any($3)',r.key_col) end);
  if r.action='anonymize' then
   -- Preserve other participants and the non-identifying challenge benchmark.
   execute format('update %I.%I set sender_user_id=null,sender_anonymous_id=null,sender_display_name=''Compte supprimé'' where %s',r.ns,r.rel,predicate)
    using p_user_id,actors,keys;
  else
   execute format('delete from %I.%I where %s',r.ns,r.rel,predicate)
    using p_user_id,actors,keys;
  end if;
 end loop;
 return report||jsonb_build_object('status','erased','barrier','active');
end $$;

-- No public RPC. Neither a player, analytics admin nor the service API key can
-- review/erase accounts or inspect the private barrier. Database owner only.
revoke all on all functions in schema lumen_privacy from public,anon,authenticated,service_role;

do $$declare r record;begin
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') loop
  execute format('create trigger lumen_erasure_guard before insert or update on %I.%I for each row execute function lumen_privacy.guard_write(%L,%L,%L)',
   r.ns,r.rel,coalesce(r.uid_col,''),coalesce(r.actor_col,''),coalesce(r.key_col,''));
 end loop;
 -- Any disagreement aborts the migration transaction, including its triggers.
 perform lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[]);
end $$;
