import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueQuestDecision,offlineVerifiedAccess} from '../src/campaign/catalogue-access.js';

const quests=[{id:'q1',ordinal:1,legacyIndex:0,packId:'p',constellationId:'c'},
 {id:'q2',ordinal:10,legacyIndex:1,packId:'p',constellationId:'c'}];
const progress={solved:{0:true}};
const context={packAllowed:true,signedIn:true,cloudReady:false,originQuests:quests};
test('verified existing account can access the next quest offline',()=>{
 assert.equal(catalogueQuestDecision(quests[1],progress,quests,{...context,offline:true,verifiedSession:true}).status,'ready');
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
