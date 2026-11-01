import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Readable} from 'node:stream';
import {createPrivateErasureEndpoint} from '../src/privacy/private-erasure-endpoint.mjs';
const uid='00000000-0000-4000-8000-000000000001';
const sid='00000000-0000-4000-8000-000000000002';
const now=Date.now();
async function call(endpoint,body={confirmation:'SUPPRIMER'}) {
 const req=Readable.from([JSON.stringify(body)]);req.method='POST';
 req.headers={'content-type':'application/json',authorization:'Bearer '+('a'.repeat(40))};
 const result={};const res={writeHead(status,headers){result.status=status;result.headers=headers},end(payload){result.body=JSON.parse(payload)}};
 await endpoint(req,res);return result;
}
function setup({claims=[{user_id:uid,actor_id:'guest-a',verified:true}],cleanupFails=false}={}) {
 const calls=[];
 const endpoint=createPrivateErasureEndpoint({
  now:()=>now,
  supabaseAuth:{getUser:async()=>({data:{user:{id:uid}},error:null})},
  verifyJwtClaims:async()=>({sub:uid,session_id:sid,exp:now/1000+3600}),
  lookupSession:async()=>({id:sid,user_id:uid,expires_at:now+3600000}),
  lookupRecentReauth:async()=>now-1000,
  loadVerifiedClaims:async user=>{calls.push('claims:'+user);return claims},
  withOperatorTransaction:async callback=>callback({
   review:async(user,actors)=>calls.push('review:'+user+':'+actors.join(',')),
   erase:async(user,actors)=>{calls.push('erase:'+user+':'+actors.join(','));return {erased:true}}
  }),
  revokeReauthProofs:async user=>{calls.push('revoke:'+user);if(cleanupFails)throw Error('unavailable')},
  invalidateLumenSessions:async user=>calls.push('invalidate:'+user)
 });
 return {endpoint,calls};
}
test('end-to-end private handler commits verified scope then completes cleanup',async()=>{
 const {endpoint,calls}=setup();const r=await call(endpoint);
 assert.equal(r.status,200);assert.deepEqual(r.body,{status:'completed',authDeleted:false});
 assert.equal(r.headers['cache-control'],'no-store');
 assert.deepEqual(calls,['claims:'+uid,'review:'+uid+':guest-a','erase:'+uid+':guest-a','revoke:'+uid,'invalidate:'+uid]);
});
test('post-commit cleanup failure returns pending rather than success',async()=>{
 const {endpoint,calls}=setup({cleanupFails:true});const r=await call(endpoint);
 assert.equal(r.status,202);assert.equal(r.body.status,'cleanup_pending');
 assert.ok(calls.some(c=>c.startsWith('erase:')));
 assert.ok(!calls.some(c=>c.startsWith('invalidate:')));
});
test('unverified actor claim blocks transaction before review and erase',async()=>{
 const {endpoint,calls}=setup({claims:[{user_id:uid,actor_id:'guest-a',verified:false}]});
 const r=await call(endpoint);assert.equal(r.status,409);
 assert.ok(!calls.some(c=>c.startsWith('review:')||c.startsWith('erase:')));
});
test('body cannot choose another account or inject actor scope',async()=>{
 const {endpoint,calls}=setup();
 const r=await call(endpoint,{confirmation:'SUPPRIMER',userId:'another-user',actors:['guest-b']});
 assert.equal(r.status,400);assert.deepEqual(calls,[]);
});
