import assert from "node:assert/strict";
import {buildAstronomicalCatalogue} from "./build-astronomical-catalogue.mjs";
const source={constellations:[
 {iau:"Ori",lines:[[1,2,3],[3,4]]},
 {iau:"And",lines:[[10,11]]}
]};
const positions={
 1:{raDeg:359,decDeg:0},2:{raDeg:0,decDeg:0},
 3:{raDeg:1,decDeg:0},4:{raDeg:1,decDeg:-3},
 10:{raDeg:20,decDeg:40}
};
const before=structuredClone({source,positions});
const {figures,coverage,summary}=buildAstronomicalCatalogue(source,positions);
assert.deepEqual(summary,{total:2,complete:1,incomplete:1});
assert.deepEqual(figures.Ori.edges,[[0,1],[1,2],[2,3]]);
assert.equal(figures.And,undefined,"Incomplete figures must not be emitted");
assert.deepEqual(coverage.find(x=>x.iau==="And").missingHip,["11"]);
assert.deepEqual({source,positions},before,"Input catalogue is immutable");
assert.throws(()=>buildAstronomicalCatalogue({constellations:[source.constellations[0],source.constellations[0]]},positions),/duplicate IAU/);
assert.equal(buildAstronomicalCatalogue({constellations:[{iau:"Ori",lines:[[1,99]]}]},positions).summary.incomplete,1);
console.log("Astronomical source ingestion and completeness OK");
