-- Disposable database only. No production profile/Auth reads or writes.
begin;
alter table auth.users add column if not exists last_sign_in_at timestamptz;
create table if not exists lumen.users(user_id uuid primary key references auth.users(id));
\ir ../../supabase/migrations/20261025062807_cockpit_activity_dates.sql
do $$
declare admin uuid:=gen_random_uuid();actor uuid:=gen_random_uuid();other uuid:=gen_random_uuid();r jsonb;original jsonb;
begin
 insert into auth.users(id,last_sign_in_at) values(admin,now()-interval '2 days'),(actor,now()-interval '1 day'),(other,now());
 insert into lumen.users values(actor);
 insert into lumen.internal_capabilities(user_id,capability) values(admin,'analytics_cockpit');
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.lumen_admin_player_observations(array['u:'||actor]);raise exception 'non-admin read';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_admin_player_observations(array['u:'||actor]);raise exception 'guest read';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 r:=public.lumen_admin_player_observations(array['u:'||actor,'u:'||other,'a:guest','u:invalid']);
 assert (select count(*) from jsonb_object_keys(r->'players'))=1,'shared Auth users must not appear';
 original:=r->'players'->('u:'||actor);
 assert original->'domains'->'wallet'='null'::jsonb;
 insert into lumen_commands.wallet_receipts(user_id,operation_id,request,outcome,recorded_at)
 values(actor,'cockpit-534','{}','{"revision":1}',now()-interval '1 hour');
 insert into lumen_commands.outbox_health(user_id,client_id,session_id,session_started,sequence,platform,state,pending,failures)
 values(actor,gen_random_uuid(),gen_random_uuid(),now(),1,'desktop','pending',1,0),
 (actor,gen_random_uuid(),gen_random_uuid(),now(),1,'desktop','confirmed',0,0);
 r:=public.lumen_admin_player_observations(array['u:'||actor])->'players'->('u:'||actor);
 assert r->>'state'='pending','one pending device cannot be masked by another confirmed device';
 assert r->'auth_at'=original->'auth_at','activity/pending must not modify Auth';
 assert r->'domains'->'wallet'<>'null'::jsonb;
 original:=r;
 update lumen_commands.outbox_health set failures=1,state='critical' where user_id=actor and pending=1;
 r:=public.lumen_admin_player_observations(array['u:'||actor])->'players'->('u:'||actor);
 assert r->>'state'='failure';assert r->'domains'=original->'domains','failure must not advance receipt dates';
 update auth.users set last_sign_in_at=now() where id=actor;
 r:=public.lumen_admin_player_observations(array['u:'||actor])->'players'->('u:'||actor);
 assert r->'auth_at'<>original->'auth_at','an actual authentication advances only Auth';
 assert r->'domains'=original->'domains';
 insert into lumen_commands.wallet_receipts(user_id,operation_id,request,outcome)
 values(actor,'cockpit-534-resumed','{}','{"revision":2}');
 r:=public.lumen_admin_player_observations(array['u:'||actor])->'players'->('u:'||actor);
 assert r->'domains'->'wallet'<>original->'domains'->'wallet','a later durable commit advances the domain';
 assert r->'domains'->'canonical'=original->'domains'->'canonical';
 update lumen.internal_capabilities set expires_at=now()-interval '1 second' where user_id=admin;
 begin perform public.lumen_admin_player_observations(array['u:'||actor]);raise exception 'expired capability';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('anon','public.lumen_admin_player_observations(text[])','EXECUTE');
 assert not has_table_privilege('authenticated','lumen_commands.wallet_receipts','SELECT');
end $$;
rollback;
