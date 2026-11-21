insert into auth.users values
 ('00000000-0000-0000-0000-000000000001',now()-interval '30 minutes',now()-interval '10 minutes','{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000002',now()-interval '30 minutes',null,'{"provider":"google"}'),
 ('00000000-0000-0000-0000-000000000003',now()-interval '30 minutes',null,'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000004',now()-interval '30 minutes',now(),'{"provider":"email","lumen_qa":true}'),
 ('00000000-0000-0000-0000-000000000005',now()-interval '30 minutes',now(),'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000006',now()-interval '3 days',now(),'{"provider":"google"}');
insert into lumen.users select id,now()-interval '5 minutes' from auth.users
 where id::text not like '%05';

insert into lumen_commands.adventure_packs values ('real-adventure-02','locked');
insert into lumen_commands.store_products values ('real-adventure-02','adventure','real-adventure-02');
insert into lumen.entitlements values ('00000000-0000-0000-0000-000000000001','real-adventure-02',null);
insert into lumen_commands.purchases
select n, provider, 'fixture-ref-'||n, ('00000000-0000-0000-0000-00000000000'||owner)::uuid,
 'real-adventure-02',100,'EUR',status,now()-age,settled_amount,settled_currency
from (values
 (1,'stripe',1,'paid',interval '10 minutes',null::numeric,null::text),
 (2,'play',1,'paid',interval '10 minutes',125.5,'JPY'),
 (3,'play',1,'paid',interval '10 minutes',null,null),
 (4,'stripe',1,'paid',interval '10 minutes',null,null),
 (5,'play',2,'paid',interval '10 minutes',1.99,'USD'),
 (6,'play',1,'refunded',interval '10 minutes',13.5,'CAD'),
 (7,'play',1,'paid',interval '3 days',2.0,'EUR'),
 (8,'stripe',1,'paid',interval '10 minutes',null,null),
 (9,'play',1,'disputed',interval '1 day',2.0,'EUR')
) test(n,provider,owner,status,age,settled_amount,settled_currency);
insert into lumen_commands.stripe_checkout_sessions
select provider_ref, id <> 4, case when id=8 then 'failed' else 'paid' end,user_id,product_id,amount_cents,currency
from lumen_commands.purchases where provider='stripe';
insert into lumen_commands.purchase_events
select id,id,status,now()-interval '3 minutes' from lumen_commands.purchases;
insert into lumen_commands.purchase_events values (10,1,'paid',now()-interval '2 minutes');

do $test$
declare
  kinds text[] := array['signup','purchase','purchase_missing_access','refund','revocation'];
  since_at timestamptz := now()-interval '1 hour';
  event record;
  events integer := 0;
  checked boolean;
begin
  if has_function_privilege('authenticated','public.lumen_claim_activity_mail(timestamptz,text[],integer,integer)','EXECUTE')
    or has_function_privilege('anon','public.lumen_finish_activity_mail(uuid,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.lumen_claim_activity_mail(timestamptz,text[],integer,integer)','EXECUTE')
    or has_table_privilege('service_role','lumen_commands.activity_mail','SELECT') then
   raise exception 'incorrect privileges';
  end if;
  for event in select * from public.lumen_claim_activity_mail(since_at,kinds,20,100) loop
    events := events+1;
    if event.payload::text like '%fixture-ref%' or event.payload ? 'owner_id' then raise exception 'identity leaked'; end if;
    if public.lumen_finish_activity_mail(event.id,gen_random_uuid(),'accepted') then raise exception 'foreign lease accepted'; end if;
    if not public.lumen_finish_activity_mail(event.id,event.lease,'accepted') then raise exception 'lost outcome'; end if;
  end loop;
  if events<>7 then raise exception 'unexpected event count: %',events; end if;
  if (select count(*) from lumen_commands.activity_mail where kind='signup')<>2
    or (select count(*) from lumen_commands.activity_mail where kind='purchase')<>2
    or (select count(*) from lumen_commands.activity_mail where kind='purchase_missing_access')<>1
    or not exists(select 1 from lumen_commands.activity_mail where payload->>'amount'='125.5' and payload->>'currency'='JPY') then
    raise exception 'classification failed';
  end if;
  if exists(select 1 from public.lumen_claim_activity_mail(since_at,kinds,20,100)) then raise exception 'replay delivered again'; end if;
  -- Email confirmation and first Lumen login release exactly one pending signup.
  update auth.users set email_confirmed_at=now() where id::text like '%03';
  select * into event from public.lumen_claim_activity_mail(since_at,array['signup'],1,100);
  if event.kind is distinct from 'signup' then raise exception 'missing confirmed email'; end if;
  perform public.lumen_finish_activity_mail(event.id,event.lease,'retry');
  if (select state from lumen_commands.activity_mail where id=event.id)<>'queued'
    or exists(select 1 from public.lumen_claim_activity_mail(since_at,kinds,20,100)) then raise exception 'retry backoff failed'; end if;
  update lumen_commands.activity_mail set ready_at=now()-interval '1 second' where id=event.id;
  select * into event from public.lumen_claim_activity_mail(since_at,kinds,1,100);
  update lumen_commands.activity_mail set ready_at=now()-interval '1 second' where id=event.id;
  perform public.lumen_claim_activity_mail(since_at,kinds,20,100);
  if (select state from lumen_commands.activity_mail where id=event.id)<>'unknown' then raise exception 'ambiguous delivery retried'; end if;
end $test$;
