-- Complete, versioned cloud snapshot for Lumen migration (#217).
-- Stored in Lumen schema, not exposed to SoldeZen or public REST.
create table if not exists lumen.profile_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1 check (version = 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 524288),
  saved_at timestamptz not null default now()
);
alter table lumen.profile_snapshots enable row level security;
revoke all on lumen.profile_snapshots from public, anon, authenticated;
create or replace function public.lumen_backup_profile(p_payload jsonb)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare v_saved timestamptz;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if p_payload is null or jsonb_typeof(p_payload) <> 'object'
   or jsonb_typeof(p_payload->'solved') <> 'object'
   or jsonb_typeof(p_payload->'badges') <> 'object'
   or octet_length(p_payload::text) > 524288
 then raise exception 'invalid Lumen profile'; end if;
 insert into lumen.profile_snapshots (user_id,payload)
 values (auth.uid(),p_payload)
 on conflict (user_id) do update
 set payload=excluded.payload,saved_at=now()
 returning saved_at into v_saved;
 return v_saved;
end;
$$;
create or replace function public.lumen_restore_profile()
returns jsonb
language sql stable security definer set search_path = ''
as $$
 select s.payload from lumen.profile_snapshots s
 where s.user_id = auth.uid();
$$;
revoke all on function public.lumen_backup_profile(jsonb) from public, anon;
revoke all on function public.lumen_restore_profile() from public, anon;
grant execute on function public.lumen_backup_profile(jsonb) to authenticated;
grant execute on function public.lumen_restore_profile() to authenticated;
