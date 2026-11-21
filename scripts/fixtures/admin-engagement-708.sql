-- #708 Lot C: lumen_admin_engagement on the migrated schema. Synthetic data in
-- disposable PostgreSQL only; everything is rolled back.
do $$begin
 if current_database()<>'lumen_test' and current_setting('lumen.sql_fixture',true) is distinct from '708'
 then raise exception 'Disposable analytics fixture requires an isolated test database';end if;
end $$;
\ir ../../supabase/migrations/20261121160000_admin_engagement_708.sql
\ir ../../supabase/migrations/20261121160000_admin_engagement_708.sql
begin;
do $$
declare admin uuid:=gen_random_uuid();player uuid:=gen_random_uuid();friend uuid:=gen_random_uuid();
 c1 uuid;c2 uuid;before jsonb;after jsonb;r jsonb;day date;quest text;rev integer;
 delta jsonb;
begin
 insert into auth.users(id) values(admin),(player),(friend);
 insert into lumen.internal_capabilities(user_id,capability) values(admin,'analytics_cockpit');

 -- Access: guests and ordinary players are refused, server-side.
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.lumen_admin_engagement(7);raise exception 'guest read engagement';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',player::text,true);
 begin perform public.lumen_admin_engagement(7);raise exception 'player read engagement';exception when insufficient_privilege then null;end;
 assert not has_function_privilege('anon','public.lumen_admin_engagement(integer)','EXECUTE'),'anon cannot even call it';

 perform set_config('request.jwt.claim.sub',admin::text,true);
 before:=public.lumen_admin_engagement(7);

 -- Traffic classes: one human, one QA (also seen as human once), one CI, one undetermined.
 insert into lumen.analytics_events(anonymous_id,session_id,event_name,occurred_at,properties) values
  ('h-708','s1','app_opened',now()-interval '1 hour','{"traffic_type":"human","acquisition_channel":"player_share"}'),
  ('h-708','s1','attempt_started',now()-interval '55 minutes','{"traffic_type":"human","acquisition_channel":"player_share","quest_ordinal":1,"attempt_mode":"campaign"}'),
  ('h-708','s1','attempt_completed',now()-interval '50 minutes','{"traffic_type":"human","acquisition_channel":"player_share","quest_ordinal":1,"attempt_mode":"campaign","outcome":"success","first_completion":true}'),
  ('h2-708','s2','app_opened',now()-interval '2 hours','{"traffic_type":"human","acquisition_channel":"player_share"}'),
  ('q-708','s3','app_opened',now()-interval '1 hour','{"traffic_type":"human","acquisition_channel":"player_invite"}'),
  ('q-708','s3','app_opened',now()-interval '59 minutes','{"traffic_type":"qa"}'),
  ('ci-708','s4','app_opened',now()-interval '1 hour','{"traffic_type":"automated_test","acquisition_channel":"tiktok"}'),
  ('u-708','s5','app_opened',now()-interval '1 hour','{}'),
  ('old-708','s6','app_opened',now()-interval '20 days','{"traffic_type":"human","acquisition_channel":"player_share"}');

 -- Challenges: two created, one sent to a friend, two accepted (one completed, one abandoned).
 insert into lumen.social_challenges(puzzle_id,sender_user_id,sender_display_name,source_duration_seconds) values(1,player,'Ana708',60) returning id into c1;
 insert into lumen.social_challenges(puzzle_id,sender_anonymous_id,sender_display_name,source_duration_seconds) values(2,'guest-708','Bo708',70) returning id into c2;
 insert into lumen.social_challenge_invites(challenge_id,recipient_user_id) values(c1,friend);
 insert into lumen.social_challenge_participations(challenge_id,participant_user_id,participant_key,participant_display_name,status,completed_at,duration_seconds)
  values(c1,friend,'u:'||friend,'Cy708','completed',now(),55),(c2,null,'a:guest-2','Di708','abandoned',now(),null);

 -- Défi du jour: one completed run.
 select p.day,p.quest_id,p.grid_revision into day,quest,rev from lumen_commands.daily_puzzles p order by p.day limit 1;
 insert into lumen_commands.daily_runs(user_id,day,operation_id,quest_id,grid_revision,status,seconds,hint,verify,guided,score,finished_at)
  values(player,day,'op-708',quest,rev,'completed',90,0,0,0,90,now());

 after:=public.lumen_admin_engagement(7);
 delta:=jsonb_build_object(
  'human',(after->'traffic'->>'human')::int-(before->'traffic'->>'human')::int,
  'qa',(after->'traffic'->>'qa')::int-(before->'traffic'->>'qa')::int,
  'automated_test',(after->'traffic'->>'automated_test')::int-(before->'traffic'->>'automated_test')::int,
  'undetermined',(after->'traffic'->>'undetermined')::int-(before->'traffic'->>'undetermined')::int);
 assert delta=jsonb_build_object('human',2,'qa',1,'automated_test',1,'undetermined',1),'traffic classes by priority: '||delta::text;

 select x into r from jsonb_array_elements(after->'acquisition') x where x->>'channel'='player_share';
 assert (r->>'opened')::int>=2 and (r->>'q1_started')::int>=1 and (r->>'q1_completed')::int>=1,'player_share funnel: '||coalesce(r::text,'none');
 assert not exists(select 1 from jsonb_array_elements(after->'acquisition') x where x->>'channel' in ('tiktok','player_invite')
  and (x->>'opened')::int>coalesce((select (y->>'opened')::int from jsonb_array_elements(before->'acquisition') y where y->>'channel'=x->>'channel'),0)),
  'QA and CI identifiers never enter the acquisition funnel';

 assert (after->'challenges'->>'created')::int-(before->'challenges'->>'created')::int=2,'challenges created';
 assert (after->'challenges'->>'sent_to_friends')::int-(before->'challenges'->>'sent_to_friends')::int=1,'sent to friends';
 assert (after->'challenges'->>'accepted')::int-(before->'challenges'->>'accepted')::int=2,'accepted';
 assert (after->'challenges'->>'completed')::int-(before->'challenges'->>'completed')::int=1,'completed';
 assert (after->'challenges'->>'abandoned')::int-(before->'challenges'->>'abandoned')::int=1,'abandoned';
 assert (after->'challenges'->>'guest_participations')::int-(before->'challenges'->>'guest_participations')::int=1,'guest participation';
 assert (after->'daily'->>'completed')::int-coalesce((before->'daily'->>'completed')::int,0)=1,'daily completed run';
 assert (after->'daily'->>'flag_enabled')::boolean=false,'daily flag reported as is';
 assert (after->'retention_by_channel'->>'measurable')::boolean=false,'retention by channel is never invented';

 -- Privacy: aggregates only.
 assert after::text !~ '[0-9a-f]{8}-[0-9a-f]{4}-' and after::text !~ 'Ana708|Cy708|@|h-708|guest-708','no identifier or nickname';
 -- Period bounds.
 r:=public.lumen_admin_engagement(100000);assert (r->>'days')::int=3650,'period capped';
 r:=public.lumen_admin_engagement(0);assert (r->>'days')::int=1,'period floor';
end $$;
rollback;
