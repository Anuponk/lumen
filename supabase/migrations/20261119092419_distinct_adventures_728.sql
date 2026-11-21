-- Entitlements depend on confirmed products across providers, independent of settlement.
begin;

create or replace function lumen_commands.main_sky_purchase_status(p_user uuid)
returns table(adventures_purchased integer, sky_purchased boolean)
language sql stable set search_path='' as $$
  select count(distinct p.product_id) filter (
    where s.kind='adventure' and s.pack_id ~ '^real-adventure-0[2-9]$'
  )::integer, coalesce(bool_or(s.kind='sky' and s.product_id='real-sky-all'),false)
  from lumen_commands.purchases p
  join lumen_commands.store_products s on s.product_id=p.product_id
  where p.user_id=p_user and p.status='paid';
$$;
revoke all on function lumen_commands.main_sky_purchase_status(uuid) from public,anon,authenticated;

create or replace function lumen_commands.sync_purchase_entitlements(p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare owed text[]; pack text; full_sky boolean;
begin
 perform pg_advisory_xact_lock(728,hashtext(p_user::text));
 select sky_purchased or adventures_purchased >= 5 into full_sky
   from lumen_commands.main_sky_purchase_status(p_user);
 select coalesce(array_agg(a.pack_id order by a.pack_id),'{}') into owed
 from lumen_commands.adventure_packs a
 where a.access='locked' and (
  (full_sky and a.pack_id ~ '^real-adventure-0[2-9]$')
  or exists (
    select 1 from lumen_commands.purchases p
      join lumen_commands.store_products s on s.product_id=p.product_id
    where p.user_id=p_user and p.status='paid' and s.kind='adventure' and s.pack_id=a.pack_id
  ));
 foreach pack in array owed loop
  perform pg_advisory_xact_lock(724,hashtext(p_user::text||'/'||pack));
  if not exists(select 1 from lumen.entitlements e where e.user_id=p_user and e.entitlement=pack
   and (e.expires_at is null or e.expires_at>clock_timestamp())) then
   insert into lumen.entitlements(user_id,entitlement,granted_at,expires_at,source)
    values(p_user,pack,clock_timestamp(),null,'purchase')
    on conflict(user_id,entitlement) do update set granted_at=excluded.granted_at,expires_at=null,source='purchase';
  end if;
 end loop;
 update lumen.entitlements e set expires_at=clock_timestamp()
  where e.user_id=p_user and e.source='purchase' and (e.expires_at is null or e.expires_at>clock_timestamp())
   and not (e.entitlement=any(owed));
end $$;
revoke all on function lumen_commands.sync_purchase_entitlements(uuid) from public,anon,authenticated;

comment on column lumen_commands.store_settings.cap_cents is
  'Historical commerce setting. Adventure entitlements use confirmed distinct purchases.';

do $$
declare owner uuid;
begin
  for owner in select distinct user_id from lumen_commands.purchases order by user_id loop
    perform lumen_commands.sync_purchase_entitlements(owner);
  end loop;
end $$;
commit;
