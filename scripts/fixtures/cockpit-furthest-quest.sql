-- Synthetic events in disposable PostgreSQL only. No player-save mutation.
do $$
declare
 admin uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid();
 low_q text; high_q text; high_ordinal integer; low_ordinal integer;
 metrics jsonb; timeline jsonb; before_events bigint; before_friction jsonb;
begin
 insert into auth.users values(admin),(actor);
 insert into lumen.internal_capabilities(user_id,capability) values(admin,'analytics_cockpit');
 select quest_id,(rules->>'ordinal')::integer into high_q,high_ordinal
 from lumen_commands.quest_rules where legacy_index is null
 order by (rules->>'ordinal')::integer desc limit 1;
 select quest_id,(rules->>'ordinal')::integer into low_q,low_ordinal
 from lumen_commands.quest_rules where legacy_index is not null
 order by (rules->>'ordinal')::integer limit 1;
 assert high_ordinal>low_ordinal,'fixture requires ordered catalogue quests';
 perform set_config('request.jwt.claim.sub',admin::text,true);
 select f into before_friction from jsonb_array_elements(public.lumen_admin_quest_metrics(1)->'friction') f
 where f->>'stable_quest_id'=high_q;
 -- An older opening on a different browser establishes the furthest point.
 insert into lumen.analytics_events(user_id,anonymous_id,event_name,session_id,occurred_at,properties) values
 (actor,'furthest-device','puzzle_start','older',now()-interval '30 days',
  jsonb_build_object('traffic_type','human','stable_quest_id',high_q)),
 (actor,'replay-device','attempt_started','newer',now()-interval '1 minute',
  jsonb_build_object('traffic_type','human','stable_quest_id',low_q)),
 (actor,'replay-device','attempt_completed','newer',now(),
  jsonb_build_object('traffic_type','human','stable_quest_id',low_q)),
 (null,'qa-furthest','puzzle_start','qa',now(),
  jsonb_build_object('traffic_type','human','qa_mode','new','stable_quest_id',high_q)),
 (null,'bot-furthest','puzzle_start','bot',now(),
  jsonb_build_object('traffic_type','automation','stable_quest_id',high_q)),
 (null,'unknown-furthest','puzzle_start','unknown',now(),
  jsonb_build_object('stable_quest_id',high_q));
 select count(*) into before_events from lumen.analytics_events;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.lumen_admin_quest_metrics();raise exception 'ordinary player read metrics';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 metrics:=public.lumen_admin_quest_metrics(1);
 assert metrics->'current_players'->>('u:'||actor::text)=high_ordinal::text,
  'later lower replay must retain the furthest lifetime catalogue ordinal';
 assert not (metrics->'current_players' ? 'a:qa-furthest');
 assert not (metrics->'current_players' ? 'a:bot-furthest');
 assert not (metrics->'current_players' ? 'a:unknown-furthest');
 assert (select f from jsonb_array_elements(metrics->'friction') f
  where f->>'stable_quest_id'=high_q) is not distinct from before_friction,
  'friction still respects its reporting window';
 timeline:=public.lumen_admin_quest_timeline('u:'||actor::text);
 assert timeline->0->>'quest_ordinal'=low_ordinal::text,'timeline remains chronological';
 assert public.lumen_admin_quest_metrics(1)=metrics,'repeated reads are stable';
 assert (select count(*) from lumen.analytics_events)=before_events,'read must preserve events';
 assert not has_function_privilege('anon','public.lumen_admin_quest_metrics(integer)','EXECUTE');
 update lumen.internal_capabilities set expires_at=now()-interval '1 second' where user_id=admin;
 begin perform public.lumen_admin_quest_metrics();raise exception 'expired admin read metrics';
 exception when insufficient_privilege then null;end;
end $$;
