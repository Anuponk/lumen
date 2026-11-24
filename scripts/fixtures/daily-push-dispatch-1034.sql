-- Disposable fixture with injected clock and synthetic subscriptions only.
begin;
do $test$
declare
 a constant uuid:='00000000-0000-4000-8000-000000002001';
 b constant uuid:='00000000-0000-4000-8000-000000002002';
 c constant uuid:='00000000-0000-4000-8000-000000002003';
 d constant uuid:='00000000-0000-4000-8000-000000002004';
 e constant uuid:='00000000-0000-4000-8000-000000002005';
 j constant uuid:='00000000-0000-4000-8000-000000002006';
 k constant uuid:='00000000-0000-4000-8000-000000002007';
 a1 constant uuid:='00000000-0000-4000-8000-000000002101';
 a2 constant uuid:='00000000-0000-4000-8000-000000002102';
 b1 constant uuid:='00000000-0000-4000-8000-000000002103';
 c1 constant uuid:='00000000-0000-4000-8000-000000002104';
 d1 constant uuid:='00000000-0000-4000-8000-000000002105';
 e1 constant uuid:='00000000-0000-4000-8000-000000002106';
 j1 constant uuid:='00000000-0000-4000-8000-000000002107';
 k1 constant uuid:='00000000-0000-4000-8000-000000002108';
 a3 constant uuid:='00000000-0000-4000-8000-000000002109';
 a4 constant uuid:='00000000-0000-4000-8000-000000002110';
 day1 constant date:='2027-03-28';
 tick constant timestamptz:='2027-03-28 16:05:00+00'; -- 18:05 in Paris after the DST shift
 qid text;
 build integer;
 ta uuid; ta2 uuid; ta3 uuid; ta4 uuid; tc uuid; te uuid; tk uuid; tj uuid;
 result jsonb;
 signature text;
begin
 foreach signature in array array['public.lumen_reserve_daily_push_v1(integer)',
  'public.lumen_authorize_daily_push_v1(uuid)','public.lumen_finish_daily_push_v1(uuid,text)',
  'public.lumen_cleanup_daily_push_v1()'] loop
  assert has_function_privilege('service_role',signature,'execute');
  assert not has_function_privilege('anon',signature,'execute'),'hosted defaults must be revoked';
  assert not has_function_privilege('authenticated',signature,'execute');
 end loop;
 assert not has_function_privilege('service_role','lumen_commands.reserve_daily_push(timestamptz,integer)','execute'),
  'service callers cannot inject a clock';
 assert not has_table_privilege('service_role','lumen_commands.push_daily_dispatches','SELECT');
 set local role service_role;
 assert public.lumen_authorize_daily_push_v1('00000000-0000-4000-8000-000000000000') is null;
 reset role;
 set local role authenticated;
 begin
  perform public.lumen_authorize_daily_push_v1('00000000-0000-4000-8000-000000000000');
  raise exception 'account could authorize a delivery';
 exception when insufficient_privilege then null; end;
 reset role;

 insert into auth.users(id) values(a),(b),(c),(d),(e),(j),(k);
 insert into lumen.profiles(user_id,nickname)
  select uid,'Test1034'||row_number() over() from unnest(array[a,b,c,d,e,j,k]) as users(uid);
 select quest_id,grid_revision into strict qid,build from lumen_commands.daily_puzzles where day=day1;
 insert into lumen_commands.push_configuration(singleton,vapid_public_key) values(true,'B'||repeat('A',86))
  on conflict(singleton) do update set vapid_public_key=excluded.vapid_public_key;
 insert into lumen_commands.push_preferences(user_id,revision,daily_consented_at)
  select uid,1,tick-interval '1 day' from unnest(array[a,b,c,d,e,j,k]) as users(uid);
 insert into lumen_commands.push_devices(user_id,device_id,endpoint,p256dh,auth_secret,timezone,locale,updated_at)
  select v.uid,v.device,'https://fcm.googleapis.com/fcm/send/'||v.device,'B'||repeat('A',86),repeat('A',22),
   v.tz,'fr',tick-v.age
  from (values (a,a1,'Europe/Paris',interval '1 day'),(a,a2,'Europe/Paris',interval '1 day'),
     (a,a3,'Europe/Paris',interval '1 day'),(a,a4,'Europe/Paris',interval '1 day'),
     (b,b1,'Europe/Paris',interval '1 day'),(c,c1,'Europe/Paris',interval '1 day'),
     (d,d1,'Europe/Paris',interval '91 days'),(e,e1,'Europe/Paris',interval '1 day'),
     (j,j1,'America/Chicago',interval '1 day'),(k,k1,'Europe/Paris',interval '1 day')
  ) as v(uid,device,tz,age);
 insert into lumen_commands.daily_runs(user_id,day,operation_id,quest_id,grid_revision,status,score)
  values(b,day1,'fixture-complete',qid,build,'completed',50);

 assert lumen_commands.reserve_daily_push(tick,50)='[]'::jsonb,'initial flag off';
 update lumen_commands.feature_flags set enabled=true where name='daily_push';
 assert lumen_commands.reserve_daily_push(tick,50)='[]'::jsonb,'the daily challenge must be open publicly';
 update lumen_commands.feature_flags set enabled=true where name='daily_challenge';
 assert lumen_commands.reserve_daily_push(tick-interval '6 minutes',50)='[]'::jsonb,'not before the local hour';
 result:=lumen_commands.reserve_daily_push(tick,2);
 assert jsonb_array_length(result)=2 and not(result->0 ? 'endpoint'),'bounded secret-free reservations';
 assert jsonb_array_length(lumen_commands.reserve_daily_push(tick,50))=5;
 assert lumen_commands.reserve_daily_push(tick,50)='[]'::jsonb,'reservation claims are unique';
 assert (select count(*)=0 from lumen_commands.push_daily_dispatches where device_id in (b1,d1,j1)),
  'skip completed, inactive and off-window devices';

 select reservation_id into strict ta from lumen_commands.push_daily_dispatches where device_id=a1;
 select reservation_id into strict ta2 from lumen_commands.push_daily_dispatches where device_id=a2;
 select reservation_id into strict ta3 from lumen_commands.push_daily_dispatches where device_id=a3;
 select reservation_id into strict ta4 from lumen_commands.push_daily_dispatches where device_id=a4;
 select reservation_id into strict tc from lumen_commands.push_daily_dispatches where device_id=c1;
 select reservation_id into strict te from lumen_commands.push_daily_dispatches where device_id=e1;
 select reservation_id into strict tk from lumen_commands.push_daily_dispatches where device_id=k1;
 update lumen_commands.push_preferences set daily_consented_at=null,revision=2 where user_id=c;
 assert lumen_commands.authorize_daily_push(tick,tc) is null,'revocation after reservation blocks authorization';
 insert into lumen_commands.daily_runs(user_id,day,operation_id,quest_id,grid_revision,status,score)
  values(k,day1,'fixture-later-completion',qid,build,'completed',51);
 assert lumen_commands.authorize_daily_push(tick,tk) is null,'recheck confirmed completion after reservation';

 result:=lumen_commands.authorize_daily_push(tick,ta);
 assert result->>'challengeDay'=day1::text and result->>'locale'='fr' and (result->>'expiresAt')::timestamptz=tick+interval '10 minutes';
 assert result->'subscription'->>'endpoint' like 'https://fcm.googleapis.com/fcm/send/%';
 assert lumen_commands.authorize_daily_push(tick,ta) is null,'ambiguous authorization response cannot yield a second send';
 assert lumen_commands.finish_daily_push(ta,'ambiguous')='ambiguous';
 assert lumen_commands.finish_daily_push(ta,'sent')='ambiguous','a late conflicting outcome cannot change the record';

 assert lumen_commands.authorize_daily_push(tick,te) is not null;
 update lumen_commands.push_devices
 set p256dh='B'||repeat('B',86)
 where user_id=e and device_id=e1;
 assert lumen_commands.finish_daily_push(te,'expired')='expired';
 assert exists(select 1 from lumen_commands.push_devices where user_id=e and device_id=e1),
  'a provider error for replaced keys does not remove the new subscription';

 assert lumen_commands.authorize_daily_push(tick,ta2) is not null;
 assert lumen_commands.finish_daily_push(ta2,'expired')='expired';
 assert not exists(select 1 from lumen_commands.push_devices where user_id=a and device_id=a2),
  '404 or 410 can remove the exact subscription';
 assert lumen_commands.authorize_daily_push(tick,ta3) is not null; -- abandoned by provider caller
 update lumen_commands.feature_flags set enabled=false where name='daily_push';
 assert lumen_commands.authorize_daily_push(tick,ta4) is null,'kill switch also applies after reservation';
 update lumen_commands.feature_flags set enabled=true where name='daily_push';

 result:=lumen_commands.cleanup_daily_push(tick+interval '10 minutes');
 assert result->>'ambiguous'='1' and result->>'inactiveDevices'='1';
 assert lumen_commands.finish_daily_push(ta3,'sent')='ambiguous','cleanup never requeues an uncertain send';
 assert lumen_commands.reserve_daily_push(tick+interval '10 minutes',50)='[]'::jsonb,'exact end of the local window';

 -- Chicago is at 18:05 after Paris midnight, so the challenge is the next day.
 result:=lumen_commands.reserve_daily_push('2027-03-28 23:05:00+00',50);
 assert jsonb_array_length(result)=1;
 tj:=(result->0->>'reservationId')::uuid;
 result:=lumen_commands.authorize_daily_push('2027-03-28 23:05:00+00',tj);
 assert result->>'challengeDay'=(day1+1)::text;
 assert lumen_commands.finish_daily_push(tj,'sent')='sent';
 assert exists(select 1 from lumen_commands.push_daily_dispatches where challenge_day=day1+1 and device_id=j1);

 -- Same browser rebinds after unlink with its original subscription endpoint.
 update lumen_commands.push_devices
 set device_id='00000000-0000-4000-8000-000000002111'
 where user_id=a and device_id=a1;
 assert lumen_commands.reserve_daily_push(tick,50)='[]'::jsonb,'replacement device id cannot resend to the same endpoint on the same day';
 assert (lumen_commands.cleanup_daily_push(tick+interval '8 days')->>'oldReservations')::integer=7;
 assert exists(select 1 from lumen_commands.push_daily_dispatches where challenge_day=day1+1),
  'cleanup removes old completed Paris days without relaxing the current day key';
end
$test$;
rollback;
