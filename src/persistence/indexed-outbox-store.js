// Only pending intents, never an authoritative profile or entitlement store.
// A transaction must complete before callers may claim a durable local write.
export function createIndexedOutboxStore(indexedDB,{timeoutMs=5000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 function transact(mode,action){
  return new Promise((resolve,reject)=>{
   if(!indexedDB){reject(Error('IndexedDB unavailable'));return}
   let db,transaction,finished=false,result;
   const finish=(error)=>{
    if(finished)return;finished=true;clearTimer(timer);
    if(db)db.close();
    if(error)reject(error);else resolve(result);
   };
   const timer=setTimer(()=>{try{transaction?.abort()}catch{}finish(Error('Outbox storage timeout'));},timeoutMs);
   let request;
   try{request=indexedDB.open('lumen-canonical-outbox',1)}catch(error){finish(error);return}
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('intents'))request.result.createObjectStore('intents')};
   request.onerror=()=>finish(request.error||Error('Outbox database unavailable'));
   request.onblocked=()=>finish(Error('Outbox database blocked'));
   request.onsuccess=()=>{
    db=request.result;
    if(finished){db.close();return}
    try{
     transaction=db.transaction('intents',mode);
     transaction.oncomplete=()=>finish();
     transaction.onabort=transaction.onerror=()=>finish(transaction.error||Error('Outbox transaction aborted'));
     action(transaction.objectStore('intents'),value=>{result=value},error=>{try{transaction.abort()}catch{}finish(error)});
    }catch(error){finish(error)}
   };
  });
 }
 return {
  entries:prefix=>transact('readonly',(store,result)=>{
   const values=[],request=store.openCursor();
   request.onsuccess=()=>{const cursor=request.result;if(!cursor){result(values);return}if(String(cursor.key).startsWith(prefix))values.push([String(cursor.key),cursor.value]);cursor.continue()};
  }),
  get:key=>transact('readonly',(store,result)=>{const request=store.get(key);request.onsuccess=()=>result(request.result??null)}),
  put:(key,raw)=>transact('readwrite',(store,result,fail)=>{
   const request=store.get(key);
   request.onsuccess=()=>{if(request.result!==undefined&&request.result!==raw){const error=Error('Outbox intent changed');error.code='OUTBOX_CONFLICT';fail(error);return}store.put(raw,key)};
  }),
  remove:(key,expected)=>transact('readwrite',(store,result,fail)=>{
   const request=store.get(key);
   request.onsuccess=()=>{if(request.result===undefined)return;if(request.result!==expected){fail(Error('Outbox intent changed before acknowledgement'));return}store.delete(key)};
  })
 };
}
