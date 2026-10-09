import test from "node:test";
import assert from "node:assert/strict";
import {LEGACY_CONSTELLATION_REGISTRY,validateConstellationRegistry,availableConstellations} from "../src/campaign/astronomy-registry.js";
test("legacy constellations retain valid silhouette geometry",()=>{
 const report=validateConstellationRegistry();
 assert.deepEqual(report.errors,[]);
 assert.equal(report.count,LEGACY_CONSTELLATION_REGISTRY.length);
 assert.equal(report.verified,0);
});
test("excludes existing constellations by ID or normalized alias",()=>{
 const first=LEGACY_CONSTELLATION_REGISTRY[0];
 const candidates=availableConstellations({usedIds:[first.id]});
 assert.ok(!candidates.some(c=>c.id===first.id));
 assert.ok(!availableConstellations({usedNames:[first.nameFr.toUpperCase()]}).some(c=>c.id===first.id));
});
test("detects invalid segment coordinates",()=>{
 const broken={...LEGACY_CONSTELLATION_REGISTRY[0],silhouette:{points:[[0,0]],edges:[[0,4]]}};
 assert.equal(validateConstellationRegistry([broken]).ok,false);
});
