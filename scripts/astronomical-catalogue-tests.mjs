import assert from "node:assert/strict";
import {buildAstronomicalCatalogue} from "./build-astronomical-catalogue.mjs";
const source={constellations:[
 {iau:"Ori",lines:[[1,2,3],[3,4]]},
 {iau:"And",lines:[["thin",10,11]]}
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
const styled=buildAstronomicalCatalogue({constellations:[{iau:"Ori",lines:[["thin",1,2,3],["bold",2,4]]}]},positions);
assert.deepEqual(styled.figures.Ori.edges,[[0,1],[1,2],[1,3]]);
assert.equal(styled.figures.Ori.hipIds.includes("thin"),false);
assert.deepEqual({source,positions},before,"Input catalogue is immutable");
assert.throws(()=>buildAstronomicalCatalogue({constellations:[source.constellations[0],source.constellations[0]]},positions),/duplicate IAU/);
assert.equal(buildAstronomicalCatalogue({constellations:[{iau:"Ori",lines:[[1,99]]}]},positions).summary.incomplete,1);
const mixedCase=buildAstronomicalCatalogue({constellations:[
 {iau:"UMa",lines:[[1,2]]},{iau:"CVn",lines:[[2,3]]},{iau:"CMi",lines:[[3,4]]},{iau:"CrB",lines:[[1,4]]}
]},positions);
assert.deepEqual(mixedCase.summary,{total:4,complete:4,incomplete:0},"Valid official mixed-case IAU codes accepted");
assert.deepEqual(Object.keys(mixedCase.figures).sort(),["CMi","CVn","CrB","UMa"].sort());
assert.throws(()=>buildAstronomicalCatalogue({constellations:[{iau:"uma",lines:[[1,2]]}]},positions),/Invalid or duplicate IAU/);
console.log("Astronomical source ingestion and completeness OK");
