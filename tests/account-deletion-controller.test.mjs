import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAccountDeletionController} from '../src/privacy/account-deletion-controller.mjs';
test('requires typed confirmation and forwards it to deletion flow',async()=>{
 let received;const statuses=[];
 const c=createAccountDeletionController({flow:async value=>{received=value;return {status:'completed'}},onStateChange:x=>statuses.push(x.status)});
 assert.equal((await c.confirm('wrong')).status,'confirmation_required');
 assert.equal(received,undefined);
 assert.equal((await c.confirm('SUPPRIMER')).status,'completed');
 assert.equal(received,'SUPPRIMER');
 assert.deepEqual(statuses,['confirmation_required','deleting','completed']);
});
test('keeps incomplete and local cleanup states distinct from completion',async()=>{
 const c=createAccountDeletionController({flow:async()=>({status:'local_cleanup_required'}),onStateChange:()=>{}});
 assert.equal((await c.confirm('SUPPRIMER')).status,'local_cleanup_required');
});
