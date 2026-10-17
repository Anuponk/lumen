-- #453: badge-only replay upgrades through the live transactional ledger.
-- No bulk player update, XP credit, schema change or identity migration.
create or replace function public.lumen_commit_canonical_victory(
 p_quest_id text, p_badges jsonb, p_performance jsonb default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_uid uuid := auth.uid();
 v_payload jsonb;
 v_entry jsonb;
 v_xp integer;
 v_old_xp numeric;
 v_badges jsonb;
 v_key text;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 if p_quest_id is null or length(p_quest_id)>120
   or not exists(select 1 from lumen.canonical_quest_allowlist q where q.quest_id=p_quest_id)
 then raise exception 'unknown canonical quest'; end if;
 if p_badges is null or jsonb_typeof(p_badges)<>'object'
   or jsonb_typeof(coalesce(p_performance,'null'::jsonb)) not in ('object','null')
   or octet_length(p_badges::text)>2048 or octet_length(coalesce(p_performance::text,''))>4096
 then raise exception 'invalid canonical reward'; end if;
 -- Serialize with all canonical commits for the same player. Existing
 -- profile CAS writes will fail and retry if their baseline became stale.
 select payload into v_payload from lumen.profile_snapshots
 where user_id=v_uid for update;
 if v_payload is null then raise exception 'verified cloud profile required'; end if;
 if jsonb_typeof(coalesce(v_payload->'canonicalQuestState','{}'::jsonb))<>'object'
 then raise exception 'invalid canonical state'; end if;
 if coalesce(v_payload->'canonicalQuestState'->p_quest_id->>'solved','false')='true'
 then
  -- A completed quest can earn missing badges on replay. Preserve every other
  -- field, including first-completion rewards, performance and unknown fields.
  v_entry := v_payload->'canonicalQuestState'->p_quest_id;
  v_badges := coalesce(nullif(v_entry->'badges','null'::jsonb),'{}'::jsonb);
  if jsonb_typeof(v_badges)<>'object' then raise exception 'invalid saved badges'; end if;
  foreach v_key in array array['autonomy','speed','noError','mastery'] loop
   -- Merge only badges explicitly earned on this run. Never synthesize mastery
   -- by combining autonomy/speed/noError across different attempts.
   if p_badges->v_key='true'::jsonb then
    v_badges := v_badges || jsonb_build_object(v_key,true);
   end if;
  end loop;
  if v_badges is distinct from coalesce(nullif(v_entry->'badges','null'::jsonb),'{}'::jsonb) then
   v_entry := jsonb_set(v_entry,'{badges}',v_badges,true);
   v_payload := jsonb_set(v_payload,array['canonicalQuestState',p_quest_id],v_entry,false);
   update lumen.profile_snapshots set payload=v_payload,saved_at=now() where user_id=v_uid;
   return jsonb_build_object('profile',v_payload,'newlyCompleted',false,'alreadySaved',false);
  end if;
  return jsonb_build_object('profile',v_payload,'newlyCompleted',false,'alreadySaved',true);
 end if;
 -- A ledger entry without a solved snapshot implies a broken invariant;
 -- never silently re-credit or overwrite either side.
 if exists(select 1 from lumen.canonical_reward_events e
           where e.user_id=v_uid and e.quest_id=p_quest_id)
 then raise exception 'canonical ledger/profile mismatch'; end if;
 v_old_xp := coalesce((v_payload->>'xp')::numeric,0);
 if v_old_xp<0 or v_old_xp>100000000 or v_old_xp<>trunc(v_old_xp)
 then raise exception 'invalid XP baseline'; end if;
 v_xp := case when p_badges->>'autonomy'='true' then 15 else 10 end;
 v_entry := jsonb_build_object('solved',true,'stars',1,'badges',p_badges,'performance',p_performance);
 insert into lumen.canonical_reward_events(user_id,quest_id,xp_credited)
 values (v_uid,p_quest_id,v_xp);
 v_payload := jsonb_set(v_payload,'{canonicalQuestState}',
   coalesce(v_payload->'canonicalQuestState','{}'::jsonb) || jsonb_build_object(p_quest_id,v_entry),true);
 v_payload := jsonb_set(v_payload,'{xp}',to_jsonb((v_old_xp+v_xp)::integer),true);
 update lumen.profile_snapshots set payload=v_payload,saved_at=now()
 where user_id=v_uid;
 return jsonb_build_object('profile',v_payload,'newlyCompleted',true,'alreadySaved',false);
end $$;
revoke all on function public.lumen_commit_canonical_victory(text,jsonb,jsonb) from public,anon;
grant execute on function public.lumen_commit_canonical_victory(text,jsonb,jsonb) to authenticated;
