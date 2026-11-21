begin;

-- Reuse the private delivery queue, lease, retry, daily budget and erasure rules.
alter table lumen_commands.activity_mail alter column owner_id drop not null;
alter table lumen_commands.activity_mail drop constraint if exists activity_mail_kind_check;
alter table lumen_commands.activity_mail add constraint activity_mail_kind_check check (
 kind in ('signup','purchase','purchase_missing_access','refund','revocation','purchase_access_restored','incident_open','incident_resolved'));
alter table lumen_commands.activity_mail drop constraint if exists activity_mail_owner_scope;
alter table lumen_commands.activity_mail add constraint activity_mail_owner_scope check (
 (owner_id is null)=(kind in ('incident_open','incident_resolved')));

-- Aggregates only. No player identifiers or raw diagnostic content are stored.
create table if not exists lumen_ops.critical_incidents (
 signature text primary key check (signature in ('availability','hydration','outbox','backlog')),
 severity text not null check (severity in ('P0','P1','P2')),
 sample bigint not null default 0,
 streak integer not null default 0,
 episode integer not null default 0,
 affected integer not null default 0,
 sampled_at timestamptz,
 opened_at timestamptz,
 resolved_at timestamptz,
 acknowledged_at timestamptz
);
alter table lumen_ops.critical_incidents enable row level security;
revoke all on lumen_ops.critical_incidents from public,anon,authenticated,service_role;
insert into lumen_ops.critical_incidents(signature,severity) values
 ('availability','P0'),('hydration','P1'),('outbox','P1'),('backlog','P2')
 on conflict do nothing;

create or replace function lumen_ops.observe_incident(
 p_signature text,p_sample bigint,p_affected integer,p_failures integer,p_recoveries integer)
returns void language plpgsql set search_path='' as $$
declare i lumen_ops.critical_incidents; observed timestamptz := now(); event_kind text;
begin
 select * into strict i from lumen_ops.critical_incidents s where s.signature=p_signature for update;
 if p_sample <= i.sample or p_affected is null then return; end if;
 i.sample := p_sample;
 i.sampled_at := observed;
 i.affected := p_affected;
 if p_affected>0 then
  i.streak := least(greatest(i.streak,0)+1,p_failures);
  if (i.opened_at is null or i.resolved_at is not null) and i.streak>=p_failures then
   i.episode := i.episode+1;
   i.opened_at := observed;
   i.resolved_at := null;
   i.acknowledged_at := null;
   event_kind := 'incident_open';
  end if;
 else
  i.streak := greatest(least(i.streak,0)-1,-p_recoveries);
  if i.opened_at is not null and i.resolved_at is null and i.streak<=-p_recoveries then
   i.resolved_at := observed;
   event_kind := 'incident_resolved';
  end if;
 end if;
 update lumen_ops.critical_incidents s set
  sample=i.sample,streak=i.streak,episode=i.episode,affected=i.affected,
  sampled_at=i.sampled_at,opened_at=i.opened_at,resolved_at=i.resolved_at,
  acknowledged_at=i.acknowledged_at
 where s.signature=i.signature;
 if event_kind is not null then
  insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload) values
   (null,event_kind,i.signature||':'||i.episode,jsonb_build_object('signature',i.signature,
      'severity',i.severity,'affected',i.affected,'event_at',observed))
  on conflict on constraint activity_mail_source_unique do nothing;
 end if;
end $$;
revoke all on function lumen_ops.observe_incident(text,bigint,integer,integer,integer)
 from public,anon,authenticated,service_role;

create or replace function public.lumen_observe_critical_incidents(
 p_sample bigint,p_probe_ok boolean,p_stall_minutes integer default 15,
 p_failures integer default 3,p_recoveries integer default 2,p_backlog integer default 20)
returns boolean language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz; hydration integer; outbox integer; backlog integer; unverified_outbox boolean;
begin
 if p_sample is null or p_sample<1 or p_probe_ok is null
  or p_stall_minutes is null or p_stall_minutes not between 5 and 240
  or p_failures is null or p_failures not between 2 and 10
  or p_recoveries is null or p_recoveries not between 2 and 10
  or p_backlog is null or p_backlog not between 3 and 200 then
  raise exception using errcode='22023',message='invalid incident observation';
 end if;
 if not pg_try_advisory_xact_lock(947,1) then return false; end if;
 if exists(select 1 from lumen_ops.critical_incidents s where s.signature='availability' and s.sample>=p_sample) then
  return true;
 end if;

 cutoff := now()-make_interval(mins=>p_stall_minutes);
 select count(distinct h.user_id)::integer into hydration
 from public.lumen_sync_health h join auth.users u on u.id=h.user_id
 where h.recorded_at<=cutoff and lumen_ops.activity_player(u)
  and (h.event='hydration_failed' or (h.event='hydration_reconciliation' and h.outcome='blocked'))
  and coalesce(h.reason,'unknown') not in ('network','offline')
  and not exists(select 1 from public.lumen_sync_health ready
   where ready.user_id=h.user_id and ready.event='hydration_ready'
     and (ready.recorded_at,ready.id)>(h.recorded_at,h.id));
 select count(distinct o.user_id) filter (where o.state in ('critical','review')
                            or (o.state='pending' and o.pending>0 and o.failures>=3))::integer,
        count(distinct o.user_id) filter (where o.state='pending' and o.failures<3 and o.pending>=p_backlog)::integer,
        coalesce(bool_or(o.state='auth' and o.pending>0),false)
   into outbox,backlog,unverified_outbox
 from lumen_commands.outbox_health o join auth.users u on u.id=o.user_id
 where o.oldest_pending_at<=cutoff and o.state in ('pending','critical','review','auth')
   and lumen_ops.activity_player(u);

 -- A payment alarm recovers only when the paid product's rights can be read back.
 insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload)
 select m.owner_id,'purchase_access_restored',m.source_id,
   m.payload || jsonb_build_object('access','verified','event_at',now())
 from lumen_commands.activity_mail m
 join lumen_commands.purchases p on p.id::text=m.source_id and p.user_id=m.owner_id and p.status='paid'
 join lumen_commands.store_products product on product.product_id=p.product_id
 where m.kind='purchase_missing_access'
   and not exists(select 1 from lumen_commands.activity_mail cleared
     where cleared.kind='purchase_access_restored' and cleared.source_id=m.source_id)
   and not exists(select 1 from lumen_commands.adventure_packs a
     where a.access='locked' and (a.pack_id=product.pack_id or
       (product.kind in ('sky','sky_upgrade') and a.pack_id ~ '^real-adventure-0[2-9]$'))
     and not exists(select 1 from lumen.entitlements e where e.user_id=m.owner_id and e.entitlement=a.pack_id
       and (e.expires_at is null or e.expires_at>now())))
 order by m.observed_at,m.id limit 100
 on conflict on constraint activity_mail_source_unique do nothing;

 perform lumen_ops.observe_incident('availability',p_sample,case when p_probe_ok then 0 else 1 end,p_failures,p_recoveries);
 perform lumen_ops.observe_incident('hydration',p_sample,hydration,1,p_recoveries);
 perform lumen_ops.observe_incident('outbox',p_sample,case when outbox=0 and unverified_outbox then null else outbox end,1,p_recoveries);
 perform lumen_ops.observe_incident('backlog',p_sample,backlog,p_failures,p_recoveries);
 return true;
end $$;
revoke all on function public.lumen_observe_critical_incidents(bigint,boolean,integer,integer,integer,integer)
 from public,anon,authenticated;
grant execute on function public.lumen_observe_critical_incidents(bigint,boolean,integer,integer,integer,integer)
 to service_role;

create or replace function lumen_ops.require_incident_admin() returns void
language plpgsql stable set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.lumen_get_internal_capabilities()
       where capability='analytics_cockpit') then
  raise exception using errcode='42501',message='analytics_cockpit capability required';
 end if;
end $$;
revoke all on function lumen_ops.require_incident_admin() from public,anon,authenticated,service_role;

create or replace function public.lumen_admin_critical_incidents()
returns table(signature text,severity text,episode integer,affected integer,sampled_at timestamptz,
 opened_at timestamptz,resolved_at timestamptz,acknowledged_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 perform lumen_ops.require_incident_admin();
 return query select i.signature,i.severity,i.episode,i.affected,i.sampled_at,i.opened_at,i.resolved_at,i.acknowledged_at
 from lumen_ops.critical_incidents i order by i.severity,i.signature;
end $$;
revoke all on function public.lumen_admin_critical_incidents() from public,anon;
grant execute on function public.lumen_admin_critical_incidents() to authenticated;

create or replace function public.lumen_admin_ack_critical_incident(p_signature text,p_episode integer)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 perform lumen_ops.require_incident_admin();
 update lumen_ops.critical_incidents i set acknowledged_at=coalesce(i.acknowledged_at,now())
  where i.signature=p_signature and i.episode=p_episode and i.opened_at is not null and i.resolved_at is null;
 return found;
end $$;
revoke all on function public.lumen_admin_ack_critical_incident(text,integer) from public,anon;
grant execute on function public.lumen_admin_ack_critical_incident(text,integer) to authenticated;

notify pgrst,'reload schema';
commit;
