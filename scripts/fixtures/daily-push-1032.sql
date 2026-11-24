-- Synthetic accounts and subscriptions, never sent to a provider.
begin;
do $test$
declare
 a constant uuid:='00000000-0000-4000-8000-000000001031';
 b constant uuid:='00000000-0000-4000-8000-000000001032';
 c constant uuid:='00000000-0000-4000-8000-000000001033';
 sa constant uuid:='00000000-0000-4000-8000-000000001041';
 sb constant uuid:='00000000-0000-4000-8000-000000001042';
 sc constant uuid:='00000000-0000-4000-8000-000000001043';
 d1 constant uuid:='00000000-0000-4000-8000-000000001051';
 d2 constant uuid:='00000000-0000-4000-8000-000000001052';
 key constant text:='B'||repeat('A',86);
 account_rpc constant text:='public.lumen_daily_push_v1(uuid,text,uuid,integer,boolean,jsonb,text,text)';
 internal_rpc constant text:='lumen_commands.daily_push_v1(uuid,text,uuid,integer,boolean,jsonb,text,text)';
 subscription constant jsonb:=jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/synthetic-1032',
  'keys',jsonb_build_object('p256dh',key,'auth',repeat('A',22)));
 result jsonb;
begin
 assert not has_function_privilege('anon',account_rpc,'execute'),'hosted anon defaults explicitly revoked';
 assert not has_function_privilege('anon',internal_rpc,'execute');
 assert not has_function_privilege('service_role',account_rpc,'execute'),'operator service role is not an account';
 assert not has_table_privilege('authenticated','lumen_commands.push_devices','SELECT');
 assert not has_table_privilege('authenticated','lumen_commands.push_preferences','UPDATE');
 assert not has_table_privilege('anon','lumen_commands.push_configuration','SELECT');
 assert (select count(*)=3 from pg_class where oid in ('lumen_commands.push_preferences'::regclass,
  'lumen_commands.push_devices'::regclass,'lumen_commands.push_configuration'::regclass) and relrowsecurity);
 assert (select count(*)=2 from lumen_privacy.policy()
  where ns='lumen_commands' and rel in ('push_preferences','push_devices') and action='delete');

 insert into auth.users(id) values(a),(b),(c);
 insert into lumen.profiles(user_id,nickname) values(a,'Test1032A'),(b,'Test1032B'),(c,'Test1032C');
 insert into auth.sessions(id,user_id,not_after) values(sa,a,null),(sb,b,null),(sc,c,now()-interval '1 day');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',sa)::text,true);

 set local role authenticated;
 result:=public.lumen_daily_push_v1(a,'read',d1);
 assert result->>'available'='false' and result->>'dailyEnabled'='false' and result->>'revision'='0';
 assert result->>'vapidPublicKey' is null;
 begin
  perform public.lumen_daily_push_v1(a,'enable',d1,0,true,subscription,'Europe/Paris','fr');
  raise exception 'disabled route accepted device';
 exception when insufficient_privilege then assert sqlerrm='push_disabled'; end;
 reset role;
 update lumen_commands.feature_flags set enabled=true where name='daily_push';
 assert public.lumen_daily_push_v1(a,'read')->>'available'='false','flag needs a configured key';
 insert into lumen_commands.push_configuration(singleton,vapid_public_key) values(true,key);

 set local role authenticated;
 result:=public.lumen_daily_push_v1(a,'read',d1);
 assert result->>'available'='true' and result->>'vapidPublicKey'=key and result->>'deviceRegistered'='false';
 begin
  perform public.lumen_daily_push_v1(a,'enable',d1,0,false,subscription,'Europe/Paris','fr');
  raise exception 'implicit consent accepted';
 exception when invalid_parameter_value then assert sqlerrm='push_consent_required'; end;
 begin
  perform public.lumen_daily_push_v1(a,'enable',d1,0,true,
   subscription||'{"endpoint":"https://fcm.googleapis.com.invalid/geography"}','Europe/Paris','fr');
  raise exception 'unsupported host accepted';
 exception when invalid_parameter_value then assert sqlerrm='push_invalid_device'; end;
 begin
  perform public.lumen_daily_push_v1(a,'enable',d1,0,true,subscription,'Moon/Base','fr');
  raise exception 'unsupported time zone accepted';
 exception when invalid_parameter_value then assert sqlerrm='push_invalid_device'; end;

 result:=public.lumen_daily_push_v1(a,'enable',d1,0,true,subscription,'Europe/Paris','fr');
 assert result->>'dailyEnabled'='true' and result->>'deviceRegistered'='true' and result->>'revision'='1'
    and result->>'reminderHour'='18';
 assert not (result ? 'endpoint' or result ? 'subscription' or result ? 'keys'),'browser cannot read secrets';
 result:=public.lumen_daily_push_v1(a,'read',d2);
 assert result->>'dailyEnabled'='true' and result->>'deviceRegistered'='false','account and device are separate';
 begin
  perform public.lumen_daily_push_v1(b,'read',d1);
  raise exception 'account switch accepted';
 exception when insufficient_privilege then assert sqlerrm='push_account_required'; end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 begin
  perform public.lumen_daily_push_v1(b,'read',d1);
  raise exception 'foreign session accepted';
 exception when insufficient_privilege then assert sqlerrm='push_account_required'; end;
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',sb)::text,true);
 assert public.lumen_daily_push_v1(b,'read',d1)->>'deviceRegistered'='false','foreign devices are not visible';
 begin
  perform public.lumen_daily_push_v1(b,'enable',d2,0,true,subscription,'Europe/Paris','es');
  raise exception 'device reassigned';
 exception when invalid_parameter_value then assert sqlerrm='push_device_conflict'; end;
 perform public.lumen_daily_push_v1(b,'unlink',d1);

 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',sa)::text,true);
 assert public.lumen_daily_push_v1(a,'read',d1)->>'deviceRegistered'='true','foreign unlink did not remove owner device';
 reset role;
 update lumen_commands.feature_flags set enabled=false where name='daily_push';
 set local role authenticated;
 result:=public.lumen_daily_push_v1(a,'disable',d1,1);
 assert result->>'dailyEnabled'='false' and result->>'revision'='2' and result->>'deviceRegistered'='true';
 result:=public.lumen_daily_push_v1(a,'unlink',d1);
 assert result->>'deviceRegistered'='false' and result->>'revision'='3','revocation works with flag off';
 reset role;

 update lumen_commands.feature_flags set enabled=true where name='daily_push';
 set local role authenticated;
 begin
  perform public.lumen_daily_push_v1(a,'enable',d1,1,true,subscription,'Europe/Paris','fr');
  raise exception 'stale consent revived';
 exception when serialization_failure then assert sqlerrm='push_stale_revision'; end;
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',sc)::text,true);
 begin
  perform public.lumen_daily_push_v1(c,'read',d1);
  raise exception 'expired session accepted';
 exception when insufficient_privilege then assert sqlerrm='push_account_required'; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',sa,'is_anonymous',true)::text,true);
 begin
  perform public.lumen_daily_push_v1(a,'read',d1);
  raise exception 'anonymous Auth accepted';
 exception when insufficient_privilege then assert sqlerrm='push_account_required'; end;
 reset role;

 insert into lumen_privacy.erased_identifiers(kind,digest,owner_digest)
 values('user',lumen_privacy.fingerprint(a::text),lumen_privacy.fingerprint(a::text));
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',sa)::text,true);
 set local role authenticated;
 begin
  perform public.lumen_daily_push_v1(a,'enable',d1,3,true,subscription,'Europe/Paris','fr');
  raise exception 'an erased account was registered again';
 exception when insufficient_privilege then assert sqlerrm='LUMEN_ACCOUNT_ERASED'; end;
 reset role;

 assert not exists(select 1 from lumen_commands.push_devices where user_id in (a,b)),'only explicit owned enrollments persisted';
 assert (select count(*)=2 from pg_trigger
  where tgrelid in ('lumen_commands.push_devices'::regclass,'lumen_commands.push_preferences'::regclass)
  and tgfoid='lumen_privacy.guard_write()'::regprocedure),'erase writer barriers installed';
end
$test$;
rollback;

-- The owner-facing rights export retains consent and device metadata only.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000001061');
insert into lumen.profiles(user_id,nickname) values('00000000-0000-4000-8000-000000001061','Test1032Export');
insert into lumen_commands.push_preferences(user_id,revision,daily_consented_at)
 values('00000000-0000-4000-8000-000000001061',1,now());
insert into lumen_commands.push_devices(user_id,device_id,endpoint,p256dh,auth_secret,timezone,locale,updated_at)
 values('00000000-0000-4000-8000-000000001061','00000000-0000-4000-8000-000000001062',
 'https://fcm.googleapis.com/fcm/send/synthetic-export','B'||repeat('A',86),repeat('A',22),'Europe/Paris','fr',now());
commit;

begin isolation level repeatable read read only;
do $export$
declare
 account_id constant uuid:='00000000-0000-4000-8000-000000001061';
 report jsonb;
 device jsonb;
begin
 report:=lumen_privacy.export_account(account_id,array[]::text[]);
 device:=report#>'{tables,lumen_commands.push_devices,0}';
 assert device->>'timezone'='Europe/Paris' and device->>'locale'='fr';
 assert not (device ? 'endpoint' or device ? 'p256dh' or device ? 'auth_secret');
 assert report#>>'{tables,lumen_commands.push_preferences,0,revision}'='1';
end
$export$;
rollback;

begin;
delete from lumen_commands.push_devices where user_id='00000000-0000-4000-8000-000000001061';
delete from lumen_commands.push_preferences where user_id='00000000-0000-4000-8000-000000001061';
delete from lumen.profiles where user_id='00000000-0000-4000-8000-000000001061';
delete from auth.users where id='00000000-0000-4000-8000-000000001061';
commit;
