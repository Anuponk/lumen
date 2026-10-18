import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudRetryScheduler} from '../src/persistence/cloud-retry-scheduler.js';

function timers(){let id=0;const tasks=new Map();return {tasks,setTimer:(fn,ms)=>{tasks.set(++id,{fn,ms});return id},clearTimer:id=>tasks.delete(id),async fire(){const [key,task]=tasks.entries().next().value;tasks.delete(key);task.fn();for(let i=0;i<8;i++)await Promise.resolve()}};}

test('transient failures back off with a bounded delay and stop after an empty queue',async()=>{
 const time=timers();let pending=true,calls=0;
 const retry=createCloudRetryScheduler({...time,random:()=>1,run:async()=>{calls++;return pending}});
 await retry.wake();
 for(const delay of [2000,4000,8000,16000,32000,60000,60000]){
  assert.equal([...time.tasks.values()][0].ms,delay);await time.fire();
 }
 pending=false;await time.fire();assert.equal(time.tasks.size,0);assert.equal(calls,9);
});

test('online/resume signals cannot create concurrent replay loops',async()=>{
 const time=timers();let finish,calls=0;
 const retry=createCloudRetryScheduler({...time,run:()=>{calls++;return new Promise(resolve=>{finish=resolve})}});
 const a=retry.wake(),b=retry.wake();await Promise.resolve();assert.equal(calls,1);
 finish(false);await Promise.all([a,b]);assert.equal(time.tasks.size,0);
});

test('cancel on an account switch prevents stale completion from scheduling a retry',async()=>{
 const time=timers();let finish;
 const retry=createCloudRetryScheduler({...time,run:()=>new Promise(resolve=>{finish=resolve})});
 const running=retry.wake();await Promise.resolve();retry.cancel();finish(true);await running;
 assert.equal(time.tasks.size,0);
});

test('offline, hidden or unsafe application state holds recovery until explicitly woken',async()=>{
 const time=timers();let allowed=false,calls=0;
 const retry=createCloudRetryScheduler({...time,ready:()=>allowed,run:async()=>{calls++;return true}});
 await retry.wake();retry.schedule();assert.equal(calls,0);assert.equal(time.tasks.size,0);
 allowed=true;await retry.wake();assert.equal(calls,1);assert.equal(time.tasks.size,1);
 allowed=false;await time.fire();assert.equal(calls,1);assert.equal(time.tasks.size,0);
});
