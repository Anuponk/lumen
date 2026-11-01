-- #316: Self-service Lumen-only erasure. The caller cannot choose the target identity.
create or replace function public.lumen_self_erase(p_user_id uuid, p_confirmation text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid; v_result jsonb; v_actors text[] := array[]::text[]; v_row record; v_found text[];
begin
  if current_user <> 'service_role' or auth.uid() is not null then
    raise exception 'Service role required' using errcode='42501';
  end if;
  v_uid := p_user_id;
  if v_uid is null then raise exception 'Missing user identity' using errcode='22023'; end if;
  if p_confirmation is distinct from 'SUPPRIMER' then
    raise exception 'Explicit confirmation required' using errcode='22023';
  end if;
  -- Only infer actor ownership from a direct user_id + anonymous_id pairing
  -- in Lumen-owned policy tables; never accept actor identifiers from callers.
  for v_row in
    select ns, rel, uid_col, actor_col from lumen_privacy.policy()
    where uid_col is not null and actor_col is not null
  loop
    execute format(
      'select array_agg(distinct %1$I::text) from %2$I.%3$I where %4$I=$1 and %1$I is not null',
      v_row.actor_col, v_row.ns, v_row.rel, v_row.uid_col
    ) into v_found using v_uid;
    v_actors := v_actors || coalesce(v_found,array[]::text[]);
  end loop;
  select coalesce(array_agg(distinct actor),array[]::text[])
    into v_actors from unnest(v_actors) as actor;
  -- The existing review rejects collisions, unguarded tables, and unsafe
  -- scopes transactionally. Never bypass its checks.
  v_result := lumen_privacy.erase_account(v_uid, v_actors, 'ERASE LUMEN ' || v_uid::text);
  return v_result;
end;
$$;
revoke all on function public.lumen_self_erase(uuid,text) from public, anon, authenticated;
grant execute on function public.lumen_self_erase(uuid,text) to service_role;
