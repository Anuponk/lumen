-- #391. Review and deploy with seed generated from canonicalQuestList().
-- No player rows are rewritten. The ledger and profile snapshot update in one
-- PostgreSQL transaction, and per-user row locks serialize competing devices.
create table if not exists lumen.canonical_quest_allowlist (
 quest_id text primary key
);
revoke all on lumen.canonical_quest_allowlist from public, anon, authenticated;
alter table lumen.canonical_quest_allowlist enable row level security;

create table if not exists lumen.canonical_reward_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 quest_id text not null references lumen.canonical_quest_allowlist(quest_id),
 event_id uuid not null default gen_random_uuid(),
 xp_credited integer not null check (xp_credited in (10,15)),
 created_at timestamptz not null default now(),
 primary key (user_id,quest_id),
 unique (event_id)
);
alter table lumen.canonical_reward_events enable row level security;
revoke all on lumen.canonical_reward_events from public, anon, authenticated;

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
 then return jsonb_build_object('profile',v_payload,'newlyCompleted',false,'alreadySaved',true); end if;
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
