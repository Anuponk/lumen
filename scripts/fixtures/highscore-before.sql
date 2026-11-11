-- Disposable PostgreSQL only, after ranking.sql and before the new migration.
-- The older erasure fixture has only the subset it needs; restore the real
-- canonical profile timestamp for the nickname RPC contract.
alter table lumen.profiles add column if not exists updated_at timestamptz not null default now();
insert into auth.users values ('65000000-0000-4000-8000-000000000001'),('65000000-0000-4000-8000-000000000002'),('65000000-0000-4000-8000-000000000003');
insert into lumen.profiles(user_id,nickname) values
 ('65000000-0000-4000-8000-000000000001',' Legacy '),('65000000-0000-4000-8000-000000000002','legacy'),('65000000-0000-4000-8000-000000000003','Unique old');
