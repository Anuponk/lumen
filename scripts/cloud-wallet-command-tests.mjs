import assert from 'node:assert/strict';
import {test} from 'node:test';
import {commitWalletCommand,walletSpendIdentity,walletCommandsSupported,recoverWalletCache,submitWalletCommand} from '../src/persistence/wallet-command.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
const user='wallet-test',operation=walletSpendIdentity('hint',{attemptId:'attempt',resetCount:0},1);
function fixture(){
 const state={profile:{solved:{},badges:{},shards:10},receipts:new Map(),debits:0,lost:false,missing:false,calls:[]};
 const client={rpc:async(name,args)=>{
  state.calls.push(name);
  if(name==='lumen_wallet_command_version')return {data:1};
  if(name==='lumen_restore_profile')return {data:structuredClone(state.profile)};
  if(name==='lumen_commit_wallet_command'){
   if(args.p_expected_user_id!==user)return {error:{code:'42501'}};
   let receipt=state.receipts.get(args.p_operation_id);
   if(receipt&&JSON.stringify(receipt.request)!==JSON.stringify(args.p_request))return {error:{code:'22023'}};
   if(!receipt){state.debits++;state.profile.shards--;state.profile.walletRevision=(state.profile.walletRevision||0)+1;
    receipt={version:1,operationId:args.p_operation_id,request:args.p_request,revision:state.profile.walletRevision,balance:state.profile.shards};state.receipts.set(args.p_operation_id,receipt)}
   if(state.lost)throw Error('lost');return {data:receipt};
  }
  if(name==='lumen_get_wallet_command')return {data:state.missing?null:state.receipts.get(args.p_operation_id)};
  throw Error(name);
 }};return {state,client};
}
test('lost spend response is verified and retry never debits twice',async()=>{
 const {state,client}=fixture();state.lost=true;
 for(let i=0;i<2;i++)assert.equal((await commitWalletCommand(client,user,operation.operationId,operation.request)).profile.shards,9);
 assert.equal(state.debits,1);assert.equal(state.receipts.size,1);
});
test('a balance alone cannot confirm a spend without the exact receipt',async()=>{
 const {state,client}=fixture();state.missing=true;
 await assert.rejects(commitWalletCommand(client,user,operation.operationId,operation.request),/receipt unconfirmed/);
 assert.equal(state.debits,1);
});
test('session changes stop before mutation and after every read',async()=>{
 const {state,client}=fixture();await assert.rejects(commitWalletCommand(client,user,operation.operationId,operation.request,{sessionValid:()=>false}));
 assert.equal(state.debits,0);
 let valid=true;const wrapped={rpc:async(...args)=>{const r=await client.rpc(...args);valid=false;return r}};
 await assert.rejects(commitWalletCommand(wrapped,user,operation.operationId,operation.request,{sessionValid:()=>valid}));
 assert.equal(state.calls.filter(n=>n==='lumen_get_wallet_command').length,0);
});

test('a token change before profile read is rejected even before the UI auth event arrives',async()=>{
 const {client}=fixture();
 const lateTokenClient={rpc:async(name,args)=>{
  if(name==='lumen_restore_profile'){
   // The transport now authenticates as another account; the UI guard still
   // sees the old account until the deferred auth callback is delivered.
   if(args?.p_expected_user_id===user)return {error:{code:'42501',message:'private provider detail'}};
   return {data:{solved:{99:1},badges:{},shards:9,walletRevision:1}};
  }
  return client.rpc(name,args);
 }};
 await assert.rejects(commitWalletCommand(lateTokenClient,user,operation.operationId,operation.request),error=>{
  assert.equal(error.code,'42501');assert.equal(error.message.includes('private provider detail'),false);return true;
 });
});
test('ambiguous capability failures never authorize a fallback spend',async()=>{
 assert.equal(await walletCommandsSupported({rpc:async()=>({error:{code:'PGRST202'},status:404})}),false);
 await assert.rejects(walletCommandsSupported({rpc:async()=>({error:{code:'42501'},status:403})}));
});
test('receipt-based first-activation recovery preserves both originals and refuses unrelated local changes',()=>{
 const local={solved:{},badges:{},shards:10},remote={...local,shards:9,walletRevision:1};
 const receipt={version:1,operationId:'spend',request:{kind:'hint'},revision:1,balance:9,balanceDelta:-1};
 for(const mode of ['valid','unknown','account','quota']){
  const original=JSON.stringify(mode==='unknown'?{...local,pendingUnknown:1}:local);
  const values=new Map([['lumenProgressV1',original],['lumenCloudOwnerId',mode==='account'?'other':user]]);
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(mode==='quota')throw Error('quota');values.set(k,v)}};
  if(mode==='quota')assert.throws(()=>recoverWalletCache(storage,remote,receipt,{userId:user}));
  else assert.equal(recoverWalletCache(storage,remote,receipt,{userId:user}),mode==='valid');
  if(mode==='valid'){assert.deepEqual(JSON.parse(storage.getItem('lumenProgressV1')),remote);assert.equal(storage.getItem('lumenBeforeWalletRecoveryLocal_spend'),original)}
  else assert.equal(storage.getItem('lumenProgressV1'),original);
 }
});
test('the actual wallet outbox survives restart and is isolated from both victory domains',async()=>{
 const data=new Map(),storage={get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const fallback={entries:async()=>[],put:async()=>{throw Error('denied')},get:async()=>null,remove:async()=>{}};
 const box=createDurableCanonicalVictoryOutbox(storage,{namespace:'Wallet',fallback});
 const {client,state}=fixture();state.missing=true;
 await assert.rejects(submitWalletCommand(box,client,user,operation.operationId,operation.request));
 assert.equal((await box.pending(user)).length,1);assert.equal(state.debits,1);
 for(const namespace of ['Canonical','Legacy'])assert.equal((await createDurableCanonicalVictoryOutbox(storage,{namespace,fallback}).pending(user)).length,0);
 state.missing=false;
 const restarted=createDurableCanonicalVictoryOutbox(storage,{namespace:'Wallet',fallback});
 await submitWalletCommand(restarted,client,user,operation.operationId,operation.request);
 assert.equal((await restarted.pending(user)).length,0);assert.equal(state.debits,1);
});
