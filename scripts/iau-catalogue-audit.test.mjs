import test from "node:test";
import assert from "node:assert/strict";
import {auditPublishedIauMapping,unpublishedIauConstellations,previewUnusedIauConstellations} from "./iau-catalogue-audit.mjs";
import {BASE_CONSTELLATIONS} from "../src/campaign/content.js";
test("published constellations match the IAU registry by stable names",()=>{
 const report=auditPublishedIauMapping();
 assert.equal(report.ok,true,report.errors.join("; "));
 assert.equal(report.publishedAbbreviations.length,24);
 assert.equal(unpublishedIauConstellations().length,64);
});
test("reordering legacy content does not change unused selection",()=>{
 const reversed=[...BASE_CONSTELLATIONS].reverse();
 assert.deepEqual(unpublishedIauConstellations({existing:reversed}),unpublishedIauConstellations());
});
test("renamed published constellation fails closed",()=>{
 const changed=BASE_CONSTELLATIONS.map((c,i)=>i===0?{...c,label:"Unmapped constellation"}:c);
 assert.equal(auditPublishedIauMapping({published:changed}).ok,false);
 assert.throws(()=>unpublishedIauConstellations({existing:changed}),/mapping invalid/);
});
test("preview clearly marks silhouettes unavailable",()=>{
 const items=previewUnusedIauConstellations({count:2});
 assert.equal(items.length,2);
 assert.ok(items.every(x=>!x.readyForPublication&&x.silhouette===null));
});
