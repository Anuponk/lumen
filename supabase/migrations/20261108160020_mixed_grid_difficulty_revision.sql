-- Prepared content metadata and version-aware writers. No player reset and no
-- revision-2 activation here. Activate the reviewed manifest separately only
-- after the matching client is available. Existing revision-0/1 play continues.
alter table lumen_commands.quest_rules add column grid_revision integer not null default 0 check(grid_revision>=0);

-- BEGIN PREVIOUS GRID REVISIONS
do $seed$ declare expected jsonb:='{"pack-real-adventure-05-q001":1,"pack-real-adventure-05-q002":1,"pack-real-adventure-05-q003":1,"pack-real-adventure-05-q004":1,"pack-real-adventure-05-q005":1,"pack-real-adventure-05-q006":1,"pack-real-adventure-05-q007":1,"pack-real-adventure-05-q008":1,"pack-real-adventure-05-q009":1,"pack-real-adventure-05-q010":1,"pack-real-adventure-05-q011":1,"pack-real-adventure-05-q012":1,"pack-real-adventure-05-q013":1,"pack-real-adventure-05-q014":1,"pack-real-adventure-05-q015":1,"pack-real-adventure-05-q016":1,"pack-real-adventure-05-q017":1,"pack-real-adventure-05-q018":1,"pack-real-adventure-05-q019":1,"pack-real-adventure-05-q020":1,"pack-real-adventure-05-q021":1,"pack-real-adventure-05-q022":1,"pack-real-adventure-05-q023":1,"pack-real-adventure-05-q024":1,"pack-real-adventure-05-q025":1,"pack-real-adventure-05-q026":1,"pack-real-adventure-05-q027":1,"pack-real-adventure-05-q028":1,"pack-real-adventure-05-q029":1,"pack-real-adventure-05-q030":1,"pack-real-adventure-05-q031":1,"pack-real-adventure-05-q032":1,"pack-real-adventure-05-q033":1,"pack-real-adventure-05-q034":1,"pack-real-adventure-05-q035":1,"pack-real-adventure-05-q036":1,"pack-real-adventure-05-q037":1,"pack-real-adventure-05-q038":1,"pack-real-adventure-05-q039":1,"pack-real-adventure-05-q040":1,"pack-real-adventure-05-q041":1,"pack-real-adventure-05-q042":1,"pack-real-adventure-05-q043":1,"pack-real-adventure-05-q044":1,"pack-real-adventure-05-q045":1,"pack-real-adventure-05-q046":1,"pack-real-adventure-05-q047":1,"pack-real-adventure-05-q048":1,"pack-real-adventure-05-q049":1,"pack-real-adventure-05-q050":1,"pack-real-adventure-05-q051":1,"pack-real-adventure-05-q052":1,"pack-real-adventure-05-q053":1,"pack-real-adventure-05-q054":1,"pack-real-adventure-05-q055":1,"pack-real-adventure-05-q056":1,"pack-real-adventure-05-q057":1,"pack-real-adventure-05-q058":1,"pack-real-adventure-05-q059":1,"pack-real-adventure-05-q060":1,"pack-real-adventure-05-q061":1,"pack-real-adventure-05-q062":1,"pack-real-adventure-05-q063":1,"pack-real-adventure-05-q064":1,"pack-real-adventure-05-q065":1,"pack-real-adventure-05-q066":1,"pack-real-adventure-05-q067":1,"pack-real-adventure-05-q068":1,"pack-real-adventure-05-q069":1,"pack-real-adventure-05-q070":1,"pack-real-adventure-05-q071":1,"pack-real-adventure-05-q072":1,"pack-real-adventure-05-q073":1,"pack-real-adventure-05-q074":1,"pack-real-adventure-05-q075":1,"pack-real-adventure-05-q076":1,"pack-real-adventure-05-q077":1,"pack-real-adventure-05-q078":1,"pack-real-adventure-05-q079":1,"pack-real-adventure-05-q080":1,"pack-real-adventure-05-q081":1,"pack-real-adventure-05-q082":1,"pack-real-adventure-05-q083":1,"pack-real-adventure-05-q084":1,"pack-real-adventure-05-q085":1,"pack-real-adventure-05-q086":1,"pack-real-adventure-05-q087":1,"pack-real-adventure-05-q088":1,"pack-real-adventure-05-q089":1,"pack-real-adventure-05-q090":1,"pack-real-adventure-05-q091":1,"pack-real-adventure-05-q092":1,"pack-real-adventure-05-q093":1,"pack-real-adventure-05-q094":1,"pack-real-adventure-05-q095":1,"pack-real-adventure-05-q096":1,"pack-real-adventure-05-q097":1,"pack-real-adventure-05-q098":1,"pack-real-adventure-05-q099":1,"pack-real-adventure-05-q100":1,"pack-real-adventure-06-q001":1,"pack-real-adventure-06-q002":1,"pack-real-adventure-06-q003":1,"pack-real-adventure-06-q004":1,"pack-real-adventure-06-q005":1,"pack-real-adventure-06-q006":1,"pack-real-adventure-06-q007":1,"pack-real-adventure-06-q008":1,"pack-real-adventure-06-q009":1,"pack-real-adventure-06-q010":1,"pack-real-adventure-06-q011":1,"pack-real-adventure-06-q012":1,"pack-real-adventure-06-q013":1,"pack-real-adventure-06-q014":1,"pack-real-adventure-06-q015":1,"pack-real-adventure-06-q016":1,"pack-real-adventure-06-q017":1,"pack-real-adventure-06-q018":1,"pack-real-adventure-06-q019":1,"pack-real-adventure-06-q020":1,"pack-real-adventure-06-q021":1,"pack-real-adventure-06-q022":1,"pack-real-adventure-06-q023":1,"pack-real-adventure-06-q024":1,"pack-real-adventure-06-q025":1,"pack-real-adventure-06-q026":1,"pack-real-adventure-06-q027":1,"pack-real-adventure-06-q028":1,"pack-real-adventure-06-q029":1,"pack-real-adventure-06-q030":1,"pack-real-adventure-06-q031":1,"pack-real-adventure-06-q032":1,"pack-real-adventure-06-q033":1,"pack-real-adventure-06-q034":1,"pack-real-adventure-06-q035":1,"pack-real-adventure-06-q036":1,"pack-real-adventure-06-q037":1,"pack-real-adventure-06-q038":1,"pack-real-adventure-06-q039":1,"pack-real-adventure-06-q040":1,"pack-real-adventure-06-q041":1,"pack-real-adventure-06-q042":1,"pack-real-adventure-06-q043":1,"pack-real-adventure-06-q044":1,"pack-real-adventure-06-q045":1,"pack-real-adventure-06-q046":1,"pack-real-adventure-06-q047":1,"pack-real-adventure-06-q048":1,"pack-real-adventure-06-q049":1,"pack-real-adventure-06-q050":1,"pack-real-adventure-06-q051":1,"pack-real-adventure-06-q052":1,"pack-real-adventure-06-q053":1,"pack-real-adventure-06-q054":1,"pack-real-adventure-06-q055":1,"pack-real-adventure-06-q056":1,"pack-real-adventure-06-q057":1,"pack-real-adventure-06-q058":1,"pack-real-adventure-06-q059":1,"pack-real-adventure-06-q060":1,"pack-real-adventure-06-q061":1,"pack-real-adventure-06-q062":1,"pack-real-adventure-06-q063":1,"pack-real-adventure-06-q064":1,"pack-real-adventure-06-q065":1,"pack-real-adventure-06-q066":1,"pack-real-adventure-06-q067":1,"pack-real-adventure-06-q068":1,"pack-real-adventure-06-q069":1,"pack-real-adventure-06-q070":1,"pack-real-adventure-06-q071":1,"pack-real-adventure-06-q072":1,"pack-real-adventure-06-q073":1,"pack-real-adventure-06-q074":1,"pack-real-adventure-06-q075":1,"pack-real-adventure-06-q076":1,"pack-real-adventure-06-q077":1,"pack-real-adventure-06-q078":1,"pack-real-adventure-06-q079":1,"pack-real-adventure-06-q080":1,"pack-real-adventure-06-q081":1,"pack-real-adventure-06-q082":1,"pack-real-adventure-06-q083":1,"pack-real-adventure-06-q084":1,"pack-real-adventure-06-q085":1,"pack-real-adventure-06-q086":1,"pack-real-adventure-06-q087":1,"pack-real-adventure-06-q088":1,"pack-real-adventure-06-q089":1,"pack-real-adventure-06-q090":1,"pack-real-adventure-06-q091":1,"pack-real-adventure-06-q092":1,"pack-real-adventure-06-q093":1,"pack-real-adventure-06-q094":1,"pack-real-adventure-06-q095":1,"pack-real-adventure-06-q096":1,"pack-real-adventure-06-q097":1,"pack-real-adventure-06-q098":1,"pack-real-adventure-06-q099":1,"pack-real-adventure-06-q100":1,"pack-real-adventure-07-q001":1,"pack-real-adventure-07-q002":1,"pack-real-adventure-07-q003":1,"pack-real-adventure-07-q004":1,"pack-real-adventure-07-q005":1,"pack-real-adventure-07-q006":1,"pack-real-adventure-07-q007":1,"pack-real-adventure-07-q008":1,"pack-real-adventure-07-q009":1,"pack-real-adventure-07-q010":1,"pack-real-adventure-07-q011":1,"pack-real-adventure-07-q012":1,"pack-real-adventure-07-q013":1,"pack-real-adventure-07-q014":1,"pack-real-adventure-07-q015":1,"pack-real-adventure-07-q016":1,"pack-real-adventure-07-q017":1,"pack-real-adventure-07-q018":1,"pack-real-adventure-07-q019":1,"pack-real-adventure-07-q020":1,"pack-real-adventure-07-q021":1,"pack-real-adventure-07-q022":1,"pack-real-adventure-07-q023":1,"pack-real-adventure-07-q024":1,"pack-real-adventure-07-q025":1,"pack-real-adventure-07-q026":1,"pack-real-adventure-07-q027":1,"pack-real-adventure-07-q028":1,"pack-real-adventure-07-q029":1,"pack-real-adventure-07-q030":1,"pack-real-adventure-07-q031":1,"pack-real-adventure-07-q032":1,"pack-real-adventure-07-q033":1,"pack-real-adventure-07-q034":1,"pack-real-adventure-07-q035":1,"pack-real-adventure-07-q036":1,"pack-real-adventure-07-q037":1,"pack-real-adventure-07-q038":1,"pack-real-adventure-07-q039":1,"pack-real-adventure-07-q040":1,"pack-real-adventure-07-q041":1,"pack-real-adventure-07-q042":1,"pack-real-adventure-07-q043":1,"pack-real-adventure-07-q044":1,"pack-real-adventure-07-q045":1,"pack-real-adventure-07-q046":1,"pack-real-adventure-07-q047":1,"pack-real-adventure-07-q048":1,"pack-real-adventure-07-q049":1,"pack-real-adventure-07-q050":1,"pack-real-adventure-07-q051":1,"pack-real-adventure-07-q052":1,"pack-real-adventure-07-q053":1,"pack-real-adventure-07-q054":1,"pack-real-adventure-07-q055":1,"pack-real-adventure-07-q056":1,"pack-real-adventure-07-q057":1,"pack-real-adventure-07-q058":1,"pack-real-adventure-07-q059":1,"pack-real-adventure-07-q060":1,"pack-real-adventure-07-q061":1,"pack-real-adventure-07-q062":1,"pack-real-adventure-07-q063":1,"pack-real-adventure-07-q064":1,"pack-real-adventure-07-q065":1,"pack-real-adventure-07-q066":1,"pack-real-adventure-07-q067":1,"pack-real-adventure-07-q068":1,"pack-real-adventure-07-q069":1,"pack-real-adventure-07-q070":1,"pack-real-adventure-07-q071":1,"pack-real-adventure-07-q072":1,"pack-real-adventure-07-q073":1,"pack-real-adventure-07-q074":1,"pack-real-adventure-07-q075":1,"pack-real-adventure-07-q076":1,"pack-real-adventure-07-q077":1,"pack-real-adventure-07-q078":1,"pack-real-adventure-07-q079":1,"pack-real-adventure-07-q080":1,"pack-real-adventure-07-q081":1,"pack-real-adventure-07-q082":1,"pack-real-adventure-07-q083":1,"pack-real-adventure-07-q084":1,"pack-real-adventure-07-q085":1,"pack-real-adventure-07-q086":1,"pack-real-adventure-07-q087":1,"pack-real-adventure-07-q088":1,"pack-real-adventure-07-q089":1,"pack-real-adventure-07-q090":1,"pack-real-adventure-07-q091":1,"pack-real-adventure-07-q092":1,"pack-real-adventure-07-q093":1,"pack-real-adventure-07-q094":1,"pack-real-adventure-07-q095":1,"pack-real-adventure-07-q096":1,"pack-real-adventure-07-q097":1,"pack-real-adventure-07-q098":1,"pack-real-adventure-07-q099":1,"pack-real-adventure-07-q100":1,"pack-real-adventure-08-q001":1,"pack-real-adventure-08-q002":1,"pack-real-adventure-08-q003":1,"pack-real-adventure-08-q004":1,"pack-real-adventure-08-q005":1,"pack-real-adventure-08-q006":1,"pack-real-adventure-08-q007":1,"pack-real-adventure-08-q008":1,"pack-real-adventure-08-q009":1,"pack-real-adventure-08-q010":1,"pack-real-adventure-08-q011":1,"pack-real-adventure-08-q012":1,"pack-real-adventure-08-q013":1,"pack-real-adventure-08-q014":1,"pack-real-adventure-08-q015":1,"pack-real-adventure-08-q016":1,"pack-real-adventure-08-q017":1,"pack-real-adventure-08-q018":1,"pack-real-adventure-08-q019":1,"pack-real-adventure-08-q020":1,"pack-real-adventure-08-q021":1,"pack-real-adventure-08-q022":1,"pack-real-adventure-08-q023":1,"pack-real-adventure-08-q024":1,"pack-real-adventure-08-q025":1,"pack-real-adventure-08-q026":1,"pack-real-adventure-08-q027":1,"pack-real-adventure-08-q028":1,"pack-real-adventure-08-q029":1,"pack-real-adventure-08-q030":1,"pack-real-adventure-08-q031":1,"pack-real-adventure-08-q032":1,"pack-real-adventure-08-q033":1,"pack-real-adventure-08-q034":1,"pack-real-adventure-08-q035":1,"pack-real-adventure-08-q036":1,"pack-real-adventure-08-q037":1,"pack-real-adventure-08-q038":1,"pack-real-adventure-08-q039":1,"pack-real-adventure-08-q040":1,"pack-real-adventure-08-q041":1,"pack-real-adventure-08-q042":1,"pack-real-adventure-08-q043":1,"pack-real-adventure-08-q044":1,"pack-real-adventure-08-q045":1,"pack-real-adventure-08-q046":1,"pack-real-adventure-08-q047":1,"pack-real-adventure-08-q048":1,"pack-real-adventure-08-q049":1,"pack-real-adventure-08-q050":1,"pack-real-adventure-08-q051":1,"pack-real-adventure-08-q052":1,"pack-real-adventure-08-q053":1,"pack-real-adventure-08-q054":1,"pack-real-adventure-08-q055":1,"pack-real-adventure-08-q056":1,"pack-real-adventure-08-q057":1,"pack-real-adventure-08-q058":1,"pack-real-adventure-08-q059":1,"pack-real-adventure-08-q060":1,"pack-real-adventure-08-q061":1,"pack-real-adventure-08-q062":1,"pack-real-adventure-08-q063":1,"pack-real-adventure-08-q064":1,"pack-real-adventure-08-q065":1,"pack-real-adventure-08-q066":1,"pack-real-adventure-08-q067":1,"pack-real-adventure-08-q068":1,"pack-real-adventure-08-q069":1,"pack-real-adventure-08-q070":1,"pack-real-adventure-08-q071":1,"pack-real-adventure-08-q072":1,"pack-real-adventure-08-q073":1,"pack-real-adventure-08-q074":1,"pack-real-adventure-08-q075":1,"pack-real-adventure-08-q076":1,"pack-real-adventure-08-q077":1,"pack-real-adventure-08-q078":1,"pack-real-adventure-08-q079":1,"pack-real-adventure-08-q080":1,"pack-real-adventure-08-q081":1,"pack-real-adventure-08-q082":1,"pack-real-adventure-08-q083":1,"pack-real-adventure-08-q084":1,"pack-real-adventure-08-q085":1,"pack-real-adventure-08-q086":1,"pack-real-adventure-08-q087":1,"pack-real-adventure-08-q088":1,"pack-real-adventure-08-q089":1,"pack-real-adventure-08-q090":1,"pack-real-adventure-08-q091":1,"pack-real-adventure-08-q092":1,"pack-real-adventure-08-q093":1,"pack-real-adventure-08-q094":1,"pack-real-adventure-08-q095":1,"pack-real-adventure-08-q096":1,"pack-real-adventure-08-q097":1,"pack-real-adventure-08-q098":1,"pack-real-adventure-08-q099":1,"pack-real-adventure-08-q100":1}'::jsonb;begin
 update lumen_commands.quest_rules q set grid_revision=(e.value #>> '{}')::integer from jsonb_each(expected) e where q.quest_id=e.key and q.grid_revision=0;
 if exists(select 1 from jsonb_each(expected) e left join lumen_commands.quest_rules q on q.quest_id=e.key where q.quest_id is null or q.legacy_index is not null or q.grid_revision<>(e.value #>> '{}')::integer) then raise exception 'Historical grid registry does not match manifest';end if;
end $seed$;
-- END PREVIOUS GRID REVISIONS

create or replace function public.lumen_create_quest_challenge_v2(
 p_anonymous_id text,p_display_name text,p_quest_id text,p_duration_seconds integer,
 p_autonomy boolean,p_speed boolean,p_mastery boolean,p_assistance_used boolean,p_first_play boolean,p_grid_revision integer
) returns table(challenge_id uuid)
language plpgsql security definer set search_path='' as $$
declare created uuid;
begin
 if p_grid_revision is null or p_grid_revision<=0 or not exists(
  select 1 from lumen_commands.quest_rules where quest_id=p_quest_id and grid_revision=p_grid_revision)
 then raise exception 'invalid_grid_revision';end if;
 select c.challenge_id into created from public.lumen_create_quest_challenge(
  p_anonymous_id,p_display_name,p_quest_id,p_duration_seconds,p_autonomy,p_speed,p_mastery,p_assistance_used,p_first_play) c;
 update lumen.social_challenges set grid_revision=p_grid_revision where id=created;
 return query select created;
end $$;
revoke all on function public.lumen_create_quest_challenge_v2(text,text,text,integer,boolean,boolean,boolean,boolean,boolean,integer) from public;
grant execute on function public.lumen_create_quest_challenge_v2(text,text,text,integer,boolean,boolean,boolean,boolean,boolean,integer) to anon,authenticated;

create or replace function lumen_commands.protect_quest_runs() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record;incoming jsonb;
begin
 for r in select a.quest_id,a.projection,a.reset_info,q.grid_revision from lumen_commands.quest_run_authority a
  join lumen_commands.quest_rules q on q.quest_id=a.quest_id where a.user_id=new.user_id loop
  incoming:=new.payload->'canonicalQuestState'->r.quest_id;
  if (r.reset_info<>'{}' and incoming is distinct from r.projection)
   or (r.reset_info='{}' and incoming ?| array['resetRevision','resetAt','rewardedBeforeReset'])
   or (r.grid_revision>1 and incoming->'gridRevision' is distinct from to_jsonb(r.grid_revision))
   or incoming->'runPerformance' is distinct from r.projection->'runPerformance'
   or incoming->'badges' is distinct from r.projection->'badges'
  then raise exception using errcode='23514',message='quest command required; preserve pending data';end if;
 end loop;
 for r in select key,value from jsonb_each(coalesce(new.payload->'canonicalQuestState','{}')) loop
  if (r.value ? 'runPerformance' or r.value ? 'resetRevision' or
    (r.value->'solved'='true' and exists(select 1 from lumen_commands.quest_rules q where q.quest_id=r.key and q.grid_revision>1)))
   and not exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=new.user_id and a.quest_id=r.key)
  then raise exception using errcode='23514',message='quest run authority missing';end if;
 end loop;
 return new;
end $$;
revoke all on function lumen_commands.protect_quest_runs() from public,anon,authenticated;

do $$
declare definition text;boundary text;
begin
 select pg_get_functiondef('lumen_commands.commit_quest(text,uuid,text,jsonb)'::regprocedure) into definition;
 boundary:='select * into receipt from lumen_commands.canonical_receipts where user_id=uid and operation_id=p_operation_id;';
 if position(boundary in definition)=0 then raise exception 'Quest receipt boundary changed; review grid migration';end if;
 definition:=replace(definition,boundary,$patch$
 if exists(select 1 from lumen_commands.quest_rules q where q.quest_id=p_quest_id and q.grid_revision>1
  and p_operation_id !~ ('^(qr[0-9]+[.])?gv'||q.grid_revision||'[.]'))
 then raise exception using errcode='23514',message='quest grid update required; refresh verified profile';end if;
 $patch$||boundary);
 boundary:='entry:=entry||jsonb_build_object(''solved'',true,''badges'',badges,''runPerformance'',performance);';
 if position(boundary in definition)=0 then raise exception 'Quest projection boundary changed; review grid migration';end if;
 definition:=replace(definition,boundary,$patch$
 if exists(select 1 from lumen_commands.quest_rules where quest_id=p_quest_id and grid_revision>1) then
  entry:=entry||jsonb_build_object('gridRevision',(select grid_revision from lumen_commands.quest_rules where quest_id=p_quest_id));
 end if;
 $patch$||boundary);
 execute definition;

 select pg_get_functiondef('public.lumen_commit_canonical_victory(text,jsonb,jsonb)'::regprocedure) into definition;
 boundary:='if v_payload is null then raise exception ''verified cloud profile required''; end if;';
 if position(boundary in definition)=0 then raise exception 'Compatibility lock boundary changed';end if;
 execute replace(definition,boundary,boundary||$patch$
 if exists(select 1 from lumen_commands.quest_rules where quest_id=p_quest_id and grid_revision>1)
 then raise exception using errcode='23514',message='quest grid update requires current quest command';end if;
 $patch$);

 select pg_get_functiondef('lumen_commands.reconcile_acquisitions(uuid,jsonb,jsonb)'::regprocedure) into definition;
 boundary:='for q in select quest_id,legacy_index,rules from lumen_commands.quest_rules loop';
 if position(boundary in definition)=0 then raise exception 'Acquisition catalogue boundary changed';end if;
 execute replace(definition,boundary,boundary||$patch$
  if exists(select 1 from lumen_commands.quest_rules current_grid where current_grid.quest_id=q.quest_id and current_grid.grid_revision>1) then continue;end if;
 $patch$);
end $$;

-- Operator-only new overload. The v1 two-argument function remains unchanged.
-- Keep every previous epoch's archive, preserve money/receipts/access, and never
-- erase a replay on a repeated call at the same epoch. Scope must be active.
create function lumen_commands.reset_replaced_quests(p_user_id uuid,p_scope jsonb,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p jsonb;old_entry jsonb;cleared jsonb;info jsonb;old_info jsonb;q record;registered integer;
 stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 revision bigint;changed integer:=0;completed integer:=0;access jsonb;
begin
 if p_revision is null or p_revision<2 or jsonb_typeof(p_scope) is distinct from 'object' or p_scope='{}'
 then raise exception 'explicit new revision and reset scope required';end if;
 select payload into p from lumen.profile_snapshots where user_id=p_user_id for update;
 if p is null then raise exception 'existing player profile required';end if;
 access:=coalesce(p->'legacyAdventureAccess','[]');
 if jsonb_typeof(access)<>'array' then raise exception 'access metadata requires review';end if;
 for q in select key,value from jsonb_each_text(p_scope) loop
  select grid_revision into registered from lumen_commands.quest_rules where quest_id=q.key and legacy_index is null;
  if not found or registered<>p_revision or left(q.key,length('pack-'||q.value||'-'))<>'pack-'||q.value||'-'
  then raise exception 'reset scope does not match active content revision';end if;
  select reset_info into old_info from lumen_commands.quest_run_authority where user_id=p_user_id and quest_id=q.key;
  old_info:=coalesce(old_info,'{}');
  if coalesce((old_info->>'revision')::integer,0)>p_revision then raise exception 'cannot downgrade reset revision';end if;
  if coalesce((old_info->>'revision')::integer,0)=p_revision then continue;end if;
  old_entry:=coalesce(p->'canonicalQuestState'->q.key,'{}');
  if coalesce(old_entry->>'solved','false') in ('true','1') then
   completed:=completed+1;if not(access ? q.value) then access:=access||jsonb_build_array(q.value);end if;
  end if;
  cleared:=jsonb_build_object('solved',false,'stars',0,'badges','{}'::jsonb,'runPerformance','{}'::jsonb,
   'gridRevision',p_revision,'resetRevision',p_revision,'resetAt',stamp,'rewardedBeforeReset',
   coalesce(old_entry->>'solved','false') in ('true','1') or exists(select 1 from lumen.canonical_reward_events where user_id=p_user_id and quest_id=q.key));
  info:=jsonb_build_object('revision',p_revision,'resetAt',stamp,'previous',old_entry,'cleared',cleared,
   'history',coalesce(old_info->'history','[]')||case when old_info='{}' then '[]'::jsonb else jsonb_build_array(old_info-'history') end);
  insert into lumen_commands.quest_run_authority(user_id,quest_id,projection,reset_info) values(p_user_id,q.key,cleared,info)
   on conflict(user_id,quest_id) do update set projection=excluded.projection,reset_info=excluded.reset_info;
  p:=jsonb_set(p,'{canonicalQuestState}',coalesce(p->'canonicalQuestState','{}')||jsonb_build_object(q.key,cleared));changed:=changed+1;
 end loop;
 if changed=0 then return jsonb_build_object('changed',0,'completedReset',0);end if;
 p:=p||jsonb_build_object('legacyAdventureAccess',access);
 insert into lumen_commands.legacy_authority(user_id,revision,projection) values(p_user_id,1,lumen_commands.legacy_projection(p))
 on conflict(user_id) do update set revision=lumen_commands.legacy_authority.revision+1,projection=excluded.projection returning legacy_authority.revision into revision;
 p:=p||jsonb_build_object('legacyVictoryRevision',revision);
 if octet_length(p::text)>524288 then raise exception 'reset projection too large';end if;
 update lumen.profile_snapshots set payload=p,saved_at=now() where user_id=p_user_id;
 return jsonb_build_object('changed',changed,'completedReset',completed);
end $$;
revoke all on function lumen_commands.reset_replaced_quests(uuid,jsonb,integer) from public,anon,authenticated;
notify pgrst,'reload schema';
