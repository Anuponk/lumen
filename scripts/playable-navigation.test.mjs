import test from 'node:test';
import assert from 'node:assert/strict';
import {nextPlayableQuest,resolvePlayableQuest} from '../src/campaign/playable-navigation.js';

const first196=Object.fromEntries(Array.from({length:196},(_,i)=>[i,1]));

test('generated adventure is locked after historical quest 196',()=>{
 const result=nextPlayableQuest(first196);
 assert.equal(result.index,196);
 assert.equal(result.status,'locked');
 assert.equal(result.packId,'real-adventure-04');
});

test('entitled players can open quest 197 and quest 296',()=>{
 const entitlements=['real-adventure-04'];
 const first=nextPlayableQuest(first196,entitlements);
 assert.equal(first.status,'ready');
 assert.equal(first.quest.index,196);
 assert.equal(first.quest.audit.solutions,1);
 const last=resolvePlayableQuest(295,entitlements);
 assert.equal(last.status,'ready');
 assert.equal(last.quest.index,295);
});

test('progress from a started adventure preserves access',()=>{
 const progress={solved:{196:1}};
 const result=resolvePlayableQuest(197,[],progress);
 assert.equal(result.status,'ready');
});

test('historical quests remain available and completed campaign is detected',()=>{
 assert.equal(resolvePlayableQuest(0).status,'ready');
 const all=Object.fromEntries(Array.from({length:296},(_,i)=>[i,1]));
 assert.deepEqual(nextPlayableQuest(all),{status:'complete',index:296});
});
