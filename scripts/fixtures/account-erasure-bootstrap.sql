-- Disposable DB only, after canonical-ledger-bootstrap.sql (or existing SQL CI).
-- New fixture schema deliberately fails on a second execution/real deployment.
reset role;
set request.jwt.claim.sub='';
create schema fixture_other_app;
create table fixture_other_app.records(user_id uuid primary key references auth.users(id),payload jsonb not null);
do $$begin
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
end $$;
create schema if not exists lumen_commands;
create table if not exists lumen.analytics_events(user_id uuid references auth.users(id) on delete set null,anonymous_id text,properties jsonb);
create table if not exists lumen.analytics_excluded_actors(anonymous_id uuid primary key,reason text);
create table if not exists lumen.canonical_quest_allowlist(quest_id text primary key);
create table if not exists lumen.canonical_reward_events(user_id uuid,quest_id text,xp_credited integer);
create table if not exists lumen.daily_progress(user_id uuid,play_date date,puzzle_id integer);
create table if not exists lumen.difficulty_ratings(user_id uuid,anonymous_id text,rating text);
create table if not exists lumen.engagement_state(user_id uuid,shards integer);
create table if not exists lumen.entitlements(user_id uuid,entitlement text);
create table if not exists lumen.feedback(user_id uuid,anonymous_id text,message text);
create table if not exists lumen.historical_performance(player_key text,user_id uuid,anonymous_id text,puzzle_id integer not null);
create table if not exists lumen.internal_capabilities(user_id uuid,capability text);
create view lumen.player_analytics as select user_id,anonymous_id from lumen.analytics_events;
create table if not exists lumen.profiles(user_id uuid primary key,nickname text);
create table if not exists lumen.progress(user_id uuid,puzzle_id integer);
create table if not exists lumen.recovery_backups(user_id uuid,payload jsonb);
create table lumen.social_challenges(
 id uuid primary key,sender_user_id uuid references auth.users(id) on delete set null,
 sender_anonymous_id text,sender_display_name text not null check(length(sender_display_name) between 2 and 24)
);
create table lumen.social_challenge_participations(
 id uuid primary key,challenge_id uuid references lumen.social_challenges(id) on delete cascade,
 participant_user_id uuid references auth.users(id) on delete set null,
 participant_anonymous_id text,participant_key text not null,participant_display_name text
);
create table if not exists lumen.users(user_id uuid primary key);
create table if not exists lumen_commands.canonical_receipts(user_id uuid,operation_id text,request jsonb,outcome jsonb);
create table if not exists lumen_commands.legacy_authority(user_id uuid,revision bigint,projection jsonb);
create table if not exists lumen_commands.legacy_receipts(user_id uuid,operation_id text,request jsonb,outcome jsonb);
create table if not exists lumen_commands.legacy_rules(quest_id text primary key,rules jsonb);
create table if not exists lumen_commands.outbox_health(user_id uuid,client_id uuid,session_id uuid,session_started timestamptz,sequence integer,platform text,state text,pending integer,failures integer,app_version text);
create table if not exists lumen_commands.wallet_authority(user_id uuid,revision bigint,balance bigint,daily jsonb);
create table if not exists lumen_commands.wallet_receipts(user_id uuid,operation_id text,request jsonb,outcome jsonb);
create table public.lumen_admin_player_snapshot(player_key text primary key,display_name text);
create table public.lumen_push_subscriptions(user_id uuid,anonymous_id text,endpoint text);
create table if not exists public.lumen_sync_health(user_id uuid,event text);
