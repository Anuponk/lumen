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
const progress={solved:{"0":1,"2":1},canonicalQuestState:{d:{solved:true}}};
assert.deepEqual(unlockedAdventureProgress(progress,[],null,packs,quests),{completed:1,total:2},"locked adventures excluded");
assert.deepEqual(unlockedAdventureProgress(progress,["extra"],null,packs,quests),{completed:3,total:4},"unlocked adventures count real completions");
assert.deepEqual(unlockedAdventureProgress({...progress,solved:{"0":1,"1":1}},[],null,packs,quests),{completed:2,total:2},"distinct completions");
assert.deepEqual(unlockedAdventureProgress({solved:{"0":1},legacyAdventureAccess:["extra"]},[],null,packs,quests),{completed:1,total:4},"restored access");
assert.deepEqual(unlockedAdventureProgress(progress,[],null,packs,quests),unlockedAdventureProgress(progress,[],null,packs,quests),"replay is idempotent");
console.log("Unlocked adventure progress tests passed");
