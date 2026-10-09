import test from "node:test";
import assert from "node:assert/strict";
import {IAU_CONSTELLATIONS} from "../src/campaign/iau-constellations.js";
import {unpublishedIauConstellations,PUBLISHED_IAU_ABBREVIATIONS} from "./unpublished-iau-constellations.mjs";
test("IAU registry contains exactly 88 distinct names and identifiers",()=>{
 assert.equal(IAU_CONSTELLATIONS.length,88);
 assert.equal(new Set(IAU_CONSTELLATIONS.map(c=>c.abbr)).size,88);
 assert.equal(new Set(IAU_CONSTELLATIONS.map(c=>c.latin)).size,88);
});
test("never propose any of the 24 published Lumen constellations",()=>{
 const candidates=unpublishedIauConstellations();
 assert.equal(candidates.length,64);
 assert.ok(candidates.every(c=>!PUBLISHED_IAU_ABBREVIATIONS.includes(c.abbr)));
 assert.ok(candidates.every(c=>!c.astronomyVerified&&c.silhouette===null));
});
