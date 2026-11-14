// Operator input only. No account identifiers, connection or mutation here.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {canonicalQuestListForRevision} from '../src/campaign/canonical-quests.js';
const index=process.argv.indexOf('--revision'),revision=index<0?2:Number(process.argv[index+1]);
assert([1,2].includes(revision),'Known explicit content revision required');
const manifest=JSON.parse(fs.readFileSync(new URL('../content/generated/logical-grids-v'+revision+'.json',import.meta.url),'utf8'));
const quests=new Map(canonicalQuestListForRevision(revision).map(q=>[q.id,q]));
const scope={};
for(const replacement of manifest.quests){
 if(revision>1&&replacement.gridHash===replacement.previousGridHash)continue;
 const quest=quests.get(replacement.id);
 assert(quest&&quest.legacyIndex===null&&quest.packId===replacement.packId&&quest.gridRevision===replacement.gridRevision);
 assert(!Object.hasOwn(scope,quest.id));scope[quest.id]=quest.packId;
}
assert(Object.keys(scope).length>0);
console.log(JSON.stringify(scope));
