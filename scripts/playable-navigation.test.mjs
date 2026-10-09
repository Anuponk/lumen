import test from 'node:test';
import assert from 'node:assert/strict';
import {nextPlayableQuest} from '../src/campaign/playable-navigation.js';
test('next quest respects pack access',()=>{
 const solved=Object.fromEntries(Array.from({length:196},(_,i)=>[i,1]));
 const result=nextPlayableQuest(solved);
 assert.equal(result.index,196);
 assert.equal(result.status,'locked');
});
