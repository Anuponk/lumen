-- Disposable database only. Synthetic sessions, no real network/provider calls.
begin;
create schema vault;
create schema net;
create table vault.decrypted_secrets(name text,decrypted_secret text);
insert into vault.decrypted_secrets values('lumen_daily_push_job_token',repeat('fixture',6));
create table net.fixture_requests(body jsonb);
create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer)
returns bigint language plpgsql as $$begin
 assert url='https://tjdjlavmusmncuszhsuw.supabase.co/functions/v1/lumen-daily-push-dispatch?action=test';
 assert headers->>'Authorization'='Bearer '||repeat('fixture',6);
 insert into net.fixture_requests values(body);return 1;
end$$;
do $test$
declare
 a uuid:='00000000-0000-4000-8000-000000003401';
 b uuid:='00000000-0000-4000-8000-000000003402';
 session_id uuid:='00000000-0000-4000-8000-000000003411';
 device uuid:='00000000-0000-4000-8000-000000003421';
 other_device uuid:='00000000-0000-4000-8000-000000003422';
 key text:='B'||repeat('A',86);
 sub jsonb;
 result jsonb;
 ticket uuid;
 tick timestamptz:=statement_timestamp();
begin
 assert not has_function_privilege('anon','public.lumen_daily_push_test_v1(uuid,uuid,text)','execute');
 assert not has_function_privilege('authenticated','public.lumen_authorize_test_push_v1(uuid)','execute');
 assert not has_function_privilege('service_role','public.lumen_daily_push_test_v1(uuid,uuid,text)','execute');
 assert not has_table_privilege('authenticated','lumen_commands.push_test_dispatches','select');
 assert (select relrowsecurity from pg_class where oid='lumen_commands.push_test_dispatches'::regclass);
 assert (select count(*)=1 from lumen_privacy.policy() where ns='lumen_commands' and rel='push_test_dispatches' and action='delete');
 insert into auth.users(id) values(a),(b);
 insert into lumen.profiles(user_id,nickname) values(a,'PushPreviewA'),(b,'PushPreviewB');
 insert into auth.sessions(id,user_id) values(session_id,a);
 insert into lumen_commands.push_configuration values(true,key) on conflict(singleton) do update set vapid_public_key=excluded.vapid_public_key;
 update lumen_commands.feature_flags set enabled=false where name='daily_push';
 update lumen_commands.feature_flags set enabled=true where name='daily_challenge';
 insert into lumen_commands.daily_puzzles(day,quest_id,grid_revision)
 select (tick at time zone 'Europe/Paris')::date,quest_id,grid_revision from lumen_commands.daily_puzzles limit 1 on conflict(day) do nothing;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',session_id)::text,true);
 result:=public.lumen_daily_push_v1(a,'read',device);
 assert result->>'available'='false';
 insert into lumen.internal_capabilities(user_id,capability,expires_at) values(a,'daily_push_preview',tick+interval '1 day');
 set local role authenticated;
 result:=public.lumen_daily_push_v1(a,'read',device);
 assert result->>'available'='true' and result->>'preview'='true','preview makes menu available without public activation';
 begin
  perform public.lumen_daily_push_test_v1(b,device,'send');raise exception 'wrong owner accepted';
 exception when insufficient_privilege then assert sqlerrm='push_account_required';end;
 begin
  perform public.lumen_daily_push_test_v1(a,device,'send');raise exception 'missing consent accepted';
 exception when insufficient_privilege then assert sqlerrm='push_device_unavailable';end;
 sub:=jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/synthetic-preview','keys',jsonb_build_object('p256dh',key,'auth',repeat('A',22)));
 result:=public.lumen_daily_push_v1(a,'enable',device,0,true,sub,'Europe/Paris','fr');
 assert result->>'dailyEnabled'='true' and result->>'deviceRegistered'='true';
 begin
  perform public.lumen_daily_push_test_v1(a,other_device,'send');raise exception 'foreign device accepted';
 exception when insufficient_privilege then assert sqlerrm='push_device_unavailable';end;
 assert public.lumen_daily_push_test_v1(a,device,'send')->>'status'='reserved';
 assert public.lumen_daily_push_test_v1(a,device,'send')->>'status'='reserved';
 reset role;
 assert (select count(*)=1 from net.fixture_requests),'repeated click only queues once';
 assert (select count(*)=0 from lumen_commands.push_daily_dispatches),'test never consumes reminder deduplication';
 select reservation_id into strict ticket from lumen_commands.push_test_dispatches where user_id=a;
 -- An ordinary player stays unavailable with the global flag off.
 assert not lumen_commands.daily_push_available(b);
 assert exists(select 1 from lumen_commands.eligible_test_push(tick,a,device));
 update lumen.internal_capabilities set expires_at=tick-interval '1 second' where user_id=a;
 assert lumen_commands.authorize_test_push(tick,ticket) is null,'revoked preview blocks a previously queued test';
 update lumen.internal_capabilities set expires_at=tick+interval '1 day' where user_id=a;
 update lumen_commands.push_test_dispatches set state='reserved' where reservation_id=ticket;
 result:=lumen_commands.authorize_test_push(tick,ticket);
 assert result->'subscription'->>'endpoint'=sub->>'endpoint';
 assert lumen_commands.authorize_test_push(tick,ticket) is null,'authorization cannot be replayed';
 assert lumen_commands.finish_test_push(ticket,'sent')='sent';
 assert lumen_commands.finish_test_push(ticket,'ambiguous')='sent';
 assert public.lumen_daily_push_test_v1(a,device,'read')->>'status'='sent';
 -- A second reservation is a local fixture only, to prove consent revalidation.
 update lumen_commands.push_test_dispatches set state='reserved' where reservation_id=ticket;
 perform public.lumen_daily_push_v1(a,'disable',device,1);
 assert lumen_commands.authorize_test_push(tick,ticket) is null;
 update lumen.internal_capabilities set expires_at=tick-interval '1 second' where user_id=a;
 assert public.lumen_daily_push_v1(a,'read',device)->>'available'='false';
end
$test$;
rollback;
