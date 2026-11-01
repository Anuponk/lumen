-- #316: private server-side reauthentication proof ledger.
-- Deploy only alongside the isolated private operator service.
create table if not exists lumen_privacy.reauth_proofs (
 user_id uuid not null,
 session_id uuid not null,
 verified_at timestamptz not null,
 primary key(user_id,session_id)
);
revoke all on lumen_privacy.reauth_proofs from public,anon,authenticated,service_role;
alter table lumen_privacy.reauth_proofs enable row level security;
create index if not exists reauth_proofs_verified_at_idx on lumen_privacy.reauth_proofs(verified_at);
comment on table lumen_privacy.reauth_proofs is 'Private short-lived session-bound proof of independently verified recent reauthentication; no browser or service_role access.';
