import {createPersistenceCoordinator} from './persistence-coordinator.js';
import {createDurableCanonicalVictoryOutbox as createOutbox} from './durable-canonical-outbox.js';
import {createIndexedOutboxStore} from './indexed-outbox-store.js';
import {createTransactionalCommandCache,createConfirmedProfileCache} from './transactional-command-cache.js';
import {commitCanonicalVictoryViaLedger as canonical} from './canonical-progress.js';
import {commitLegacyVictoryCommand as legacy} from './legacy-command.js';
import {submitWalletCommand as wallet} from './wallet-command.js';

let currentSession,onCacheIssue=()=>{};
const coordinator=createPersistenceCoordinator({session:()=>currentSession?.()});
export function configureCommandSession(read,{onIssue=()=>{}}={}){currentSession=read;onCacheIssue=onIssue}
export const inspectCommandOutboxes=userId=>coordinator.inspect(userId);
// Only the explicit private recovery download uses this raw snapshot.
export const exportCommandStorage=async()=>Object.fromEntries(await databaseStore().entries(''));
function databaseStore(){let database;try{database=globalThis.indexedDB}catch{}return createIndexedOutboxStore(database)}
async function installVerifiedProfile(userId,result,sessionValid){
 if(!sessionValid())throw Error('Cache session changed');
 // New command confirmations are read through the owner-bound indexed cache.
 // Its refusal remains observable and cannot repeat a verified server effect.
 let profile=result.profile;
 try{profile=(await createConfirmedProfileCache(databaseStore()).installAndRead(userId,profile,{sessionValid})).profile}
 catch{if(sessionValid())try{onCacheIssue({kind:'confirmed_cache_unavailable'})}catch{}}
 if(!sessionValid())throw Error('Cache session changed');
 return profile;
}
export function createDurableCanonicalVictoryOutbox(storage,options={}){
 const fallback=options.fallback??createTransactionalCommandCache(databaseStore());
 return coordinator.register(createOutbox(storage,{...options,fallback}));
}
function send(client,options,run,{mirror=true}={}){
 options={...options};
 return coordinator.dispatch(options.userId,client,async valid=>{
  const result=await run({...options,sessionValid:valid});
  if(mirror)result.profile=await installVerifiedProfile(options.userId,result,valid);
  return result;
 },options);
}
export function commitCanonicalVictoryViaLedger(client,questId,reward,options={}){
 const evidence=structuredClone(reward);
 return send(client,options,guarded=>canonical(client,questId,evidence,guarded));
}
export function commitLegacyVictoryCommand(client,questId,facts,operationId,options={}){
 const evidence=structuredClone(facts);
 return send(client,options,guarded=>legacy(client,questId,evidence,operationId,guarded));
}
export function submitWalletCommand(outbox,client,userId,operationId,request,options={}){
 // Wallet capture must precede waiting for the shared transport lock.
 const evidence=structuredClone(request);options={...options};
 return outbox.enqueue(userId,'wallet',{request:evidence},{operationId}).then(entry=>
  send(client,{...options,userId},guarded=>wallet(outbox,client,userId,entry.operationId,entry.reward.request,{
   ...guarded,beforeAcknowledge:async result=>{
    result.profile=await installVerifiedProfile(userId,result,guarded.sessionValid);
    if(options.beforeAcknowledge)await options.beforeAcknowledge(result);
   }
  }),{mirror:false}));
}
