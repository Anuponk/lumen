-- Dedicated server-only email throttle for Lumen. No SoldeZen tables or Auth configuration.
create schema if not exists lumen_private;
create table if not exists lumen_private.auth_mail_limits (
  bucket text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
);
revoke all on schema lumen_private from public, anon, authenticated;
revoke all on lumen_private.auth_mail_limits from public, anon, authenticated;
grant usage on schema lumen_private to service_role;

create or replace function public.lumen_auth_mail_reserve(p_email_hash text)
returns boolean language plpgsql security definer
set search_path = '' as $$
declare
  v_email_count integer;
  v_global_count integer;
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  insert into lumen_private.auth_mail_limits(bucket, window_started_at, attempts)
    values ('email:' || p_email_hash, now(), 1)
    on conflict (bucket) do update
      set attempts = case
          when lumen_private.auth_mail_limits.window_started_at <= now() - interval '1 hour'
          then 1 else lumen_private.auth_mail_limits.attempts + 1 end,
          window_started_at = case
          when lumen_private.auth_mail_limits.window_started_at <= now() - interval '1 hour'
          then now() else lumen_private.auth_mail_limits.window_started_at end
    returning attempts into v_email_count;
  insert into lumen_private.auth_mail_limits(bucket, window_started_at, attempts)
    values ('global', now(), 1)
    on conflict (bucket) do update
      set attempts = case
          when lumen_private.auth_mail_limits.window_started_at <= now() - interval '1 hour'
          then 1 else lumen_private.auth_mail_limits.attempts + 1 end,
          window_started_at = case
          when lumen_private.auth_mail_limits.window_started_at <= now() - interval '1 hour'
          then now() else lumen_private.auth_mail_limits.window_started_at end
    returning attempts into v_global_count;
  return v_email_count <= 5 and v_global_count <= 100;
end $$;
revoke all on function public.lumen_auth_mail_reserve(text) from public, anon, authenticated;
grant execute on function public.lumen_auth_mail_reserve(text) to service_role;
