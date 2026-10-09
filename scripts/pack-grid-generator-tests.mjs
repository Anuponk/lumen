import assert from "node:assert/strict";
import {createRandom,countSolutions,generateUniqueGrid} from "./pack-grid-generator.mjs";

assert.deepEqual(Array.from({length:5},()=>createRandom(123)()),Array.from({length:5},()=>createRandom(123)()));
assert.equal(countSolutions([[0,0],[1,1]]).count,0);
for(const size of [5,6,7]){
 const a=generateUniqueGrid({size,seed:42,maxAttempts:3000});
 const b=generateUniqueGrid({size,seed:42,maxAttempts:3000});
 assert.deepEqual(a,b,"same seed must produce identical puzzle");
 assert.equal(countSolutions(a.reg).count,1);
 assert.equal(a.reg.length,size);
 assert.equal(new Set(a.reg.flat()).size,size);
 assert.equal(new Set(a.sol).size,size);
 for(let r=1;r<size;r++)assert.ok(Math.abs(a.sol[r]-a.sol[r-1])>1);
 for(let r=0;r<size;r++)assert.equal(a.reg[r][a.sol[r]],r);
}
assert.throws(()=>generateUniqueGrid({size:11}),/size/);
assert.throws(()=>generateUniqueGrid({size:5,maxAttempts:0}),/maxAttempts/);
console.log("Pack grid generator: deterministic unique puzzles verified");
