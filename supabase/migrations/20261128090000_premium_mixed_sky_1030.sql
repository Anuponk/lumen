-- #1030 owner decision (27/11/2026): a whole main sky made of administrative grants
-- (admin, admin_*, manual — including the Google Play review account) AND confirmed
-- unit purchases is Premium at launch, like a fully administrative sky. A sky that
-- includes any mastery unlock stays without automatic Premium (mastery-only rule).
-- Additive and idempotent: new grant source, same traced backfill (dry run by
-- default, nothing executed by this migration).
begin;

alter table lumen_commands.premium_grants drop constraint if exists premium_grants_source_check;
alter table lumen_commands.premium_grants add constraint premium_grants_source_check
 check (source in ('admin_full_sky','admin_mixed_full_sky','admin'));

create or replace function lumen_commands.premium_backfill(p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rows jsonb; granted integer:=0; r record;
begin
 perform pg_advisory_xact_lock(1030,1);
 create temporary table if not exists pg_temp.premium_backfill_scan(user_id uuid,class text,evidence jsonb) on commit drop;
 truncate pg_temp.premium_backfill_scan;
 insert into pg_temp.premium_backfill_scan
 with locked as (select pack_id from lumen_commands.adventure_packs where access='locked' and pack_id ~ '^real-adventure-0[2-9]$'),
 act as (select e.user_id,e.entitlement,e.source from lumen.entitlements e join locked l on l.pack_id=e.entitlement
  where e.expires_at is null or e.expires_at>clock_timestamp()),
 people as (select user_id from act union select user_id from lumen_commands.purchases union select user_id from lumen_commands.premium_grants),
 facts as (select p.user_id,
  (select count(*) from act a where a.user_id=p.user_id) owned,
  (select count(*) from locked) total,
  (select count(*) from act a where a.user_id=p.user_id and (a.source='admin' or a.source like 'admin\_%' or a.source='manual')) admin_owned,
  (select count(*) from act a where a.user_id=p.user_id and a.source='mastery') mastery_owned,
  (select count(*) from act a where a.user_id=p.user_id and a.source='purchase') purchase_owned,
  (select coalesce(jsonb_agg(distinct a.source),'[]'::jsonb) from act a where a.user_id=p.user_id) sources,
  lumen_commands.premium_status(p.user_id) premium
  from people p)
 select user_id,
  case when (premium->>'active')::boolean and premium->>'source' not in ('admin_full_sky','admin_mixed_full_sky','admin') then 'premium_from_purchases'
   when (premium->>'active')::boolean then 'premium_granted'
   when owned=total and admin_owned=total then 'admin_full_sky'
   when owned=total and mastery_owned=0 and admin_owned>0 and admin_owned+purchase_owned=total then 'admin_mixed_full_sky'
   when owned=total and mastery_owned=total then 'mastery_full_sky'
   when owned=total then 'mixed_full_sky_uncovered'
   when owned>0 then 'partial'
   else 'free' end,
  jsonb_build_object('owned',owned,'admin',admin_owned,'mastery',mastery_owned,'purchase',purchase_owned,'sources',sources)
 from facts;
 if p_apply then
  for r in select * from pg_temp.premium_backfill_scan where class in ('admin_full_sky','admin_mixed_full_sky') loop
   insert into lumen_commands.premium_grants(user_id,source,evidence) values(r.user_id,r.class,r.evidence)
    on conflict(user_id) do nothing;
   if found then
    insert into lumen_commands.premium_grant_events(user_id,action,source) values(r.user_id,'grant',r.class);
    granted:=granted+1;
   end if;
  end loop;
 end if;
 select jsonb_build_object('applied',p_apply,'granted',granted,
  'classes',coalesce((select jsonb_object_agg(class,n) from (select class,count(*) n from pg_temp.premium_backfill_scan group by class) c),'{}'::jsonb),
  'review',coalesce((select jsonb_agg(jsonb_build_object('account',left(md5(user_id::text),8),'class',class,'evidence',evidence) order by class,md5(user_id::text))
   from pg_temp.premium_backfill_scan where class in ('admin_full_sky','admin_mixed_full_sky','mixed_full_sky_uncovered','mastery_full_sky')),'[]'::jsonb))
 into rows;
 return rows;
end $$;
revoke all on function lumen_commands.premium_backfill(boolean) from public,anon,authenticated,service_role;
commit;
