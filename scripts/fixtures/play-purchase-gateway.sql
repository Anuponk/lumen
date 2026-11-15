-- Disposable PostgreSQL only. #729: the Play gateway is reachable by service_role only,
-- and only replays the #728 ledger rules. Runs after purchases-mastery.sql.
do $$begin
 assert not has_function_privilege('authenticated','public.lumen_record_purchase(text,text,uuid,text,integer,text,text,timestamptz)','EXECUTE'),'players cannot record';
 assert not has_function_privilege('anon','public.lumen_record_purchase(text,text,uuid,text,integer,text,text,timestamptz)','EXECUTE');
 assert has_function_privilege('service_role','public.lumen_record_purchase(text,text,uuid,text,integer,text,text,timestamptz)','EXECUTE');
 assert not has_function_privilege('authenticated','public.lumen_purchase_by_ref(text,text)','EXECUTE'),'players cannot look up purchases';
 assert not has_function_privilege('anon','public.lumen_purchase_by_ref(text,text)','EXECUTE');
 assert has_function_privilege('service_role','public.lumen_purchase_by_ref(text,text)','EXECUTE');
 assert not has_function_privilege('authenticated','public.lumen_store_price(text)','EXECUTE');
 assert has_function_privilege('service_role','public.lumen_store_price(text)','EXECUTE');
end $$;
insert into auth.users(id) values('00000000-0000-0000-0000-000000072901');
do $$declare p uuid:='00000000-0000-0000-0000-000000072901';r jsonb;ref text:=repeat('a',64);begin
 assert (public.lumen_store_price('real-adventure-02')->>'price_cents')::integer=100;
 assert (public.lumen_store_price('real-sky-all')->>'price_cents')::integer=500;
 assert public.lumen_store_price('base-real-sky') is null,'the free Adventure is not a product';
 assert public.lumen_purchase_by_ref('play',ref) is null;
 r:=public.lumen_record_purchase('play',ref,p,'real-adventure-05',100,'EUR','paid','2026-11-15T10:00:00Z');
 assert r->'adventures' ? 'real-adventure-05','the gateway records through #728';
 r:=public.lumen_purchase_by_ref('play',ref);
 assert r->>'user_id'=p::text and r->>'product_id'='real-adventure-05' and r->>'status'='paid','lookup returns the original identity';
 r:=public.lumen_record_purchase('play',ref,p,'real-adventure-05',100,'EUR','refunded',(r->>'purchased_at')::timestamptz);
 assert not (r->'adventures' ? 'real-adventure-05'),'a voided replay refunds';
 begin perform public.lumen_record_purchase('play',ref,p,'real-adventure-06',100,'EUR','paid');
  raise exception 'identity conflict accepted';exception when invalid_parameter_value then null;end;
end $$;
