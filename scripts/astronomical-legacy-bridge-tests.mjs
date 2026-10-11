import assert from "node:assert/strict";
import {mapAstronomicalFigureToLegacy,resolveVerifiedAstronomicalShape} from "../src/ui/astronomical-legacy-bridge.js";
const legacy={name:"Example",count:3,pts:[[1,2],[3,4],[5,6]],edges:[[0,1]]};
const ref={count:4,hipIds:["10","20","30","40"],pts:[[100,11],[150,20],[160,32],[200,44]],edges:[[0,2],[2,3],[1,2]]};
const before=structuredClone({legacy,ref});
const shape=mapAstronomicalFigureToLegacy(legacy,ref,["40","10","30"]);
assert.equal(shape.count,3,"Earned star count is historical");
assert.deepEqual(shape.pts,[[200,44],[100,11],[160,32]]);
assert.deepEqual(shape.edges,[[1,2],[2,0]],"Only actual atlas edges with mapped endpoints");
assert.equal(shape.astronomicalSource,true);
assert.deepEqual({legacy,ref},before,"Neither legacy saves nor source shape mutate");
assert.throws(()=>mapAstronomicalFigureToLegacy(legacy,ref,["10","10","30"]),/one-to-one/);
assert.throws(()=>mapAstronomicalFigureToLegacy(legacy,ref,["10","20"]),/count mismatch/);
assert.throws(()=>mapAstronomicalFigureToLegacy(legacy,ref,["10","20","999"]),/one-to-one/);
const originalWarn=console.warn;console.warn=()=>{};
try{assert.equal(resolveVerifiedAstronomicalShape(legacy,{figure:ref,hipByLegacyIndex:["10","10","30"]}),legacy)}
finally{console.warn=originalWarn}
assert.equal(resolveVerifiedAstronomicalShape(legacy),legacy);
console.log("Astronomical legacy star bridge OK");
