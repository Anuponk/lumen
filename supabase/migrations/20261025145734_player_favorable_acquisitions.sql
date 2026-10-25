-- #391: product-approved recovery of positive facts. No automatic money grant,
-- command replay, receipt rewrite, old-writer bypass, or existing-row backfill.
-- Apply only with the reviewed client, after separate production approval.
create table lumen_commands.acquisition_recovery_sources (
 user_id uuid not null references auth.users(id) on delete cascade,
 digest bytea not null,
 source jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,digest)
);
alter table lumen_commands.acquisition_recovery_sources enable row level security;
revoke all on lumen_commands.acquisition_recovery_sources from public,anon,authenticated;

-- A saved Mastery flag is grandfathered. Never derive it by combining component
-- badges from different runs. Unknown local fields stay in the original archive.
create function lumen_commands.recover_positive_flags(l jsonb,r jsonb,badges_only boolean default false)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=case when jsonb_typeof(r)='object' then r else '{}' end;e record;
begin
 if jsonb_typeof(l) is distinct from 'object' then return result;end if;
 for e in select key,value from jsonb_each(l) loop
  if (not badges_only or e.key=any(array['autonomy','speed','noError','mastery']))
   and e.value in ('true'::jsonb,'1'::jsonb)
   and coalesce(result->e.key,'null') in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'true'::jsonb,'1'::jsonb)
  then result:=result||jsonb_build_object(e.key,case when badges_only then 'true'::jsonb else e.value end);end if;
 end loop;
 return result;
end $$;

create function lumen_commands.recover_performance(l jsonb,r jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb:=case when jsonb_typeof(r)='object' then r else '{}' end;
 winner jsonb;lb numeric;rb numeric;lt numeric;rt numeric;k text;day_l text;at_l timestamptz;at_r timestamptz;
begin
 if jsonb_typeof(l) is distinct from 'object' then return result;end if;
 -- Select one coherent run for time/assistance/errors; independent best-time
 -- and cumulative badge summaries are not evidence of a new qualifying run.
 foreach k in array array['bestTime','time','seconds'] loop
  if jsonb_typeof(l->k)='number' and (l->>k)::numeric>=0 and (l->>k)::numeric<=9007199254740991
  then lb:=least(lb,(l->>k)::numeric);end if;
  if jsonb_typeof(r->k)='number' and (r->>k)::numeric>=0 and (r->>k)::numeric<=9007199254740991
  then rb:=least(rb,(r->>k)::numeric);end if;
 end loop;
 foreach k in array array['time','seconds'] loop
  if jsonb_typeof(l->k)='number' and (l->>k)::numeric>=0 then lt:=least(lt,(l->>k)::numeric);end if;
  if jsonb_typeof(r->k)='number' and (r->>k)::numeric>=0 then rt:=least(rt,(r->>k)::numeric);end if;
 end loop;
 winner:=case when coalesce(lt,lb) is not null and (coalesce(rt,rb) is null or coalesce(lt,lb)<coalesce(rt,rb)) then l else r end;
 foreach k in array array['time','seconds','hints','mistakes'] loop
  if jsonb_typeof(winner->k)='number' and (winner->>k)::numeric>=0 and (winner->>k)::numeric<=9007199254740991
  then result:=result||jsonb_build_object(k,winner->k);end if;
 end loop;
 foreach k in array array['autoUsed','assisted'] loop
  if jsonb_typeof(winner->k)='boolean' then result:=result||jsonb_build_object(k,winner->k);end if;
 end loop;
 if least(lb,rb) is not null then result:=result||jsonb_build_object('bestTime',least(lb,rb));end if;
 foreach k in array array['attempts','stars'] loop
  if jsonb_typeof(l->k)='number' and (l->>k)::numeric>=0 and (l->>k)::numeric<=2147483647
   and trunc((l->>k)::numeric)=(l->>k)::numeric
   and (r->k is null or jsonb_typeof(r->k)='number')
  then result:=result||jsonb_build_object(k,greatest((l->>k)::numeric,coalesce((r->>k)::numeric,0)));end if;
 end loop;
 if l->'version' in ('2'::jsonb,'3'::jsonb) and (r->'version' is null or r->'version' in ('2'::jsonb,'3'::jsonb))
 then result:=result||jsonb_build_object('version',greatest((l->>'version')::integer,coalesce((r->>'version')::integer,2)));end if;
 if not(result ? 'questIndex') and (l->>'questIndex') ~ '^[0-9]{1,9}$' and jsonb_typeof(l->'questIndex')='number'
 then result:=result||jsonb_build_object('questIndex',l->'questIndex');end if;
 if not(result ? 'quest') and jsonb_typeof(l->'quest')='boolean' then result:=result||jsonb_build_object('quest',l->'quest');end if;
 if not(result ? 'milestone') and l->'milestone' in ('null'::jsonb,'"mid"'::jsonb,'"boss"'::jsonb)
 then result:=result||jsonb_build_object('milestone',l->'milestone');end if;
 result:=result||jsonb_build_object('badges',lumen_commands.recover_positive_flags(l->'badges',r->'badges',true));
 -- Cooldown never moves backwards. Bad timestamps are isolated, not defaulted
 -- into proof of a reward. Keep the associated calendar day from that record.
 begin
  if l->>'lastQualifiedAt' ~ '^\d{4}-\d{2}-\d{2}T' then at_l:=(l->>'lastQualifiedAt')::timestamptz;end if;
 exception when others then at_l:=null;end;
 begin
  if r->>'lastQualifiedAt' ~ '^\d{4}-\d{2}-\d{2}T' then at_r:=(r->>'lastQualifiedAt')::timestamptz;end if;
 exception when others then at_r:=null;end;
 begin
  if (l->>'lastQualifiedDay') ~ '^\d{4}-\d{2}-\d{2}$' and (l->>'lastQualifiedDay')::date::text=l->>'lastQualifiedDay'
  then day_l:=l->>'lastQualifiedDay';end if;
 exception when others then day_l:=null;end;
 if at_l is not null and (at_r is null or at_l>at_r) then
  result:=result||jsonb_build_object('lastQualifiedAt',l->'lastQualifiedAt');
  if day_l is not null then result:=result||jsonb_build_object('lastQualifiedDay',day_l);end if;
 elsif at_l is null and at_r is null and day_l is not null
  and (r->>'lastQualifiedDay' is null or day_l>r->>'lastQualifiedDay')
 then result:=result||jsonb_build_object('lastQualifiedDay',day_l);end if;
 return result;
end $$;

create function lumen_commands.reconcile_acquisitions(p_expected_user_id uuid,p_expected jsonb,p_local jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();p jsonb;before_profile jsonb;result jsonb;e record;q record;
 entry jsonb;saved jsonb;k text;
begin
 if uid is null or uid is distinct from p_expected_user_id then raise insufficient_privilege;end if;
 if jsonb_typeof(p_local) is distinct from 'object' or jsonb_typeof(p_local->'solved') is distinct from 'object'
  or jsonb_typeof(p_local->'badges') is distinct from 'object' or octet_length(p_local::text)>524288
 then raise exception using errcode='22023',message='invalid acquisition source';end if;
 -- Serialize with existing commands/CAS in the same order: snapshot first.
 select payload into p from lumen.profile_snapshots where user_id=uid for update;
 if p is null then raise exception using errcode='22023',message='verified profile required';end if;
 if p is distinct from p_expected then return null;end if;
 before_profile:=p;
 -- Both source snapshots are immutable and content-addressed; a response loss,
 -- duplicate client or second device cannot multiply either effects or archives.
 insert into lumen_commands.acquisition_recovery_sources(user_id,digest,source)
 select uid,sha256(convert_to(source::text,'UTF8')),source from (values(p_local),(p)) originals(source)
 on conflict(user_id,digest) do nothing;
 foreach k in array array['badges','stars','noHint','historyBackup','challenges'] loop
  if jsonb_typeof(p_local->k)='object' then
   p:=jsonb_set(p,array[k],lumen_commands.recover_positive_flags(p_local->k,p->k));
  end if;
 end loop;
 -- Only catalogue-recognized quest identities become playable acquisitions.
 -- Unknown historical IDs remain archived, ready for a compatible future client.
 for q in select quest_id,legacy_index,rules from lumen_commands.quest_rules loop
  if q.legacy_index is not null then
   k:=q.legacy_index::text;
   if p_local->'solved'->k in ('true'::jsonb,'1'::jsonb) then
    p:=jsonb_set(p,'{solved}',coalesce(p->'solved','{}')||jsonb_build_object(k,1));
   end if;
   if jsonb_typeof(p_local->'performances'->k)='object' then
    p:=jsonb_set(p,'{performances}',coalesce(p->'performances','{}')||jsonb_build_object(k,
     lumen_commands.recover_performance(p_local->'performances'->k,p->'performances'->k)));
   end if;
  end if;
  entry:=p_local->'canonicalQuestState'->q.quest_id;saved:=p->'canonicalQuestState'->q.quest_id;
  if jsonb_typeof(entry)='object' and entry->'solved' in ('true'::jsonb,'1'::jsonb) then
   if saved is null or jsonb_typeof(saved)='object' and coalesce(saved->'solved','false') in ('false'::jsonb,'0'::jsonb,'null'::jsonb) then
    -- Adopt only interpreted fields; do not promote unknown local properties
    -- into transactional evidence. The full original remains in the archive.
    saved:=coalesce(saved,'{}')||jsonb_build_object('solved',true,'badges',lumen_commands.recover_positive_flags(entry->'badges',saved->'badges',true));
    if jsonb_typeof(entry->'stars')='number' and (entry->>'stars')::numeric>=0
     and (entry->>'stars')::numeric<=(q.rules->>'stars')::numeric
     and trunc((entry->>'stars')::numeric)=(entry->>'stars')::numeric
    then saved:=saved||jsonb_build_object('stars',entry->'stars');end if;
    if jsonb_typeof(entry->'performance')='object' then
     saved:=saved||jsonb_build_object('performance',lumen_commands.recover_performance(entry->'performance','{}'));
    end if;
   end if;
   if jsonb_typeof(saved)='object' and saved->'solved' in ('true'::jsonb,'1'::jsonb) then
    if q.legacy_index is not null then
     p:=jsonb_set(p,'{solved}',coalesce(p->'solved','{}')||jsonb_build_object(q.legacy_index::text,1));
     p:=jsonb_set(p,'{performances}',coalesce(p->'performances','{}')||jsonb_build_object(q.legacy_index::text,
      lumen_commands.recover_performance(coalesce(entry->'runPerformance',entry->'performance','{}')||jsonb_build_object('badges',entry->'badges'),p->'performances'->q.legacy_index::text)));
    end if;
    saved:=saved||jsonb_build_object('badges',lumen_commands.recover_positive_flags(entry->'badges',saved->'badges',true));
    if jsonb_typeof(entry->'runPerformance')='object' or jsonb_typeof(entry->'performance')='object' then
     saved:=saved||jsonb_build_object('runPerformance',lumen_commands.recover_performance(
      coalesce(entry->'runPerformance',entry->'performance'),coalesce(saved->'runPerformance',saved->'performance','{}')));
    end if;
    p:=jsonb_set(p,'{canonicalQuestState}',coalesce(p->'canonicalQuestState','{}')||jsonb_build_object(q.quest_id,saved));
   end if;
  end if;
 end loop;
 -- One-way UI markers and existing compatibility grants are not transactions.
 foreach k in array array['autonomySeen','fullBadgeIntroSeen','autoCrossUnlockSeen','speedBadgeIntroSeen'] loop
  if p_local->k in ('true'::jsonb,'1'::jsonb) then p:=p||jsonb_build_object(k,1);end if;
 end loop;
 -- Non-spendable cumulative summaries keep their existing lower-bound max
 -- policy. Do not sum them or infer missing monetary rewards from completion.
 foreach k in array array['xp','skyScore'] loop
  if jsonb_typeof(p_local->k)='number' and (p_local->>k) ~ '^[0-9]{1,15}$'
   and (p->k is null or jsonb_typeof(p->k)='number')
  then p:=p||jsonb_build_object(k,greatest((p_local->>k)::bigint,coalesce((p->>k)::bigint,0)));end if;
 end loop;
 if jsonb_typeof(p_local->'autonomousWins')='number' and (p_local->>'autonomousWins') ~ '^[0-9]{1,9}$'
  and (p->'autonomousWins' is null or jsonb_typeof(p->'autonomousWins')='number')
 then p:=p||jsonb_build_object('autonomousWins',greatest((p_local->>'autonomousWins')::integer,coalesce((p->>'autonomousWins')::integer,0)));end if;
 if jsonb_typeof(p_local->'legacyAdventureAccess')='array' then
  select coalesce(jsonb_agg(value order by value),'[]') into result from (
   select distinct value from jsonb_array_elements(p_local->'legacyAdventureAccess') where jsonb_typeof(value)='string'
   union select value from jsonb_array_elements(coalesce(p->'legacyAdventureAccess','[]'))
  ) grants;
  p:=p||jsonb_build_object('legacyAdventureAccess',result);
 end if;
 if octet_length(p::text)>524288 then raise exception using errcode='22023',message='recovered profile too large';end if;
 if p is distinct from before_profile then
  -- Trusted recovery changes only positive projections. Keep ALL immutable
  -- receipts, spendable currency, daily, origins and command cursors intact.
  -- The ordinary snapshot guards remain active and verify these projections.
  update lumen_commands.legacy_authority set projection=lumen_commands.legacy_projection(p) where user_id=uid;
  for e in select key,value from jsonb_each(coalesce(p->'canonicalQuestState','{}')) loop
   if e.value ? 'runPerformance' then
    insert into lumen_commands.quest_run_authority(user_id,quest_id,projection) values(uid,e.key,e.value)
    on conflict(user_id,quest_id) do update set projection=excluded.projection;
   else
    update lumen_commands.quest_run_authority set projection=e.value where user_id=uid and quest_id=e.key;
   end if;
  end loop;
  update lumen.profile_snapshots set payload=p,saved_at=now() where user_id=uid;
 end if;
 return jsonb_build_object('policy','positive-acquisitions-v1','userId',uid,'profile',p);
end $$;
create function public.lumen_reconcile_acquisitions(p_expected_user_id uuid,p_expected jsonb,p_local jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select lumen_commands.reconcile_acquisitions(p_expected_user_id,p_expected,p_local);
$$;
revoke all on function lumen_commands.recover_positive_flags(jsonb,jsonb,boolean),lumen_commands.recover_performance(jsonb,jsonb),
 lumen_commands.reconcile_acquisitions(uuid,jsonb,jsonb),public.lumen_reconcile_acquisitions(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function lumen_commands.reconcile_acquisitions(uuid,jsonb,jsonb),public.lumen_reconcile_acquisitions(uuid,jsonb,jsonb) to authenticated;
