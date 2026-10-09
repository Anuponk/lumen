import test from "node:test";
import assert from "node:assert/strict";
import {difficultyTargets} from "./pack-difficulty-targets.mjs";
test("exact deterministic quotas with stable remainder ties",()=>{
 const q=difficultyTargets({beginner:0.25,easy:0.25,intermediate:0.5},7);
 assert.deepEqual(q.counts,{beginner:2,easy:2,intermediate:3,hard:0,expert:0});
 assert.equal(q.targets.length,7);
});
test("invalid distributions are rejected",()=>{
 assert.throws(()=>difficultyTargets({easy:0.5},10),/sum to 1/);
 assert.throws(()=>difficultyTargets({unknown:1},10),/sum to 1/);
 assert.equal(difficultyTargets(null,5),null);
});
