create table public.lumen_sync_health (
 id bigint generated always as identity primary key, user_id uuid, recorded_at timestamptz,
 event text, reason text, outcome text
);
create table lumen_commands.outbox_health (
 user_id uuid, oldest_pending_at timestamptz, state text, failures integer, pending integer
);
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function public.lumen_get_internal_capabilities() returns table(capability text)
language sql stable as $$
 select 'analytics_cockpit'::text where auth.uid()='00000000-0000-0000-0000-000000000001'
$$;
