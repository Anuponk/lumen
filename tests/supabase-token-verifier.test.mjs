import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createSupabaseTokenVerifier} from '../src/privacy/supabase-token-verifier.mjs';
const uid='00000000-0000-4000-8000-000000000001',now=1700000000000,token='a'.repeat(40);
const base={supabaseAuth:{getUser:async()=>({data:{user:{id:uid}},error:null})},verifyJwtClaims:async()=>({sub:uid,session_id:'session-1'}),lookupSession:async()=>({id:'session-1',user_id:uid,expires_at:now+60000}),lookupRecentReauth:async()=>now-1000,now:()=>now};
test('accepts only Auth-confirmed user and verified session claim',async()=>{
 const verify=createSupabaseTokenVerifier(base);
 assert.equal((await verify(token)).user.id,uid);
});
test('rejects forged session claim and mismatched subject',async()=>{
 await assert.rejects(createSupabaseTokenVerifier({...base,verifyJwtClaims:async()=>({sub:'other',session_id:'session-1'})})(token));
 await assert.rejects(createSupabaseTokenVerifier({...base,lookupSession:async()=>({id:'other',user_id:uid,expires_at:now+60000})})(token));
});
test('rejects revoked session or missing reauth',async()=>{
 await assert.rejects(createSupabaseTokenVerifier({...base,lookupSession:async()=>({id:'session-1',user_id:uid,expires_at:now+60000,revoked:true})})(token));
 await assert.rejects(createSupabaseTokenVerifier({...base,lookupRecentReauth:async()=>null})(token));
});
