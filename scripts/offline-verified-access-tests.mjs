import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {catalogueQuestDecision,offlineVerifiedAccess} from '../src/campaign/catalogue-access.js';
import {createCloudPersistence} from '../src/persistence/cloud.js';

const quests=[{id:'q1',ordinal:1,legacyIndex:0,packId:'p',constellationId:'c'},
 {id:'q2',ordinal:10,legacyIndex:1,packId:'p',constellationId:'c'}];
const progress={solved:{0:true}};
const context={packAllowed:true,signedIn:true,cloudReady:false,originQuests:quests};
test('verified existing account can access the next quest offline',()=>{
 assert.equal(catalogueQuestDecision(quests[1],progress,quests,{...context,offline:true,verifiedSession:true}).status,'ready');
});

test('offline startup does not launch historical cloud recovery or mutate cached acquisitions',async()=>{
 let calls=0;const model={lumenSupabase:{rpc:async()=>{calls++;throw TypeError('disconnected')}},lumenProgress:{performances:{old:{badges:{mastery:true}}}}};
 const before=JSON.stringify(model.lumenProgress);
 const cloud=createCloudPersistence(model,{}, {navigator:{onLine:false}});
 await cloud.cloudMergeHistoricalPerformance();
 assert.equal(calls,0);assert.equal(JSON.stringify(model.lumenProgress),before);
});
test('unverified, signed-out or online sessions cannot bypass hydration',()=>{
 for(const override of [{verifiedSession:false,offline:true},{verifiedSession:true,offline:false},{verifiedSession:true,offline:true,signedIn:false}]){
  assert.equal(offlineVerifiedAccess({...context,...override}),false);
 }
 assert.equal(catalogueQuestDecision(quests[1],progress,quests,{...context,offline:true,verifiedSession:false}).status,'sync-required');
});
test('verified offline access does not unlock a quest before its prerequisite',()=>{
 assert.equal(catalogueQuestDecision(quests[1],{},quests,{...context,offline:true,verifiedSession:true}).status,'prerequisite');
});

test('offline victories must enqueue before cloud readiness and avoid network calls',()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const canonical=source.slice(source.indexOf('async function celebrateCanonicalSuccess()'),source.indexOf('const legacyVictoryOutbox='));
 const legacy=source.slice(source.indexOf('async function captureLegacyCommandVictory()'),source.indexOf('async function celebrateSuccess()'));
 assert(canonical.indexOf('canonicalVictoryOutbox.enqueue(')<canonical.indexOf('if(typeof navigator!=="undefined"&&navigator.onLine===false)throw Error('));
 assert(legacy.includes('if(!cloudProfileReady||(typeof navigator!=="undefined"&&navigator.onLine===false))'));
 assert(legacy.indexOf('legacyVictoryOutbox.enqueue(')<legacy.indexOf("if(!cloudProfileReady||canonicalOutboxRetryInFlight"));
});

