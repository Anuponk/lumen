// Operator input only. No account identifiers, connection or mutation here.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../content/generated/logical-grids-v1.json',import.meta.url),'utf8'));
const quests=new Map(canonicalQuestList().map(q=>[q.id,q]));
const scope={};
for(const replacement of manifest.quests){
 const quest=quests.get(replacement.id);
 assert(quest&&quest.legacyIndex===null&&quest.packId===replacement.packId&&quest.gridRevision===replacement.gridRevision);
 assert(!Object.hasOwn(scope,quest.id));scope[quest.id]=quest.packId;
}
assert(Object.keys(scope).length>0);
console.log(JSON.stringify(scope));
