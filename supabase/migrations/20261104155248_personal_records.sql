-- #600: metadata from NEW completed runs only. No backfill, wallet, badge,
-- qualification, receipt or reward changes. No player rows are updated here.
-- Source guards stop the migration if deployed command bodies differ.
begin;
create function lumen_commands.personal_record_min(a jsonb,b jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select to_jsonb(min(case when jsonb_typeof(v)='number' then
  case when (v #>> '{}')::numeric between 0 and 9007199254740991 then (v #>> '{}')::numeric end end))
 from (values(a),(b)) t(v);
$$;
revoke all on function lumen_commands.personal_record_min(jsonb,jsonb) from public,anon;
grant execute on function lumen_commands.personal_record_min(jsonb,jsonb) to authenticated;

do $migration$
declare definition text;needle text;replacement text;
begin
 select pg_get_functiondef('lumen_commands.commit_legacy(text,uuid,text,jsonb)'::regprocedure) into definition;
 needle:=$source$v_profile:=jsonb_set(v_profile,array['performances',v_key],v_saved);$source$;
 replacement:=$source$v_saved:=v_saved-'bestUnassistedTime';
 if lumen_commands.personal_record_min(v_old->'bestUnassistedTime',case when not v_assisted and not v_hint then to_jsonb(v_seconds) end) is not null then
  v_saved:=v_saved||jsonb_build_object('bestUnassistedTime',lumen_commands.personal_record_min(v_old->'bestUnassistedTime',case when not v_assisted and not v_hint then to_jsonb(v_seconds) end));
 end if;
 v_profile:=jsonb_set(v_profile,array['performances',v_key],v_saved);$source$;
 if strpos(definition,needle)=0 then raise exception 'Legacy command source changed; review personal records migration';end if;
 execute replace(definition,needle,replacement);

 select pg_get_functiondef('lumen_commands.commit_quest(text,uuid,text,jsonb)'::regprocedure) into definition;
 needle:=$source$xp:=coalesce((p->>'xp')::bigint,0);balance:=coalesce((p->>'shards')::bigint,0);wins:=coalesce((p->>'autonomousWins')::bigint,0);$source$;
 replacement:=$source$performance:=performance-'bestUnassistedTime';
 if lumen_commands.personal_record_min(old->'bestUnassistedTime',case when not assisted and not hint then to_jsonb(seconds) end) is not null then
  performance:=performance||jsonb_build_object('bestUnassistedTime',lumen_commands.personal_record_min(old->'bestUnassistedTime',case when not assisted and not hint then to_jsonb(seconds) end));
 end if;
 xp:=coalesce((p->>'xp')::bigint,0);balance:=coalesce((p->>'shards')::bigint,0);wins:=coalesce((p->>'autonomousWins')::bigint,0);$source$;
 if strpos(definition,needle)=0 then raise exception 'Quest command source changed; review personal records migration';end if;
 execute replace(definition,needle,replacement);

 select pg_get_functiondef('lumen_commands.recover_performance(jsonb,jsonb)'::regprocedure) into definition;
 needle:=$source$return result;$source$;
 replacement:=$source$result:=result-'bestUnassistedTime';
 if lumen_commands.personal_record_min(l->'bestUnassistedTime',r->'bestUnassistedTime') is not null then
  result:=result||jsonb_build_object('bestUnassistedTime',lumen_commands.personal_record_min(l->'bestUnassistedTime',r->'bestUnassistedTime'));
 end if;
 return result;$source$;
 if strpos(definition,needle)=0 then raise exception 'Acquisition recovery source changed; review personal records migration';end if;
 execute replace(definition,needle,replacement);
end $migration$;
commit;
