-- The ledger transaction also makes the acknowledgement recoverable after a crash.
begin;

create table if not exists lumen_commands.play_acknowledgements (
  purchase_id bigint primary key,
  purchase_token text check (char_length(purchase_token) between 1 and 4096),
  created_at timestamptz not null default clock_timestamp(),
  retry_at timestamptz not null default statement_timestamp(),
  attempts integer not null default 0,
  acknowledged_at timestamptz
);
alter table lumen_commands.play_acknowledgements enable row level security;
revoke all on lumen_commands.play_acknowledgements from public,anon,authenticated,service_role;
create index if not exists play_acknowledgements_retry_idx
  on lumen_commands.play_acknowledgements (retry_at, purchase_id)
  where purchase_token is not null;

create or replace function public.lumen_record_play_purchase_with_ack(
  p_provider_ref text, p_user_id uuid, p_product_id text,
  p_settled_amount numeric, p_settled_currency text, p_counts_toward_cap boolean,
  p_test_purchase boolean, p_purchased_at timestamptz,
  p_purchase_token text, p_acknowledged boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  receipt jsonb;
  confirmed boolean;
begin
  if p_acknowledged is null or (not p_acknowledged and (
    p_purchase_token is null or p_provider_ref is distinct from
      encode(sha256(convert_to(p_purchase_token,'UTF8')),'hex')
  )) then
    raise exception using errcode='22023',message='invalid acknowledgement data';
  end if;

  receipt := public.lumen_record_play_purchase(p_provider_ref,p_user_id,p_product_id,
    p_settled_amount,p_settled_currency,p_counts_toward_cap,p_test_purchase,p_purchased_at);
  if receipt->>'status' <> 'paid' then return receipt; end if;

  insert into lumen_commands.play_acknowledgements as a
    (purchase_id,purchase_token,acknowledged_at)
  values ((receipt->>'purchase_id')::bigint,
    case when not p_acknowledged then p_purchase_token end,
    case when p_acknowledged then clock_timestamp() end)
  on conflict (purchase_id) do update set
    purchase_token=case when p_acknowledged then null else a.purchase_token end,
    acknowledged_at=coalesce(a.acknowledged_at,excluded.acknowledged_at)
  returning acknowledged_at is not null into confirmed;
  return receipt || jsonb_build_object('acknowledged',confirmed);
end $$;

create or replace function public.lumen_claim_play_acknowledgements(p_purchase_id bigint)
returns table(purchase_id bigint, product_id text, purchase_token text, attempt integer)
language sql security definer set search_path='' as $$
  with due as (
    select a.purchase_id, p.product_id
    from lumen_commands.play_acknowledgements a
    join lumen_commands.purchases p on p.id=a.purchase_id
    where a.purchase_token is not null and p.status='paid'
      and a.retry_at <= statement_timestamp()
      and a.created_at > statement_timestamp() - interval '4 days'
      and (p_purchase_id is null or a.purchase_id=p_purchase_id)
    order by a.retry_at,a.purchase_id
    limit 10
    for update of a skip locked
  )
  update lumen_commands.play_acknowledgements a
  set attempts=a.attempts+1,
      retry_at=statement_timestamp() + make_interval(secs => least(300,30 * (1 << least(a.attempts,4))))
  from due where a.purchase_id=due.purchase_id
  returning a.purchase_id,due.product_id,a.purchase_token,a.attempts;
$$;

create or replace function public.lumen_complete_play_acknowledgement(p_purchase_id bigint,p_attempt integer)
returns void language sql security definer set search_path='' as $$
  update lumen_commands.play_acknowledgements
  set purchase_token=null, acknowledged_at=clock_timestamp()
  where purchase_id=p_purchase_id and attempts=p_attempt and purchase_token is not null;
$$;

create or replace function public.lumen_prune_play_acknowledgements()
returns void language sql security definer set search_path='' as $$
  update lumen_commands.play_acknowledgements
  set purchase_token=null
  where purchase_token is not null and created_at <= statement_timestamp() - interval '4 days';
$$;

create or replace function lumen_commands.clear_play_acknowledgement_token()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='DELETE' then
    delete from lumen_commands.play_acknowledgements where purchase_id=old.id;
    return old;
  end if;
  update lumen_commands.play_acknowledgements set purchase_token=null where purchase_id=new.id;
  return new;
end $$;
revoke all on function lumen_commands.clear_play_acknowledgement_token() from public,anon,authenticated;
drop trigger if exists clear_play_acknowledgement_token on lumen_commands.purchases;
create trigger clear_play_acknowledgement_token after update of status on lumen_commands.purchases
for each row when (new.provider='play' and new.status <> 'paid' and old.status <> new.status)
execute function lumen_commands.clear_play_acknowledgement_token();
drop trigger if exists delete_play_acknowledgement on lumen_commands.purchases;
create trigger delete_play_acknowledgement after delete on lumen_commands.purchases
for each row when (old.provider='play') execute function lumen_commands.clear_play_acknowledgement_token();

revoke all on function
  public.lumen_record_play_purchase_with_ack(text,uuid,text,numeric,text,boolean,boolean,timestamptz,text,boolean),
  public.lumen_claim_play_acknowledgements(bigint), public.lumen_complete_play_acknowledgement(bigint,integer),
  public.lumen_prune_play_acknowledgements()
  from public,anon,authenticated;
grant execute on function
  public.lumen_record_play_purchase_with_ack(text,uuid,text,numeric,text,boolean,boolean,timestamptz,text,boolean),
  public.lumen_claim_play_acknowledgements(bigint), public.lumen_complete_play_acknowledgement(bigint,integer),
  public.lumen_prune_play_acknowledgements()
  to service_role;
-- The purchase is the erasure root. Its delete trigger removes the queue row;
-- never export the transient provider credential as part of player data.
do $do$begin
  if to_regprocedure('lumen_privacy.policy()') is not null
    and to_regprocedure('lumen_privacy.policy_before_play_ack()') is null then
    alter function lumen_privacy.policy() rename to policy_before_play_ack;
  end if;
  if to_regprocedure('lumen_privacy.policy_before_play_ack()') is not null then
    execute $f$create or replace function lumen_privacy.policy()
      returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
      language sql stable set search_path='' as $b$
        select * from lumen_privacy.policy_before_play_ack()
        union all values ('lumen_commands','play_acknowledgements',null,null,null,'retain-rule')
      $b$ $f$;
    revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_play_ack()
      from public,anon,authenticated,service_role;
    perform lumen_privacy.install_guards();
  end if;
end $do$;
notify pgrst,'reload schema';
commit;
