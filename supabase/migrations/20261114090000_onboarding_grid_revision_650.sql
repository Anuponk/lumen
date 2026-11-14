-- #650: owner-approved easier boards for legacy Adventure 1 quests 3-6.
-- Data-only and idempotent. Soft grid revision 1 is ignored by every
-- revision>1 guard (victory commands, acquisitions, resets), so completion,
-- badges, stars, wallet and saved times are untouched. Only new ranking runs
-- and the ranking board use revision 1, matching the client manifest
-- content/generated/onboarding-grids-650.json.
-- Apply AFTER the matching client is deployed: until then, new-client ranking
-- runs stay durably pending and are accepted once this revision is active.
do $onboarding650$
declare expected jsonb:='{"base-q003":2,"base-q004":3,"base-q005":4,"base-q006":5}';
begin
 if exists(select 1 from jsonb_each(expected) e left join lumen_commands.quest_rules q on q.quest_id=e.key
  where q.quest_id is null or q.legacy_index is distinct from (e.value #>> '{}')::integer or q.grid_revision not in (0,1))
 then raise exception 'onboarding grid revision 650 requires review';end if;
 update lumen_commands.quest_rules q set grid_revision=1
  from jsonb_each(expected) e where q.quest_id=e.key and q.grid_revision=0;
 if (select count(*) from lumen_commands.quest_rules where quest_id in (select jsonb_object_keys(expected)) and grid_revision=1)<>4
 then raise exception 'onboarding grid revision 650 incomplete';end if;
end $onboarding650$;
