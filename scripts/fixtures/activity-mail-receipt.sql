insert into auth.users values
 ('00000000-0000-0000-0000-000000000001',now(),now(),'{"provider":"email"}');
insert into lumen.users select id,now() from auth.users;
insert into lumen_commands.adventure_packs values ('fixture-adventure','locked');
insert into lumen_commands.store_products values ('fixture-adventure','adventure','fixture-adventure');
insert into lumen.entitlements values
 ('00000000-0000-0000-0000-000000000001','fixture-adventure',null);
insert into lumen_commands.purchases values
 (1,'play','receipt-fixture','00000000-0000-0000-0000-000000000001',
  'fixture-adventure',100,'EUR','paid',now(),1.00,'EUR');
insert into lumen_commands.purchase_events values (1,1,'paid',now());

set role service_role;
select public.lumen_observe_critical_incidents(1,false);
select public.lumen_observe_critical_incidents(2,false);
select public.lumen_observe_critical_incidents(3,false);
select public.lumen_enqueue_health_digest(
 (now() at time zone 'Europe/Paris')::date-1,'Europe/Paris');
