import test from "node:test";
import assert from "node:assert/strict";
import {prepareAstronomicalBatch} from "./astronomical-batch-review.mjs";
const source={url:"https://example.org/stars",license:"CC0-1.0",attribution:"Test fixture"};
const record={iauAbbr:"Ant",source,stars:[{id:"a",raDeg:1,decDeg:5},{id:"b",raDeg:2,decDeg:7}],edges:[["a","b"]]};
test("reviewed batch remains unpublished until source is checked",()=>{
 const batch=prepareAstronomicalBatch([record]);
 assert.equal(batch.entries[0].id,"iau-ant");
 assert.equal(batch.entries[0].sourceReviewRequired,true);
 assert.equal(batch.entries[0].readyForPublication,false);
 assert.equal(batch.summary.publishable,0);
});
test("refuses already published constellations",()=>{
 assert.throws(()=>prepareAstronomicalBatch([{...record,iauAbbr:"Ori"}]),/Already published/);
});
test("refuses duplicate and unsupported source licenses",()=>{
 assert.throws(()=>prepareAstronomicalBatch([record,record]),/Duplicate/);
 assert.throws(()=>prepareAstronomicalBatch([{...record,source:{...source,license:"unknown"}}]),/Unsupported/);
});
