// Measurements contain only fixed categories/counts. Never expose storage keys,
// profile contents, account identities or token values through diagnostics.
const backupPatterns=[
 /^lumenBefore(CloudRestore|CloudReconcile|CloudAuthority|CloudReconcileLocal|CloudReconcileRemote|AccountSwitch|CanonicalStartMetadataLocal|CanonicalStartMetadataRemote)_(\d+)$/,
 /^(lumenUnsyncedCloudBackupV2:[^:]+:)(\d+):[a-z0-9]+$/
];
function backupIdentity(key){
 const match=backupPatterns[0].exec(key);
 if(match)return {family:match[1],time:Number(match[2])};
 const checkpoint=backupPatterns[1].exec(key);
 return checkpoint?{family:checkpoint[1],time:Number(checkpoint[2])}:null;
}
function category(key){
 if(backupIdentity(key)||/^lumen(?:Before|GuestBeforeAccount_|UnsyncedCloudBackup)/.test(key))return 'backups';
 if(/^lumenCloud(?:Diagnostics|Health)V1$/.test(key))return 'logs';
 if(/^(?:lumen|regalia).*Outbox/.test(key))return 'pending';
 if(key==='lumenProgressV1'||/^lumen.*Attempt/.test(key))return 'progress';
 if(/^sb-|^lumenAuth/.test(key))return 'auth';
 if(/^lumen|^regalia/.test(key))return 'settings';
 return 'other';
}
export function measureLocalStorage(storage){
 const categories=Object.fromEntries(['progress','backups','pending','logs','auth','settings','other'].map(name=>[name,{entries:0,bytes:0}]));
 let entries=0,bytes=0;
 try{
  for(let i=0;i<storage.length;i++){
   const key=storage.key(i);if(key===null)continue;
   const value=storage.getItem(key);if(value===null)continue;
   const size=2*(key.length+value.length),group=categories[category(key)];
   group.entries++;group.bytes+=size;entries++;bytes+=size;
  }
  return {available:true,entries,bytes,encoding:'utf16-estimate',categories};
 }catch{return {available:false}}
}
async function measureIndexedStores(indexedDB){
 try{
  if(typeof indexedDB?.databases!=='function')return {available:false};
  const databases=await indexedDB.databases(),categories={};
  for(const [name,storeName,label] of [['lumenCloudRecoveryV1','snapshots','archives'],['lumen-unsynced-checkpoints','snapshots','checkpoints'],['lumen-canonical-outbox','intents','pending']]){
   if(!databases.some(db=>db.name===name)){categories[label]={entries:0,bytes:0};continue}
   categories[label]=await new Promise((resolve,reject)=>{
    let db,done=false;const result={entries:0,bytes:0};
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);db?.close();error?reject(error):resolve(result)};
    const timer=setTimeout(()=>finish(Error('Storage measurement timeout')),5000);
    const request=indexedDB.open(name);
    request.onupgradeneeded=()=>{request.transaction.abort();finish(Error('Storage changed'))};
    request.onerror=request.onblocked=()=>finish(Error('Storage unavailable'));
    request.onsuccess=()=>{
     db=request.result;if(done){db.close();return}
     try{
      const tx=db.transaction(storeName,'readonly');
      tx.oncomplete=()=>finish();tx.onerror=tx.onabort=()=>finish(Error('Storage read failed'));
      const cursor=tx.objectStore(storeName).openCursor();
      cursor.onerror=()=>finish(Error('Storage read failed'));
      cursor.onsuccess=()=>{
       try{
        const entry=cursor.result;if(!entry)return;
        const raw=typeof entry.value==='string'?entry.value:JSON.stringify(entry.value)??'';
        result.entries++;result.bytes+=2*(String(entry.key).length+raw.length);entry.continue();
       }catch{finish(Error('Storage read failed'))}
      };
     }catch{finish(Error('Storage unavailable'))}
    };
   });
  }
  return {available:true,categories,encoding:'utf16-estimate'};
 }catch{return {available:false}}
}
export async function storageReport(storage,navigatorObject=globalThis.navigator,indexedDB=globalThis.indexedDB){
 const local=measureLocalStorage(storage);let browser={available:false};
 try{
  const estimate=await navigatorObject?.storage?.estimate();
  if(Number.isFinite(estimate?.usage)&&Number.isFinite(estimate?.quota))browser={available:true,usage:estimate.usage,quota:estimate.quota};
 }catch{/* The local measurement remains useful without the broader estimate. */}
 const indexed=await measureIndexedStores(indexedDB);
 return {local,browser,indexed,deviceFreeSpaceKnown:false};
}
// Keep recent copies in localStorage. Older immutable snapshots move to the
// existing exportable recovery store; no unique original expires with age.
function archiveCandidates(storage){
 const families=new Map();
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i),identity=key&&backupIdentity(key);if(!identity)continue;
  const value=storage.getItem(key);if(value===null)continue;
  const group=families.get(identity.family)||[];
  group.push({key,value,time:identity.time});families.set(identity.family,group);
 }
 return [...families.values()].flatMap(group=>group.sort((a,b)=>b.time-a.time||a.key.localeCompare(b.key)).slice(2)).slice(0,50);
}
// Resolves only after both read-back and transaction completion. Reusing a key
// with different evidence aborts; a full/blocked database leaves local intact.
function archiveOriginal(indexedDB,key,value){
 return new Promise((resolve,reject)=>{
  let db,tx,done=false,verified=false;
  const finish=error=>{
   if(done)return;done=true;clearTimeout(timer);db?.close();error?reject(error):resolve();
  };
  const timer=setTimeout(()=>{try{tx?.abort()}catch{}finish(Error('Archive timeout'))},5000);
  try{
   if(!indexedDB)throw Error('Archive unavailable');
   const request=indexedDB.open('lumenCloudRecoveryV1',1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('snapshots'))request.result.createObjectStore('snapshots')};
   request.onblocked=()=>finish(Error('Archive blocked'));
   request.onerror=()=>finish(Error('Archive unavailable'));
   request.onsuccess=()=>{
    db=request.result;if(done){db.close();return}
    try{
     tx=db.transaction('snapshots','readwrite');const store=tx.objectStore('snapshots'),archiveKey='localStorage:'+key;
     const fail=()=>{try{tx.abort()}catch{}finish(Error('Archive unverified'))};
     tx.onerror=()=>finish(Error('Archive write failed'));
     tx.onabort=()=>finish(Error('Archive aborted'));
     tx.oncomplete=()=>finish(verified?null:Error('Archive unverified'));
     const previous=store.get(archiveKey);previous.onerror=fail;
     previous.onsuccess=()=>{
      try{
       if(previous.result!==undefined){if(previous.result===value)verified=true;else fail();return}
       const write=store.put(value,archiveKey);write.onerror=fail;
       write.onsuccess=()=>{
        try{
         const read=store.get(archiveKey);read.onerror=fail;
         read.onsuccess=()=>{if(read.result===value)verified=true;else fail()};
        }catch{fail()}
       };
      }catch{fail()}
     };
    }catch{finish(Error('Archive unavailable'))}
   };
  }catch{finish(Error('Archive unavailable'))}
 });
}
export async function archiveRecoveryBackups(storage,{indexedDB=globalThis.indexedDB,sessionValid=()=>true}={}){
 const result={archived:0,bytes:0,failed:false,interrupted:false};
 try{
  const owner=storage.getItem('lumenCloudOwnerId'),profile=storage.getItem('lumenProgressV1');
  const valid=()=>sessionValid()&&storage.getItem('lumenCloudOwnerId')===owner&&storage.getItem('lumenProgressV1')===profile;
  if(!valid())return {...result,interrupted:true};
  const candidates=archiveCandidates(storage);
  for(const {key,value} of candidates){
   if(!valid()){result.interrupted=true;break}
   if(storage.getItem(key)!==value)continue;
   await archiveOriginal(indexedDB,key,value);
   if(!valid()){result.interrupted=true;break}
   if(storage.getItem(key)!==value){result.interrupted=true;break}
   storage.removeItem(key);
   if(storage.getItem(key)!==null)throw Error('Local removal refused');
   result.archived++;result.bytes+=2*(key.length+value.length);
  }
 }catch{result.failed=true}
 return result;
}
