-- Administrative control only. Default closed, with no real account enrolled.
create table lumen_commands.sync_release_approvals(
 revision text primary key check(revision ~ '^[0-9a-f]{40}$'),
 protocol integer not null check(protocol=1),
 evidence_digest text not null check(evidence_digest ~ '^[0-9a-f]{64}$'),
 approved_at timestamptz not null default now()
);
create table lumen_commands.sync_rollout_control(
 singleton boolean primary key default true check(singleton),
 allow_new_activations boolean not null default false
);
insert into lumen_commands.sync_rollout_control(singleton,allow_new_activations) values(true,false);
create table lumen_commands.sync_cohort_events(
 event_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 stage text not null check(stage in ('shadow','active')),
 revision text not null,
 evidence_digest text not null,
 recorded_at timestamptz not null default now()
);
create index sync_cohort_events_owner on lumen_commands.sync_cohort_events(user_id,recorded_at);
alter table lumen_commands.sync_release_approvals enable row level security;
alter table lumen_commands.sync_rollout_control enable row level security;
alter table lumen_commands.sync_cohort_events enable row level security;
revoke all on lumen_commands.sync_release_approvals,lumen_commands.sync_rollout_control,lumen_commands.sync_cohort_events from public,anon,authenticated,service_role;

create function lumen_commands.set_sync_cohort(p_user_id uuid,p_stage text,p_revision text,p_evidence_digest text)
returns void language plpgsql security invoker set search_path='' as $$
declare previous lumen_commands.sync_cohorts; approval lumen_commands.sync_release_approvals;
begin
 if p_user_id is null or p_stage not in ('shadow','active') or p_stage is null then raise exception 'invalid cohort' using errcode='22023';end if;
 -- Serialize administrative enrollment with the emergency stop, including when
 -- two operators act together. Existing active accounts keep their authority.
 perform 1 from lumen_commands.sync_rollout_control where singleton for update;
 select * into approval from lumen_commands.sync_release_approvals where revision=p_revision;
 if approval.revision is null or approval.evidence_digest is distinct from p_evidence_digest then raise exception 'release evidence not approved' using errcode='22023';end if;
 select * into previous from lumen_commands.sync_cohorts where user_id=p_user_id for update;
 if previous.stage='active' and p_stage<>'active' then raise exception 'durable activation cannot be downgraded' using errcode='22023';end if;
 if p_stage='active' and previous.stage is distinct from 'active' and not coalesce((select allow_new_activations from lumen_commands.sync_rollout_control where singleton),false) then raise exception 'new activations paused' using errcode='55000';end if;
 if previous.stage=p_stage and previous.revision=p_revision and previous.evidence_digest=p_evidence_digest then return;end if;
 insert into lumen_commands.sync_cohorts(user_id,stage,protocol,revision,evidence_digest)
 values(p_user_id,p_stage,approval.protocol,p_revision,p_evidence_digest)
 on conflict(user_id) do update set stage=excluded.stage,protocol=excluded.protocol,revision=excluded.revision,evidence_digest=excluded.evidence_digest;
 insert into lumen_commands.sync_cohort_events(user_id,stage,revision,evidence_digest) values(p_user_id,p_stage,p_revision,p_evidence_digest);
end $$;
revoke all on function lumen_commands.set_sync_cohort(uuid,text,text,text) from public,anon,authenticated,service_role;

-- 0 is an explicit compatible server decision, not a failed request. Clients
-- may use the old initializer only before any claim mutation was attempted.
create or replace function public.lumen_guest_claim_version()
returns integer language plpgsql stable security invoker set search_path='' as $$
declare contract jsonb;
begin
 contract:=lumen_commands.sync_contract(auth.uid());
 return case when contract->>'stage'='active' then 1 else 0 end;
end $$;
revoke all on function public.lumen_guest_claim_version() from public,anon;
grant execute on function public.lumen_guest_claim_version() to authenticated;

-- Protect the mutation endpoint too: clients cannot bypass capability discovery.
alter function lumen_commands.claim_guest_profile(uuid,jsonb) rename to claim_guest_profile_v1;
revoke all on function lumen_commands.claim_guest_profile_v1(uuid,jsonb) from public,anon,authenticated,service_role;
create function lumen_commands.claim_guest_profile(p_expected_user_id uuid,p_manifest jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then raise insufficient_privilege;end if;
 -- A receipt issued before rollout controls remains readable/retryable even
 -- for a previously unclassified account; it cannot cause a second seed.
 receipt:=lumen_commands.get_guest_claim((p_manifest->>'claimId')::uuid,p_expected_user_id);
 if receipt is null and (lumen_commands.sync_contract(p_expected_user_id)->>'stage') is distinct from 'active' then raise exception 'guest writer not activated' using errcode='55000';end if;
 return lumen_commands.claim_guest_profile_v1(p_expected_user_id,p_manifest);
end $$;
revoke all on function lumen_commands.claim_guest_profile(uuid,jsonb) from public,anon;
grant execute on function lumen_commands.claim_guest_profile(uuid,jsonb) to authenticated;

-- Explicitly rebind the facade after renaming the original implementation.
create or replace function public.lumen_claim_guest_profile(p_expected_user_id uuid,p_manifest jsonb)
returns jsonb language sql security invoker set search_path='' as $$select lumen_commands.claim_guest_profile(p_expected_user_id,p_manifest)$$;
