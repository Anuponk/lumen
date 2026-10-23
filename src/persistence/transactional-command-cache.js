// Local pending view only. It never contains spendable rewards or entitlements.
// Reuse v1's store so old clients can still open the database and read intents.
export const COMMAND_CACHE_PREFIX='lumenCommandCacheV1:';
export const PROFILE_CACHE_PREFIX='lumenConfirmedCacheV1:';
function companion(key,raw){
 const match=/^lumen(Canonical|Legacy|Wallet)VictoryOutboxV2:([^:]+):([A-Za-z0-9._-]{1,120})$/.exec(key);
 if(!match)return null;
 const entry=JSON.parse(raw),[,domain,userId,operationId]=match;
 if(entry.version!==2||entry.userId!==userId||entry.operationId!==operationId)throw Error('Invalid cache owner');
 return {key:COMMAND_CACHE_PREFIX+domain+':'+userId+':'+operationId,
  raw:JSON.stringify({version:1,userId,domain,operationId,questId:entry.questId,createdAt:entry.createdAt,status:'pending'})};
}
export function createTransactionalCommandCache(store){
 return {
  ...store,
  put:async(key,raw)=>{
   const state=companion(key,raw);
   if(!state)return store.put(key,raw);
   // If unsupported, the existing outbox chooses verified localStorage. Never
   // describe two separate writes as an atomic capture.
   if(!store.capture)throw Error('Transactional command storage unavailable');
   await store.capture(key,raw,state.key,state.raw);
  },
  remove:async(key,expected,{sessionValid=()=>true}={})=>{
   const state=companion(key,expected);
   return state&&store.retire?store.retire(key,expected,state.key,state.raw,sessionValid):store.remove(key,expected,{sessionValid});
  },
  pendingState:async userId=>{
   const states=await store.entries(COMMAND_CACHE_PREFIX);
   const pending=[];
   for(const [,raw] of states){
    const state=JSON.parse(raw);if(state.userId!==userId)continue;
    if(state.version!==1||!['Canonical','Legacy','Wallet'].includes(state.domain)||state.status!=='pending')throw Error('Invalid pending cache');
    const intent=await store.get('lumen'+state.domain+'VictoryOutboxV2:'+userId+':'+state.operationId);
    // Older clients may acknowledge the intent without understanding its view.
    // Preserve orphaned bytes, but never present them as a pending command.
    if(intent!==null&&companion('lumen'+state.domain+'VictoryOutboxV2:'+userId+':'+state.operationId,intent)?.raw===raw)pending.push(state);
   }
   return pending;
  }
 };
}

// A read model for already verified server projections. The caller retains
// responsibility for receipt/coverage verification; this API never merges.
export function createConfirmedProfileCache(store){
 function key(userId){if(!userId||String(userId).includes(':'))throw Error('Invalid cache owner');return PROFILE_CACHE_PREFIX+userId}
 async function read(userId){
  const raw=await store.get(key(userId));if(raw===null)return null;
  const state=JSON.parse(raw);
  if(state.version!==1||state.userId!==userId||!Number.isSafeInteger(state.revision)||state.revision<1||!state.profile||typeof state.profile!=='object'||Array.isArray(state.profile))throw Error('Invalid confirmed cache');
  return state;
 }
 async function install(userId,profile,{sessionValid=()=>true}={}){
  if(!sessionValid()||!profile||typeof profile!=='object'||Array.isArray(profile))throw Error('Invalid confirmed projection');
  const copy=structuredClone(profile),cacheKey=key(userId),before=await store.get(cacheKey);
  let prior=null;
  if(before!==null){prior=JSON.parse(before);if(prior.version!==1||prior.userId!==userId||!Number.isSafeInteger(prior.revision)||prior.revision<1)throw Error('Invalid confirmed cache')}
  const state={version:1,userId,revision:(prior?.revision??0)+1,profile:copy};
  if(!Number.isSafeInteger(state.revision))throw Error('Cache revision exhausted');
  await store.compareAndSwap(cacheKey,before,JSON.stringify(state),sessionValid);
  if(!sessionValid())throw Error('Cache session changed');
  return state;
 }
 async function installAndRead(userId,profile,options={}){
  const installed=await install(userId,profile,options),cached=await read(userId);
  if(options.sessionValid&&!options.sessionValid())throw Error('Cache session changed');
  if(!cached||cached.revision!==installed.revision||JSON.stringify(cached.profile)!==JSON.stringify(installed.profile))throw Error('Confirmed cache changed before read');
  return cached;
 }
 return {read,install,installAndRead};
}
