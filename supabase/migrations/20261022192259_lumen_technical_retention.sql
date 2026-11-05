-- Prepared owner-operated retention. No cron, remote call or automatic activation.
-- Do not age progression, command receipts, recovery evidence or unresolved incidents.
alter table lumen.feedback add column privacy_closed_at timestamptz;
alter table lumen.feedback add column privacy_hold boolean not null default false;
alter table public.lumen_push_subscriptions add column privacy_disabled_at timestamptz;
-- Historical closure/disable dates are unknown: start their clock at migration,
-- never infer them from creation or last_seen. Existing erasure guards remain active.
update lumen.feedback set privacy_closed_at=statement_timestamp() where status='closed';
update public.lumen_push_subscriptions set privacy_disabled_at=statement_timestamp() where enabled is false;

create function lumen_privacy.stamp_feedback_retention() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='closed' then
  if tg_op='UPDATE' and old.status='closed' then new.privacy_closed_at:=old.privacy_closed_at;
  else new.privacy_closed_at:=statement_timestamp(); end if;
 else new.privacy_closed_at:=null; end if;
 -- Only an operator database session can place/lift a documented support hold.
 if auth.uid() is not null or current_setting('role',true) in ('anon','authenticated','service_role') then
  if tg_op='INSERT' then new.privacy_hold:=false; else new.privacy_hold:=old.privacy_hold; end if;
 end if;
 return new;
end $$;
create function lumen_privacy.stamp_push_retention() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.enabled is false then
  if tg_op='UPDATE' and old.enabled is false then new.privacy_disabled_at:=old.privacy_disabled_at;
  else new.privacy_disabled_at:=statement_timestamp(); end if;
 else new.privacy_disabled_at:=null; end if;
 return new;
end $$;
create trigger lumen_retention_stamp before insert or update on lumen.feedback
 for each row execute function lumen_privacy.stamp_feedback_retention();
create trigger lumen_retention_stamp before insert or update on public.lumen_push_subscriptions
 for each row execute function lumen_privacy.stamp_push_retention();
create index if not exists analytics_events_occurred_at_idx on lumen.analytics_events(occurred_at);
create index lumen_feedback_retention_idx on lumen.feedback(privacy_closed_at)
 where status='closed' and not privacy_hold;
create index lumen_push_retention_idx on public.lumen_push_subscriptions(privacy_disabled_at)
 where enabled is false;

create function lumen_privacy.retain_technical_data(
 p_apply boolean default false,p_confirmation text default null,p_batch integer default 1000
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare r record; n bigint; result jsonb:='{}';
begin
 if auth.uid() is not null then
  raise exception using errcode='42501',message='Operator database session required';
 end if;
 if p_apply is null or p_batch is null or p_batch not between 1 and 1000 then
  raise exception using errcode='22023',message='Invalid retention parameters';
 end if;
 if p_apply and p_confirmation is distinct from 'PURGE LUMEN TECHNICAL DATA' then
  raise exception using errcode='22023',message='Explicit retention confirmation required';
 end if;
 if p_apply and current_setting('transaction_isolation')<>'read committed' then
  raise exception using errcode='25000',message='LUMEN_RETENTION_REQUIRES_READ_COMMITTED';
 end if;
 if p_apply then
  -- Close DDL/FK/trigger races without blocking ordinary writers on these tables.
  lock table lumen.analytics_events,lumen.feedback,public.lumen_push_subscriptions in row exclusive mode;
 end if;
 -- Refuse schema/cascade drift before any deletion, including other-app FKs.
 perform lumen_privacy.review_erasure('00000000-0000-0000-0000-000000000000',array[]::text[]);
 if not exists(select 1 from pg_trigger where tgrelid='lumen.feedback'::regclass
  and tgname='lumen_retention_stamp' and tgenabled in ('O','A')
  and tgfoid='lumen_privacy.stamp_feedback_retention()'::regprocedure)
 or not exists(select 1 from pg_trigger where tgrelid='public.lumen_push_subscriptions'::regclass
  and tgname='lumen_retention_stamp' and tgenabled in ('O','A')
  and tgfoid='lumen_privacy.stamp_push_retention()'::regprocedure) then
  raise exception 'LUMEN_RETENTION_STAMP_REVIEW_REQUIRED';
 end if;
 for r in select * from (values
  -- Explicit non-gameplay allowlist. Historical victory/hint/attempt evidence is excluded.
  ('lumen','analytics_events','occurred_at',
   $p$occurred_at < statement_timestamp()-interval '90 days' and event_name in
   ('session_start','app_opened','referral_visit','share_result','pwa_install_offer',
    'pwa_install_choice','pwa_install_later','pwa_installed','push_offer','push_choice',
    'feedback_submitted')$p$),
  ('lumen','feedback','privacy_closed_at',
   $p$status='closed' and not privacy_hold and privacy_closed_at < statement_timestamp()-interval '180 days'$p$),
  ('public','lumen_push_subscriptions','privacy_disabled_at',
   $p$enabled is false and privacy_disabled_at < statement_timestamp()-interval '90 days'$p$)
 ) as categories(ns,rel,age_col,predicate) loop
  if p_apply then
   execute format('with batch as (select ctid from %1$I.%2$I where %3$s order by %4$I,ctid limit $1 for update skip locked) delete from %1$I.%2$I t using batch b where t.ctid=b.ctid',
    r.ns,r.rel,r.predicate,r.age_col) using p_batch;
   get diagnostics n=row_count;
  else
   execute format('select count(*) from (select 1 from %I.%I where %s limit $1) eligible',
    r.ns,r.rel,r.predicate) into n using p_batch;
  end if;
  result:=result||jsonb_build_object(r.ns||'.'||r.rel,n);
 end loop;
 return jsonb_build_object('applied',p_apply,'batchPerCategory',p_batch,'rows',result);
end $$;
revoke all on function lumen_privacy.stamp_feedback_retention(),lumen_privacy.stamp_push_retention(),
 lumen_privacy.retain_technical_data(boolean,text,integer) from public,anon,authenticated,service_role;
