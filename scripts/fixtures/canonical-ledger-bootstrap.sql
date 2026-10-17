-- Isolated disposable PostgreSQL only. CREATE SCHEMA deliberately fails if
-- pointed at a real Supabase database; never run fixtures against player data.
create schema auth;
create schema lumen;
create role anon;
create role authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create table lumen.profile_snapshots(
 user_id uuid primary key references auth.users(id),
 payload jsonb not null,
 saved_at timestamptz not null default now()
);
