import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createOutboxHealthReporter} from '../src/persistence/outbox-health.js';
test('outbox health survives quota, deduplicates, and never transmits operation facts',async()=>{
 const calls=[],client={};
 const reporter=createOutboxHealthReporter({storage:{getItem(){throw Error('quota')}},newId:()=> '00000000-0000-0000-0000-000000000001',
  now:()=> '2026-10-22T04:00:00Z',send:async(_client,payload)=>calls.push(payload)});
 const input={userId:'synthetic',client,platform:'android-pwa',pending:[{createdAt:'2026-10-22T03:00:00Z',reward:{private:'secret'},operationId:'must-not-leak',email:'private@example.invalid'}]};
 await reporter.report(input);await reporter.report(input);assert.equal(calls.length,1);
 assert.equal(calls[0].p_pending,1);assert.equal(calls[0].p_oldest_at,'2026-10-22T03:00:00.000Z');
 assert(!/secret|must-not-leak|email|reward/.test(JSON.stringify(calls)));
 await reporter.report({...input,state:'confirmed',pending:[]});assert.equal(calls.length,2);assert.equal(calls[1].p_pending,0);
});
