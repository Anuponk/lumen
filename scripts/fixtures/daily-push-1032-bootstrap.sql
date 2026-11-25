-- Supabase Auth stand-ins only for the disposable canonical-ledger database.
create table if not exists auth.sessions (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 not_after timestamptz
);
create or replace function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
