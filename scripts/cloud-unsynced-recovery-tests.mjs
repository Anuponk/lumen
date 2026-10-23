import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
assert.match(src,/function preserveUnsyncedCloudProgress\(reason\)/);
assert.match(src,/lumenUnsyncedCloudBackupV1:/);
assert.match(src,/localStorage\.getItem\(key\)!==payload/);
assert.match(src,/preserveUnsyncedCloudProgress\("save-failed"\)/);
assert.match(src,/preserveUnsyncedCloudProgress\("version-conflict"\)/);
assert.match(src,/createSyncPresentation/);
assert.doesNotMatch(src,/panel.setAttribute\("aria-modal","true"\)/,'Recoverable save failure no longer opens a blocking dialog');
assert.doesNotMatch(src,/reload\.onclick=\(\)=>\{location\.reload\(\);resolve\(false\)\}/);
assert.match(src,/lumenUnsyncedCloudBackupV2:/);
assert.match(src,/if\(sameCloudProfile\(prev.progress,progress\)\)return true/);
assert.match(src,/outbox_preserved/);
assert.doesNotMatch(src,/oldSolved>newSolved/);
assert.match(src,/function preserveUnsyncedInIndexedDB\(uid,payload\)/);
assert.match(src,/indexedDB\.open\("lumen-unsynced-checkpoints",1\)/);
assert.match(src,/tx\.oncomplete=/);
assert.match(src,/read\.result===payload/);
assert.match(src,/store:"indexeddb"/);
assert.match(src,/async function exportLumenRecoveryBundle\(\)/);
assert.match(src,/format:"recovery-export-v1"/);
assert.match(src,/Exporter ma sauvegarde/);
assert.match(src,/indexedDB:indexed/);
assert.match(src,/\["lumenCloudRecoveryV1",cloudRecoveryIndexedDB\]/,'Recovery export includes the original archived after localStorage quota');
console.log('Cloud save failure keeps a recoverable local backup; no unsafe reload CTA');

// Quota regression: a verified cloud profile may be installed in memory.
assert.match(src,/hydration_local_quota_bypass/);
assert.match(src,/changed==="memory_only"/);
const profileSource=fs.readFileSync(new URL("../src/persistence/cloud-profile.js",import.meta.url),"utf8");
assert.match(profileSource,/cloudSafelyCoversLocal\(JSON.parse\(current\),verified\)/);
assert.match(profileSource,/return "memory_only"/);

// Execute the real explicit export: both existing checkpoints and quota
// recovery originals remain recoverable, including failure without download.
const {default:vm}=await import('node:vm');
const exportSource=src.slice(src.indexOf('async function exportLumenRecoveryBundle()'),src.indexOf('async function flushCloudProfile()'));
for(const abort of [false,true]){
 const stores={'lumen-unsynced-checkpoints':{pending:'original-pending'},lumenCloudRecoveryV1:{archive:'original-before-quota'}},modes=[];
 let exported=null,downloads=0;
 const context=vm.createContext({Blob,Date,JSON,setTimeout:()=>{},
  localStorage:{length:1,key:()=>"lumenProgressV1",getItem:()=>"original-local"},
  URL:{createObjectURL(blob){exported=blob;return 'blob:test'},revokeObjectURL(){}},
  document:{body:{append(){}},createElement:()=>({click(){downloads++},remove(){}})},
  indexedDB:{open(name){
   const open={};queueMicrotask(()=>{
    open.result={close(){},transaction(_store,mode){
     modes.push(mode);const tx={objectStore:()=>({openCursor(){
      const cursor={};const entries=Object.entries(stores[name]);let index=0;
      const next=()=>queueMicrotask(()=>{
       if(abort&&name==='lumenCloudRecoveryV1'){tx.error=Error('abort');tx.onabort();return}
       const entry=entries[index++];cursor.result=entry?{key:entry[0],value:entry[1],continue:next}:null;
       cursor.onsuccess();if(!entry)tx.oncomplete();
      });next();return cursor;
     }})};return tx;
    }};open.onsuccess();
   });return open;
  }}
 });
 vm.runInContext(exportSource,context);
 if(abort){await assert.rejects(()=>vm.runInContext('exportLumenRecoveryBundle()',context));assert.equal(downloads,0);assert.equal(exported,null)}
 else{
  await vm.runInContext('exportLumenRecoveryBundle()',context);
  const bundle=JSON.parse(await exported.text());
  assert.equal(bundle.localStorage.lumenProgressV1,'original-local');
  assert.deepEqual(bundle.indexedDB,stores['lumen-unsynced-checkpoints']);
  assert.deepEqual(bundle.cloudRecoveryIndexedDB,stores.lumenCloudRecoveryV1);assert.equal(downloads,1);
 }
 assert.deepEqual(modes,['readonly','readonly']);
}
console.log('Explicit recovery export preserves both IndexedDB stores and refuses incomplete reads');
