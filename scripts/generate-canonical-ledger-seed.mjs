// Generates a reviewed allowlist seed from the same catalogue used by Lumen.
// Run: node scripts/generate-canonical-ledger-seed.mjs > /tmp/lumen-canonical-seed.sql
import {canonicalQuestList} from "../src/campaign/canonical-quests.js";
const ids=canonicalQuestList().filter(q=>q.legacyIndex===null).map(q=>q.id);
if(new Set(ids).size!==ids.length||!ids.length)throw Error("Invalid canonical quest allowlist");
for(const id of ids)if(typeof id!=="string"||id.length>120||!/^[-a-zA-Z0-9_]+$/.test(id))throw Error("Invalid quest id "+id);
console.log("begin;");
for(const id of ids)console.log("insert into lumen.canonical_quest_allowlist(quest_id) values ('"+id+"') on conflict(quest_id) do nothing;");
console.log("commit;");
