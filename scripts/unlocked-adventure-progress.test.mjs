import assert from "node:assert/strict";
import {unlockedAdventureProgress} from "../src/campaign/canonical-quests.js";

const packs=[
 {id:"base",kind:"base",access:"included",questIndices:[0,1]},
 {id:"extra",kind:"addon",access:"locked",questIndices:[2,3]}
];
const quests=[
 {id:"a",packId:"base",legacyIndex:0},
 {id:"b",packId:"base",legacyIndex:1},
 {id:"c",packId:"extra",legacyIndex:2},
 {id:"d",packId:"extra",legacyIndex:null}
];
const lockedProgress={solved:{"0":1},canonicalQuestState:{}};
assert.deepEqual(unlockedAdventureProgress(lockedProgress,[],null,packs,quests),{completed:1,total:2},"unstarted locked adventures excluded");
const progress={solved:{"0":1,"2":1},canonicalQuestState:{d:{solved:true}}};
assert.deepEqual(unlockedAdventureProgress(progress,[],null,packs,quests),{completed:3,total:4},"started adventures retain access without an entitlement");
assert.deepEqual(unlockedAdventureProgress(progress,["extra"],null,packs,quests),{completed:3,total:4},"unlocked adventures count real completions");
assert.deepEqual(unlockedAdventureProgress({...lockedProgress,solved:{"0":1,"1":1}},[],null,packs,quests),{completed:2,total:2},"distinct completions");
assert.deepEqual(unlockedAdventureProgress({solved:{"0":1},legacyAdventureAccess:["extra"]},[],null,packs,quests),{completed:1,total:4},"restored access");
assert.deepEqual(unlockedAdventureProgress(progress,[],null,packs,quests),unlockedAdventureProgress(progress,[],null,packs,quests),"replay is idempotent");

// No progress mutation while browsing/restoring; READY and social attempts are
// not proof that an Adventure was started in the campaign.
const before=structuredClone(lockedProgress);
for(const attempt of [{questId:3,mode:"campaign",startedAt:null},{questId:3,mode:"challenge",startedAt:1}]){
 assert.deepEqual(unlockedAdventureProgress(lockedProgress,[],attempt,packs,quests),{completed:1,total:2});
}
assert.deepEqual(unlockedAdventureProgress(lockedProgress,[],{questId:3,mode:"campaign",startedAt:1},packs,quests),{completed:1,total:4});
assert.deepEqual(lockedProgress,before);

// A formerly complete Adventure becomes partial when catalogue quests are
// appended. Reordered metadata, canonical-only quests and different pack sizes
// must use their stable identities, preserving the old save after reload.
const restored=JSON.parse(JSON.stringify({...progress,solved:{0:1,1:1,2:1}}));
const saved=structuredClone(restored);
const expanded=[...quests,{id:"e",packId:"extra",legacyIndex:null}];
assert.deepEqual(unlockedAdventureProgress(restored,[],null,packs,quests),{completed:4,total:4});
assert.deepEqual(unlockedAdventureProgress(restored,[],null,[...packs].reverse(),[...expanded].reverse()),{completed:4,total:5});
assert.deepEqual(restored,saved,"catalogue growth and browsing must preserve the entire restored save");
restored.canonicalQuestState.e={solved:true};
assert.deepEqual(unlockedAdventureProgress(restored,[],null,packs,expanded),{completed:5,total:5});
assert.deepEqual(unlockedAdventureProgress({},[],null,[],[]),{completed:0,total:0});
console.log("Unlocked adventure progress tests passed");
