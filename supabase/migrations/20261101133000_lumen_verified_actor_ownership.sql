-- #316: private ownership evidence; only a trusted operator may insert
-- independently verified actor bindings. Guest manifests and client aliases
-- alone MUST NOT be treated as proof.
create table if not exists lumen_privacy.verified_actor_ownership (
 user_id uuid not null,
 actor_id text not null check(length(actor_id) between 1 and 256),
 verified boolean not null default false check(verified = true),
 proof_type text not null check(proof_type in ('server_verified_guest_ownership','operator_verified')),
 proof_reference text not null check(length(proof_reference) between 1 and 256),
 verified_at timestamptz not null default now(),
 primary key(actor_id),
 unique(user_id,actor_id)
);
revoke all on lumen_privacy.verified_actor_ownership from public,anon,authenticated,service_role;
alter table lumen_privacy.verified_actor_ownership enable row level security;
comment on table lumen_privacy.verified_actor_ownership is 'Operator-only evidence of independently established guest actor ownership. Never populate from client assertions or guest manifest alone.';
