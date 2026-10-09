import test from 'node:test';
import assert from 'node:assert/strict';
import {mapConstellationRange,generatedMapSummary} from '../src/campaign/generated-map.js';
test('historical constellation range stays unchanged',()=>{
 const c=mapConstellationRange(0);
 assert.equal(c.generated,false);
 assert.equal(generatedMapSummary(0),null);
});
test('ten new constellations have contiguous quest ranges',()=>{
 for(let i=0;i<10;i++){
  const c=mapConstellationRange(24+i);
  assert.equal(c.generated,true);
  assert.equal(c.count,10);
  assert.deepEqual(c.quests,Array.from({length:10},(_,j)=>196+i*10+j));
 }
});
test('generated summary reflects saved completions',()=>{
 const c=generatedMapSummary(24,{196:1,197:1});
 assert.equal(c.completed,2);
 assert.equal(c.next,198);
 assert.equal(c.complete,false);
});
