-- #999: synthetic stand-in for the production shape exported by
-- scripts/lumen-backup.sh (no real data). Covers RLS, an auth.uid() default,
-- a trigger whose function lives outside the dump and analytics exclusion.
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table auth.users(id uuid primary key, email text unique, created_at timestamptz default now());
create table auth.identities(id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, provider text not null);
create function public.lumen_touch() returns trigger language plpgsql as $$ begin return new; end $$;

create schema lumen;
create schema lumen_commands;
create schema lumen_privacy;
create table lumen.profile_snapshots(user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(), payload jsonb not null);
alter table lumen.profile_snapshots enable row level security;
create table lumen.analytics_events(id bigserial primary key, user_id uuid, event_name text);
create table lumen_commands.purchases(id bigserial primary key, user_id uuid references auth.users(id), product_id text, status text);
create trigger purchases_touch before update on lumen_commands.purchases for each row execute function public.lumen_touch();
create table lumen_privacy.erasure_ledger(id bigserial primary key, subject_digest text not null);

insert into auth.users(id,email) select gen_random_uuid(), 'synthetic-backup-' || g || '@example.invalid' from generate_series(1,5) g;
insert into auth.identities(id,user_id,provider) select gen_random_uuid(), id, 'email' from auth.users;
insert into lumen.profile_snapshots(user_id,payload) select id, jsonb_build_object('solved', jsonb_build_object('1', true)) from auth.users;
insert into lumen.analytics_events(user_id,event_name) select id, 'puzzle_start' from auth.users;
insert into lumen_commands.purchases(user_id,product_id,status) select id, 'real-adventure-02', 'paid' from auth.users limit 2;
insert into lumen_privacy.erasure_ledger(subject_digest) values ('synthetic');
