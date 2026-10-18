import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalQuestList,canonicalCampaignQuestDecision} from '../src/campaign/canonical-quests.js';
import {currentCatalogueOrigin,catalogueOrigin,mergeCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {createLocalPersistence} from '../src/persistence/local.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';
const history=JSON.parse(fs.readFileSync('content/catalogue/access-origins.json','utf8'));
assert.equal(history.version,1);
const hash=quest=>createHash('sha256').update(JSON.stringify({reg:quest.reg,sol:quest.sol})).digest('hex');
const active=canonicalQuestList().map(({id,legacyIndex,packId,constellationId,ordinal,...quest})=>({id,legacyIndex,packId,constellationId,ordinal,gridHash:hash(quest)}));
assert.equal(history.current,history.catalogues.at(-1).revision);
assert.deepEqual(history.catalogues.at(-1).quests,active,'Catalogue changes require a new immutable revision before publishing');
let previous=[];
let previousRevision=0;
for(const revision of history.catalogues){
 assert.ok(Number.isSafeInteger(revision.revision)&&revision.revision>previousRevision,'Published revisions are unique and strictly increasing');
 previousRevision=revision.revision;
 assert.equal(new Set(revision.quests.map(q=>q.id)).size,revision.quests.length);
 assert.equal(revision.digest,createHash('sha256').update(JSON.stringify(revision.quests)).digest('hex'),'Historical metadata must retain its recorded digest');
 for(const quest of previous){
  const current=revision.quests.find(q=>q.id===quest.id);
  assert.ok(current,'Removing a stable quest requires an explicit supported migration');
  assert.equal(current.packId,quest.packId,'Cross-pack moves require explicit rights migration');
  assert.equal(current.legacyIndex,quest.legacyIndex,'Never reinterpret a historical save key');
  if(quest.gridHash){
   assert.equal(current.gridHash,quest.gridHash,'An ID cannot be reused for another puzzle');
   assert.equal(current.constellationId,quest.constellationId,'Future constellation moves require explicit acquired-access migration');
  }
 }
 previous=revision.quests;
}
const migrations=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
const serverRevision=migrations.flatMap(file=>[...fs.readFileSync('supabase/migrations/'+file,'utf8').matchAll(/catalogue-origin-current: (\d+)/g)].map(match=>Number(match[1]))).at(-1);
assert.equal(serverRevision,currentCatalogueOrigin,'A catalogue revision also updates the server cohort guard in an additive migration');

let stored=null;
const storage={getItem:()=>stored,setItem:(_key,value)=>stored=value};
const local=createLocalPersistence(storage,()=>progress);
let progress=local.loadLumenProgress();
assert.equal(progress.catalogueOrigin,currentCatalogueOrigin,'Fresh guests are never treated as historical profiles');
const entitlements=CONTENT_PACKS.map(pack=>pack.id);
for(const [i,quest] of canonicalQuestList().entries()){
 assert.equal(canonicalCampaignQuestDecision(quest,progress,{entitlements}).status,'ready','Sequential new-player frontier');
 const next=canonicalQuestList()[i+1];
 if(next)assert.equal(canonicalCampaignQuestDecision(next,progress,{entitlements}).status,'prerequisite','Owning an adventure never skips its prerequisites');
 if(quest.legacyIndex===null){progress.canonicalQuestState??={};progress.canonicalQuestState[quest.id]={solved:true}}
 else progress.solved[quest.legacyIndex]=1;
 local.saveLumenProgress();progress=local.loadLumenProgress();
 assert.equal(progress.catalogueOrigin,currentCatalogueOrigin,'The cohort survives reload after every quest');
}
assert.equal(catalogueOrigin({solved:{0:1}}),1,'Unversioned nonempty profiles retain the frozen legacy cohort');
assert.equal(catalogueOrigin({solved:{}}),currentCatalogueOrigin);
assert.throws(()=>catalogueOrigin({catalogueOrigin:999}),/Unsupported/);
assert.equal(mergeCatalogueOrigin({catalogueOrigin:2},{catalogueOrigin:1,solved:{0:1}}).ok,false,'Conflicting cohorts require review rather than guessed rights');
assert.deepEqual(mergeCatalogueOrigin({solved:{0:1}},{catalogueOrigin:2,solved:{0:1}}),{ok:true,value:2},'An old-client cache does not override the explicit server cohort');
console.log(JSON.stringify({catalogueRevisions:history.catalogues.length,questIdentities:active.length,newPlayerReloads:active.length,compatible:true}));
