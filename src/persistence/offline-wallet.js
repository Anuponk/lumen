import {walletSpendIdentity} from './wallet-command.js';

// Match the existing server tariff; this is a reservation, never a wallet write.
export function walletReservationCost(entries,userId){
 let cost=0;const seen=new Set();
 for(const entry of entries){
  if(entry.userId!==userId||seen.has(entry.operationId))continue;
  seen.add(entry.operationId);const request=entry.reward?.request;
  if(['daily','establish'].includes(request?.kind))continue;
  const expected=walletSpendIdentity(request?.kind,{attemptId:request?.attemptId,resetCount:request?.resetCount},request?.sequence);
  if(expected.operationId!==entry.operationId)throw Error('Invalid wallet reservation');
  cost+=request.kind==='hint'&&request.sequence>1?2:1;
 }
 return cost;
}

export async function queueOfflineWalletSpend(outbox,{userId,operation,balance,sessionValid=()=>true,locks=globalThis.navigator?.locks}={}){
 if(outbox.domain!=='Wallet'||!Number.isSafeInteger(balance)||balance<0)throw Error('Confirmed offline wallet required');
 const guard=()=>{if(!sessionValid())throw Error('Offline wallet session changed')};
 const reserve=async()=>{
  guard();const state=await outbox.inspect(userId);guard();
  if(!state.complete||state.issues.length)throw Error('Offline wallet inventory unavailable');
  const prior=state.pending.find(e=>e.operationId===operation.operationId);
  const cost=walletReservationCost([{userId,operationId:operation.operationId,reward:{request:operation.request}}],userId);
  if(!prior&&walletReservationCost(state.pending,userId)+cost>balance)return {allowed:false,reason:'balance'};
  const entry=await outbox.enqueue(userId,'wallet',{request:operation.request},{operationId:operation.operationId});
  guard();return {allowed:true,entry,pending:true};
 };
 // Without cross-tab serialization, decline rather than overspend a shared cache.
 if(!locks?.request)throw Error('Offline wallet lock unavailable');
 return locks.request('lumen-offline-wallet:'+userId,{mode:'exclusive'},reserve);
}
