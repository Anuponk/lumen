-- Explicit operator reset, scoped by catalogue quest IDs. No account backfill.
-- Keep original quest facts private; existing account export/erasure owns this
-- already inventoried user-owned authority table. Never delete reward receipts.
alter table lumen_commands.quest_run_authority
 add column reset_info jsonb not null default '{}'::jsonb;

create or replace function lumen_commands.protect_quest_runs() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record; incoming jsonb;
begin
 for r in select quest_id,projection,reset_info from lumen_commands.quest_run_authority where user_id=new.user_id loop
  incoming:=new.payload->'canonicalQuestState'->r.quest_id;
  if (r.reset_info<>'{}' and incoming is distinct from r.projection)
   or (r.reset_info='{}' and incoming ?| array['resetRevision','resetAt','rewardedBeforeReset'])
   or incoming->'runPerformance' is distinct from r.projection->'runPerformance'
   or incoming->'badges' is distinct from r.projection->'badges'
  then raise exception using errcode='23514',message='quest command required; preserve pending data';end if;
 end loop;
 for r in select key,value from jsonb_each(coalesce(new.payload->'canonicalQuestState','{}')) loop
  if (r.value ? 'runPerformance' or r.value ? 'resetRevision') and not exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=new.user_id and a.quest_id=r.key)
  then raise exception using errcode='23514',message='quest run authority missing';end if;
 end loop;
 return new;
end $$;
revoke all on function lumen_commands.protect_quest_runs() from public,anon,authenticated;

-- Only the exact, preauthorized cleared entry may lower a previous acquisition.
-- The epoch comparison forbids reusing that exception after the first replay.
do $$
declare definition text; boundary text:='incoming := new_state->quest.key;';
begin
 select pg_get_functiondef('lumen.protect_canonical_snapshot()'::regprocedure) into definition;
 if position(boundary in definition)=0 then raise exception 'canonical guard changed; review reset migration';end if;
 execute replace(definition,boundary,boundary||$patch$
   if exists(select 1 from lumen_commands.quest_run_authority a
    where a.user_id=new.user_id and a.quest_id=quest.key
     and a.reset_info->'cleared'=incoming
     and coalesce((quest.value->>'resetRevision')::integer,0)<(a.reset_info->>'revision')::integer)
   then continue;end if;
 $patch$);
end $$;

-- Retain the current writer (including personal records). Fail closed if its
-- reviewed boundaries change; this migration must never reinstall an old body.
do $$
declare definition text; boundary text; replacement text;
begin
 select pg_get_functiondef('lumen_commands.commit_quest(text,uuid,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,chr(13),'');
 boundary:='select * into receipt from lumen_commands.canonical_receipts where user_id=uid and operation_id=p_operation_id;';
 if position(boundary in definition)=0 then raise exception 'quest receipt boundary changed';end if;
 definition:=replace(definition,boundary,$patch$
 if exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=uid and a.quest_id=p_quest_id
  and a.reset_info<>'{}' and
   (left(p_operation_id,length('qr'||(a.reset_info->>'revision')||'.'))<>'qr'||(a.reset_info->>'revision')||'.'
    or (p_facts->>'qualifiedAt')::timestamptz<(a.reset_info->>'resetAt')::timestamptz))
 then raise exception using errcode='23514',message='quest reset revision changed; refresh verified profile';end if;
 $patch$||boundary);
 boundary:=$old$if first_win then
  if exists(select 1 from lumen.canonical_reward_events where user_id=uid and quest_id=p_quest_id) then raise exception 'canonical ledger/profile mismatch';end if;
  xp:=xp+10+case when hint then 0 else 5 end;
  insert into lumen.canonical_reward_events(user_id,quest_id,xp_credited) values(uid,p_quest_id,case when hint then 10 else 15 end);
  entry:=entry||jsonb_build_object('stars',stars,'performance',jsonb_build_object('bestTime',seconds,'seconds',seconds,'assisted',assisted));
  if autonomy then wins:=wins+1;if wins%3=0 then auto_shard:=1;balance:=balance+1;end if;end if;
 end if;$old$;
 replacement:=$patch$if first_win then
  entry:=entry||jsonb_build_object('stars',stars,'performance',jsonb_build_object('bestTime',seconds,'seconds',seconds,'assisted',assisted));
  if coalesce(entry->>'rewardedBeforeReset','false')<>'true' then
   if exists(select 1 from lumen.canonical_reward_events where user_id=uid and quest_id=p_quest_id) then raise exception 'canonical ledger/profile mismatch';end if;
   xp:=xp+10+case when hint then 0 else 5 end;
   insert into lumen.canonical_reward_events(user_id,quest_id,xp_credited) values(uid,p_quest_id,case when hint then 10 else 15 end);
   if autonomy then wins:=wins+1;if wins%3=0 then auto_shard:=1;balance:=balance+1;end if;end if;
  end if;
 end if;$patch$;
 if position(boundary in definition)=0 then raise exception 'quest economic boundary changed';end if;
 definition:=replace(definition,boundary,replacement);
 boundary:='insert into lumen_commands.quest_run_authority values(uid,p_quest_id,jsonb_build_object(''runPerformance'',performance,''badges'',badges))';
 if position(boundary in definition)=0 then raise exception 'quest authority insert changed';end if;
 definition:=replace(definition,boundary,'insert into lumen_commands.quest_run_authority(user_id,quest_id,projection) values(uid,p_quest_id,jsonb_build_object(''runPerformance'',performance,''badges'',badges))');
 boundary:='on conflict(user_id,quest_id) do update set projection=excluded.projection;';
 if position(boundary in definition)=0 then raise exception 'quest authority update changed';end if;
 definition:=replace(definition,boundary,'on conflict(user_id,quest_id) do update set projection=case when lumen_commands.quest_run_authority.reset_info<>''{}'' then entry else excluded.projection end;');
 execute definition;

 -- Old badge-only API cannot prove a new run after an explicit reset. Keep its
 -- historical behavior on every unaffected account/quest. Lock before testing.
 select pg_get_functiondef('public.lumen_commit_canonical_victory(text,jsonb,jsonb)'::regprocedure) into definition;
 boundary:='if v_payload is null then raise exception ''verified cloud profile required''; end if;';
 if position(boundary in definition)=0 then raise exception 'compatibility writer boundary changed';end if;
 execute replace(definition,boundary,boundary||$patch$
 if exists(select 1 from lumen_commands.quest_run_authority where user_id=v_uid and quest_id=p_quest_id and reset_info<>'{}')
 then raise exception using errcode='23514',message='quest reset requires current quest command';end if;
 $patch$);

 -- Acquisitions recovery must not promote old or forged achievements back into
 -- a reset quest. The exact server projection remains authoritative at all epochs.
 select pg_get_functiondef('lumen_commands.reconcile_acquisitions(uuid,jsonb,jsonb)'::regprocedure) into definition;
 boundary:='for q in select quest_id,legacy_index,rules from lumen_commands.quest_rules loop';
 if position(boundary in definition)=0 then raise exception 'acquisition boundary changed';end if;
 execute replace(definition,boundary,boundary||$patch$
  if exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=uid and a.quest_id=q.quest_id and a.reset_info<>'{}') then continue;end if;
 $patch$);
end $$;

-- Operator-only: reset once at epoch 1; reruns never erase subsequent replays.
-- Input is {stableQuestId: packId} generated from the replacement manifest.
create function lumen_commands.reset_replaced_quests(p_user_id uuid,p_scope jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p jsonb;old_entry jsonb;cleared jsonb;info jsonb;q record;rule jsonb;
 stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 revision bigint;changed integer:=0;completed integer:=0;access jsonb;
begin
 if jsonb_typeof(p_scope) is distinct from 'object' or p_scope='{}' then raise exception 'explicit reset scope required';end if;
 select payload into p from lumen.profile_snapshots where user_id=p_user_id for update;
 if p is null then raise exception 'existing player profile required';end if;
 access:=coalesce(p->'legacyAdventureAccess','[]');
 if jsonb_typeof(access)<>'array' then raise exception 'access metadata requires review';end if;
 for q in select key,value from jsonb_each_text(p_scope) loop
  select rules into rule from lumen_commands.quest_rules where quest_id=q.key and legacy_index is null;
  if not found or left(q.key,length('pack-'||q.value||'-'))<>'pack-'||q.value||'-' then raise exception 'reset scope does not match catalogue';end if;
  if exists(select 1 from lumen_commands.quest_run_authority a where a.user_id=p_user_id and a.quest_id=q.key and a.reset_info<>'{}') then continue;end if;
  old_entry:=coalesce(p->'canonicalQuestState'->q.key,'{}');
  if coalesce(old_entry->>'solved','false') in ('true','1') then
   completed:=completed+1;
   if not(access ? q.value) then access:=access||jsonb_build_array(q.value);end if;
  end if;
  cleared:=jsonb_build_object('solved',false,'stars',0,'badges','{}'::jsonb,'runPerformance','{}'::jsonb,
   'resetRevision',1,'resetAt',stamp,'rewardedBeforeReset',
    coalesce(old_entry->>'solved','false') in ('true','1') or exists(select 1 from lumen.canonical_reward_events where user_id=p_user_id and quest_id=q.key));
  info:=jsonb_build_object('revision',1,'resetAt',stamp,'previous',old_entry,'cleared',cleared);
  insert into lumen_commands.quest_run_authority(user_id,quest_id,projection,reset_info) values(p_user_id,q.key,cleared,info)
   on conflict(user_id,quest_id) do update set projection=excluded.projection,reset_info=excluded.reset_info;
  p:=jsonb_set(p,'{canonicalQuestState}',coalesce(p->'canonicalQuestState','{}')||jsonb_build_object(q.key,cleared));
  changed:=changed+1;
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
revoke all on function lumen_commands.reset_replaced_quests(uuid,jsonb) from public,anon,authenticated;
notify pgrst,'reload schema';
