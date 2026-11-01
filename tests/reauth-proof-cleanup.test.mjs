import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createReauthProofRevoker,createExpiredReauthProofPruner} from '../src/privacy/reauth-proof-cleanup.mjs';
const userId='00000000-0000-4000-8000-000000000001';
test('revokes all session proofs for one verified user only',async()=>{
 let sql,params;
 const revoke=createReauthProofRevoker({query:async(s,p)=>{sql=s;params=p}});
 await revoke(userId);
 assert.match(sql,/where user_id=\$1::uuid/);
 assert.deepEqual(params,[userId]);
 await assert.rejects(revoke('invalid'));
});
test('prunes only expired private proofs',async()=>{
 let sql;
 const prune=createExpiredReauthProofPruner({query:async s=>{sql=s;return {rowCount:3}}});
 assert.equal(await prune(),3);
 assert.match(sql,/verified_at < now\(\) - interval '5 minutes'/);
});
