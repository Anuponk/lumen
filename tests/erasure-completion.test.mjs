import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createErasureCompletion} from '../src/privacy/erasure-completion.mjs';
test('post-commit cleanup revokes proof before invalidating Lumen sessions',async()=>{
 const calls=[];
 const complete=createErasureCompletion({revokeReauthProofs:async id=>calls.push('proof:'+id),invalidateLumenSessions:async id=>calls.push('session:'+id)});
 await complete('user-1');
 assert.deepEqual(calls,['proof:user-1','session:user-1']);
});
test('failed proof revocation prevents falsely claiming completed cleanup',async()=>{
 let invalidated=false;
 const complete=createErasureCompletion({revokeReauthProofs:async()=>{throw Error('db unavailable')},invalidateLumenSessions:async()=>{invalidated=true}});
 await assert.rejects(complete('user-1'));
 assert.equal(invalidated,false);
});
