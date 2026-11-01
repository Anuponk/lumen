import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createVerifiedActorResolver} from '../src/privacy/verified-actor-resolver.mjs';
const id='00000000-0000-4000-8000-000000000001';
test('resolves actors only from verified receipts for the authenticated user',async()=>{
 const resolve=createVerifiedActorResolver({loadVerifiedClaims:async()=>[{user_id:id,actor_id:'guest-b',verified:true},{user_id:id,actor_id:'guest-a',verified:true}]});
 assert.deepEqual(await resolve(id),['guest-a','guest-b']);
});
test('rejects foreign, unverified and duplicate actor claims',async()=>{
 for(const claims of [[{user_id:'other',actor_id:'guest',verified:true}],[{user_id:id,actor_id:'guest',verified:false}],[{user_id:id,actor_id:'guest',verified:true},{user_id:id,actor_id:'guest',verified:true}]]) {
  await assert.rejects(createVerifiedActorResolver({loadVerifiedClaims:async()=>claims})(id));
 }
});
test('rejects unavailable claim source rather than guessing',async()=>{
 await assert.rejects(createVerifiedActorResolver({loadVerifiedClaims:async()=>null})(id));
});
