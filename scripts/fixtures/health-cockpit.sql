begin;
insert into auth.users values
 ('00000000-0000-0000-0000-000000000010',now()-interval '4 days',now()-interval '4 days','{"provider":"google"}'),
 ('00000000-0000-0000-0000-000000000011',now()-interval '4 days',null,'{"provider":"email"}'),
 ('00000000-0000-0000-0000-000000000012',now()-interval '4 days',null,'{"provider":"google","lumen_qa":true}');
insert into lumen.users
select id,((now() at time zone 'Europe/Paris')::date-1+time '12:00') at time zone 'Europe/Paris'
from auth.users;
insert into lumen_commands.store_products values ('fixture-pack','pack','fixture-pack');
insert into lumen_commands.purchases
 (id,provider,provider_ref,user_id,product_id,amount_cents,currency,status,purchased_at,settled_amount,settled_currency)
select n,provider,ref,owner::uuid,'fixture-pack',1000,'eur',state,
 ((now() at time zone 'Europe/Paris')::date-1+time '12:05') at time zone 'Europe/Paris',amount,currency
from (values
 (1,'stripe','real','00000000-0000-0000-0000-000000000010','paid',null::numeric,null::text),
 (2,'stripe','test','00000000-0000-0000-0000-000000000010','paid',null,null),
 (3,'play','one','00000000-0000-0000-0000-000000000010','refunded',125.5,'jpy'),
 (4,'play','qa','00000000-0000-0000-0000-000000000012','paid',1,'USD'),
 (5,'play','unpriced','00000000-0000-0000-0000-000000000010','paid',null,null)
) p(n,provider,ref,owner,state,amount,currency);
insert into lumen_commands.stripe_checkout_sessions values
 ('real',true,'paid','00000000-0000-0000-0000-000000000010','fixture-pack',1000,'eur'),
 ('test',false,'paid','00000000-0000-0000-0000-000000000010','fixture-pack',1000,'eur');
insert into lumen_commands.purchase_events values (1,3,'paid',now()-interval '1 day');
insert into lumen_commands.activity_mail(owner_id,kind,source_id,state,payload,observed_at)
values (null,'incident_open','availability:1','accepted',
 '{"severity":"P0","signature":"availability","affected":1}',
 ((now() at time zone 'Europe/Paris')::date-1+time '12:30') at time zone 'Europe/Paris');
update lumen_ops.critical_incidents set sampled_at=now(),opened_at=now(),affected=1 where signature='availability';
do $$
declare day date:=(now() at time zone 'Europe/Paris')::date-1;
 from_at timestamptz:=day::timestamp at time zone 'Europe/Paris';
 until_at timestamptz:=(day+1)::timestamp at time zone 'Europe/Paris';
 summary jsonb;
begin
 begin
  perform public.lumen_admin_health_snapshot(7);
  raise exception 'ordinary session read cockpit';
 exception when insufficient_privilege then null;
 end;
 perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 if public.lumen_admin_health_snapshot(7) #>> '{availability,state}' <> 'outage' then
  raise exception 'outage not displayed';
 end if;
 summary:=lumen_ops.health_snapshot(from_at,until_at);
 if summary->>'signup_count'<>'1' or summary->>'purchase_count'<>'2'
  or (summary #>> '{currencies,0,amount}')::numeric<>10
  or summary #>> '{currencies,1,currency}'<>'JPY'
  or (summary #>> '{currencies,1,amount}')::numeric<>125.5
  or summary #>> '{delivery,accepted}'<>'1' then raise exception 'daily verified totals differ';end if;
 if summary::text ~ '00000000-0000|provider_ref|unpriced|"test"|@' then
  raise exception 'unexpected identifier or test purchase';
 end if;
 if lumen_ops.health_snapshot(until_at,until_at+interval '1 second')->>'signup_count'<>'0' then
  raise exception 'date boundary leaked';
 end if;
 if not public.lumen_enqueue_health_digest(day,'Europe/Paris')
  or public.lumen_enqueue_health_digest(day,'Europe/Paris') then
  raise exception 'daily key was not idempotent';
 end if;
 if (select count(*) from lumen_commands.activity_mail where kind='daily_summary')<>1 then
  raise exception 'unexpected digest count';
 end if;
 if has_function_privilege('authenticated','public.lumen_enqueue_health_digest(date,text)','execute')
  or has_function_privilege('service_role','lumen_ops.health_snapshot(timestamptz,timestamptz)','execute') then
  raise exception 'unexpected digest privileges';
 end if;
 begin
  perform public.lumen_enqueue_health_digest(day-1,'Europe/Paris');
  raise exception 'historical resend accepted';
 exception when invalid_parameter_value then null;
 end;
end $$;
rollback;
