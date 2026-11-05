-- Disposable SQL CI only. Match catalog columns absent from minimal erasure fixtures.
alter table lumen.analytics_events add column if not exists event_name text;
alter table lumen.analytics_events add column if not exists occurred_at timestamptz default now();
alter table lumen.feedback add column if not exists status text default 'new';
alter table lumen.feedback add column if not exists created_at timestamptz default now();
alter table public.lumen_push_subscriptions add column if not exists enabled boolean default true;
