-- Additive preparation. No existing account is activated or migrated here.
create table lumen_commands.guest_claim_receipts (
 claim_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 manifest jsonb not null,
 created_at timestamptz not null default now()
);
create index guest_claim_receipts_owner on lumen_commands.guest_claim_receipts(user_id);
alter table lumen_commands.guest_claim_receipts enable row level security;
revoke all on lumen_commands.guest_claim_receipts from public,anon,authenticated;

create function lumen_commands.get_guest_claim(p_claim_id uuid,p_expected_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise insufficient_privilege; end if;
 select manifest into m from lumen_commands.guest_claim_receipts where claim_id=p_claim_id and user_id=auth.uid();
 if m is null then return null;end if;
 return jsonb_build_object('version',1,'userId',p_expected_user_id,'claimId',p_claim_id,
  'sourceDigest',m->>'sourceDigest','seedDigest',m->>'seedDigest','policy',m->>'policy','status','initialized');
end $$;

create function lumen_commands.claim_guest_profile(p_expected_user_id uuid,p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();cid uuid;old_manifest jsonb;source_profile jsonb;seed jsonb;inserted uuid;
begin
 if uid is null or uid is distinct from p_expected_user_id then raise insufficient_privilege;end if;
 if jsonb_typeof(p_manifest) is distinct from 'object' or octet_length(p_manifest::text)>1200000
  or p_manifest->>'version' is distinct from '1' or p_manifest->>'userId' is distinct from uid::text
  or p_manifest->>'policy' is distinct from 'new-profile-net-balance-v1'
  or jsonb_typeof(p_manifest->'sourceRaw') is distinct from 'string'
  or jsonb_typeof(p_manifest->'seedRaw') is distinct from 'string'
 then raise exception 'invalid guest claim' using errcode='22023';end if;
 cid:=(p_manifest->>'claimId')::uuid;
 if cid is null then raise exception 'missing claim identity' using errcode='22023';end if;
 source_profile:=(p_manifest->>'sourceRaw')::jsonb;seed:=(p_manifest->>'seedRaw')::jsonb;
 if jsonb_typeof(source_profile) is distinct from 'object'
  or jsonb_typeof(seed->'solved') is distinct from 'object' or jsonb_typeof(seed->'badges') is distinct from 'object'
  or seed ? 'walletRevision' or seed ? 'legacyVictoryRevision' or octet_length(seed::text)>524288
  or seed is distinct from (case when source_profile ? 'shards' then source_profile else source_profile||'{"shards":3}'::jsonb end)
  or jsonb_typeof(seed->'shards') is distinct from 'number' or (seed->>'shards') !~ '^[0-9]+$'
  or (seed->>'shards')::numeric>9007199254740991
  or p_manifest->>'sourceDigest' is distinct from encode(sha256(convert_to(p_manifest->>'sourceRaw','UTF8')),'hex')
  or p_manifest->>'seedDigest' is distinct from encode(sha256(convert_to(p_manifest->>'seedRaw','UTF8')),'hex')
 then raise exception 'guest evidence mismatch' using errcode='22023';end if;
 -- Same provenance across accounts and same account across claims serialize.
 perform pg_advisory_xact_lock(hashtextextended('lumen-guest-claim:'||cid::text,0));
 perform pg_advisory_xact_lock(hashtextextended('lumen-guest-owner:'||uid::text,0));
 select manifest into old_manifest from lumen_commands.guest_claim_receipts where claim_id=cid;
 if old_manifest is not null then
  if old_manifest is distinct from p_manifest then raise exception 'immutable guest claim' using errcode='22023';end if;
  return lumen_commands.get_guest_claim(cid,uid);
 end if;
 -- Identical or divergent existing accounts never receive another seed.
 insert into lumen.profile_snapshots(user_id,payload) values(uid,seed)
 on conflict(user_id) do nothing returning user_id into inserted;
 if inserted is null then return jsonb_build_object('status','review_required');end if;
 insert into lumen_commands.guest_claim_receipts(claim_id,user_id,manifest) values(cid,uid,p_manifest);
 return lumen_commands.get_guest_claim(cid,uid);
end $$;
create function public.lumen_guest_claim_version() returns integer language sql stable security invoker set search_path='' as $$select 1$$;
create function public.lumen_claim_guest_profile(p_expected_user_id uuid,p_manifest jsonb)
returns jsonb language sql security invoker set search_path='' as $$select lumen_commands.claim_guest_profile(p_expected_user_id,p_manifest)$$;
create function public.lumen_get_guest_claim(p_expected_user_id uuid,p_claim_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select lumen_commands.get_guest_claim(p_claim_id,p_expected_user_id)$$;
revoke all on function lumen_commands.claim_guest_profile(uuid,jsonb),lumen_commands.get_guest_claim(uuid,uuid),public.lumen_guest_claim_version(),public.lumen_claim_guest_profile(uuid,jsonb),public.lumen_get_guest_claim(uuid,uuid) from public,anon;
grant execute on function lumen_commands.claim_guest_profile(uuid,jsonb),lumen_commands.get_guest_claim(uuid,uuid),public.lumen_guest_claim_version(),public.lumen_claim_guest_profile(uuid,jsonb),public.lumen_get_guest_claim(uuid,uuid) to authenticated;

-- Cohorts are administrative state. A browser cannot activate or downgrade one.
create table lumen_commands.sync_cohorts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 stage text not null check(stage in ('shadow','active')),
 protocol integer not null check(protocol=1),
 revision text not null check(revision ~ '^[0-9a-f]{40}$'),
 evidence_digest text not null check(evidence_digest ~ '^[0-9a-f]{64}$'),
 activated_at timestamptz not null default now()
);
alter table lumen_commands.sync_cohorts enable row level security;
revoke all on lumen_commands.sync_cohorts from public,anon,authenticated;
create function lumen_commands.protect_sync_activation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 -- Preserve activation through code rollback, without obstructing an explicit
 -- auth-user deletion and its normal FK cascade.
 if tg_op='DELETE' and not exists(select 1 from auth.users where id=old.user_id) then return old;end if;
 if tg_op='DELETE' or (old.stage='active' and (new.stage<>'active' or new.protocol<>old.protocol)) then
  raise exception 'durable sync activation cannot be downgraded' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function lumen_commands.protect_sync_activation() from public,anon,authenticated;
create trigger protect_sync_activation before update or delete on lumen_commands.sync_cohorts for each row execute function lumen_commands.protect_sync_activation();
create function lumen_commands.sync_contract(p_expected_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cohort lumen_commands.sync_cohorts;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise insufficient_privilege;end if;
 select * into cohort from lumen_commands.sync_cohorts where user_id=auth.uid();
 return jsonb_build_object('version',1,'userId',auth.uid(),'protocol',coalesce(cohort.protocol,1),'stage',coalesce(cohort.stage,'compatibility'),'revision',cohort.revision);
end $$;
create function public.lumen_sync_contract(p_expected_user_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select lumen_commands.sync_contract(p_expected_user_id)$$;
revoke all on function lumen_commands.sync_contract(uuid),public.lumen_sync_contract(uuid) from public,anon;
grant execute on function lumen_commands.sync_contract(uuid),public.lumen_sync_contract(uuid) to authenticated;
-- No retirement stage: old snapshot/mirror writers stay available until the
-- separate release evidence gate proves parity, restoration and observation.
