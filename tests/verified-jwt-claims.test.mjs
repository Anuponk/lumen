import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createVerifiedJwtClaims} from '../src/privacy/verified-jwt-claims.mjs';
const now=1700000000000,token='a'.repeat(40);
const valid={sub:'00000000-0000-4000-8000-000000000001',session_id:'00000000-0000-4000-8000-000000000002',exp:Math.floor((now+60000)/1000)};
test('accepts only signed claims supplied by Supabase Auth',async()=>{
 const verify=createVerifiedJwtClaims({auth:{getClaims:async()=>({data:{claims:valid},error:null})},now:()=>now});
 assert.equal((await verify(token)).session_id,valid.session_id);
});
test('rejects unsigned or expired claims',async()=>{
 const failed=createVerifiedJwtClaims({auth:{getClaims:async()=>({data:null,error:Error('bad signature')})},now:()=>now});
 await assert.rejects(failed(token));
 const expired=createVerifiedJwtClaims({auth:{getClaims:async()=>({data:{claims:{...valid,exp:Math.floor((now-1000)/1000)}},error:null})},now:()=>now});
 await assert.rejects(expired(token));
});
