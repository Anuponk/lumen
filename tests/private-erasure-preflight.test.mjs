import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assertPrivateErasureDatabaseReady} from '../src/privacy/private-erasure-preflight.mjs';
const ready={db_user:'postgres',session_user:'postgres',auth_user:null,has_review:true,has_erase:true,has_reauth:true,has_ownership:true,authenticated_schema_usage:false,service_schema_usage:false,authenticated_proof_read:false,service_ownership_read:false};
test('preflight accepts complete operator-only privacy deployment',async()=>{
 let sql;
 assert.equal(await assertPrivateErasureDatabaseReady({query:async s=>{sql=s;return {rows:[ready]}}}),true);
 assert.match(sql,/to_regprocedure/);
});
test('preflight fails closed on missing table, wrong role or excessive grants',async()=>{
 for(const change of [{has_ownership:false},{db_user:'service_role'},{authenticated_schema_usage:true},{service_ownership_read:true},{auth_user:'someone'}]) {
  const row={...ready,...change};
  await assert.rejects(assertPrivateErasureDatabaseReady({query:async()=>({rows:[row]})}));
 }
});
test('preflight fails closed on database failure',async()=>{
 await assert.rejects(assertPrivateErasureDatabaseReady({query:async()=>{throw Error('connection refused')}}));
});
