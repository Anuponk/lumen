-- #391 read-only aggregate compatibility check
select count(*) as profiles,
 count(*) filter(where payload ? 'canonicalQuestState' and jsonb_typeof(payload->'canonicalQuestState') <> 'object') as invalid_state,
 count(*) filter(where not (payload ? 'canonicalQuestState')) as legacy_without_state,
 count(*) filter(where jsonb_typeof(payload->'xp') <> 'number') as invalid_xp
from lumen.profile_snapshots;
