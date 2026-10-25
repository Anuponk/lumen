-- #534 lot 2: closed administrative read model over existing telemetry only.
create index if not exists analytics_admin_user_time_idx on lumen.analytics_events(user_id,occurred_at desc);
create index if not exists analytics_admin_guest_time_idx on lumen.analytics_events(anonymous_id,occurred_at desc) where user_id is null;
create index if not exists diagnostic_admin_user_time_idx on lumen_commands.diagnostic_events(user_id,received_at desc);
create function lumen_commands.admin_player_sessions(p_player_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid;guest text;result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from lumen.internal_capabilities c where c.user_id=auth.uid()
  and c.capability='analytics_cockpit' and (c.expires_at is null or c.expires_at>now()))
 then raise exception using errcode='42501',message='analytics_cockpit capability required';end if;
 if p_player_key ~ '^u:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
  select lu.user_id into uid from lumen.users lu where lu.user_id=substr(p_player_key,3)::uuid;
 elsif p_player_key ~ '^a:[A-Za-z0-9._-]{1,120}$' then guest:=substr(p_player_key,3);
 else raise exception using errcode='22023',message='invalid player key';end if;
 with recent as (
  select e.session_id,e.event_name,e.occurred_at,e.puzzle_id,e.properties from lumen.analytics_events e
  where ((uid is not null and e.user_id=uid) or (guest is not null and e.user_id is null and e.anonymous_id=guest))
   and e.occurred_at>=now()-interval '90 days'
   and coalesce(e.properties->>'qa_mode','')='' and e.properties->>'traffic_type'='human'
   and e.event_name in ('session_start','attempt_started','puzzle_start','attempt_completed','puzzle_complete','attempt_reset','attempt_abandoned','hint_used','verify_used','guided_intervention','tutorial_complete')
  order by e.occurred_at desc,e.session_id,e.event_name limit 100
 ), analytics as (
  select case when r.session_id ~* '^([0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9]{13}-[a-z0-9]{1,20})$' then r.session_id else null end session_id,r.event_name,r.occurred_at,
   case when r.properties->>'app_version' ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\+[0-9]{1,9}$' then r.properties->>'app_version' else 'unknown' end app_version,
   (q.rules->>'ordinal')::integer quest_ordinal
  from recent r left join lumen_commands.quest_rules q on q.quest_id=coalesce(r.properties->>'stable_quest_id',
   (select h.quest_id from lumen_commands.quest_rules h where h.legacy_index=r.puzzle_id-1))
   and (r.properties->>'stable_quest_id' is null or r.puzzle_id is null or q.legacy_index=r.puzzle_id-1)
 ), diagnostics as (
  select d.session_id,d.trace_id,d.sequence,d.occurred_at,d.received_at,d.code,d.stage,d.kind,d.severity,d.app_version,d.platform,d.browser,d.before_state,d.after_state,d.retry
  from lumen_commands.diagnostic_events d
  where d.user_id=uid and d.received_at>=now()-interval '7 days'
   and exists(select 1 from lumen_commands.diagnostic_preferences p where p.user_id=d.user_id and p.enabled)
  order by d.received_at desc,d.sequence desc limit 100
 ) select jsonb_build_object('analytics',coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at,a.session_id,a.event_name) from analytics a),'[]'::jsonb),
  'diagnostics',coalesce((select jsonb_agg(to_jsonb(d) order by d.received_at,d.sequence) from diagnostics d),'[]'::jsonb),
  'partial',true,'observed_at',now()) into result;
 return result;
end $$;
revoke all on function lumen_commands.admin_player_sessions(text) from public,anon;
grant execute on function lumen_commands.admin_player_sessions(text) to authenticated;
create function public.lumen_admin_player_sessions(p_player_key text)
returns jsonb language sql stable security invoker set search_path='' as $$select lumen_commands.admin_player_sessions(p_player_key)$$;
revoke all on function public.lumen_admin_player_sessions(text) from public,anon;
grant execute on function public.lumen_admin_player_sessions(text) to authenticated;
notify pgrst,'reload schema';
