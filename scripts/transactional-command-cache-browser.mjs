import assert from 'node:assert/strict';
// Native IndexedDB, disposable same-origin fixture. No live Auth or RPC.
export async function verifyTransactionalCommandCache({evaluate,navigate,url}){
 await navigate('Page.navigate',{url:new URL('/scripts/fixtures/storage-quota.html',url).href});
 const result=await evaluate(`(async()=>{
  const {createIndexedOutboxStore}=await import('/src/persistence/indexed-outbox-store.js');
  const {createTransactionalCommandCache,createConfirmedProfileCache,COMMAND_CACHE_PREFIX}=await import('/src/persistence/transactional-command-cache.js');
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const {createPersistenceCoordinator}=await import('/src/persistence/persistence-coordinator.js');
  // Separate browsing contexts share the native account lock, not JS memory.
  const frame=document.createElement('iframe');frame.src='/scripts/fixtures/storage-quota.html';
  const loaded=new Promise(resolve=>frame.onload=resolve);document.body.append(frame);await loaded;
  if(!navigator.locks||!frame.contentWindow.navigator.locks)throw Error('Native Web Locks unavailable');
  const firstCoordinator=createPersistenceCoordinator({locks:navigator.locks}),secondCoordinator=createPersistenceCoordinator({locks:frame.contentWindow.navigator.locks});
  let release,started;const begun=new Promise(resolve=>started=resolve),held=new Promise(resolve=>release=resolve),order=[];
  const first=firstCoordinator.dispatch('native-lock-fixture',{},async()=>{order.push('first');started();await held});await begun;
  const second=secondCoordinator.dispatch('native-lock-fixture',{},()=>order.push('second'));
  await new Promise(resolve=>setTimeout(resolve,30));
  if(order.length!==1)throw Error('Two browsing contexts dispatched together');
  release();await Promise.all([first,second]);frame.remove();
  if(order.join(',')!=='first,second')throw Error('Native lock lost dispatch');
  const store=createIndexedOutboxStore(indexedDB),cache=createTransactionalCommandCache(store);
  const userId='atomic-fixture-'+crypto.randomUUID(),key='lumenCanonicalVictoryOutboxV2:'+userId+':op',stateKey=COMMAND_CACHE_PREFIX+'Canonical:'+userId+':op';
  const box=createDurableCanonicalVictoryOutbox(localStorage,{fallback:cache});
  const entry=await box.enqueue(userId,'q',{stars:1},{operationId:'op'});
  if(!await store.get(key)||(await cache.pendingState(userId)).length!==1)throw Error('Paired capture missing');
  const restarted=createDurableCanonicalVictoryOutbox(localStorage,{fallback:createTransactionalCommandCache(createIndexedOutboxStore(indexedDB))});
  if((await restarted.pending(userId))[0].operationId!=='op')throw Error('Crash/restart changed identity');
  const raw=await store.get(key),stateRaw=await store.get(stateKey);
  let conflict=false;try{await store.capture(key+'-other','new intent',stateKey,'changed state')}catch{conflict=true}
  if(!conflict||await store.get(key+'-other')!==null||await store.get(stateKey)!==stateRaw)throw Error('Conflict was not atomic');
  // Abort after issuing a request in the actual native write transaction.
  const aborting={open:(...args)=>{
   const request=indexedDB.open(...args);
   const wrapper={get result(){return request.result},get error(){return request.error}};
   for(const name of ['onupgradeneeded','onerror','onblocked'])Object.defineProperty(wrapper,name,{set:value=>{request[name]=value}});
   Object.defineProperty(wrapper,'onsuccess',{set:handler=>{request.onsuccess=()=>{
    const db=request.result,transaction=db.transaction.bind(db);
    db.transaction=(...args)=>{const tx=transaction(...args),objectStore=tx.objectStore.bind(tx);
     tx.objectStore=(...storeArgs)=>{const target=objectStore(...storeArgs);for(const name of ['put','delete']){const write=target[name].bind(target);target[name]=(...writeArgs)=>{const result=write(...writeArgs);result.onsuccess=()=>{try{tx.abort()}catch{}};return result}}return target};return tx};handler();
   }}});return wrapper;
  }};
  let aborted=false;try{await createIndexedOutboxStore(aborting).capture(key+'-aborted','new',stateKey+'-aborted','pending')}catch{aborted=true}
  if(!aborted||await store.get(key+'-aborted')!==null||await store.get(stateKey+'-aborted')!==null)throw Error('Aborted capture leaked a partial record');
  let retireAborted=false;try{await createIndexedOutboxStore(aborting).retire(key,raw,stateKey,stateRaw)}catch{retireAborted=true}
  if(!retireAborted||await store.get(key)!==raw||await store.get(stateKey)!==stateRaw)throw Error('Aborted acknowledgement lost pending evidence');
  await restarted.acknowledge(userId,'q',entry.reward,'op');
  if(await store.get(key)!==null||await store.get(stateKey)!==null)throw Error('Acknowledgement did not retire both records');
  if((await createDurableCanonicalVictoryOutbox(localStorage,{fallback:createTransactionalCommandCache(createIndexedOutboxStore(indexedDB))}).pending(userId)).length)throw Error('Acknowledged operation reappeared after restart');
  const profiles=createConfirmedProfileCache(store),profile={solved:{q:true},shards:3,future:{preserved:1}};
  await profiles.install(userId,profile);
  const read=await createConfirmedProfileCache(createIndexedOutboxStore(indexedDB)).read(userId);
  if(JSON.stringify(read.profile)!==JSON.stringify(profile)||await profiles.read(userId+'-other')!==null)throw Error('Owner-bound projection did not survive restart');
  let stale=false;try{await profiles.install(userId,{shards:999},{sessionValid:()=>false})}catch{stale=true}
  if(!stale||(await profiles.read(userId)).profile.shards!==3)throw Error('Stale session installed a projection');
  // Old schema clients must still be able to open version 1 after cache writes.
  const old=await new Promise((resolve,reject)=>{const r=indexedDB.open('lumen-canonical-outbox',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});old.close();
  return {ok:true,paired:true,abort:true,restart:true,accountIsolation:true,oldClient:true};
 })()`,true);
 assert.equal(result.ok,true);return result;
}
