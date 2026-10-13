import assert from 'node:assert/strict';
import {rng,generate,connected,countSolutions,signature,replay,features,selectCandidates,FAMILIES} from './generate-diverse-grids.mjs';

assert.equal(FAMILIES.length,5);
assert.equal(rng(123)(),rng(123)());
assert.throws(()=>selectCandidates({family:'unknown'}),/Invalid/);
assert.throws(()=>selectCandidates({size:12}),/Invalid/);
const rnd=rng(340);
for(const family of FAMILIES){
  for(let i=0;i<20;i++){
    const p=generate(7,family,rnd);
    if(!p)continue;
    assert.equal(connected(p.reg),true);
    assert.equal(new Set(p.sol).size,7);
    for(let r=1;r<7;r++)assert.ok(Math.abs(p.sol[r]-p.sol[r-1])>1);
    assert.equal(signature(p.reg),signature(p.reg.map(row=>row.slice().reverse())));
    assert.ok(countSolutions(p)>=1);
  }
}
const first=selectCandidates({size:6,family:'hybrid',count:1,seed:340,attempts:2000});
const second=selectCandidates({size:6,family:'hybrid',count:1,seed:340,attempts:2000});
assert.deepEqual(first,second,'Seed must reproduce all selected candidates');
for(const p of first.selected){
  assert.equal(connected(p.reg),true);
  assert.equal(countSolutions(p),1);
  const proof=replay(p);
  assert.ok(proof,'Proof must finish without guessing');
  assert.equal(features(p,proof).score,p.audit.score);
}
console.log('Diverse grid generator contract passed. Candidates:',first.validCandidates,'selected:',first.selected.length);
