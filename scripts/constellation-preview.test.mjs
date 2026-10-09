import test from "node:test";
import assert from "node:assert/strict";
import {CONSTELLATION_PREVIEW_CATALOGUE,getConstellationPreview} from "../src/campaign/constellation-preview.js";
test("all 88 constellation previews have unique identifiers and valid line art",()=>{
 assert.equal(CONSTELLATION_PREVIEW_CATALOGUE.length,88);
 assert.equal(new Set(CONSTELLATION_PREVIEW_CATALOGUE.map(c=>c.id)).size,88);
 assert.equal(CONSTELLATION_PREVIEW_CATALOGUE.filter(c=>c.published).length,24);
 assert.equal(CONSTELLATION_PREVIEW_CATALOGUE.filter(c=>!c.published).length,64);
 for(const c of CONSTELLATION_PREVIEW_CATALOGUE){
  assert.ok(c.points.length>0,c.id);
  assert.ok(c.edges.every(([a,b])=>a>=0&&b>=0&&a<c.points.length&&b<c.points.length),c.id);
 }
});
test("unpublished silhouettes stay explicitly preview-only",()=>{
 assert.ok(CONSTELLATION_PREVIEW_CATALOGUE.filter(c=>!c.published).every(c=>c.requiresSourceReview));
 assert.equal(getConstellationPreview("unknown"),null);
});
