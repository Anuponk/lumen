import assert from 'node:assert/strict';
import { test } from 'node:test';
import { processAccountErasure } from '../src/privacy/private-erasure-worker.mjs';
const id='00000000-0000-4000-8000-000000000001', now=1700000000000;
const base={authenticatedUser:{id},session:{user_id:id,expires_at:now+60000},verifiedAt:now-1000,confirmation:'SUPPRIMER',now};
test('transaction reviews then erases only verified user',async()=>{
 const calls=[];
 const result=await processAccountErasure({...base,resolveVerifiedActors:async uid=>{assert.equal(uid,id);return ['verified-actor']},
 withOperatorTransaction:async fn=>fn({review:async(...args)=>calls.push(['review',...args]),erase:async(...args)=>{calls.push(['erase',...args]);return {ok:true}}})});
 assert.equal(result.status,'erasure_committed');
 assert.deepEqual(calls,[['review',id,['verified-actor']],['erase',id,['verified-actor'],'ERASE LUMEN '+id]]);
});
test('rejects ambiguous actor scope before transaction',async()=>{
 let called=false;
 await assert.rejects(processAccountErasure({...base,resolveVerifiedActors:async()=>['dup','dup'],withOperatorTransaction:async()=>{called=true}}));
 assert.equal(called,false);
});
test('does not report completion when transaction fails',async()=>{
 let completed=false;
 await assert.rejects(processAccountErasure({...base,resolveVerifiedActors:async()=>[],withOperatorTransaction:async fn=>fn({review:async()=>{},erase:async()=>{throw Error('rollback')}}),onCompleted:async()=>{completed=true}}));
 assert.equal(completed,false);
});
test('rejects stale authentication before any dependency invocation',async()=>{
 let called=false;
 await assert.rejects(processAccountErasure({...base,verifiedAt:now-600000,resolveVerifiedActors:async()=>{called=true;return []},withOperatorTransaction:async()=>{called=true}}));
 assert.equal(called,false);
});
