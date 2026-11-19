-- Isolated ledger. A lost client or worker response must leave one recoverable receipt.
begin;
do $$
declare
  player constant uuid := '00000000-0000-0000-0000-000000083301';
  token constant text := 'synthetic-ack-token';
  ref text := encode(sha256(convert_to(token,'UTF8')),'hex');
  receipt jsonb;
  purchase_key bigint;
begin
  assert not has_table_privilege('service_role','lumen_commands.play_acknowledgements','SELECT');
  assert not has_function_privilege('authenticated','public.lumen_claim_play_acknowledgements(bigint)','EXECUTE');
  assert has_function_privilege('service_role','public.lumen_claim_play_acknowledgements(bigint)','EXECUTE');
  insert into auth.users(id) values(player);
  receipt:=public.lumen_record_play_purchase_with_ack(ref,player,'real-adventure-04',null,null,false,true,null,token,false);
  purchase_key:=(receipt->>'purchase_id')::bigint;
  assert receipt->'adventures' ? 'real-adventure-04';
  assert receipt->>'acknowledged'='false';
  assert (select attempt from public.lumen_claim_play_acknowledgements(purchase_key))=1;
  assert not exists(select from public.lumen_claim_play_acknowledgements(purchase_key));

  receipt:=public.lumen_record_play_purchase_with_ack(ref,player,'real-adventure-04',null,null,false,true,null,token,false);
  assert (receipt->>'purchase_id')::bigint=purchase_key and receipt->>'changed'='false';
  assert not exists(select from public.lumen_claim_play_acknowledgements(purchase_key)), 'replay cannot reset the retry lease';
  update lumen_commands.play_acknowledgements set retry_at=statement_timestamp()-interval '1 second' where purchase_id=purchase_key;
  assert (select attempt from public.lumen_claim_play_acknowledgements(null) where purchase_id=purchase_key)=2;
  perform public.lumen_complete_play_acknowledgement(purchase_key,1);
  assert exists(select from lumen_commands.play_acknowledgements where purchase_id=purchase_key and purchase_token=token);
  perform public.lumen_complete_play_acknowledgement(purchase_key,2);
  receipt:=public.lumen_record_play_purchase_with_ack(ref,player,'real-adventure-04',null,null,false,true,null,token,false);
  assert receipt->>'acknowledged'='true';
  assert exists(select from lumen_commands.play_acknowledgements where purchase_id=purchase_key and purchase_token is null);
  assert (select count(*) from lumen_commands.purchase_events where purchase_id=purchase_key)=1;

  perform public.lumen_record_purchase('play',ref,player,'real-adventure-04',0,'XXX','refunded');
  receipt:=public.lumen_record_play_purchase_with_ack(ref,player,'real-adventure-04',null,null,false,true,null,token,false);
  assert receipt->>'status'='refunded';
  assert not exists(select from public.lumen_claim_play_acknowledgements(purchase_key));
  delete from auth.users where auth.users.id=player;
  assert not exists(select from lumen_commands.play_acknowledgements where purchase_id=purchase_key);
end $$;
rollback;
