import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createPostgresVerifiedClaimReader} from '../src/privacy/postgres-verified-actor-reader.mjs';
const uid='00000000-0000-4000-8000-000000000001';
test('reads only independently verified actor ownership with parameterized user scope',async()=>{
 let sql,params;
 const load=createPostgresVerifiedClaimReader({query:async(s,p)=>{sql=s;params=p;return {rows:[{user_id:uid,actor_id:'actor-1',verified:true}]}}});
 assert.equal((await load(uid))[0].actor_id,'actor-1');
 assert.match(sql,/verified=true/);
 assert.deepEqual(params,[uid]);
});
test('rejects invalid user ID and unavailable ownership source',async()=>{
 const load=createPostgresVerifiedClaimReader({query:async()=>({})});
 await assert.rejects(load('invalid'));
 await assert.rejects(load(uid));
});
