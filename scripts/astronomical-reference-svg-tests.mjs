import assert from "node:assert/strict";
import {astronomicalReferenceSvg,astronomicalPrimarySvg} from "../src/ui/astronomical-reference-svg.js";
import {CONTENT_CONSTELLATIONS} from "../src/campaign/content.js";
import {CONSTELLATIONS} from "../src/campaign/data.js";
import {readFileSync} from "node:fs";
const original=JSON.stringify(CONSTELLATIONS);
assert.equal(CONTENT_CONSTELLATIONS.length>=24,true);
for(let i=0;i<24;i++){
 const svg=astronomicalReferenceSvg({id:CONTENT_CONSTELLATIONS[i].id});
 assert.match(svg,/astronomical-reference/);
 assert.match(svg,/<line /);
 assert.match(svg,/<circle /);
 assert.equal(svg.includes('class="sky-star on"'),false,"No false illuminated stars");
}
assert.equal(astronomicalReferenceSvg({id:"missing"}),"");
assert.equal(astronomicalPrimarySvg({id:"missing"}),"");
for(let i=0;i<24;i++){const svg=astronomicalPrimarySvg({id:CONTENT_CONSTELLATIONS[i].id});assert.match(svg,/class="sky-line"/);assert.match(svg,/class="sky-star"/);assert.doesNotMatch(svg,/sky-star on/,"No false star progress may be assigned to HIP IDs");}
assert.equal(JSON.stringify(CONSTELLATIONS),original,"Historical catalogue not mutated");
const source=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.equal((source.match(/astronomicalReferenceSvg\(\{id:CONTENT_CONSTELLATIONS\[/g)||[]).length,2,"Detail and reveal both use real atlas");
console.log("Astronomical overlays verified on historical detail and celebrations");
