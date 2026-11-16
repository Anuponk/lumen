-- #732: keep a minimal accounting record of each purchase when its account is erased
-- (owner decision, 16/11/2026). Accounting records are kept 10 years after the end
-- of the calendar year of the purchase (Code de commerce L123-22), without any
-- account identity: no user id, email, nickname, progress or token.
-- Rows are copied by a BEFORE DELETE trigger on lumen_commands.purchases, so every
-- deletion path (lumen_privacy.erase_account, auth.users cascade) is covered.
-- Production application by the owner (Supabase SQL editor). Idempotent.
create table if not exists lumen_commands.purchase_accounting_records(
 provider text not null check (provider in ('play','stripe')),
 provider_ref text not null check (char_length(provider_ref) between 1 and 200),
 product_id text not null check (char_length(product_id) between 1 and 80),
 amount_cents integer not null check (amount_cents>=0),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 status text not null check (status in ('paid','refunded','disputed')),
 purchased_at timestamptz not null,
 status_at timestamptz not null,
 archived_at timestamptz not null default clock_timestamp(),
 retain_until timestamptz not null,
 primary key (provider,provider_ref)
);
alter table lumen_commands.purchase_accounting_records enable row level security;
revoke all on lumen_commands.purchase_accounting_records from public,anon,authenticated;

create or replace function lumen_commands.archive_purchase_accounting() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into lumen_commands.purchase_accounting_records
  (provider,provider_ref,product_id,amount_cents,currency,status,purchased_at,status_at,retain_until)
 values (old.provider,old.provider_ref,old.product_id,old.amount_cents,old.currency,old.status,old.purchased_at,old.updated_at,
  date_trunc('year',old.purchased_at at time zone 'Europe/Paris') at time zone 'Europe/Paris'+interval '11 years')
 on conflict (provider,provider_ref) do update
  set status=excluded.status,status_at=excluded.status_at,archived_at=clock_timestamp();
 return old;
end $$;
revoke all on function lumen_commands.archive_purchase_accounting() from public,anon,authenticated;
drop trigger if exists purchase_accounting_archive on lumen_commands.purchases;
create trigger purchase_accounting_archive before delete on lumen_commands.purchases
 for each row execute function lumen_commands.archive_purchase_accounting();

-- Retention end: to be scheduled (daily job) by the owner; returns the purged count.
create or replace function lumen_commands.purge_expired_purchase_accounting() returns integer
language sql security definer set search_path='' as $$
 with gone as (delete from lumen_commands.purchase_accounting_records where retain_until<now() returning 1)
 select count(*)::integer from gone;
$$;
revoke all on function lumen_commands.purge_expired_purchase_accounting() from public,anon,authenticated;

-- The privacy inventory must classify every lumen_commands table. The record holds
-- no account identity, so erasure does not touch it: retained by legal rule.
do $do$begin
 if to_regprocedure('lumen_privacy.policy()') is not null
  and to_regprocedure('lumen_privacy.policy_before_accounting()') is null then
  alter function lumen_privacy.policy() rename to policy_before_accounting;
 end if;
 if to_regprocedure('lumen_privacy.policy_before_accounting()') is not null then
  execute $f$create or replace function lumen_privacy.policy()
   returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
   language sql stable set search_path='' as $b$
    select * from lumen_privacy.policy_before_accounting()
    union all values
     ('lumen_commands','purchase_accounting_records',null,null,null,'retain-rule')
   $b$ $f$;
  revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_accounting() from public,anon,authenticated,service_role;
  perform lumen_privacy.install_guards();
 end if;
end $do$;
