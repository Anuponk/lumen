-- Keep Google Play's settled receipt separate from historical unlock accounting.
begin;

alter table lumen_commands.purchases
  add column if not exists settled_currency text,
  add column if not exists settled_amount numeric(28,9);
alter table lumen_commands.purchase_accounting_records
  add column if not exists settled_currency text,
  add column if not exists settled_amount numeric(28,9);

create or replace function public.lumen_record_play_purchase(
  p_provider_ref text, p_user_id uuid, p_product_id text,
  p_settled_amount numeric, p_settled_currency text, p_counts_toward_cap boolean,
  p_test_purchase boolean, p_purchased_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  original lumen_commands.purchases;
  product_kind text;
  credit_cents integer;
  credit_currency text;
  receipt jsonb;
begin
  -- Serialize verification/restore for one token, then share the ledger's user lock.
  perform pg_advisory_xact_lock(729, hashtext(p_provider_ref));
  perform pg_advisory_xact_lock(728, hashtext(p_user_id::text));

  select * into original from lumen_commands.purchases
   where provider='play' and provider_ref=p_provider_ref for update;
  if found then
    if original.user_id is distinct from p_user_id or original.product_id is distinct from p_product_id then
      raise exception using errcode='22023', message='purchase identity conflict';
    end if;
    if original.status <> 'paid' then
      return jsonb_build_object('status',original.status);
    end if;
    return lumen_commands.record_purchase('play',p_provider_ref,p_user_id,p_product_id,
      original.amount_cents,original.currency,'paid',original.purchased_at);
  end if;

  select kind into product_kind from lumen_commands.store_products
   where product_id=p_product_id and active;
  if not found then
    raise exception using errcode='22023', message='unknown product';
  end if;
  if not coalesce(p_test_purchase,false) and (
    p_settled_amount is null or p_settled_amount::text in ('NaN','Infinity','-Infinity')
    or p_settled_amount<0 or p_settled_amount>=1e19 or scale(p_settled_amount)>9
    or p_settled_currency is null or p_settled_currency !~ '^[A-Z]{3}$'
  ) then
    raise exception using errcode='22023', message='invalid Play settlement';
  end if;

  -- The previous France unlock rule is denominated in catalogue credits, not in
  -- the customer's charge. An adventure advances the same threshold after repricing.
  credit_cents := 0;
  credit_currency := 'XXX';
  if p_counts_toward_cap and (p_settled_currency='EUR' or p_test_purchase) then
    credit_cents := case product_kind when 'adventure' then 100 else 500 end;
    credit_currency := 'EUR';
  end if;
  receipt := lumen_commands.record_purchase('play',p_provider_ref,p_user_id,p_product_id,
    credit_cents,credit_currency,'paid',p_purchased_at);
  if not coalesce(p_test_purchase,false) then
    update lumen_commands.purchases set
      settled_amount=p_settled_amount, settled_currency=p_settled_currency
     where provider='play' and provider_ref=p_provider_ref;
  end if;
  return receipt;
end $$;
revoke all on function public.lumen_record_play_purchase(text,uuid,text,numeric,text,boolean,boolean,timestamptz)
  from public,anon,authenticated;
grant execute on function public.lumen_record_play_purchase(text,uuid,text,numeric,text,boolean,boolean,timestamptz)
  to service_role;

create or replace function lumen_commands.archive_purchase_accounting() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.provider='stripe' and old.provider_ref like 'cs\_test\_%' then return old; end if;
  insert into lumen_commands.purchase_accounting_records
    (provider,provider_ref,product_id,amount_cents,currency,status,purchased_at,status_at,retain_until,
     settled_amount,settled_currency)
  values (old.provider,old.provider_ref,old.product_id,old.amount_cents,old.currency,old.status,old.purchased_at,old.updated_at,
    date_trunc('year',old.purchased_at at time zone 'Europe/Paris') at time zone 'Europe/Paris' + interval '11 years',
    old.settled_amount,old.settled_currency)
  on conflict (provider,provider_ref) do update
    set status=excluded.status,status_at=excluded.status_at,archived_at=clock_timestamp();
  return old;
end $$;
revoke all on function lumen_commands.archive_purchase_accounting() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
