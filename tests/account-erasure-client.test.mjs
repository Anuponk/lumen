import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAccountErasureFlow,postAccountErasure} from '../src/privacy/account-erasure-client.mjs';
const calls=[];
const deps=()=>({getAccessToken:async()=>{calls.push('token');return 'test-token'},reauthenticate:async()=>calls.push('reauth'),requestDeletion:async()=>{calls.push('delete');return {status:'completed'}},signOut:async()=>calls.push('signout'),clearLumenLocalData:async()=>calls.push('clear')});
test('confirmation and recent reauth precede deletion; local cleanup follows success',async()=>{
 calls.length=0;
 const flow=createAccountErasureFlow(deps());
 await assert.rejects(flow('oui'));
 assert.deepEqual(calls,[]);
 assert.equal((await flow('SUPPRIMER')).status,'completed');
 assert.deepEqual(calls,['reauth','token','delete','signout','clear']);
});
test('never clears local state when server deletion is unconfirmed',async()=>{
 calls.length=0;
 const flow=createAccountErasureFlow({...deps(),requestDeletion:async()=>({status:'pending'})});
 assert.equal((await flow('SUPPRIMER')).status,'pending');
 assert.deepEqual(calls,['reauth','token']);
});
test('reports incomplete local cleanup',async()=>{
 calls.length=0;
 const flow=createAccountErasureFlow({...deps(),clearLumenLocalData:async()=>{throw Error('storage blocked')}});
 assert.equal((await flow('SUPPRIMER')).status,'local_cleanup_required');
});
test('same-origin POST never sends client user ID or timestamp',async()=>{
 let request;
 const response=await postAccountErasure({token:'test-token',confirmation:'SUPPRIMER',fetchImpl:async(url,opts)=>{request={url,...opts};return {ok:true,status:200,json:async()=>({status:'completed'})}}});
 assert.equal(response.status,'completed');
 assert.deepEqual(JSON.parse(request.body),{confirmation:'SUPPRIMER'});
 assert.equal(request.credentials,'omit');
 await assert.rejects(postAccountErasure({token:'x',confirmation:'SUPPRIMER',url:'https://other.example'}));
});
