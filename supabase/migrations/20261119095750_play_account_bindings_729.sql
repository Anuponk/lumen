-- A signed-in client prepares its provider account binding before opening Play.
-- RTDN can then resolve the owner even if the client never receives the token.
begin;
create table if not exists lumen_commands.play_account_bindings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_binding text not null unique check (account_binding ~ '^[0-9a-f]{64}$')
);
alter table lumen_commands.play_account_bindings enable row level security;
revoke all on lumen_commands.play_account_bindings from public,anon,authenticated,service_role;

create or replace function public.lumen_prepare_play_purchase(p_expected_user_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare
  owner_id uuid := auth.uid();
  binding text;
begin
  if owner_id is null or owner_id is distinct from p_expected_user_id then
    raise exception using errcode='42501',message='Play purchase account changed';
  end if;
  binding := encode(sha256(convert_to('lumen-play:'||owner_id::text,'UTF8')),'hex');
  insert into lumen_commands.play_account_bindings(user_id,account_binding)
    values(owner_id,binding) on conflict(user_id) do nothing;
  return binding;
end $$;
revoke all on function public.lumen_prepare_play_purchase(uuid) from public,anon;
grant execute on function public.lumen_prepare_play_purchase(uuid) to authenticated;

create or replace function public.lumen_play_account_by_binding(p_account_binding text)
returns uuid language sql stable security definer set search_path='' as $$
  select user_id from lumen_commands.play_account_bindings where account_binding=p_account_binding;
$$;
revoke all on function public.lumen_play_account_by_binding(text) from public,anon,authenticated;
grant execute on function public.lumen_play_account_by_binding(text) to service_role;

do $do$begin
  if to_regprocedure('lumen_privacy.policy()') is not null
    and to_regprocedure('lumen_privacy.policy_before_play_binding()') is null then
    alter function lumen_privacy.policy() rename to policy_before_play_binding;
  end if;
  if to_regprocedure('lumen_privacy.policy_before_play_binding()') is not null then
    execute $f$create or replace function lumen_privacy.policy()
      returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
      language sql stable set search_path='' as $b$
        select * from lumen_privacy.policy_before_play_binding()
        union all values ('lumen_commands','play_account_bindings','user_id',null,null,'delete')
      $b$ $f$;
    revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_play_binding()
      from public,anon,authenticated,service_role;
    perform lumen_privacy.install_guards();
  end if;
end $do$;
notify pgrst,'reload schema';
commit;
