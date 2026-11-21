begin;

create schema if not exists lumen_ops;
revoke all on schema lumen_ops from public, anon, authenticated;

create table if not exists lumen_commands.activity_mail (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('signup','purchase','purchase_missing_access','refund','revocation')),
  source_id text not null,
  payload jsonb not null,
  observed_at timestamptz not null default now(),
  ready_at timestamptz not null default now(),
  state text not null default 'queued' check (state in ('queued','sending','accepted','failed','unknown')),
  attempts smallint not null default 0,
  last_attempt_at timestamptz,
  lease uuid,
  constraint activity_mail_source_unique unique (kind,source_id)
);
alter table lumen_commands.activity_mail enable row level security;
revoke all on lumen_commands.activity_mail from public, anon, authenticated, service_role;
create index if not exists activity_mail_ready_idx on lumen_commands.activity_mail (ready_at,id) where state='queued';
create index if not exists activity_mail_owner_idx on lumen_commands.activity_mail (owner_id);
create index if not exists activity_mail_new_user_idx on lumen.users (first_seen_at,user_id);
create index if not exists activity_mail_recent_purchase_idx on lumen_commands.purchase_events (recorded_at,purchase_id,id);

-- Only operator-set app metadata identifies internal accounts. Auth is shared:
-- a verified Lumen membership and a new Auth identity are both required.
create or replace function lumen_ops.activity_player(u auth.users) returns boolean
language sql stable set search_path='' as $$
  select not (coalesce(u.raw_app_meta_data->>'lumen_qa','false')='true')
$$;
revoke all on function lumen_ops.activity_player(auth.users) from public, anon, authenticated, service_role;

create or replace function public.lumen_claim_activity_mail(p_since timestamptz, p_kinds text[], p_limit integer default 10, p_daily_limit integer default 100)
returns table(id uuid, lease uuid, kind text, payload jsonb)
language plpgsql security definer set search_path='' as $$
declare
  tick timestamptz := now();
  floor_at timestamptz := greatest(p_since,tick-interval '7 days');
  batch integer := greatest(1,least(coalesce(p_limit,10),20));
begin
  if p_since is null or p_since > tick then
    raise exception using errcode='22023', message='invalid activity activation timestamp';
  end if;
  if coalesce(cardinality(p_kinds),0)=0 then return; end if;
  if not pg_try_advisory_xact_lock(950,1) then return; end if;

  delete from lumen_commands.activity_mail m where m.observed_at < tick-interval '14 days';
  -- A lost acknowledgement is ambiguous. Hold it for operator review instead of resending.
  update lumen_commands.activity_mail m set state='unknown', lease=null
    where m.state='sending' and m.ready_at <= tick;

  if 'signup'=any(p_kinds) then
    insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload)
      select u.id,'signup',u.id::text,jsonb_build_object(
        'created_at',u.created_at, 'method',u.raw_app_meta_data->>'provider',
        'email_confirmed',u.email_confirmed_at is not null)
      from lumen.users lu join auth.users u on u.id=lu.user_id
      where lu.first_seen_at >= floor_at and u.created_at >= floor_at
        and lumen_ops.activity_player(u)
        and u.raw_app_meta_data->>'provider' in ('email','google')
        and (u.raw_app_meta_data->>'provider'='google' or u.email_confirmed_at is not null)
        and not exists(select 1 from lumen_commands.activity_mail m where m.kind='signup' and m.source_id=u.id::text)
      order by lu.first_seen_at,u.id limit 100
      on conflict on constraint activity_mail_source_unique do nothing;
  end if;

  with recent as (
    select distinct on (e.purchase_id) e.purchase_id,e.status,e.id as event_id,e.recorded_at
    from lumen_commands.purchase_events e
    where e.recorded_at >= floor_at
    order by e.purchase_id,e.recorded_at desc,e.id desc
  ), verified as (
    select p.id as purchase_id,p.user_id,p.product_id,p.provider,p.purchased_at,r.recorded_at,r.event_id,p.status,
      case when p.provider='stripe' then p.amount_cents * 0.01::numeric else p.settled_amount end as amount,
      case when p.provider='stripe' then p.currency else p.settled_currency end as currency,
      not exists (
        select 1 from lumen_commands.adventure_packs a
        where a.access='locked' and (a.pack_id=product.pack_id or
          (product.kind in ('sky','sky_upgrade') and a.pack_id ~ '^real-adventure-0[2-9]$'))
          and not exists (select 1 from lumen.entitlements e where e.user_id=p.user_id and e.entitlement=a.pack_id
            and (e.expires_at is null or e.expires_at > tick))
      ) as access_granted
    from recent r join lumen_commands.purchases p on p.id=r.purchase_id and p.status=r.status
      join auth.users u on u.id=p.user_id
      join lumen_commands.store_products product on product.product_id=p.product_id
    where lumen_ops.activity_player(u) and (
      (p.provider='stripe' and exists(select 1 from lumen_commands.stripe_checkout_sessions s
        where s.session_id=p.provider_ref and s.livemode and s.status=p.status
          and s.user_id=p.user_id and s.product_id=p.product_id and s.amount_cents=p.amount_cents
          and s.currency=p.currency))
      or (p.provider='play' and p.settled_amount is not null and p.settled_currency is not null)
    )
  ), events as (
    select v.*, k.kind,
      case when k.kind in ('refund','revocation') then v.event_id::text else v.purchase_id::text end as source_id
    from verified v
    cross join lateral (values
      ('purchase', v.status='paid' and v.access_granted),
      ('purchase_missing_access', v.status='paid' and not v.access_granted),
      ('refund',v.status='refunded'),
      ('revocation',v.status='disputed')
    ) k(kind,eligible)
    where k.eligible and k.kind=any(p_kinds)
      and (k.kind in ('refund','revocation') or v.purchased_at >= floor_at)
  )
  insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload)
    select v.user_id,v.kind,v.source_id,jsonb_build_object(
      'product',v.product_id,'provider',v.provider,'amount',v.amount::text,'currency',v.currency,
      'event_at',case when v.kind in ('refund','revocation') then v.recorded_at else v.purchased_at end,
      'access',case when v.status <> 'paid' then 'changed' when v.access_granted then 'verified' else 'missing' end)
    from events v where not exists(select 1 from lumen_commands.activity_mail m where m.kind=v.kind and m.source_id=v.source_id)
    order by v.recorded_at,v.event_id limit 100
    on conflict on constraint activity_mail_source_unique do nothing;

  select least(batch,greatest(0,least(coalesce(p_daily_limit,100),200)-count(*)::integer))
    into batch from lumen_commands.activity_mail m
    where m.last_attempt_at >= date_trunc('day',tick at time zone 'UTC') at time zone 'UTC';

  return query
    with pending as (
      select m.id from lumen_commands.activity_mail m
      where m.state='queued' and m.ready_at <= tick and m.kind=any(p_kinds)
      order by (m.kind='purchase_missing_access') desc,m.ready_at,m.id limit batch
      for update skip locked
    )
    update lumen_commands.activity_mail m set state='sending', lease=gen_random_uuid(),
      attempts=m.attempts+1, last_attempt_at=tick, ready_at=tick+interval '10 minutes'
      from pending q where m.id=q.id returning m.id,m.lease,m.kind,m.payload;
end $$;
revoke all on function public.lumen_claim_activity_mail(timestamptz,text[],integer,integer) from public, anon, authenticated;
grant execute on function public.lumen_claim_activity_mail(timestamptz,text[],integer,integer) to service_role;

create or replace function public.lumen_finish_activity_mail(p_id uuid,p_lease uuid,p_result text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_result is null or p_result not in ('accepted','rejected','retry','unknown') then
    raise exception using errcode='22023', message='invalid activity transport result';
  end if;
  update lumen_commands.activity_mail m set
    state=case p_result when 'retry' then case when m.attempts < 5 then 'queued' else 'failed' end
      when 'rejected' then 'failed' else p_result end,
    ready_at=now()+make_interval(mins => (1 << m.attempts)), lease=null
  where m.id=p_id and m.lease=p_lease and m.state='sending';
  return found;
end $$;
revoke all on function public.lumen_finish_activity_mail(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.lumen_finish_activity_mail(uuid,uuid,text) to service_role;

-- The Auth account may survive erasure in the shared project. The existing Lumen
-- erasure policy deletes queued and historical notifications for that player.
do $migration$
begin
  if to_regprocedure('lumen_privacy.policy_before_activity_mail()') is null then
    alter function lumen_privacy.policy() rename to policy_before_activity_mail;
  end if;
end $migration$;
create or replace function lumen_privacy.policy()
returns table(ns text,rel text,uid_col text,actor_col text,key_col text,action text)
language sql stable set search_path='' as $$
  select * from lumen_privacy.policy_before_activity_mail()
  union all values ('lumen_commands','activity_mail','owner_id',null,null,'delete')
$$;
revoke all on function lumen_privacy.policy(),lumen_privacy.policy_before_activity_mail()
  from public,anon,authenticated,service_role;
select lumen_privacy.install_guards();

notify pgrst, 'reload schema';
commit;
