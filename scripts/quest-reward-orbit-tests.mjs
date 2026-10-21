import test from 'node:test';
import assert from 'node:assert/strict';
import {astronomicalPrimarySvg} from '../src/ui/astronomical-reference-svg.js';
import {verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';

const entry={id:'real-adventure-03-new-01'};
const figure=verifiedAstronomicalFigure(entry),before=JSON.stringify(figure);

test('every quest reward has a distinct decorative mark, independently of atlas point count',()=>{
 for(const total of [1,4,10,17,31]){
  for(let earned=0;earned<=total;earned++){
   const svg=astronomicalPrimarySvg(entry,earned,total);
   assert.equal((svg.match(/data-reward-index=/g)||[]).length,total);
   assert.equal((svg.match(/class="quest-reward on/g)||[]).length,earned);
   assert.equal((svg.match(/class="sky-star /g)||[]).length,figure.pts.length,'Real astronomical points must not be fabricated or removed');
  }
 }
 assert.equal(JSON.stringify(figure),before);
});

test('new reward animates even when no extra astronomical point can light up; replay does not',()=>{
 const total=figure.pts.length+5;
 for(let earned=1;earned<=total;earned++){
  const svg=astronomicalPrimarySvg(entry,earned,total,earned-1);
  assert.equal((svg.match(/new-reward/g)||[]).length,1);
  assert.doesNotMatch(astronomicalPrimarySvg(entry,earned,total,earned),/new-reward/);
 }
 assert.doesNotMatch(astronomicalPrimarySvg(entry,0,0),/quest-reward on/);
 assert.equal(astronomicalPrimarySvg({id:'unknown'},2,10),'','No decorative geometry can substitute for a missing astronomical reference');
});
