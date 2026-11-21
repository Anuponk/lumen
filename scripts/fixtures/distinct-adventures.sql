-- Replay, cross-provider duplicates, arbitrary settlement and refund recalculation.
begin;
do $$
declare
  player constant uuid := '00000000-0000-0000-0000-000000083302';
  r jsonb;
begin
  insert into auth.users(id) values(player);
  insert into lumen.entitlements(user_id,entitlement,source) values
    (player,'real-adventure-08','admin'),(player,'real-adventure-07','mastery');
  perform public.lumen_record_purchase('stripe','distinct-02',player,'real-adventure-02',500,'EUR','paid');
  assert (select adventures_purchased from lumen_commands.main_sky_purchase_status(player))=1;
  assert not exists(select from lumen.entitlements where user_id=player and entitlement='real-adventure-09');
  perform public.lumen_record_play_purchase('distinct-dup',player,'real-adventure-02',180,'JPY',false,false,null);
  perform public.lumen_record_play_purchase('distinct-03',player,'real-adventure-03',190,'JPY',false,false,null);
  assert (select adventures_purchased from lumen_commands.main_sky_purchase_status(player))=2;
  perform public.lumen_record_purchase('stripe','distinct-04',player,'real-adventure-04',70,'USD','paid');
  perform public.lumen_record_purchase('stripe','distinct-05',player,'real-adventure-05',80,'CAD','paid');
  assert (select adventures_purchased from lumen_commands.main_sky_purchase_status(player))=4;
  assert not exists(select from lumen.entitlements where user_id=player and entitlement='real-adventure-09');
  r:=public.lumen_record_play_purchase('distinct-06',player,'real-adventure-06',1.19,'EUR',true,false,null);
  assert r->'adventures' ? 'real-adventure-09';
  assert (select adventures_purchased from lumen_commands.main_sky_purchase_status(player))=5;
  r:=public.lumen_record_purchase('stripe','distinct-02',player,'real-adventure-02',500,'EUR','refunded');
  assert r->'adventures' ? 'real-adventure-09', 'the other valid receipt still counts';
  r:=public.lumen_record_purchase('stripe','distinct-04',player,'real-adventure-04',70,'USD','refunded');
  assert not (r->'adventures' ? 'real-adventure-09');
  assert r->'adventures' ?& array['real-adventure-07','real-adventure-08'];
  assert (select adventures_purchased from lumen_commands.main_sky_purchase_status(player))=4;
  r:=public.lumen_record_play_purchase('distinct-sky',player,'real-sky-all',900,'JPY',false,false,null);
  assert r->'adventures' ? 'real-adventure-09';
  assert (select adventures_purchased=4 and sky_purchased from lumen_commands.main_sky_purchase_status(player));
end $$;
rollback;
