-- Disposable PostgreSQL only. #732: erasing an account keeps a minimal accounting
-- record of its purchases for 10 years, without any account identity.
do $$begin
 assert not has_table_privilege('authenticated','lumen_commands.purchase_accounting_records','SELECT'),'players cannot read accounting records';
 assert not has_table_privilege('anon','lumen_commands.purchase_accounting_records','SELECT');
 assert not has_function_privilege('authenticated','lumen_commands.purge_expired_purchase_accounting()','EXECUTE');
 assert not exists(select 1 from information_schema.columns where table_schema='lumen_commands' and table_name='purchase_accounting_records'
  and column_name in ('user_id','email','nickname','profile','purchase_token','actor')),'no account identity column';
 assert exists(select 1 from lumen_privacy.policy() where ns='lumen_commands' and rel='purchase_accounting_records' and action='retain-rule'),'classified in the privacy inventory';
 perform lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[]);
end $$;
insert into auth.users(id) values('00000000-0000-0000-0000-000000073201'),('00000000-0000-0000-0000-000000073202');
do $$declare p uuid:='00000000-0000-0000-0000-000000073201';q uuid:='00000000-0000-0000-0000-000000073202';begin
 perform lumen_commands.record_purchase('play','gp-acc-1',p,'real-adventure-02',100,'EUR','paid','2026-03-10T10:00:00Z');
 perform lumen_commands.record_purchase('play','gp-acc-2',p,'real-adventure-04',100,'EUR','paid','2026-12-31T23:30:00Z');
 perform lumen_commands.record_purchase('play','gp-acc-2',p,'real-adventure-04',100,'EUR','refunded','2026-12-31T23:30:00Z');
 perform lumen_commands.record_purchase('play','gp-acc-3',q,'real-adventure-03',100,'EUR','paid','2026-05-01T08:00:00Z');
 assert not exists(select 1 from lumen_commands.purchase_accounting_records where provider_ref like 'gp-acc-%'),'nothing archived while the account exists';
end $$;
-- Account erasure, as lumen_privacy.erase_account does it (policy 'delete' by user_id);
-- an auth.users cascade is the same row-level DELETE and fires the same trigger.
delete from lumen_commands.purchase_events where user_id='00000000-0000-0000-0000-000000073201';
delete from lumen_commands.purchases where user_id='00000000-0000-0000-0000-000000073201';
do $$declare r record;begin
 assert not exists(select 1 from lumen_commands.purchases where user_id='00000000-0000-0000-0000-000000073201'),'purchase rows erased with the account';
 assert (select count(*) from lumen_commands.purchase_accounting_records where provider_ref in ('gp-acc-1','gp-acc-2'))=2;
 select * into r from lumen_commands.purchase_accounting_records where provider='play' and provider_ref='gp-acc-1';
 assert r.product_id='real-adventure-02' and r.amount_cents=100 and r.currency='EUR' and r.status='paid';
 assert r.retain_until='2037-01-01T00:00:00+01:00'::timestamptz,'kept 10 years after the end of the purchase year: '||r.retain_until;
 select * into r from lumen_commands.purchase_accounting_records where provider_ref='gp-acc-2';
 assert r.status='refunded','the final status is kept';
 -- 23:30 UTC on 31/12 is already 2027 in Paris: the French calendar year decides.
 assert r.retain_until='2038-01-01T00:00:00+01:00'::timestamptz,'Paris calendar year: '||r.retain_until;
 assert not exists(select 1 from lumen_commands.purchase_accounting_records where provider_ref='gp-acc-3'),'other players are untouched';
 assert exists(select 1 from lumen_commands.purchases where provider_ref='gp-acc-3');
end $$;
-- Retention end: only expired records are purged.
insert into lumen_commands.purchase_accounting_records(provider,provider_ref,product_id,amount_cents,currency,status,purchased_at,status_at,retain_until)
values('play','gp-acc-old','real-adventure-02',100,'EUR','paid','2014-01-01','2014-01-01','2025-01-01');
do $$begin
 assert lumen_commands.purge_expired_purchase_accounting()=1;
 assert not exists(select 1 from lumen_commands.purchase_accounting_records where provider_ref='gp-acc-old');
 assert (select count(*) from lumen_commands.purchase_accounting_records where provider_ref in ('gp-acc-1','gp-acc-2'))=2;
end $$;
-- Leave the shared fixture database as found.
delete from lumen_commands.purchase_events where user_id in ('00000000-0000-0000-0000-000000073201','00000000-0000-0000-0000-000000073202');
delete from lumen_commands.purchases where user_id in ('00000000-0000-0000-0000-000000073201','00000000-0000-0000-0000-000000073202');
delete from lumen_commands.purchase_accounting_records where provider_ref like 'gp-acc-%';
