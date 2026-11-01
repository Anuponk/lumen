import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createVerifiedSessionLookup} from '../src/privacy/verified-session-lookup.mjs';
const uid='00000000-0000-4000-8000-000000000001',sid='00000000-0000-4000-8000-000000000002',now=1700000000000;
test('returns only matching non-expired session',async()=>{
 let params;const lookup=createVerifiedSessionLookup({now:()=>now,query:async(sql,p)=>{params=p;return {rows:[{id:sid,user_id:uid,expires_at:now+60000}]}}});
 assert.equal((await lookup({userId:uid,sessionId:sid,verifiedJwtExpiryMs:now+60000})).id,sid);
 assert.deepEqual(params,[sid,uid]);
});
test('rejects absent and expired session',async()=>{
 const missing=createVerifiedSessionLookup({query:async()=>({rows:[]}),now:()=>now});
 assert.equal(await missing({userId:uid,sessionId:sid,verifiedJwtExpiryMs:now+60000}),null);
 const expired=createVerifiedSessionLookup({query:async()=>({rows:[{id:sid,user_id:uid,expires_at:0}]}),now:()=>now});
 assert.equal(await expired({userId:uid,sessionId:sid,verifiedJwtExpiryMs:now+60000}),null);
});
test('rejects malformed identifiers before query',async()=>{
 const lookup=createVerifiedSessionLookup({query:async()=>{throw Error('query should not execute')}});
 await assert.rejects(lookup({userId:uid,sessionId:'forged'}),/Verified UUIDs/);
});
