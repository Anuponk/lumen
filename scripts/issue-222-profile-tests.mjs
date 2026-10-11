import assert from "node:assert/strict";
import {projectCanonicalProfile,restoreLegacyFromProjection} from "../src/persistence/canonical-profile.js";
import {canonicalQuestForLegacy} from "../src/campaign/canonical-quests.js";
const profile={solved:{"0":true,"78":true,"195":true,"295":true},
 badges:{"0":{speed:true},"295":{mastery:true}},performances:{"195":{bestTime:41}},stars:{"78":3},
 shards:9,xp:800,legacyAdventureAccess:["real-adventure-04"],streak:{current:7},purchaseEntitlements:["abc"],extraNewField:{nested:[1,2,3]}};
const backup=structuredClone(profile),view=projectCanonicalProfile(profile);
assert.deepEqual(profile,backup,"Projection may not mutate input");
assert.equal(view.nextOrdinal,2);
assert.equal(view.questStateById[canonicalQuestForLegacy(295).id].badges.mastery,true);
assert.equal(view.questStateById[canonicalQuestForLegacy(195).id].performances.bestTime,41);
assert.deepEqual(restoreLegacyFromProjection(view),profile,"Rollback must be bit-for-bit data equivalent");
const repeat=projectCanonicalProfile(restoreLegacyFromProjection(view));
assert.deepEqual(repeat,view,"Projection must be deterministic and idempotent");
assert.throws(()=>projectCanonicalProfile({...profile,solved:{"999999":true}}),/Unknown historic quest/);
assert.throws(()=>projectCanonicalProfile({...profile,badges:{"abc":{speed:true}}}),/Invalid legacy quest key/);
assert.equal(view.source.shards,9);
assert.deepEqual(view.source.purchaseEntitlements,["abc"]);
console.log("Lossless canonical cloud projection, rollback, and unknown-key protections passed");
