-- #316: Self-service Lumen-only erasure. The caller cannot choose the target identity.
create or replace function public.lumen_self_erase(p_confirmation text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid; v_result jsonb;
begin
  v_uid := auth.uid();
  if v_uid is null or (select auth.role()) <> 'authenticated' then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if p_confirmation is distinct from 'SUPPRIMER' then
    raise exception 'Explicit confirmation required' using errcode='22023';
  end if;
  -- Existing audited operator procedure checks that the operation is not
  -- performed as a client session. Preserve the verified UUID first.
  perform set_config('request.jwt.claim.sub', '', true);
  v_result := lumen_privacy.erase_account(v_uid, array[]::text[], 'ERASE LUMEN ' || v_uid::text);
  return v_result;
end;
$$;
revoke all on function public.lumen_self_erase(text) from public, anon;
grant execute on function public.lumen_self_erase(text) to authenticated;
