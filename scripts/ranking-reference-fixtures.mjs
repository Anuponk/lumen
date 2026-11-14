import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
// Virtual opponents are designed targets, never measured human performances.
// Catalogue growth automatically supplies a target for every new quest.
const targets=Object.fromEntries(canonicalQuestList().map(q=>[q.id,Math.max(30,Math.min(3600,Math.round(20+q.size*5+(q.logical?.score??q.difficulty?.score??40)*.5)))]));
console.log(`update lumen_commands.quest_rules q set ranking_reference_seconds=(e.value #>> '{}')::integer from jsonb_each('${JSON.stringify(targets)}'::jsonb) e where q.quest_id=e.key;`);
