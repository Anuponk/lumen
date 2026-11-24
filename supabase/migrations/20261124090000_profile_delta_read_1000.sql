-- #1000 lot 2: read back a profile as a delta from the copy the client holds.
-- Additive and read-only. Supabase Free bills outgoing traffic only: the client
-- uploads its base profile (free ingress) and downloads only the changed
-- entries plus the SHA-256 of the stored profile text. The client applies the
-- delta and installs it only if its digest equals the server's; any mismatch,
-- error or missing endpoint falls back to the full lumen_restore_profile read.
create or replace function lumen_commands.profile_delta(p_current jsonb, p_base jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_patch jsonb := '[]'::jsonb; v_key text; v_sub text; v_cur jsonb; v_old jsonb;
begin
  for v_key in select k from (select jsonb_object_keys(p_current) k union select jsonb_object_keys(p_base) k) keys order by 1 loop
    v_cur := p_current -> v_key; v_old := p_base -> v_key;
    if v_cur is not distinct from v_old then continue; end if;
    if v_cur is null then
      v_patch := v_patch || jsonb_build_array(jsonb_build_object('op', 'remove', 'path', jsonb_build_array(v_key)));
    elsif jsonb_typeof(v_cur) = 'object' and jsonb_typeof(v_old) = 'object' then
      for v_sub in select k from (select jsonb_object_keys(v_cur) k union select jsonb_object_keys(v_old) k) subkeys order by 1 loop
        if (v_cur -> v_sub) is not distinct from (v_old -> v_sub) then continue; end if;
        if v_cur -> v_sub is null then
          v_patch := v_patch || jsonb_build_array(jsonb_build_object('op', 'remove', 'path', jsonb_build_array(v_key, v_sub)));
        else
          v_patch := v_patch || jsonb_build_array(jsonb_build_object('op', 'set', 'path', jsonb_build_array(v_key, v_sub), 'value', v_cur -> v_sub));
        end if;
      end loop;
    else
      v_patch := v_patch || jsonb_build_array(jsonb_build_object('op', 'set', 'path', jsonb_build_array(v_key), 'value', v_cur));
    end if;
  end loop;
  return v_patch;
end $$;
revoke all on function lumen_commands.profile_delta(jsonb, jsonb) from public, anon, authenticated;

create or replace function public.lumen_profile_delta(p_expected_user_id uuid, p_base jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_current jsonb;
begin
  if auth.uid() is null or p_expected_user_id is distinct from auth.uid()
  then raise exception using errcode='42501', message='profile account changed'; end if;
  if p_base is null or jsonb_typeof(p_base) <> 'object' or octet_length(p_base::text) > 1048576
  then raise exception using errcode='22023', message='invalid profile base'; end if;
  select s.payload into v_current from lumen.profile_snapshots s where s.user_id = auth.uid();
  if v_current is null then return jsonb_build_object('version', 1, 'sha256', null); end if;
  return jsonb_build_object('version', 1,
    'sha256', encode(sha256(convert_to(v_current::text, 'UTF8')), 'hex'),
    'patch', lumen_commands.profile_delta(v_current, p_base));
end $$;
revoke all on function public.lumen_profile_delta(uuid, jsonb) from public, anon;
grant execute on function public.lumen_profile_delta(uuid, jsonb) to authenticated;
notify pgrst, 'reload schema';
