import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPostgresReauthProofStore} from '../src/privacy/postgres-reauth-proof-store.mjs';
const userId='00000000-0000-4000-8000-000000000001',sessionId='00000000-0000-4000-8000-000000000002';
test('writes parameterized, server-timed proof and reads verified timestamp',async()=>{
 const calls=[];const store=createPostgresReauthProofStore({now:()=>1000,query:async(sql,params)=>{calls.push({sql,params});return {rows:[{verified_at:1000}]}}});
 await store.writeProof({userId,sessionId,verifiedAt:1000});
 assert.deepEqual(calls[0].params,[userId,sessionId,1000]);
 assert.equal((await store.readProof({userId,sessionId})).verifiedAt,1000);
 assert.deepEqual(calls[1].params,[userId,sessionId]);
});
test('rejects forged stale timestamps before persistence',async()=>{
 const store=createPostgresReauthProofStore({now:()=>10000,query:async()=>{throw Error('should not write')}});
 await assert.rejects(store.writeProof({userId,sessionId,verifiedAt:1000}));
});
