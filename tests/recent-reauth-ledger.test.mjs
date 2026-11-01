import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRecentReauthLedger} from '../src/privacy/recent-reauth-ledger.mjs';
const userId='00000000-0000-4000-8000-000000000001';
const sessionId='00000000-0000-4000-8000-000000000002';
test('stores server-owned proof bound to verified user and session',async()=>{
 let proof;let now=1000000;
 const ledger=createRecentReauthLedger({writeProof:async p=>{proof=p},readProof:async()=>proof,now:()=>now});
 await assert.rejects(ledger.recordVerifiedReauth({userId,sessionId,verifiedProviderChallenge:false}));
 await ledger.recordVerifiedReauth({userId,sessionId,verifiedProviderChallenge:true});
 assert.equal(await ledger.lookupRecentReauth({userId,sessionId}),now);
 now+=300001;
 assert.equal(await ledger.lookupRecentReauth({userId,sessionId}),null);
});
test('rejects mismatched or future-dated proofs',async()=>{
 const ledger=createRecentReauthLedger({writeProof:async()=>{},readProof:async()=>({verifiedAt:1100}),now:()=>1000});
 assert.equal(await ledger.lookupRecentReauth({userId,sessionId}),null);
 assert.equal(await ledger.lookupRecentReauth({userId:'invalid',sessionId}),null);
});
