-- Second disposable database on the same CI cluster: roles are cluster-wide.
-- CREATE SCHEMA still refuses any existing Auth/Lumen database.
create schema auth;
create schema lumen;
do $$begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;
end $$;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
grant usage on schema auth to authenticated;
create table lumen.profile_snapshots(
 user_id uuid primary key references auth.users(id),
 payload jsonb not null,saved_at timestamptz not null default now()
);
