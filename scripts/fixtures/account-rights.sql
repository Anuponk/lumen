-- Disposable database only, after the erasure migration and fixtures.
do $$begin
 if to_regprocedure('lumen_privacy.export_account(uuid,text[],integer)') is null then
  raise exception 'Missing bounded operator rights export';
 end if;
end $$;
insert into auth.users(id) values
 ('00000000-0000-0000-0000-000000009401'),
 ('00000000-0000-0000-0000-000000009402'),
 ('00000000-0000-0000-0000-000000009403'),
 ('00000000-0000-0000-0000-000000009404');
insert into lumen.feedback(user_id,anonymous_id,message) values
 ('00000000-0000-0000-0000-000000009401','rights-guest','own feedback'),
 (null,'rights-guest','own guest feedback'),
 ('00000000-0000-0000-0000-000000009402',null,'OTHER_PLAYER_SECRET'),
 ('00000000-0000-0000-0000-000000009403',null,repeat('oversize',1100000));
insert into lumen.feedback(user_id,anonymous_id,message) values
 ('00000000-0000-0000-0000-000000009402','rights-shared','collision one'),
 ('00000000-0000-0000-0000-000000009404','rights-shared','collision two');
insert into fixture_other_app.records values
 ('00000000-0000-0000-0000-000000009401','{"secret":"OTHER_APP_SECRET"}');
alter table auth.users add column fixture_auth_secret text;
insert into lumen_commands.wallet_receipts(user_id,operation_id,request,outcome) values
 ('00000000-0000-0000-0000-000000009401','rights-receipt','{"fixture":true}','{"status":"own receipt"}');
insert into lumen.social_challenges(id,sender_user_id,sender_anonymous_id,sender_display_name) values
 ('00000000-0000-0000-0000-000000009421','00000000-0000-0000-0000-000000009401','rights-guest','Own player');
insert into lumen.social_challenge_participations(id,challenge_id,participant_user_id,participant_key,participant_display_name) values
 ('00000000-0000-0000-0000-000000009422','00000000-0000-0000-0000-000000009421',
 '00000000-0000-0000-0000-000000009402','u:00000000-0000-0000-0000-000000009402','OTHER_PARTICIPANT_SECRET');
update auth.users set fixture_auth_secret='AUTH_SECRET';
alter table public.lumen_push_subscriptions add column if not exists subscription jsonb;
insert into public.lumen_push_subscriptions(user_id,anonymous_id,endpoint,subscription) values
 ('00000000-0000-0000-0000-000000009401','rights-guest','https://push.invalid/fixture',
 '{"endpoint":"https://push.invalid/fixture","keys":{"auth":"PUSH_SECRET","p256dh":"PUSH_KEY"}}');
do $$begin
 begin
  perform lumen_privacy.export_account('00000000-0000-0000-0000-000000009401',array['rights-guest']);
  raise exception 'Writable export accepted';
 exception when invalid_transaction_state then null; end;
end $$;
