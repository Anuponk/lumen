import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from 'node:vm';
import {CLOUD_PROFILE_FIELDS} from '../src/persistence/cloud-profile.js';
const ui=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
const start=ui.indexOf('const fields=Array.isArray(resolution.fields)');
const end=ui.indexOf('if(resolution.status==="reconciled"',start);
assert(start>0&&end>start,'Actual reconciliation diagnostic formatting is exercised');
for(const id of ['known-quest','195','private-fixture@example.test','unknown-quest']){
 const records=[],context=vm.createContext({CLOUD_PROFILE_FIELDS,
  resolution:{status:'blocked',reason:'reward_conflict',fields:['performances','private-field'],conflictId:id,conflictKeys:['bestTime','private-key']},
  canonicalQuestList:()=>[{id:'known-quest',legacyIndex:null},{id:'old-quest',legacyIndex:195}],
  recordCloudDiagnostic:(event,details)=>records.push({event,...JSON.parse(JSON.stringify(details))})});
 vm.runInContext(ui.slice(start,end),context);
 assert.equal(records.length,1);
 assert.equal(records[0].conflictId,['known-quest','195'].includes(id)?id:null,'Known public quest identity is retained; arbitrary profile keys are not');
 assert.deepEqual(records[0].fields,['performances','unknown_field']);
 assert.deepEqual(records[0].conflictKeys,['bestTime','unknown_field']);
 assert(!JSON.stringify(records).includes('private-'));
}
console.log('Exact known reward identity and bounded fields remain diagnosable without private profile keys');
