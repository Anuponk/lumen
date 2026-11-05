import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pendingNavigationProfile} from '../src/persistence/pending-navigation.js';
test('multiple durable offline victories form navigation only, without currency, badges or rights',()=>{
 const profile={solved:{},canonicalQuestState:{},shards:3,xp:0,badges:{},legacyAdventureAccess:[]};
 const raw=JSON.stringify(profile),quests=[{id:'legacy',legacyIndex:0},{id:'new',legacyIndex:null},{id:'other',legacyIndex:2}];
 const entries=[{userId:'a',questId:'legacy'},{userId:'a',questId:'new'},{userId:'b',questId:'other'},{userId:'a',questId:'unknown'}];
 const view=pendingNavigationProfile(profile,entries,'a',quests);
 assert.equal(view.solved[0],1);assert.equal(view.canonicalQuestState.new.pending,true);assert.equal(view.solved[2],undefined);
 assert.equal(view.shards,3);assert.equal(view.xp,0);assert.deepEqual(view.badges,{});assert.deepEqual(view.legacyAdventureAccess,[]);
 assert.equal(JSON.stringify(profile),raw);
 assert.deepEqual(pendingNavigationProfile(profile,JSON.parse(JSON.stringify(entries)),'a',quests),view,'Restarted durable entries produce the same navigation view');
});

test('pending offline victories allow sequential navigation without granting unearned rewards',async()=>{
 const {catalogueQuestDecision}=await import('../src/campaign/catalogue-access.js');
 const quests=[
  {id:'first',ordinal:9,legacyIndex:0,packId:'pack',constellationId:'stars'},
  {id:'second',ordinal:10,legacyIndex:1,packId:'pack',constellationId:'stars'},
  {id:'third',ordinal:11,legacyIndex:null,packId:'pack',constellationId:'stars'}
 ];
 const original={solved:{},canonicalQuestState:{},xp:4,shards:2};
 const entries=[{userId:'owner',questId:'first',operationId:'a'},{userId:'owner',questId:'second',operationId:'b'}];
 const view=pendingNavigationProfile(original,entries,'owner',quests);
 const ctx={packAllowed:true,signedIn:true,cloudReady:false,offline:true,verifiedSession:true,originQuests:quests};
 assert.equal(catalogueQuestDecision(quests[2],view,quests,ctx).status,'ready');
 assert.equal(catalogueQuestDecision(quests[2],original,quests,ctx).status,'prerequisite');
 assert.equal(view.xp,4);assert.equal(view.shards,2);
 assert.equal(original.solved[0],undefined);
 assert.equal(pendingNavigationProfile(original,entries,'other',quests).solved[0],undefined);
});
