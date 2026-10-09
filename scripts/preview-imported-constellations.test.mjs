import test from "node:test";
import assert from "node:assert/strict";
import {previewImportedConstellations} from "./preview-imported-constellations.mjs";
test("all 64 unpublished IAU constellations have usable line geometry",()=>{
 const result=previewImportedConstellations();
 assert.equal(result.count,64);
 assert.equal(new Set(result.entries.map(c=>c.abbr)).size,64);
 assert.ok(result.entries.every(c=>c.points.length>=2&&c.edges.length>=1));
 assert.ok(result.entries.every(c=>!c.readyForPublication&&c.licenseReviewRequired));
});
