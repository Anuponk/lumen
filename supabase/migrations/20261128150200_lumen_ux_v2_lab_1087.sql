-- #1087: global emergency switch and server-side eligibility for LUMEN Lab.
begin;

insert into lumen_commands.feature_flags (name, enabled)
values ('ux_preview', false)
on conflict (name) do nothing;

create function public.lumen_ux_v2_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'false'
    and exists (
      select 1
      from lumen_commands.feature_flags
      where name = 'ux_preview' and enabled
    )
    and lumen_commands.has_capability(auth.uid(), 'ux_v2_preview');
$$;

revoke all on function public.lumen_ux_v2_access() from public, anon, authenticated;
grant execute on function public.lumen_ux_v2_access() to authenticated;

notify pgrst, 'reload schema';
commit;
