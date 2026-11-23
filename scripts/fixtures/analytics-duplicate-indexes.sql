-- #995: only exact duplicates of lumen.analytics_events indexes are dropped.
-- Runs after the technical-retention bootstrap (anonymous_id, occurred_at).
create index if not exists analytics_events_occurred_at_idx on lumen.analytics_events(occurred_at);
create index if not exists analytics_events_anonymous_occurred_idx on lumen.analytics_events(anonymous_id,occurred_at);
create index if not exists analytics_events_occurred_idx on lumen.analytics_events(occurred_at);
-- Same name, different definition: must be kept.
drop index if exists lumen.analytics_events_anon_idx;
create index analytics_events_anon_idx on lumen.analytics_events(anonymous_id);
select count(*) as rows_before from lumen.analytics_events \gset

\ir ../../supabase/migrations/20261123062000_analytics_duplicate_indexes_995.sql
\ir ../../supabase/migrations/20261123062000_analytics_duplicate_indexes_995.sql

do $$begin
  assert to_regclass('lumen.analytics_events_occurred_idx') is null, 'exact duplicate dropped';
  assert to_regclass('lumen.analytics_events_occurred_at_idx') is not null, 'twin kept';
  assert to_regclass('lumen.analytics_events_anon_idx') is not null, 'different definition kept';
end $$;

-- Exact duplicate now: dropped, twin kept, rows untouched.
drop index lumen.analytics_events_anon_idx;
create index analytics_events_anon_idx on lumen.analytics_events(anonymous_id,occurred_at);
\ir ../../supabase/migrations/20261123062000_analytics_duplicate_indexes_995.sql
select (count(*) = :rows_before) as rows_kept from lumen.analytics_events \gset
do $$begin
  assert to_regclass('lumen.analytics_events_anon_idx') is null;
  assert to_regclass('lumen.analytics_events_anonymous_occurred_idx') is not null;
end $$;
\if :rows_kept
\else
  \echo 'analytics_events rows changed'
  select 1/0;
\endif
-- Missing twin: the only index is never dropped.
create index analytics_events_occurred_idx on lumen.analytics_events(occurred_at);
drop index lumen.analytics_events_occurred_at_idx;
\ir ../../supabase/migrations/20261123062000_analytics_duplicate_indexes_995.sql
do $$begin
  assert to_regclass('lumen.analytics_events_occurred_idx') is not null, 'sole index kept';
end $$;
-- Restore the schema expected by later steps.
drop index lumen.analytics_events_occurred_idx;
create index analytics_events_occurred_at_idx on lumen.analytics_events(occurred_at);
