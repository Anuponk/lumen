begin;

alter table lumen_commands.activity_mail drop constraint activity_mail_kind_check;
alter table lumen_commands.activity_mail add constraint activity_mail_kind_check check (
 kind in ('signup','purchase','purchase_missing_access','refund','revocation','purchase_access_restored',
  'incident_open','incident_resolved','performance_regression','daily_summary'));
alter table lumen_commands.activity_mail drop constraint activity_mail_owner_scope;
alter table lumen_commands.activity_mail add constraint activity_mail_owner_scope check (
 (owner_id is null)=(kind in ('incident_open','incident_resolved','performance_regression','daily_summary')));

create or replace function lumen_ops.health_snapshot(p_from timestamptz,p_until timestamptz)
returns jsonb language sql stable set search_path='' as $$
 with signups as materialized (
  select greatest(lu.first_seen_at,u.created_at,coalesce(u.email_confirmed_at,u.created_at)) as effective_at,
   u.raw_app_meta_data->>'provider' as method
  from lumen.users lu join auth.users u on u.id=lu.user_id
  where lu.first_seen_at is not null and u.created_at is not null and lumen_ops.activity_player(u)
   and (u.raw_app_meta_data->>'provider'='google' or
     (u.raw_app_meta_data->>'provider'='email' and u.email_confirmed_at is not null))
   and greatest(lu.first_seen_at,u.created_at,coalesce(u.email_confirmed_at,u.created_at))>=p_from
   and greatest(lu.first_seen_at,u.created_at,coalesce(u.email_confirmed_at,u.created_at))<p_until
 ), purchases as materialized (
  select p.purchased_at as event_at,p.product_id,p.provider,
   case when p.provider='stripe' then p.amount_cents*0.01::numeric else p.settled_amount end as amount,
   upper(case when p.provider='stripe' then p.currency else p.settled_currency end) as currency
  from lumen_commands.purchases p join auth.users u on u.id=p.user_id
   join lumen_commands.store_products product on product.product_id=p.product_id
  where p.purchased_at>=p_from and p.purchased_at<p_until and lumen_ops.activity_player(u)
   and (p.status='paid' or exists(select 1 from lumen_commands.purchase_events e
      where e.purchase_id=p.id and e.status='paid'))
   and ((p.provider='play' and p.settled_amount is not null and p.settled_currency ~ '^[A-Za-z]{3}$')
    or (p.provider='stripe' and p.amount_cents is not null and p.currency ~ '^[A-Za-z]{3}$'
      and exists(select 1 from lumen_commands.stripe_checkout_sessions s where s.session_id=p.provider_ref
       and s.livemode and s.user_id=p.user_id and s.product_id=p.product_id
       and s.amount_cents=p.amount_cents and s.currency=p.currency and s.status in ('paid','refunded','disputed'))))
 ), unresolved_payments as materialized (
  select m.owner_id,m.observed_at
  from lumen_commands.activity_mail m
   join lumen_commands.purchases p on p.id::text=m.source_id and p.user_id=m.owner_id and p.status='paid'
   join auth.users u on u.id=m.owner_id
  where m.kind='purchase_missing_access' and lumen_ops.activity_player(u)
   and not exists(select 1 from lumen_commands.activity_mail r
    where r.kind='purchase_access_restored' and r.source_id=m.source_id)
 ), notices as materialized (
  select m.kind,m.payload,m.state,m.observed_at from lumen_commands.activity_mail m
   left join auth.users u on u.id=m.owner_id
  where m.observed_at>=p_from and m.observed_at<p_until
   and (m.owner_id is null or (u.id is not null and lumen_ops.activity_player(u)))
 ), recent_errors as (
  select kind,observed_at,payload->>'signature' as signature,payload->>'version' as version,
   payload->>'metric' as metric,
   case when kind='purchase_missing_access' then 'P0' else payload->>'severity' end as severity,
   payload->'affected' as affected
  from notices where kind in ('incident_open','purchase_missing_access','performance_regression')
  order by observed_at desc limit 40
 ), active as (
  select signature,severity,affected,opened_at from lumen_ops.critical_incidents
   where opened_at is not null and resolved_at is null
  union all select 'purchase', 'P0',count(distinct owner_id)::integer,min(observed_at)
   from unresolved_payments having count(*)>0
 )
 select jsonb_build_object(
  'from',p_from,'until',p_until,'generated_at',statement_timestamp(),
  'availability',(select jsonb_build_object('sampled_at',sampled_at,
   'state',case when sampled_at is null then 'unknown' when sampled_at<now()-interval '20 minutes' then 'stale'
     when resolved_at is null and opened_at is not null then 'outage'
     when affected>0 then 'unstable' else 'healthy' end)
    from lumen_ops.critical_incidents where signature='availability'),
  'active',coalesce((select jsonb_agg(to_jsonb(a) order by a.severity,a.signature) from active a),'[]'::jsonb),
  'affected_floor',coalesce((select max(affected) from active where signature<>'availability'),0),
  'critical_count',(select count(*) from notices
   where kind in ('incident_open','purchase_missing_access','performance_regression')),
  'errors',coalesce((select jsonb_agg(to_jsonb(e) order by e.observed_at desc) from recent_errors e),'[]'::jsonb),
  'signup_count',(select count(*) from signups),
  'signups',coalesce((select jsonb_agg(to_jsonb(s) order by s.effective_at desc)
   from (select * from signups order by effective_at desc limit 20) s),'[]'::jsonb),
  'purchase_count',(select count(*) from purchases),
  'purchases',coalesce((select jsonb_agg(to_jsonb(p) order by p.event_at desc)
   from (select * from purchases order by event_at desc limit 20) p),'[]'::jsonb),
  'currencies',coalesce((select jsonb_agg(to_jsonb(c) order by c.currency) from
   (select currency,count(*) as count,sum(amount)::text as amount from purchases group by currency) c),'[]'::jsonb),
  'delivery',coalesce((select jsonb_object_agg(d.state,d.count) from
   (select state,count(*) as count from notices group by state) d),'{}'::jsonb)
 )
$$;
revoke all on function lumen_ops.health_snapshot(timestamptz,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.lumen_admin_health_snapshot(p_days integer default 7)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform lumen_ops.require_incident_admin();
 return lumen_ops.health_snapshot(now()-make_interval(days=>least(greatest(coalesce(p_days,7),1),3650)),now())
  || jsonb_build_object('performance',public.lumen_admin_performance_health());
end $$;
revoke all on function public.lumen_admin_health_snapshot(integer) from public,anon;
grant execute on function public.lumen_admin_health_snapshot(integer) to authenticated;

create or replace function public.lumen_enqueue_health_digest(p_date date,p_zone text)
returns boolean language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; from_at timestamptz; until_at timestamptz; summary jsonb;
begin
 if p_date is null or length(coalesce(p_zone,''))>64
  or not exists(select 1 from pg_timezone_names z where z.name=p_zone) then
  raise exception using errcode='22023',message='invalid digest date or zone';
 end if;
 if p_date<>(now() at time zone p_zone)::date-1 then
  raise exception using errcode='22023',message='expected previous local day';
 end if;
 if not pg_try_advisory_xact_lock(949,1) then return false;end if;
 if exists(select 1 from lumen_commands.activity_mail
  where kind='daily_summary' and source_id=p_date::text) then return false;end if;
 from_at:=p_date::timestamp at time zone p_zone;
 until_at:=(p_date+1)::timestamp at time zone p_zone;
 snapshot:=lumen_ops.health_snapshot(from_at,until_at);
 summary:=snapshot-ARRAY['errors','signups','purchases','delivery','from','until','generated_at'];
 summary:=summary || jsonb_build_object('date',p_date,'zone',p_zone,
  'performance',coalesce((select jsonb_agg(to_jsonb(c)) from (
   select version,reference,metric,p90,reference_p90,samples,reference_samples,regression
   from lumen_ops.performance_comparison(20) where reference_p90 is not null
   order by regression desc,samples desc,metric,platform,browser,network limit 5
  ) c),'[]'::jsonb),
  'error_rate',lumen_ops.hydration_error_comparison());
 insert into lumen_commands.activity_mail(owner_id,kind,source_id,payload)
 values(null,'daily_summary',p_date::text,summary)
 on conflict on constraint activity_mail_source_unique do nothing;
 return found;
end $$;
revoke all on function public.lumen_enqueue_health_digest(date,text) from public,anon,authenticated;
grant execute on function public.lumen_enqueue_health_digest(date,text) to service_role;

notify pgrst,'reload schema';
commit;
