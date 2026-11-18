-- Isolated PostgreSQL. Google Play's settlement must not change unlock credits.
begin;
do $$
declare
 f constant uuid := '00000000-0000-0000-0000-000000072951';
 j constant uuid := '00000000-0000-0000-0000-000000072952';
 r jsonb;
begin
 assert not has_function_privilege('anon','public.lumen_record_play_purchase(text,uuid,text,numeric,text,boolean,boolean,timestamptz)','EXECUTE');
 assert not has_function_privilege('authenticated','public.lumen_record_play_purchase(text,uuid,text,numeric,text,boolean,boolean,timestamptz)','EXECUTE');
 assert has_function_privilege('service_role','public.lumen_record_play_purchase(text,uuid,text,numeric,text,boolean,boolean,timestamptz)','EXECUTE');
 insert into auth.users(id) values(f),(j);

 r:=public.lumen_record_play_purchase('region-fr',f,'real-adventure-02',1.19,'EUR',true,false,null);
 assert r->'adventures' ? 'real-adventure-02';
 assert not (r->'adventures' ? 'real-adventure-09');
 assert exists(select from lumen_commands.purchases where provider_ref='region-fr'
   and amount_cents=100 and currency='EUR' and settled_amount=1.19 and settled_currency='EUR');
 r:=public.lumen_record_play_purchase('region-fr',f,'real-adventure-02',1.49,'EUR',true,false,null);
 assert (r->>'changed')::boolean=false;
 assert (select settled_amount from lumen_commands.purchases where provider_ref='region-fr')=1.19;

 r:=public.lumen_record_play_purchase('region-jp',j,'real-adventure-02',180,'JPY',false,false,null);
 assert r->'adventures' ? 'real-adventure-02';
 assert not (r->'adventures' ? 'real-adventure-09');
 assert exists(select from lumen_commands.purchases where provider_ref='region-jp'
   and amount_cents=0 and currency='XXX' and settled_amount=180 and settled_currency='JPY');
 r:=public.lumen_record_play_purchase('region-jp-sky',j,'real-sky-all',900,'JPY',false,false,null);
 assert r->'adventures' ? 'real-adventure-09','a verified non-EUR full-sky purchase grants the sky';

 begin
   perform public.lumen_record_play_purchase('region-fr',j,'real-adventure-02',1.19,'EUR',true,false,null);
   raise exception 'purchase rebound to another account';
 exception when invalid_parameter_value then null;
 end;
 begin
   perform public.lumen_record_play_purchase('missing-amount',j,'real-adventure-04',null,null,false,false,null);
   raise exception 'missing settlement accepted';
 exception when invalid_parameter_value then null;
 end;

 perform public.lumen_record_purchase('play','region-fr',f,'real-adventure-02',100,'EUR','refunded');
 r:=public.lumen_record_play_purchase('region-fr',f,'real-adventure-02',null,null,false,false,null);
 assert r->>'status'='refunded','a restore cannot regrant a refunded Play purchase';
 delete from lumen_commands.purchases where provider='play' and provider_ref='region-fr';
 assert exists(select from lumen_commands.purchase_accounting_records where provider_ref='region-fr'
    and settled_amount=1.19 and settled_currency='EUR' and status='refunded');

 perform public.lumen_record_purchase('play','region-legacy',f,'real-adventure-03',100,'EUR','paid');
 r:=public.lumen_record_play_purchase('region-legacy',f,'real-adventure-03',null,null,false,false,null);
 assert r->'adventures' ? 'real-adventure-03','the old receipt still restores';
 assert exists(select from lumen_commands.purchases where provider_ref='region-legacy' and settled_amount is null);
end $$;
rollback;
