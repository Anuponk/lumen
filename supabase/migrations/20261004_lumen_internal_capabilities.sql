-- #33 Internal/admin capabilities for tester-only tools.
create table if not exists lumen.internal_capabilities (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability text not null check (capability ~ '^[a-z0-9_:-]{2,64}$'),
  source text not null default 'manual',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key(user_id, capability)
);
alter table lumen.internal_capabilities enable row level security;

create or replace function public.lumen_get_internal_capabilities()
returns table(capability text, source text, granted_at timestamptz, expires_at timestamptz)
language sql security definer set search_path=''
as $$
 select c.capability,c.source,c.granted_at,c.expires_at
 from lumen.internal_capabilities c
 where c.user_id=auth.uid()
   and (c.expires_at is null or c.expires_at>now())
 order by c.capability
$$;

revoke all on function public.lumen_get_internal_capabilities() from public;
grant execute on function public.lumen_get_internal_capabilities() to authenticated;

insert into lumen.internal_capabilities(user_id,capability,source)
select id,'unlimited_shards','initial_admin_grant'
from auth.users
where lower(email)=lower('valente.cedric@gmail.com')
on conflict(user_id,capability) do nothing;
