-- #638: additive timing evidence; old immutable receipts remain valid.
-- No player row, score, wallet, badge or historical receipt is updated here.
begin;
set local lock_timeout='5s';

create or replace function lumen_commands.official_time(f jsonb,revision integer)
returns integer language plpgsql immutable security invoker set search_path='' as $$
declare t jsonb:=f->'timing';c jsonb;h integer;v integer;g integer;k text;
begin
 if t is null then return null;end if;
 if jsonb_typeof(t)<>'object' or not(t ?& array['version','gridRevision','helpUses'])
  or exists(select 1 from jsonb_object_keys(t) x where x not in ('version','gridRevision','helpUses'))
  or t->'version' is distinct from '1'::jsonb or t->'gridRevision' is distinct from to_jsonb(revision)
 then raise invalid_parameter_value using message='invalid official timing identity';end if;
 c:=t->'helpUses';
 if jsonb_typeof(c)<>'object' or not(c ?& array['hint','verify','guided'])
  or exists(select 1 from jsonb_object_keys(c) x where x not in ('hint','verify','guided')) then raise invalid_parameter_value;end if;
 foreach k in array array['hint','verify','guided'] loop
  if jsonb_typeof(c->k)<>'number' or c->>k !~ '^[0-9]{1,5}$' then raise invalid_parameter_value;end if;
 end loop;
 h:=(c->>'hint')::integer;v:=(c->>'verify')::integer;g:=(c->>'guided')::integer;
 if h>10000 or v+g>10000 or h>0 and not(f->>'hintUsed')::boolean
  or h+v+g>0 and not(f->>'assistanceUsed')::boolean then raise invalid_parameter_value;end if;
 return (f->>'seconds')::integer+h*15+(v+g)*5;
end $$;

create or replace function lumen_commands.merge_official_times(a jsonb,b jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:='{}';k text;v jsonb;
begin
 if a is not null and jsonb_typeof(a)<>'object' or b is not null and jsonb_typeof(b)<>'object' then raise invalid_parameter_value;end if;
 for k,v in select key,value from jsonb_each(coalesce(a,'{}')) union all select key,value from jsonb_each(coalesce(b,'{}')) loop
  if k !~ '^(0|[1-9][0-9]{0,8})$' or jsonb_typeof(v)<>'number' or v #>> '{}' !~ '^[0-9]{1,10}$' then raise invalid_parameter_value;end if;
  result:=jsonb_set(result,array[k],lumen_commands.personal_record_min(result->k,v));
 end loop;
 return result;
end $$;

create or replace function lumen_commands.official_prior(old jsonb,u uuid,q text,revision integer)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare prior jsonb;competitive record;historic jsonb;
begin
 prior:=coalesce(old->'officialTimes','{}');
 if not(old ? 'officialTimes') then
  select s.seconds,s.penalty,s.score into competitive from lumen_commands.ranking_scores s where s.user_id=u and s.quest_id=q and s.grid_revision=revision;
  -- Legacy raw minima have no revision proof beyond the original grid.
  -- A known penalized competitive raw value is never imported as unassisted.
  if revision=0 then
   historic:=lumen_commands.personal_record_min(old->'bestTime',null);
   if competitive.penalty>0 and historic=to_jsonb(competitive.seconds) then historic:=lumen_commands.personal_record_min(old->'bestUnassistedTime',null);end if;
  end if;
  historic:=lumen_commands.personal_record_min(historic,to_jsonb(competitive.score));
  if historic is not null then prior:=jsonb_build_object(revision::text,historic);end if;
 end if;
 return prior;
end $$;

create or replace function lumen_commands.official_records(old jsonb,f jsonb,u uuid,q text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare revision integer;score integer;prior jsonb;
begin
 select grid_revision into revision from lumen_commands.quest_rules where quest_id=q;
 score:=lumen_commands.official_time(f,revision);
 if score is null then return '{}';end if;
 prior:=lumen_commands.official_prior(old,u,q,revision);
 return jsonb_build_object('officialTimes',lumen_commands.merge_official_times(prior,jsonb_build_object(revision::text,score)));
end $$;

do $migration$
declare definition text;signature text;needle text;replacement text;
begin
 foreach signature in array array['lumen_commands.commit_legacy(text,uuid,text,jsonb)','lumen_commands.commit_quest(text,uuid,text,jsonb)'] loop
  select pg_get_functiondef(signature::regprocedure) into definition;
  needle:=$source$'hintUsed','challengeFailed','qualifiedDay','qualifiedAt'))$source$;
  replacement:=$source$'hintUsed','challengeFailed','qualifiedDay','qualifiedAt','timing'))$source$;
  if strpos(definition,replacement)=0 then
   if strpos(definition,needle)=0 then raise exception 'Timing facts contract changed: %',signature;end if;
   definition:=replace(definition,needle,replacement);
  end if;
  if signature like '%commit_legacy%' then
   needle:=$source$v_profile:=jsonb_set(v_profile,array['performances',v_key],v_saved);$source$;
   replacement:=$source$if p_facts ? 'timing' then v_old:=v_old||jsonb_build_object('officialTimes',lumen_commands.official_prior(v_old,v_uid,p_quest_id,(p_facts#>>'{timing,gridRevision}')::integer));end if;
 v_saved:=v_saved||lumen_commands.official_records(v_old,p_facts,v_uid,p_quest_id);
 v_profile:=jsonb_set(v_profile,array['performances',v_key],v_saved);$source$;
  else
   needle:=$source$xp:=coalesce((p->>'xp')::bigint,0);balance:=coalesce((p->>'shards')::bigint,0);wins:=coalesce((p->>'autonomousWins')::bigint,0);$source$;
   replacement:=$source$if p_facts ? 'timing' then old:=old||jsonb_build_object('officialTimes',lumen_commands.official_prior(old,uid,p_quest_id,(p_facts#>>'{timing,gridRevision}')::integer));end if;
 performance:=performance||lumen_commands.official_records(old,p_facts,uid,p_quest_id);
 xp:=coalesce((p->>'xp')::bigint,0);balance:=coalesce((p->>'shards')::bigint,0);wins:=coalesce((p->>'autonomousWins')::bigint,0);$source$;
  end if;
  if strpos(definition,'||lumen_commands.official_records(')=0 then
   if strpos(definition,needle)=0 then raise exception 'Timing projection source changed: %',signature;end if;
   definition:=replace(definition,needle,replacement);
  end if;
  execute definition;
 end loop;
 select pg_get_functiondef('lumen_commands.recover_performance(jsonb,jsonb)'::regprocedure) into definition;
 needle:=$source$return result;$source$;
 replacement:=$source$if l ? 'officialTimes' or r ? 'officialTimes' then result:=result||jsonb_build_object('officialTimes',lumen_commands.merge_official_times(l->'officialTimes',r->'officialTimes'));end if;
 return result;$source$;
 if strpos(definition,'lumen_commands.merge_official_times')=0 then
  if strpos(definition,needle)=0 then raise exception 'Timing recovery source changed';end if;
  execute replace(definition,needle,replacement);
 end if;
 select pg_get_functiondef('lumen_commands.ranking_finish(text,integer,integer)'::regprocedure) into definition;
 needle:=$source$raw:=(facts->>'seconds')::integer;$source$;
 replacement:=$source$if facts ? 'timing' then
  perform lumen_commands.official_time(facts,r.grid_revision);
  if p_hint_uses<>(facts#>>'{timing,helpUses,hint}')::integer or p_verify_uses<>(facts#>>'{timing,helpUses,verify}')::integer+(facts#>>'{timing,helpUses,guided}')::integer then raise invalid_parameter_value;end if;
 end if;
 raw:=(facts->>'seconds')::integer;$source$;
 if strpos(definition,$source$if facts ? 'timing'$source$)=0 then
  if strpos(definition,needle)=0 then raise exception 'Ranking timing source changed';end if;
  execute replace(definition,needle,replacement);
 end if;
end $migration$;

-- Read-only historical projection. Private records never depend on public opt-in.
create or replace function lumen_commands.get_official_records(q text,revision integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid();p jsonb;old jsonb;idx integer;current_revision integer;
begin
 if u is null then raise insufficient_privilege;end if;
 select legacy_index,grid_revision into idx,current_revision from lumen_commands.quest_rules where quest_id=q;
 if not found or revision is distinct from current_revision then raise invalid_parameter_value;end if;
 select payload into p from lumen.profile_snapshots where user_id=u;
 old:=case when idx is null then coalesce(p#>array['canonicalQuestState',q,'runPerformance'],p#>array['canonicalQuestState',q,'performance'],'{}') else coalesce(p#>array['performances',idx::text],'{}') end;
 return jsonb_build_object('officialTimes',lumen_commands.official_prior(old,u,q,revision));
end $$;
create or replace function public.lumen_get_official_records(p_quest_id text,p_grid_revision integer)
returns jsonb language sql stable security invoker set search_path='' as $$select lumen_commands.get_official_records(p_quest_id,p_grid_revision)$$;
revoke all on function lumen_commands.get_official_records(text,integer),public.lumen_get_official_records(text,integer) from public,anon;
grant execute on function lumen_commands.get_official_records(text,integer),public.lumen_get_official_records(text,integer) to authenticated;

create or replace function public.lumen_official_time_version() returns integer
language sql stable security invoker set search_path='' as $$ select 1 where auth.uid() is not null $$;
revoke all on function public.lumen_official_time_version() from public,anon;
grant execute on function public.lumen_official_time_version() to authenticated;
revoke all on function lumen_commands.official_time(jsonb,integer),lumen_commands.official_records(jsonb,jsonb,uuid,text),lumen_commands.official_prior(jsonb,uuid,text,integer),lumen_commands.merge_official_times(jsonb,jsonb) from public,anon,authenticated;
-- Never import a post-rollout raw minimum as an unassisted historical time.
-- The earliest immutable versioned receipt freezes the comparable old baseline.
create or replace view lumen_commands.ranking_history_candidates with (security_invoker=true) as
with snapshots as (
 select user_id,payload,'cloud'::text as source from lumen.profile_snapshots
 union all select user_id,projection,'legacy_authority' from lumen_commands.legacy_authority
), records as (
 select s.user_id,s.source,e.key as reference,false as canonical,e.value as record from snapshots s cross join lateral jsonb_each(coalesce(s.payload->'performances','{}')) e where not(e.value ? 'officialTimes')
 union all
 select s.user_id,s.source,e.key,true,coalesce(e.value->'runPerformance','{}') from snapshots s cross join lateral jsonb_each(coalesce(s.payload->'canonicalQuestState','{}')) e where not(coalesce(e.value->'runPerformance','{}') ? 'officialTimes')
 union all
 select r.user_id,'official_baseline',r.request->>'questId',true,jsonb_build_object('bestTime',r.outcome#>'{priorPerformance,officialTimes,0}')
 from (
  select distinct on (user_id,request->>'questId') user_id,request,outcome,recorded_at,operation_id
  from (
   select user_id,request,outcome,recorded_at,operation_id from lumen_commands.legacy_receipts where request->'facts' ? 'timing'
   union all select user_id,request,outcome,recorded_at,operation_id from lumen_commands.canonical_receipts where request->'facts' ? 'timing'
  ) receipts
  order by user_id,request->>'questId',recorded_at,(outcome->>'attempts')::bigint,operation_id
 ) r where r.request#>'{facts,timing,gridRevision}'='0'::jsonb
 union all
 select h.user_id,'historical_badges',(h.puzzle_id-1)::text,false,'{}'::jsonb from lumen.historical_performance h
), identified as (
 select r.*,q.quest_id,q.grid_revision,
 case when jsonb_typeof(r.record->'bestTime')='number' and r.record->>'bestTime' ~ '^[0-9]{1,6}$' then (r.record->>'bestTime')::integer end as seconds
 from records r left join lumen_commands.quest_rules q on
 (r.canonical and q.quest_id=r.reference) or (not r.canonical and q.legacy_index::text=r.reference)
)
select i.*,case
 when i.user_id is null then 'unlinked_identity'
 when not exists(select 1 from auth.users a where a.id=i.user_id) then 'deleted_account'
 when p.ranking_opted_out then 'participation_disabled'
 when not coalesce(p.nickname_ready,false) then 'nickname_required'
 when not exists(select 1 from lumen_commands.ranking_members m where m.user_id=i.user_id and m.participating) then 'not_participating'
 when i.quest_id is null then 'unknown_quest'
 when i.grid_revision<>0 then 'ambiguous_revision'
 when i.seconds is null or i.seconds>86400 then 'missing_or_invalid_time'
 else null end as exclusion
from identified i left join lumen.profiles p on p.user_id=i.user_id;
revoke all on lumen_commands.ranking_history_candidates from public,anon,authenticated,service_role;

commit;
