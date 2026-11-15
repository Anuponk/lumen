-- Synthetic data in disposable PostgreSQL only. No production player reads.
do $$begin
 if current_database()<>'lumen_test' and current_setting('lumen.sql_fixture',true) is distinct from '708'
 then raise exception 'Disposable analytics fixture requires an isolated test database';end if;
end $$;
create table if not exists lumen.users(user_id uuid primary key references auth.users(id));
alter table lumen.users add column if not exists last_seen_at timestamptz default now();
alter table auth.users add column if not exists email text;
alter table auth.users add column if not exists created_at timestamptz default now();
alter table auth.users add column if not exists last_sign_in_at timestamptz;
create table if not exists lumen.profiles(user_id uuid primary key,nickname text);
alter table lumen.profiles add column if not exists nickname text;
create table if not exists lumen.progress(user_id uuid,puzzle_id integer);
create table if not exists lumen.feedback(created_at timestamptz not null default now());
\ir ../../supabase/migrations/20261115162545_reliable_analytics_708.sql
\ir ../../supabase/migrations/20261115162545_reliable_analytics_708.sql
begin;
do $$
declare admin uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();
 q text;ordinal integer;r jsonb;before_receipts bigint;baseline_players bigint;baseline_quests bigint;baseline_completions bigint;
begin
 insert into auth.users(id) values(admin),(a),(b),(outsider);
 insert into lumen.users(user_id) values(a),(b);
 insert into lumen.internal_capabilities(user_id,capability) values(admin,'analytics_cockpit');
 select quest_id,(rules->>'ordinal')::integer into q,ordinal from lumen_commands.quest_rules order by (rules->>'ordinal')::integer limit 1;
 perform set_config('request.jwt.claim.sub',a::text,true);
 begin perform public.lumen_admin_cockpit();raise exception 'ordinary player read admin metrics';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_admin_cockpit();raise exception 'guest read admin metrics';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 r:=public.lumen_admin_cockpit(7)->'service_activity'->'summary';
 baseline_players:=(r->>'players')::bigint;baseline_quests:=(r->>'quests')::bigint;baseline_completions:=(r->>'completions')::bigint;
 insert into lumen_commands.canonical_receipts(user_id,operation_id,request,outcome,recorded_at) values
 (a,'kpi-708-win',jsonb_build_object('questId',q),'{"firstCompletion":true}',now()-interval '1 hour'),
 (outsider,'kpi-708-other-app',jsonb_build_object('questId',q),'{}',now());
 insert into lumen_commands.legacy_receipts(user_id,operation_id,request,outcome,recorded_at) values
 (a,'kpi-708-win',jsonb_build_object('questId',q),'{"firstCompletion":true}',now()-interval '1 hour'),
 (b,'kpi-708-replay',jsonb_build_object('questId',q),'{"firstCompletion":false}',now()-interval '2 hours'),
 (b,'kpi-708-old',jsonb_build_object('questId',q),'{"firstCompletion":false}',now()-interval '9 days');
 select count(*) into before_receipts from lumen_commands.canonical_receipts;
 r:=public.lumen_admin_cockpit(7);
 assert (r->'service_activity'->'summary'->>'players')::bigint=baseline_players+2,'service players do not depend on optional events; shared Auth outsiders excluded';
 assert (r->'service_activity'->'summary'->>'completions')::bigint=baseline_completions+2,'cross-domain duplicate operation counted once; replays count; old receipts excluded';
 assert r->'collection'->>'enabled'='false','no permission silently activated';
 assert r->'retention'->'j7'='null'::jsonb,'interrupted collection cannot produce a retention percentage';
 assert exists(select 1 from jsonb_array_elements(r->'service_activity'->'players') p where p->>'player_key'='u:'||a::text),'bounded account drilldown';
 assert (select count(*) from lumen_commands.canonical_receipts)=before_receipts,'reader must never mutate receipts';
 -- Two explicit owners of one browser must remain separate. An ambiguous guest stays anonymous.
 insert into lumen.analytics_events(user_id,anonymous_id,event_name,session_id,occurred_at,properties) values
 (a,'shared-browser-708','attempt_completed','s-708',now()-interval '2 hours',jsonb_build_object('traffic_type','human','stable_quest_id',q,'attempt_id','attempt-708','run_index',1,'active_seconds',12.3,'grid_revision',1)),
 (a,'shared-browser-708','puzzle_complete','s-708',now()-interval '2 hours',jsonb_build_object('traffic_type','human','stable_quest_id',q,'attempt_id','attempt-708','run_index',1)),
 (b,'shared-browser-708','attempt_started','s-708',now()-interval '1 hour',jsonb_build_object('traffic_type','human','stable_quest_id',q)),
 (null,'shared-browser-708','session_start','s-708',now(),' {"traffic_type":"human"}'),
 (a,'older-browser-708','session_start','older',now()-interval '3 days','{"traffic_type":"human"}'),
 (b,'qa-browser-708','session_start','qa',now(),'{"traffic_type":"human","qa_mode":"new"}'),
 (null,'weekly-browser-708','session_start','weekly',now()-interval '3 days','{"traffic_type":"human"}');
 assert (select count(distinct player_key) from lumen_commands.cockpit_events(7) where session_id='s-708')=3,'explicit owners preserved and shared guest remains ambiguous';
 r:=public.lumen_admin_cockpit(1);
 assert (r->'summary'->>'wau')::bigint>(r->'summary'->>'unique_players')::bigint,'WAU includes a weekly visitor outside the selected day';
 assert (select count(*) from lumen_commands.cockpit_events(7) where session_id='qa')=0,'QA excluded';
 -- An open alone is not a played attempt. Paired completion events count once.
 delete from lumen.analytics_events where anonymous_id not in ('shared-browser-708','older-browser-708','qa-browser-708');
 r:=public.lumen_admin_cockpit(7);
 assert (r->'summary'->>'quests_completed')::integer=1,'one completed run, two event names';
 assert (r->'summary'->>'quests_started')::integer=1,'only actual attempt starts';
 select x into r from jsonb_array_elements(public.lumen_admin_quest_metrics(7)->'friction') x where x->>'stable_quest_id'=q;
 assert (r->>'median_seconds')::numeric=12.3 and r->>'duration_samples'='1','decimal duration and sample count for one known revision';
 insert into lumen.analytics_events(user_id,anonymous_id,event_name,session_id,properties) values
 (a,'shared-browser-708','attempt_completed','s-708',jsonb_build_object('traffic_type','human','stable_quest_id',q,'grid_revision',2,'active_seconds',999));
 select x into r from jsonb_array_elements(public.lumen_admin_quest_metrics(7)->'friction') x where x->>'stable_quest_id'=q;
 assert r->'median_seconds'='null'::jsonb,'different revisions cannot become one difficulty timing';
 insert into lumen.analytics_events(user_id,anonymous_id,event_name,session_id,properties) values
 (b,'old-unqualified-708','session_start','unqualified','{}');
 assert (select last_activity<now() from public.lumen_admin_accounts(250) where user_id=b),'unqualified traffic cannot advance account activity';
 assert (select count(*) from public.lumen_admin_accounts(250) where user_id=outsider)=0,'account directory restricted to Lumen membership';
 assert (select count(*) from public.lumen_admin_recent_players(250) where player_key='u:'||a::text)=1,'shared browser retains explicit account identity';
 insert into lumen_commands.outbox_health(user_id,client_id,session_id,session_started,sequence,platform,state,pending,failures,updated_at)
 values(a,gen_random_uuid(),gen_random_uuid(),now(),1,'desktop','pending',2,0,now()-interval '1 day');
 r:=lumen_commands.outbox_health_summary();
 assert (r->>'pending_players')::integer>0,'old evidence retained';
 assert (select count(*) from lumen_commands.outbox_health where user_id=a and pending>0 and updated_at>=now()-interval '15 minutes')=0,'old device is not fresh';
 update lumen.internal_capabilities set expires_at=now()-interval '1 second' where user_id=admin;
 begin perform public.lumen_admin_cockpit();raise exception 'expired admin read';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('anon','public.lumen_admin_cockpit(integer)','EXECUTE');
 assert not has_function_privilege('authenticated','lumen_commands.service_activity(integer)','EXECUTE');
 assert not has_function_privilege('authenticated','lumen_commands.cockpit_events(integer)','EXECUTE');
end $$;
rollback;
