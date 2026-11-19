begin;
do $$
declare
  owner constant uuid := '00000000-0000-0000-0000-000000081901';
  other_player constant uuid := '00000000-0000-0000-0000-000000081902';
begin
  assert not has_function_privilege('anon','public.lumen_get_main_sky_purchase_progress(uuid)','EXECUTE');
  assert has_function_privilege('authenticated','public.lumen_get_main_sky_purchase_progress(uuid)','EXECUTE');
  insert into auth.users(id) values(owner),(other_player);
  perform set_config('request.jwt.claim.sub',owner::text,true);
  assert public.lumen_get_main_sky_purchase_progress(other_player) is null;
  assert public.lumen_get_main_sky_purchase_progress(owner) = '{"purchased":0,"remaining":5,"unlocked":false}';
  perform public.lumen_record_purchase('stripe','offer-02',owner,'real-adventure-02',90,'USD','paid');
  assert public.lumen_get_main_sky_purchase_progress(owner) = '{"purchased":1,"remaining":4,"unlocked":false}';
  perform public.lumen_record_purchase('stripe','offer-sky',owner,'real-sky-all',400,'USD','paid');
  assert public.lumen_get_main_sky_purchase_progress(owner) = '{"purchased":1,"remaining":4,"unlocked":true}';
  perform public.lumen_record_purchase('stripe','offer-sky',owner,'real-sky-all',400,'USD','refunded');
  assert public.lumen_get_main_sky_purchase_progress(owner) = '{"purchased":1,"remaining":4,"unlocked":false}';
end $$;
rollback;
