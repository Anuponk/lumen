import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {astronomicalPrimarySvg,astronomicalIllumination} from '../src/ui/astronomical-reference-svg.js';
import {verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';
import {secondaryStarPositions} from '../src/ui/quest-secondary-stars.js';
import {readFileSync} from 'node:fs';

const small={id:'real-adventure-03-new-01'},large=CONTENT_CONSTELLATIONS.find(c=>verifiedAstronomicalFigure(c)?.iau==='Ori');
test('no crowns and no unnecessary decorative stars when real points cover all victories',()=>{
 for(const entry of [small,large])for(const total of [1,4,10,17,31]){
  const figure=verifiedAstronomicalFigure(entry),before=JSON.stringify(figure);
  for(let earned=0;earned<=total;earned++){
   const svg=astronomicalPrimarySvg(entry,earned,total),data=astronomicalIllumination(entry,earned,total);
   assert.doesNotMatch(svg,/quest-reward-orbit|class="quest-reward/,'The rejected crown must disappear from every figure');
   assert.equal((svg.match(/data-secondary-index=/g)||[]).length,Math.max(0,total-figure.count));
   assert.equal((svg.match(/class="quest-secondary-star on/g)||[]).length,Math.max(0,earned-figure.count));
   assert.equal(data.litIndices.size,figure.count>=total?Math.floor(earned*figure.count/total):Math.min(earned,figure.count));
   assert.equal((svg.match(/class="sky-star /g)||[]).length,figure.count);
   assert.equal((svg.match(/class="sky-line /g)||[]).length,figure.edges.length);
  }
  assert.equal(JSON.stringify(figure),before,'Real astronomical source must remain immutable');
 }
});
test('every victory changes the sky, with real stars first and only surplus secondary stars',()=>{
 for(const entry of CONTENT_CONSTELLATIONS){
  const figure=verifiedAstronomicalFigure(entry),total=canonicalQuestList().filter(q=>q.constellationId===entry.id).length;
  for(let earned=1;earned<=total;earned++){
   const svg=astronomicalPrimarySvg(entry,earned,total,earned-1);
   assert.match(svg,/new-star|new-secondary/,entry.id+' each victory has a visible new light');
   assert.doesNotMatch(astronomicalPrimarySvg(entry,earned,total,earned),/new-star|new-line|new-secondary/,'Replay adds nothing');
   if(figure.count>=total)assert.doesNotMatch(svg,/quest-secondary-star/,'Large figures need no decoration');
  }
 }
 assert.equal(astronomicalPrimarySvg({id:'unknown'},2,10),'');
 assert.doesNotMatch(astronomicalPrimarySvg(small,0,0),/quest-secondary-star|sky-star on/);
});
test('secondary lights are deterministic, scattered and separate from genuine stars',()=>{
 for(const entry of [small,{id:'iau-ant'},{id:'iau-aps'},{id:'iau-cae'}]){
  const figure=verifiedAstronomicalFigure(entry);
  for(const count of [0,1,5,8,26,103]){
   const points=secondaryStarPositions(figure,count);
   assert.equal(points.length,count);
   assert.deepEqual(secondaryStarPositions(figure,count),points);
   assert.equal(new Set(points.map(p=>JSON.stringify(p))).size,count);
   for(const [x,y] of points){assert(x>=12&&x<=278&&y>=12&&y<=103);assert(figure.pts.every(([a,b])=>Math.hypot(x-a,y-b)>5.9),'Decorations never overlap HIP points');}
  }
 }
});
test('onboarding and motion/accessibility explain the accepted sky presentation',()=>{
 const screen=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const styles=readFileSync(new URL('../src/ui/styles.css',import.meta.url),'utf8');
 assert.match(screen,/target:"skyCard"[^\n]+étoiles réelles[^\n]+étoiles de lumière/);
 assert.doesNotMatch(screen,/Chaque réussite allume un repère doré/);
 assert.match(styles,/\.quest-secondary-star\{opacity:0/);
 assert.match(styles,/\.quest-secondary-star\.on\{opacity:1/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)\{\.quest-secondary-star\.new-secondary\{animation:none\}\}/);
 assert.match(astronomicalPrimarySvg(small,7,10),/aria-label="Étoiles secondaires : 2 sur 5"/);
});
