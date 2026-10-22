-- Disposable baseline for the existing production analytics/capability schema.
create table if not exists lumen.internal_capabilities(user_id uuid,capability text,expires_at timestamptz);
create table if not exists lumen.analytics_events(user_id uuid,anonymous_id text,event_name text,puzzle_id integer,session_id text,occurred_at timestamptz default now(),properties jsonb);
