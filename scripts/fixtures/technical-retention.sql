-- Disposable synthetic data only; no production connection or scheduler.
do $$begin
 if to_regprocedure('lumen_privacy.retain_technical_data(boolean,text,integer)') is null then
  raise exception 'Missing safe technical retention';
 end if;
end $$;
begin;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000009501');
insert into lumen.profile_snapshots(user_id,payload) values
 ('00000000-0000-0000-0000-000000009501','{"fixture":"retention must preserve progress"}');
insert into lumen_commands.wallet_receipts(user_id,operation_id,request,outcome) values
 ('00000000-0000-0000-0000-000000009501','retention-receipt','{}','{"balance":42}');
insert into lumen.analytics_events(user_id,event_name,occurred_at,properties) values
 ('00000000-0000-0000-0000-000000009501','session_start',now()-interval '91 days','{"fixture":"old statistic"}'),
 ('00000000-0000-0000-0000-000000009501','session_start',now()-interval '89 days','{"fixture":"recent statistic"}'),
 ('00000000-0000-0000-0000-000000009501','puzzle_complete',now()-interval '500 days','{"fixture":"historical victory"}'),
 ('00000000-0000-0000-0000-000000009501','account_signin_failure',now()-interval '500 days','{"fixture":"security evidence"}'),
 ('00000000-0000-0000-0000-000000009501','unknown_future_event',now()-interval '500 days','{}');
insert into lumen.feedback(user_id,message,status,created_at,privacy_closed_at) values
 ('00000000-0000-0000-0000-000000009501','old closed','closed',now()-interval '400 days',now()-interval '399 days'),
 ('00000000-0000-0000-0000-000000009501','recent closure','closed',now()-interval '400 days',now()-interval '399 days'),
 ('00000000-0000-0000-0000-000000009501','unresolved','new',now()-interval '400 days',now()-interval '399 days'),
 ('00000000-0000-0000-0000-000000009501','reviewed not closed','reviewed',now()-interval '400 days',null),
 ('00000000-0000-0000-0000-000000009501','held closed','closed',now()-interval '400 days',null);
insert into public.lumen_push_subscriptions(user_id,endpoint,enabled,privacy_disabled_at) values
 ('00000000-0000-0000-0000-000000009501','https://push.invalid/retention-old',false,now()-interval '400 days'),
 ('00000000-0000-0000-0000-000000009501','https://push.invalid/retention-recent',false,now()-interval '400 days'),
 ('00000000-0000-0000-0000-000000009501','https://push.invalid/retention-active',true,now()-interval '400 days');
do $$begin
 if exists(select 1 from lumen.feedback where user_id='00000000-0000-0000-0000-000000009501'
  and ((status='closed' and privacy_closed_at<now()-interval '1 minute')
   or (status<>'closed' and privacy_closed_at is not null)))
 or exists(select 1 from public.lumen_push_subscriptions where user_id='00000000-0000-0000-0000-000000009501'
  and ((not enabled and privacy_disabled_at<now()-interval '1 minute') or (enabled and privacy_disabled_at is not null))) then
  raise exception 'Client supplied retention dates accepted';
 end if;
end $$;
-- Simulate historical transitions in this disposable fixture only. Erasure guards
-- stay enabled; date guards are immediately reinstated before all purge tests.
alter table lumen.feedback disable trigger lumen_retention_stamp;
update lumen.feedback set privacy_closed_at=now()-interval '181 days'
 where user_id='00000000-0000-0000-0000-000000009501' and message in ('old closed','held closed');
alter table lumen.feedback enable trigger lumen_retention_stamp;
alter table public.lumen_push_subscriptions disable trigger lumen_retention_stamp;
update public.lumen_push_subscriptions set privacy_disabled_at=now()-interval '91 days'
 where endpoint='https://push.invalid/retention-old';
alter table public.lumen_push_subscriptions enable trigger lumen_retention_stamp;
update lumen.feedback set privacy_hold=true where message='held closed';
-- An authenticated request cannot lift an operator hold or backdate a clock.
set local request.jwt.claim.sub='00000000-0000-0000-0000-000000009501';
update lumen.feedback set privacy_hold=false,privacy_closed_at=now()-interval '900 days' where message='held closed';
set local request.jwt.claim.sub='';
update lumen.feedback set status='new' where message='recent closure';
update lumen.feedback set status='closed',privacy_closed_at=now()-interval '900 days' where message='recent closure';
update public.lumen_push_subscriptions set enabled=true where endpoint='https://push.invalid/retention-recent';
update public.lumen_push_subscriptions set enabled=false,privacy_disabled_at=now()-interval '900 days'
 where endpoint='https://push.invalid/retention-recent';
do $$begin
 if not (select privacy_hold from lumen.feedback where message='held closed')
  or (select privacy_closed_at from lumen.feedback where message='recent closure')<now()-interval '1 minute'
  or (select privacy_disabled_at from public.lumen_push_subscriptions where endpoint='https://push.invalid/retention-recent')<now()-interval '1 minute' then
  raise exception 'Hold or transition clock integrity failed';
 end if;
end $$;
do $$declare r jsonb; begin
 r:=lumen_privacy.retain_technical_data();
 if (r->>'applied')::boolean or (r->'rows'->>'lumen.analytics_events')::integer<1
  or (r->'rows'->>'lumen.feedback')::integer<>1
  or (r->'rows'->>'public.lumen_push_subscriptions')::integer<>1 then
  raise exception 'Retention preview or scope failed';
 end if;
 if not exists(select 1 from lumen.feedback where message='old closed') then raise exception 'Preview deleted data'; end if;
 begin
  perform lumen_privacy.retain_technical_data(true);
  raise exception 'Unconfirmed purge accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform lumen_privacy.retain_technical_data(false,null,1001);
  raise exception 'Unbounded purge accepted';
 exception when invalid_parameter_value then null; end;
end $$;
-- A failure after the first category must roll back its deletion too.
create function public.fixture_retention_fail() returns trigger language plpgsql as $$
begin raise exception 'fixture retention failure'; end $$;
create trigger fixture_retention_fail before delete on lumen.feedback for each row execute function public.fixture_retention_fail();
do $$begin
 begin
  perform lumen_privacy.retain_technical_data(true,'PURGE LUMEN TECHNICAL DATA',1);
  raise exception 'Expected fixture failure';
 exception when raise_exception then if sqlerrm<>'fixture retention failure' then raise; end if; end;
 if not exists(select 1 from lumen.analytics_events where properties->>'fixture'='old statistic') then
  raise exception 'Partial retention deletion survived failure';
 end if;
end $$;
drop trigger fixture_retention_fail on lumen.feedback;
drop function public.fixture_retention_fail();
do $$declare r jsonb; role_name text; begin
 r:=lumen_privacy.retain_technical_data(true,'PURGE LUMEN TECHNICAL DATA',1);
 if exists(select 1 from jsonb_each_text(r->'rows') t where t.value::integer>1) then raise exception 'Batch exceeded'; end if;
 if exists(select 1 from lumen.feedback where message='old closed')
  or exists(select 1 from public.lumen_push_subscriptions where endpoint='https://push.invalid/retention-old')
  or not exists(select 1 from lumen.feedback where message='unresolved')
  or not exists(select 1 from lumen.feedback where message='reviewed not closed')
  or not exists(select 1 from lumen.feedback where message='held closed')
  or not exists(select 1 from lumen.feedback where message='recent closure')
  or not exists(select 1 from public.lumen_push_subscriptions where endpoint='https://push.invalid/retention-active')
  or not exists(select 1 from public.lumen_push_subscriptions where endpoint='https://push.invalid/retention-recent')
  or not exists(select 1 from lumen.analytics_events where properties->>'fixture'='historical victory')
  or not exists(select 1 from lumen.analytics_events where properties->>'fixture'='security evidence')
  or not exists(select 1 from lumen.analytics_events where event_name='unknown_future_event')
  or not exists(select 1 from lumen.profile_snapshots where user_id='00000000-0000-0000-0000-000000009501')
  or not exists(select 1 from lumen_commands.wallet_receipts where operation_id='retention-receipt') then
  raise exception 'Retention exceeded technical-data scope';
 end if;
 foreach role_name in array array['anon','authenticated','service_role'] loop
  execute format('set local role %I',role_name);
  begin
   perform lumen_privacy.retain_technical_data();
   raise exception 'API retention accepted';
  exception when insufficient_privilege then null; end;
  reset role;
 end loop;
end $$;
alter table lumen.feedback disable trigger lumen_retention_stamp;
do $$begin
 begin
  perform lumen_privacy.retain_technical_data(true,'PURGE LUMEN TECHNICAL DATA');
  raise exception 'Disabled date guard accepted';
 exception when raise_exception then
  if sqlerrm<>'LUMEN_RETENTION_STAMP_REVIEW_REQUIRED' then raise; end if;
 end;
end $$;
alter table lumen.feedback enable trigger lumen_retention_stamp;
rollback;
