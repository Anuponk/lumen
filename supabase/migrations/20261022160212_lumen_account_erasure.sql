-- Lumen-only operator erasure. Never deletes auth.users or another application.
-- Apply only after explicit production authorization; fixtures use disposable SQL.
create schema lumen_privacy;
revoke all on schema lumen_privacy from public, anon, authenticated, service_role;

create table lumen_privacy.erased_identifiers (
 kind text not null check (kind in ('user','actor','key')),
 digest text not null check (digest ~ '^[0-9a-f]{64}$'),
 owner_digest text not null check (owner_digest ~ '^[0-9a-f]{64}$'),
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
language sql stable set search_path='' as $$
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
 ('public','lumen_sync_health','user_id',null,null,'delete')
 union all
 select 'lumen_commands',x.rel,x.uid_col,null,null,x.action from (values
 ('diagnostic_preferences','user_id','delete'),('diagnostic_events','user_id','delete'),
 ('diagnostic_budgets',null,'delete'),('quest_rules',null,'retain-rule'),
 ('quest_run_authority','user_id','delete'),('guest_claim_receipts','user_id','delete'),
 ('sync_cohorts','user_id','delete'),('sync_cohort_events','user_id','delete'),
 ('sync_release_approvals',null,'retain-rule'),('sync_rollout_control',null,'retain-rule'),
 ('acquisition_recovery_sources','user_id','delete'),('support_control',null,'retain-rule'),
 ('support_cases','user_id','delete'),('support_captures',null,'delete'),
 ('support_contents',null,'delete'),('support_access',null,'delete')
 ) x(rel,uid_col,action) where to_regclass('lumen_commands.'||x.rel) is not null;
$$;


-- $1 verified UID, $2 verified actors, $3 verified player keys. Never raw caller SQL.
create function lumen_privacy.scope_predicate(ns text,rel text,uid_col text,actor_col text,key_col text)
returns text language plpgsql immutable set search_path='' as $$
begin
 if ns='lumen_commands' then
  if rel='diagnostic_budgets' then return 'subject=$1::text';end if;
  if rel='support_captures' then return 'case_id in(select id from lumen_commands.support_cases where user_id=$1)';end if;
  if rel='support_contents' then return 'capture_id in(select id from lumen_commands.support_captures where case_id in(select id from lumen_commands.support_cases where user_id=$1))';end if;
  if rel='support_access' then return 'actor=$1 or privacy_owner_id=$1 or case_id in(select id from lumen_commands.support_cases where user_id=$1)';end if;
 end if;
 return concat_ws(' or ',case when uid_col is not null then format('%I=$1',uid_col) end,
  case when actor_col is not null then format('%I::text=any($2)',actor_col) end,
  case when key_col is not null then format('%I=any($3)',key_col) end);
end $$;

create function lumen_privacy.guard_write() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_row jsonb := to_jsonb(new); v_uid text := auth.uid()::text; support_case uuid; owner_id uuid;
begin
 -- Trigger queries need a fresh committed view after an erasure's table lock.
 -- Old long-lived repeatable-read snapshots may not observe its barrier.
 if current_setting('transaction_isolation') <> 'read committed' then
  raise exception using errcode='25000',message='LUMEN_WRITE_REQUIRES_READ_COMMITTED';
 end if;
 if tg_table_schema='lumen_commands' then
  if tg_table_name='diagnostic_budgets' then v_row:=v_row||jsonb_build_object('user_id',v_row->>'subject');end if;
  if tg_table_name in ('support_captures','support_access') then support_case:=(v_row->>'case_id')::uuid;
  elsif tg_table_name='support_contents' then select case_id into support_case from lumen_commands.support_captures where id=(v_row->>'capture_id')::uuid;end if;
  if support_case is not null then
   select user_id into owner_id from lumen_commands.support_cases where id=support_case;
   if exists(select 1 from lumen_privacy.erased_identifiers where kind='key' and digest=lumen_privacy.fingerprint('support:'||support_case::text)) then
    raise exception using errcode='42501',message='LUMEN_ACCOUNT_ERASED';end if;
   if tg_table_name='support_access' then
    new:=jsonb_populate_record(new,jsonb_build_object('privacy_owner_id',owner_id));
   end if;
   v_row:=v_row||jsonb_build_object('user_id',owner_id);
  end if;
 end if;
 if exists (
  select 1 from lumen_privacy.erased_identifiers e
  where (e.kind='user' and e.digest in (
    lumen_privacy.fingerprint(v_uid),lumen_privacy.fingerprint(v_row->>tg_argv[0]),
    lumen_privacy.fingerprint(v_row->>'user_id'),lumen_privacy.fingerprint(v_row->>'privacy_owner_id'),
    case when tg_table_name='support_access' then lumen_privacy.fingerprint(v_row->>'actor') end))
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
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='lumen_commands' and c.relname in ('support_control','support_cases','support_captures','support_contents','support_access'))
 and (select count(*) from lumen_privacy.policy() where ns='lumen_commands' and rel in ('support_control','support_cases','support_captures','support_contents','support_access'))<>5 then
  raise exception 'LUMEN_ERASURE_SUPPORT_SCHEMA_REVIEW_REQUIRED';
 end if;
 if p_user_id<>'00000000-0000-0000-0000-000000000000' and to_regclass('lumen_commands.support_access') is not null then
  execute 'select exists(select 1 from lumen_commands.support_access a where a.case_id is not null and a.privacy_owner_id is null and not exists(select 1 from lumen_commands.support_cases c where c.id=a.case_id))' into collision;
  if collision then raise exception 'LUMEN_ERASURE_SUPPORT_AUDIT_REVIEW_REQUIRED';end if;
 end if;
 if exists (
  select 1 from pg_class c join pg_namespace s on s.oid=c.relnamespace
  where (s.nspname in ('lumen','lumen_commands') or (s.nspname='public' and c.relname like 'lumen\_%' escape '\'))
   and c.relkind in ('r','p','v','m','f') and not exists (
    select 1 from lumen_privacy.policy() p where p.ns=s.nspname and p.rel=c.relname)
 ) then raise exception 'LUMEN_ERASURE_SCHEMA_REVIEW_REQUIRED'; end if;
 -- New incoming FKs could cascade into another player's/app's data, even if
 -- its table is outside our namespace inventory. Only the known challenge-ID
 -- reference is allowed; challenges are anonymized without changing that ID.
 if exists (
  select 1 from pg_constraint c join lumen_privacy.policy() p
   on c.confrelid=to_regclass(format('%I.%I',p.ns,p.rel))
  where c.contype='f' and p.action in ('delete','anonymize') and not (
   p.ns='lumen' and p.rel='social_challenges'
   and c.conrelid=to_regclass('lumen.social_challenge_participations')
   and cardinality(c.conkey)=1 and cardinality(c.confkey)=1
   and (select a.attname from pg_attribute a where a.attrelid=c.conrelid and a.attnum=c.conkey[1])='challenge_id'
   and (select a.attname from pg_attribute a where a.attrelid=c.confrelid and a.attnum=c.confkey[1])='id'
  ) and not (
   p.ns='lumen_commands' and
   ((p.rel='support_cases' and c.conrelid=to_regclass('lumen_commands.support_captures')
     and pg_get_constraintdef(c.oid)='FOREIGN KEY (case_id) REFERENCES lumen_commands.support_cases(id) ON DELETE CASCADE')
    or (p.rel='support_captures' and c.conrelid=to_regclass('lumen_commands.support_contents')
     and pg_get_constraintdef(c.oid)='FOREIGN KEY (capture_id) REFERENCES lumen_commands.support_captures(id) ON DELETE CASCADE'))
  )
 ) then raise exception 'LUMEN_ERASURE_DEPENDENCY_REVIEW_REQUIRED'; end if;
 keys := array['u:'||p_user_id::text] || array(select 'a:'||a from unnest(actors) a);
 for r in select * from lumen_privacy.policy() order by ns,rel loop
  if to_regclass(format('%I.%I',r.ns,r.rel)) is null then
   raise exception 'LUMEN_ERASURE_SCHEMA_REVIEW_REQUIRED';
  end if;
  if r.action in ('retain-rule','derived-view') then continue; end if;
  if not exists(select 1 from pg_trigger t
   where t.tgrelid=to_regclass(format('%I.%I',r.ns,r.rel))
    and t.tgname='lumen_erasure_guard' and t.tgenabled in ('O','A')
    and t.tgfoid='lumen_privacy.guard_write()'::regprocedure
    and t.tgtype=23 and t.tgqual is null and t.tgnargs=3
    and t.tgargs=convert_to(coalesce(r.uid_col,''),'UTF8')||decode('00','hex')||convert_to(coalesce(r.actor_col,''),'UTF8')||decode('00','hex')||convert_to(coalesce(r.key_col,''),'UTF8')||decode('00','hex')) then
   raise exception 'LUMEN_ERASURE_GUARD_REVIEW_REQUIRED';
  end if;
  if r.action='anonymize' and exists (
   select 1 from pg_attribute a where a.attrelid=to_regclass(format('%I.%I',r.ns,r.rel))
    and a.attnum>0 and not a.attisdropped and a.attname not in (
     'id','puzzle_id','sender_user_id','sender_anonymous_id','sender_display_name',
     'source_duration_seconds','source_autonomy','source_speed','source_mastery',
     'source_assistance_used','source_first_play','created_at','stable_quest_id')
  ) then raise exception 'LUMEN_ERASURE_SOCIAL_REVIEW_REQUIRED'; end if;
  if r.uid_col is not null and r.actor_col is not null then
   execute format('select array_agg(distinct %1$I::text) from %2$I.%3$I where %4$I=$1 and %1$I is not null and not (%1$I::text=any($2))',
    r.actor_col,r.ns,r.rel,r.uid_col) into missing using p_user_id,actors;
   if cardinality(missing)>0 then
    -- Operator-only review error contains no profile or actor values.
    raise exception 'LUMEN_ERASURE_ACTOR_REVIEW_REQUIRED in %.%',r.ns,r.rel;
   end if;
  end if;
  predicate:=lumen_privacy.scope_predicate(r.ns,r.rel,r.uid_col,r.actor_col,r.key_col);
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
 keys text[]; predicate text; remaining bigint;
begin
 if current_setting('transaction_isolation') <> 'read committed' then
  raise exception using errcode='25000',message='LUMEN_WRITE_REQUIRES_READ_COMMITTED';
 end if;
 if p_confirmation is distinct from 'ERASE LUMEN '||p_user_id::text then
  raise exception using errcode='22023',message='Explicit scope confirmation required';
 end if;
 report:=lumen_privacy.review_erasure(p_user_id,actors);
 -- Same support owner lock as upload/revoke/prune, acquired before table locks.
 if to_regclass('lumen_commands.support_cases') is not null then
  perform pg_advisory_xact_lock(574,hashtext(p_user_id::text));
 end if;
 -- Rare manual operation: lock every owned table, in one stable order, to close
 -- writer/actor-discovery races. Lock failure rolls back; never skip a table.
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') order by ns,rel loop
  execute format('lock table %I.%I in share row exclusive mode',r.ns,r.rel);
 end loop;
 report:=lumen_privacy.review_erasure(p_user_id,actors);
 keys:=array['u:'||p_user_id::text]||array(select 'a:'||a from unnest(actors) a);
 insert into lumen_privacy.erased_identifiers(kind,digest,owner_digest)
 select 'user',lumen_privacy.fingerprint(p_user_id::text),lumen_privacy.fingerprint(p_user_id::text)
 union select 'actor',lumen_privacy.fingerprint(a),lumen_privacy.fingerprint(p_user_id::text) from unnest(actors) a
 union select 'key',lumen_privacy.fingerprint(k),lumen_privacy.fingerprint(p_user_id::text) from unnest(keys) k
 on conflict do nothing;
 if to_regclass('lumen_commands.support_cases') is not null then
  execute 'insert into lumen_privacy.erased_identifiers(kind,digest,owner_digest) select ''key'',lumen_privacy.fingerprint(''support:''||id::text),lumen_privacy.fingerprint($1::text) from (select id from lumen_commands.support_cases where user_id=$1 union select case_id as id from lumen_commands.support_access where privacy_owner_id=$1 and case_id is not null) retired on conflict do nothing' using p_user_id;
 end if;
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') order by case rel when 'support_contents' then 0 when 'support_access' then 1 when 'support_captures' then 2 when 'support_cases' then 3 else 4 end,ns,rel loop
  predicate:=lumen_privacy.scope_predicate(r.ns,r.rel,r.uid_col,r.actor_col,r.key_col);
  if r.action='anonymize' then
   -- Preserve other participants and the non-identifying challenge benchmark.
   execute format('update %I.%I set sender_user_id=null,sender_anonymous_id=null,sender_display_name=''Compte supprimé'' where %s',r.ns,r.rel,predicate)
    using p_user_id,actors,keys;
  else
   execute format('delete from %I.%I where %s',r.ns,r.rel,predicate)
    using p_user_id,actors,keys;
  end if;
  -- Check while indirect parent keys still exist. A trigger may silently skip
  -- a row without throwing; that is an incomplete transaction, never success.
  execute format('select count(*) from %I.%I where %s',r.ns,r.rel,predicate)
   into remaining using p_user_id,actors,keys;
  if remaining<>0 then raise exception 'LUMEN_ERASURE_INCOMPLETE';end if;
 end loop;
 return report||jsonb_build_object('status','erased','barrier','active');
end $$;

-- No public RPC. Neither a player, analytics admin nor the service API key can
-- review/erase accounts or inspect the private barrier. Database owner only.
revoke all on all functions in schema lumen_privacy from public,anon,authenticated,service_role;

create function lumen_privacy.install_guards() returns void language plpgsql security invoker set search_path='' as $$declare r record;begin
 if to_regclass('lumen_commands.support_access') is not null then
  alter table lumen_commands.support_access add column if not exists privacy_owner_id uuid;
  -- Attribution only from an existing verified server case, never a supplied UID.
  update lumen_commands.support_access a set privacy_owner_id=c.user_id from lumen_commands.support_cases c where c.id=a.case_id and a.privacy_owner_id is distinct from c.user_id;
 end if;
 for r in select * from lumen_privacy.policy() where action in ('delete','anonymize') loop
  if exists(select 1 from pg_trigger where tgrelid=to_regclass(format('%I.%I',r.ns,r.rel)) and tgname='lumen_erasure_guard') then continue;end if;
  execute format('create trigger lumen_erasure_guard before insert or update on %I.%I for each row execute function lumen_privacy.guard_write(%L,%L,%L)',
   r.ns,r.rel,coalesce(r.uid_col,''),coalesce(r.actor_col,''),coalesce(r.key_col,''));
 end loop;
 -- Any disagreement aborts the migration transaction, including its triggers.
 perform lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[]);
end $$;

revoke all on function lumen_privacy.install_guards() from public,anon,authenticated,service_role;
select lumen_privacy.install_guards();
