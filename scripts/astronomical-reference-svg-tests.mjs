import assert from "node:assert/strict";
import {astronomicalReferenceSvg,astronomicalPrimarySvg,astronomicalIllumination} from "../src/ui/astronomical-reference-svg.js";
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
for(let i=0;i<24;i++){const svg=astronomicalPrimarySvg({id:CONTENT_CONSTELLATIONS[i].id});assert.match(svg,/class="sky-line /);assert.match(svg,/class="sky-star /);assert.doesNotMatch(svg,/sky-star on/,"At zero progress, no real star should be lit");}
const orion={id:CONTENT_CONSTELLATIONS[11].id};
const zero=astronomicalIllumination(orion,0,17);
const half=astronomicalIllumination(orion,8,17);
const full=astronomicalIllumination(orion,17,17);
assert.equal(zero.litIndices.size,0);
assert(half.litIndices.size>0&&half.litIndices.size<full.litIndices.size);
assert.equal(full.litIndices.size,full.figure.count,"All atlas stars light up on completion");
assert.deepEqual([...astronomicalIllumination(orion,8,17).litIndices],[...half.litIndices],"Mapping must be stable");
assert.match(astronomicalPrimarySvg(orion,8,17),/sky-star on/,"Earned stars visibly illuminate real HIP points");
assert.match(astronomicalPrimarySvg(orion,17,17),/sky-line on/,"Completed real atlas lines illuminate");
assert.equal(JSON.stringify(CONSTELLATIONS),original,"Historical catalogue not mutated");
const source=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.equal((source.match(/astronomicalPrimarySvg\(\{id:CONTENT_CONSTELLATIONS\[/g)||[]).length,1,"Historical detail uses the genuine shape");
assert.equal((source.match(/astronomicalReferenceSvg\(\{id:CONTENT_CONSTELLATIONS\[/g)||[]).length,0,"Old overlay does not compete with genuine shape");
console.log("Astronomical overlays verified on historical detail and celebrations");

const arrived=astronomicalPrimarySvg(orion,17,17,8);
assert.match(arrived,/new-star/,"Newly illuminated real stars animate after a win");
assert.match(arrived,/new-line/,"Newly illuminated links animate after a win");
assert.doesNotMatch(astronomicalPrimarySvg(orion,17,17,17),/new-star|new-line/,"Replays never animate a new star");
