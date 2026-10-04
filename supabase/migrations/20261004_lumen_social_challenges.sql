-- #18 Social challenges: first-play challenge snapshots, one participation per identity,
-- challenge result inbox and push ownership. Live migration: lumen_social_challenges.
-- The public RPCs are SECURITY DEFINER and are the only client write surface; RLS remains enabled.
-- See docs/DATA_AND_ARCHITECTURE.md for the product/security contract.

create table if not exists lumen.social_challenges (
 id uuid primary key default gen_random_uuid(),
 puzzle_id integer not null check (puzzle_id between 1 and 100),
 sender_user_id uuid references auth.users(id) on delete set null,
 sender_anonymous_id text,
 sender_display_name text not null check (char_length(sender_display_name) between 2 and 24),
 source_duration_seconds integer not null check (source_duration_seconds >= 0),
 source_autonomy boolean not null default false,
 source_speed boolean not null default false,
 source_mastery boolean not null default false,
 source_assistance_used boolean not null default false,
 source_first_play boolean not null default true check (source_first_play),
 created_at timestamptz not null default now()
);
alter table lumen.social_challenges enable row level security;

create table if not exists lumen.social_challenge_participations (
 id uuid primary key default gen_random_uuid(),
 challenge_id uuid not null references lumen.social_challenges(id) on delete cascade,
 participant_user_id uuid references auth.users(id) on delete set null,
 participant_anonymous_id text,
 participant_key text not null,
 participant_display_name text not null check (char_length(participant_display_name) between 2 and 24),
 previously_played boolean not null default false,
 status text not null default 'started' check (status in ('started','completed','abandoned')),
 started_at timestamptz not null default now(),
 completed_at timestamptz,
 duration_seconds integer,
 autonomy boolean,
 speed boolean,
 mastery boolean,
 assistance_used boolean,
 sender_read_at timestamptz,
 push_notified_at timestamptz,
 unique(challenge_id,participant_key)
);
alter table lumen.social_challenge_participations enable row level security;

alter table public.lumen_push_subscriptions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.lumen_push_subscriptions add column if not exists anonymous_id text;
alter table public.lumen_push_subscriptions add column if not exists social_enabled boolean not null default true;

-- Function bodies are intentionally kept in the live migration history. Re-apply from Supabase
-- migration lumen_social_challenges when recreating the backend; do not grant direct table writes.
