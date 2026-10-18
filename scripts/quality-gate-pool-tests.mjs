import test from 'node:test';
import assert from 'node:assert/strict';
import {runPool} from './quality-gate-pool.mjs';

test('bounded pool overlaps independent tasks, executes each once and drains after failure',async()=>{
 let active=0,max=0;
 const completed=[];
 const tasks=Array.from({length:7},(_,i)=>async()=>{
  active++;max=Math.max(max,active);
  await new Promise(resolve=>setTimeout(resolve,5));
  active--;completed.push(i);
  if(i===1||i===4)throw Error('regression '+i);
 });
 await assert.rejects(runPool(tasks,2),error=>{
  assert.equal(error.errors.length,2);return true;
 });
 assert.equal(max,2);
 assert.equal(active,0);
 assert.deepEqual(completed.sort(),[0,1,2,3,4,5,6]);
});
test('default is serial; invalid worker counts fail before tasks start',async()=>{
 const order=[];
 await runPool([async()=>order.push(1),async()=>order.push(2)]);
 assert.deepEqual(order,[1,2]);
 for(const workers of [0,3,NaN,1.5])await assert.rejects(runPool([],workers));
});
