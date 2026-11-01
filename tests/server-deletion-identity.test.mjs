import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createVerifiedDeletionIdentity} from '../src/privacy/server-deletion-identity.mjs';
const id='00000000-0000-4000-8000-000000000001',now=1700000000000;
const token='a'.repeat(40);
const deps={getUserFromToken:async()=>({id}),lookupSession:async()=>({id:'session-1',user_id:id,expires_at:now+60000}),lookupRecentReauth:async()=>now-1000,now:()=>now};
test('accepts trusted active session with server reauth',async()=>{
 const verify=createVerifiedDeletionIdentity(deps);
 const identity=await verify(token);
 assert.equal(identity.user.id,id);assert.equal(identity.serverVerifiedReauthAt,now-1000);
});
test('rejects stale reauth and revoked session',async()=>{
 await assert.rejects(createVerifiedDeletionIdentity({...deps,lookupRecentReauth:async()=>now-300001})(token));
 await assert.rejects(createVerifiedDeletionIdentity({...deps,lookupSession:async()=>({...await deps.lookupSession(),revoked:true})})(token));
});
test('rejects token identity mismatch and missing reauth proof',async()=>{
 await assert.rejects(createVerifiedDeletionIdentity({...deps,lookupSession:async()=>({id:'s',user_id:'foreign',expires_at:now+60000})})(token));
 await assert.rejects(createVerifiedDeletionIdentity({...deps,lookupRecentReauth:async()=>undefined})(token));
});
