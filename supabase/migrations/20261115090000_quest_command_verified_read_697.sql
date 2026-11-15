-- #697: one read-only round trip for the independent post-command verification.
-- Additive and read-only: no command, receipt, profile, wallet or reward changes.
-- It returns exactly what lumen_get_quest_command and lumen_restore_profile(uuid)
-- return, with the same account guard. The profile is returned only with an
-- existing receipt, so a pre-command lookup does not download the profile.
create function public.lumen_get_quest_command_verified(p_operation_id text,p_expected_user_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare receipt jsonb;
begin
 if auth.uid() is null or p_expected_user_id is distinct from auth.uid()
 then raise exception using errcode='42501',message='command account changed';end if;
 receipt:=lumen_commands.get_quest(p_operation_id,p_expected_user_id);
 if receipt is null then return jsonb_build_object('version',1,'receipt',null,'profile',null);end if;
 return jsonb_build_object('version',1,'receipt',receipt,'profile',public.lumen_restore_profile(p_expected_user_id));
end $$;
revoke all on function public.lumen_get_quest_command_verified(text,uuid) from public,anon;
grant execute on function public.lumen_get_quest_command_verified(text,uuid) to authenticated;
