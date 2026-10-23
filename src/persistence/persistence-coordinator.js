// One captured account/generation per operation. No reward or receipt authority.
export function createPersistenceCoordinator({session,locks=globalThis.navigator?.locks,mode='active'}={}){
 if(!['active','shadow'].includes(mode))throw Error('Invalid persistence mode');
 const tails=new Map(),domains=new Map();
 const stale=()=>Object.assign(Error('Persistence session changed'),{code:'SESSION_CHANGED'});
 function capture(userId,client){
  const before=session?.();
  const valid=()=>!session||(before?.userId===userId&&(!client||before.client===client)&&
   session()?.userId===before.userId&&session()?.client===before.client&&session()?.generation===before.generation);
  if(!userId||!valid())throw stale();
  return valid;
 }
 function active(){if(mode!=='active')throw Object.assign(Error('Read-only persistence coordinator'),{code:'SHADOW_ONLY'})}
 async function submit(domain,userId,questId,reward,options){
  active();const valid=capture(userId),box=domains.get(domain);
  if(!box)throw Error('Unknown command domain');
  // Freeze caller evidence before the first asynchronous storage read.
  const evidence=structuredClone(reward),identity=options?structuredClone(options):undefined;
  const entry=await box.enqueue(userId,questId,evidence,identity);
  if(!valid())throw stale(); // Captured intent stays with its original owner.
  return entry;
 }
 function register(box){
  if(domains.has(box.domain))throw Error('Duplicate command domain');
  domains.set(box.domain,box);
  const facade={...box,enqueue:(...args)=>submit(box.domain,...args)};
  for(const name of ['acknowledge','pause','resume','archiveRecreatedCapture'])if(box[name])facade[name]=(...args)=>{active();return box[name](...args)};
  return facade;
 }
 async function inspect(userId){
  const valid=capture(userId),result={};
  for(const [domain,box] of domains){result[domain]=await box.inspect(userId);if(!valid())throw stale()}
  return result;
 }
 function dispatch(userId,client,run,{sessionValid=()=>true}={}){
  active();const valid=capture(userId,client),guard=()=>{if(!valid()||!sessionValid())throw stale()};
  // Keep the tail until completion even if the session changes. An old network
  // request cannot be cancelled by forgetting a JavaScript promise.
  const prior=tails.get(userId)||Promise.resolve();
  const work=prior.catch(()=>{}).then(()=>{
   guard();
   const execute=async()=>{guard();try{const value=await run(()=>valid()&&sessionValid());guard();return value}catch(error){guard();throw error}};
   return locks?.request?locks.request('lumen-command-dispatch:'+userId,{mode:'exclusive'},execute):execute();
  });
  tails.set(userId,work);
  void work.finally(()=>{if(tails.get(userId)===work)tails.delete(userId)}).catch(()=>{});
  return work;
 }
 return {register,submit,inspect,dispatch,capabilities:()=>({mode,crossTab:!!locks?.request})};
}
