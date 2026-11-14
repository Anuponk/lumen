-- #692: owner-approved easier board for Adventure 1 quest 7 (7x7).
-- Data-only and idempotent, same contract as #650: soft grid revision 1 is
-- ignored by every revision>1 guard (victory commands, acquisitions, resets),
-- so completion, badges, stars, wallet and saved times are untouched. Only new
-- ranking runs and the ranking board use revision 1, matching the client
-- manifest content/generated/onboarding-grids-650.json.
-- Quests 4-6 keep revision 1 (their board changes under the same revision by
-- owner decision); this migration does not touch them and removes no row.
-- Apply AFTER the matching client is deployed: until then, new-client ranking
-- runs stay durably pending and are accepted once this revision is active.
do $quest7_692$
declare expected jsonb:='{"planned-real-01-q07":null}';
begin
 if exists(select 1 from jsonb_each(expected) e left join lumen_commands.quest_rules q on q.quest_id=e.key
  where q.quest_id is null or q.legacy_index is not null or q.grid_revision not in (0,1))
 then raise exception 'quest 7 grid revision 692 requires review';end if;
 update lumen_commands.quest_rules q set grid_revision=1
  from jsonb_each(expected) e where q.quest_id=e.key and q.grid_revision=0;
 if (select count(*) from lumen_commands.quest_rules where quest_id in (select jsonb_object_keys(expected)) and grid_revision=1)<>1
 then raise exception 'quest 7 grid revision 692 incomplete';end if;
end $quest7_692$;
