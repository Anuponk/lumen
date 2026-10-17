-- #391: every snapshot writer, including legacy backup and CAS, must preserve
-- committed canonical acquisitions. No player row is rewritten by this DDL.
-- This does not impose max() on money, spends, refunds or entitlements.
do $$
begin
 if exists (
  select 1 from lumen.canonical_reward_events e
  left join lumen.profile_snapshots s on s.user_id=e.user_id
  where coalesce(s.payload->'canonicalQuestState'->e.quest_id->'solved','false'::jsonb)<>'true'::jsonb
 ) then raise exception 'canonical ledger/profile mismatch: review before activation'; end if;
end $$;

create or replace function lumen.protect_canonical_snapshot()
returns trigger language plpgsql set search_path = '' as $$
declare
 old_state jsonb := coalesce(nullif(old.payload->'canonicalQuestState','null'::jsonb),'{}'::jsonb);
 new_state jsonb := coalesce(nullif(new.payload->'canonicalQuestState','null'::jsonb),'{}'::jsonb);
 quest record;
 badge record;
 incoming jsonb;
begin
 if jsonb_typeof(old_state)<>'object' or jsonb_typeof(new_state)<>'object' then
  raise exception using errcode='23514', message='invalid canonical snapshot';
 end if;
 for quest in select key,value from jsonb_each(old_state) loop
  if quest.value->'solved'='true'::jsonb then
   incoming := new_state->quest.key;
   -- Preserve the first-completion record, including unknown metadata. Badge
   -- flags may improve independently, never assembled into mastery here.
   if incoming is null or jsonb_typeof(incoming)<>'object'
      or not ((incoming-'badges') @> (quest.value-'badges')) then
    raise exception using errcode='23514', message='canonical acquisition removal rejected';
   end if;
   for badge in select key,value from jsonb_each(
     coalesce(nullif(quest.value->'badges','null'::jsonb),'{}'::jsonb)) loop
    if badge.value='true'::jsonb and incoming->'badges'->badge.key is distinct from 'true'::jsonb then
     raise exception using errcode='23514', message='canonical badge removal rejected';
    end if;
   end loop;
  end if;
 end loop;
 return new;
end $$;
revoke all on function lumen.protect_canonical_snapshot() from public,anon,authenticated;
drop trigger if exists protect_canonical_snapshot on lumen.profile_snapshots;
create trigger protect_canonical_snapshot before update of payload on lumen.profile_snapshots
for each row execute function lumen.protect_canonical_snapshot();
