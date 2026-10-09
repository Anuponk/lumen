import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fileURLToPath} from "node:url";
import {CONSTELLATION_PREVIEW_CATALOGUE} from "../src/campaign/constellation-preview.js";
import {BASE_CONSTELLATIONS} from "../src/campaign/content.js";
const config=JSON.parse(fs.readFileSync(new URL("../content/first-adventure-preview.json",import.meta.url),"utf8"));
test("first adventure contains 10 unique unpublished IAU constellations",()=>{
 assert.equal(config.constellations.length,10);
 assert.equal(config.constellations.length*config.questsPerConstellation,100);
 const ids=new Set(config.constellations.map(c=>c.id));
 assert.equal(ids.size,10);
 const existing=new Set(BASE_CONSTELLATIONS.map(c=>c.id));
 for(const c of config.constellations){
  const preview=CONSTELLATION_PREVIEW_CATALOGUE.find(x=>x.id===c.id);
  assert.ok(preview,c.id);
  assert.equal(preview.published,false,c.id);
  assert.equal(preview.name,c.name);
  assert.ok(!existing.has(c.id),c.id);
 }
});
