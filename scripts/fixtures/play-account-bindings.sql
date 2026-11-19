begin;
do $$
declare
  owner_id constant uuid := '00000000-0000-0000-0000-000000083301';
  other_id constant uuid := '00000000-0000-0000-0000-000000083302';
  binding text;
begin
  assert not has_table_privilege('authenticated','lumen_commands.play_account_bindings','SELECT');
  assert not has_table_privilege('service_role','lumen_commands.play_account_bindings','SELECT');
  assert not has_function_privilege('anon','public.lumen_prepare_play_purchase(uuid)','EXECUTE');
  assert has_function_privilege('authenticated','public.lumen_prepare_play_purchase(uuid)','EXECUTE');
  assert not has_function_privilege('authenticated','public.lumen_play_account_by_binding(text)','EXECUTE');
  assert has_function_privilege('service_role','public.lumen_play_account_by_binding(text)','EXECUTE');
  insert into auth.users(id) values(owner_id),(other_id);
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  binding := public.lumen_prepare_play_purchase(owner_id);
  assert binding=encode(sha256(convert_to('lumen-play:'||owner_id::text,'UTF8')),'hex');
  assert binding=public.lumen_prepare_play_purchase(owner_id);
  assert public.lumen_play_account_by_binding(binding)=owner_id;
  begin
    perform public.lumen_prepare_play_purchase(other_id);
    raise exception 'cross-account preparation succeeded';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from lumen_commands.play_account_bindings where user_id in (owner_id,other_id))=1;
  delete from auth.users where id=owner_id;
  assert public.lumen_play_account_by_binding(binding) is null;
end $$;
rollback;
