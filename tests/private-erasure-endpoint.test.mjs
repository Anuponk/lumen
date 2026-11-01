import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPrivateErasureEndpoint} from '../src/privacy/private-erasure-endpoint.mjs';
test('composition fails closed when trusted private adapters are absent',()=>{
 assert.throws(()=>createPrivateErasureEndpoint({}),/Trusted Auth dependencies required/);
});
test('private endpoint rejects unauthorized requests before any erasure transaction',async()=>{
 let erased=false;
 const endpoint=createPrivateErasureEndpoint({
  supabaseAuth:{getUser:async()=>({error:Error('invalid token')})},
  verifyJwtClaims:async()=>({}),lookupSession:async()=>null,lookupRecentReauth:async()=>null,
  loadVerifiedClaims:async()=>[],withOperatorTransaction:async()=>{erased=true},
  revokeReauthProofs:async()=>{},invalidateLumenSessions:async()=>{}
 });
 const {Readable}=await import('node:stream');
 const req=Readable.from(['{"confirmation":"SUPPRIMER"}']);
 req.method='POST';req.headers={'content-type':'application/json',authorization:'Bearer '+('x'.repeat(32))};
 const result={};const res={writeHead(status){result.status=status},end(body){result.body=body}};
 await endpoint(req,res);
 assert.equal(result.status,401);
 assert.equal(erased,false);
});
