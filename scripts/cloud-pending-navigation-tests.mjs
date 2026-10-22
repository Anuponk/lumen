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
