-- Synthetic human/QA/ambiguous events only; never player data.
do $$
declare admin uuid:=gen_random_uuid();actor uuid:=gen_random_uuid();q text;ordinal integer;metrics jsonb;timeline jsonb;row jsonb;
begin
 insert into auth.users values(admin),(actor);
 insert into lumen.internal_capabilities(user_id,capability) values(admin,'analytics_cockpit');
 select quest_id,(rules->>'ordinal')::integer into q,ordinal from lumen_commands.quest_rules where legacy_index is null order by (rules->>'ordinal')::integer limit 1;
 insert into lumen.analytics_events(user_id,anonymous_id,event_name,puzzle_id,session_id,properties) values
 (actor,'actor-522','attempt_started',null,'session-522',jsonb_build_object('traffic_type','human','stable_quest_id',q)),
 (actor,'actor-522','attempt_completed',null,'session-522',jsonb_build_object('traffic_type','human','stable_quest_id',q,'active_seconds',45)),
 (actor,'actor-522','hint_used',null,'session-522',jsonb_build_object('traffic_type','human','stable_quest_id',q)),
 (actor,'actor-522','attempt_started',39,'session-522','{"traffic_type":"human"}'),
 (null,'bot-522','attempt_started',null,'bot',jsonb_build_object('traffic_type','automation','stable_quest_id',q)),
 (null,'qa-522','attempt_started',null,'qa',jsonb_build_object('traffic_type','human','qa_mode','new','stable_quest_id',q)),
 (null,'ambiguous-522','attempt_started',null,'legacy',jsonb_build_object('stable_quest_id',q)),
 (actor,'actor-522','attempt_started',1,'conflict',jsonb_build_object('traffic_type','human','stable_quest_id',q));
 perform set_config('request.jwt.claim.sub',actor::text,true);
 begin perform public.lumen_admin_quest_metrics();raise exception 'player read admin metrics';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 metrics:=public.lumen_admin_quest_metrics();
 select value into row from jsonb_array_elements(metrics->'friction') where value->>'stable_quest_id'=q;
 assert row->>'started'='1' and row->>'completed'='1' and row->>'hints'='1';
 assert row->>'quest_ordinal'=ordinal::text and row->'puzzle_id'='null' and row->>'median_seconds'='45';
 assert exists(select 1 from jsonb_array_elements(metrics->'friction') where value->>'stable_quest_id'='base-q039'),'numeric history resolves its original stable grid';
 timeline:=public.lumen_admin_quest_timeline('u:'||actor::text);
 assert exists(select 1 from jsonb_array_elements(timeline) where value->>'stable_quest_id'=q and value->>'quest_ordinal'=ordinal::text);
 assert not has_function_privilege('anon','public.lumen_admin_quest_metrics(integer)','EXECUTE');
 assert not has_function_privilege('authenticated','lumen_commands.quest_analytics(integer)','EXECUTE');
 update lumen.internal_capabilities set expires_at=now()-interval '1 second' where user_id=admin;
 begin perform public.lumen_admin_quest_timeline('u:'||actor::text);raise exception 'expired admin retained access';exception when insufficient_privilege then null;end;
end $$;
