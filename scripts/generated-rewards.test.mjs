import test from 'node:test';
import assert from 'node:assert/strict';
import {generatedQuestReward,generatedAdventureRewards} from '../src/campaign/generated-rewards.js';
test('generated constellation rewards',()=>{
 assert.equal(generatedQuestReward(196).stars,1);
 assert.equal(generatedQuestReward(200).stars,2);
 assert.equal(generatedQuestReward(205).stars,3);
 assert.equal(generatedQuestReward(196,false).stars,0);
 assert.equal(generatedQuestReward(195).stars,0);
});
test('rewards accumulate only from generated quests',()=>{
 const solved={0:1,195:1,196:1,200:1,205:1};
 const rewards=generatedAdventureRewards(solved);
 assert.equal(rewards.stars,6);
 assert.equal(rewards.completed,3);
 assert.equal(rewards.complete,false);
});
