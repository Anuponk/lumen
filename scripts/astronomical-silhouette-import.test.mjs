import test from "node:test";
import assert from "node:assert/strict";
import {projectConstellationStars,importAstronomicalSilhouette} from "./astronomical-silhouette-import.mjs";
const stars=[{id:"a",raDeg:359,decDeg:10},{id:"b",raDeg:1,decDeg:12},{id:"c",raDeg:3,decDeg:9}];
const source={url:"https://example.org/catalogue",license:"CC0-1.0",attribution:"Test fixture only"};
test("RA wrap-around keeps nearby stars near each other",()=>{
 const points=projectConstellationStars(stars);
 assert.ok(Math.abs(points[0][0]-points[1][0])<180);
 assert.ok(points.every(([x,y])=>x>=0&&x<=280&&y>=0&&y<=120));
});
test("import produces indexed lines with explicit provenance",()=>{
 const result=importAstronomicalSilhouette({iauAbbr:"And",stars,edges:[["a","b"],["b","c"]],source});
 assert.deepEqual(result.silhouette.edges,[[0,1],[1,2]]);
 assert.equal(result.astronomyVerified,true);
});
test("rejects missing source and invalid star connections",()=>{
 assert.throws(()=>importAstronomicalSilhouette({iauAbbr:"And",stars,edges:[["a","b"]]}),/provenance/);
 assert.throws(()=>importAstronomicalSilhouette({iauAbbr:"And",stars,edges:[["a","missing"]],source}),/Invalid star connection/);
});
test("rejects duplicate IDs and invalid coordinates",()=>{
 assert.throws(()=>projectConstellationStars([stars[0],stars[0]]),/duplicate/);
 assert.throws(()=>projectConstellationStars([{id:"a",raDeg:360,decDeg:0},stars[1]]),/Invalid sky coordinates/);
});
