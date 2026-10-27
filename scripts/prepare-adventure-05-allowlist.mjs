// Generate a reviewable SQL allowlist migration; never connects to production.
// Apply only alongside the fully published canonical catalogue and verified ledger.
import assert from 'node:assert/strict';
import candidates from '../content/generated/fifth-adventure-candidates.json' with {type:'json'};
import config from '../content/fifth-adventure-preview.json' with {type:'json'};
const ids=candidates.quests.map(q=>q.id);
assert.equal(ids.length,100);
assert.equal(new Set(ids).size,ids.length);
assert.ok(ids.every(id=>/^pack-real-adventure-05-q\d{3}$/.test(id)));
assert.ok(ids.every((id,i)=>id===`pack-real-adventure-05-q${String(i+1).padStart(3,'0')}`));
assert.equal(config.id,'real-adventure-05');
const values=ids.map(id=>`('${id}')`).join(',\n  ');
const sql=`-- Adventure 5 canonical allowlist, reviewed deployment step only.\n-- Do not apply before published client and cloud command contract are ready.\nBEGIN;\nINSERT INTO lumen.canonical_quest_allowlist(quest_id) VALUES\n  ${values}\nON CONFLICT (quest_id) DO NOTHING;\n-- Expected: exactly 100 Adventure 5 entries, no duplicates.\nDO $$ BEGIN\n IF (SELECT count(*) FROM lumen.canonical_quest_allowlist WHERE quest_id LIKE 'pack-real-adventure-05-q%') <> 100 THEN\n  RAISE EXCEPTION 'Adventure 5 allowlist incomplete';\n END IF;\nEND $$;\nCOMMIT;\n`;
if(process.argv.includes('--sql'))process.stdout.write(sql);
else console.log('PASS: prepared 100 stable Adventure 5 allowlist IDs; use --sql to review SQL.');
