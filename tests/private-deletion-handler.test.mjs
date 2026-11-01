import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createDeletionHandler} from '../src/privacy/private-deletion-handler.mjs';
const uid='00000000-0000-4000-8000-000000000001',now=Date.now();
const trusted={user:{id:uid},session:{user_id:uid,expires_at:now+60000},serverVerifiedReauthAt:now-1000};
const req={method:'POST',headers:{authorization:'Bearer fake', 'content-type':'application/json'},body:JSON.stringify({confirmation:'SUPPRIMER'})};
const deps={verifyRequest:async()=>trusted,resolveVerifiedActors:async()=>[],withOperatorTransaction:async f=>f({review:async()=>{},erase:async()=>({})}),invalidateLumenSessions:async()=>{}};
test('rejects client-provided identity and reauth timestamps',async()=>{
 const h=createDeletionHandler(deps);
 const result=await h({...req,body:JSON.stringify({confirmation:'SUPPRIMER',userId:uid,verifiedAt:now})});
 assert.equal(result.status,400);
});
test('rejects unauthorized token',async()=>{
 const h=createDeletionHandler({...deps,verifyRequest:async()=>{throw Error('unauthorized')}});
 assert.equal((await h(req)).status,401);
});
test('returns completed only when cleanup succeeds',async()=>{
 const h=createDeletionHandler(deps);
 const result=await h(req);
 assert.equal(result.status,200);
 assert.equal(JSON.parse(result.body).status,'completed');
});
test('reports cleanup pending without pretending completion',async()=>{
 const h=createDeletionHandler({...deps,invalidateLumenSessions:async()=>{throw Error('unavailable')}});
 const result=await h(req);
 assert.equal(result.status,202);
 assert.equal(JSON.parse(result.body).status,'cleanup_pending');
});
