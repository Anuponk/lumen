import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource,frenchT} from './source-tools.mjs';

const ui=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
test('a browser quota refusal does not claim the whole phone is full',()=>{
 const message=vm.runInNewContext('('+functionSource(ui,'cloudReconciliationMessage')+')',{t:frenchT})({reason:'partial_reconciliation',detail:'storage_quota'});
 assert.match(message,/Espace de stockage de LUMEN/);
 assert.doesNotMatch(message,/appareil saturé/);
});

const load=()=>import('../src/persistence/storage-maintenance.js');
import {reconcileCloudAchievementsDurably} from '../src/persistence/cloud-profile.js';
function fixture({fault,onRead=()=>{}}={}){
 const values=new Map([['lumenCloudOwnerId','private-owner'],['lumenProgressV1','private-current'],
  ['lumenBeforeCloudRestore_100','old-original'],['lumenBeforeCloudRestore_200','recent'],['lumenBeforeCloudRestore_300','newest'],
  ['lumenUnsyncedCloudBackupV2:private-owner:latest','latest-evidence'],
  ['lumenCanonicalOutboxV2:private','pending-intent'],['unknown-secret-key','secret-token'],['lumenCloudDiagnosticsV1','[]']]);
 const archives=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),key:i=>[...values.keys()][i]??null,get length(){return values.size}};
 const indexedDB={open(){
  const open={};setImmediate(()=>{
   if(fault==='open'){open.onerror();return}
   open.result={objectStoreNames:{contains:()=>true},close(){},transaction(){
    const pending=new Map(archives);let aborted=false,requests=0,completed=false;
    const enqueue=action=>{requests++;setImmediate(()=>{if(aborted)return;action();requests--;if(!requests&&!aborted&&!completed){completed=true;if(fault==='commit'){tx.onabort?.();return}for(const [k,v] of pending)archives.set(k,v);tx.oncomplete?.()}})};
    const tx={abort(){aborted=true;setImmediate(()=>tx.onabort?.())},objectStore:()=>({
     get(key){const read={};enqueue(()=>{onRead();read.result=fault==='read'?'bad-read':pending.get(key);read.onsuccess?.()});return read},
     put(value,key){if(fault==='write-sync')throw Error('denied');const write={};pending.set(key,value);enqueue(()=>{if(fault==='write')tx.abort();else write.onsuccess?.()});return write}
    })};return tx;
   }};open.onsuccess();
  });return open;
 }};
 return {storage,values,archives,indexedDB};
}

for(const fault of [undefined,'commit'])test(`achievement installation quota archives old originals before one retry (${fault||'success'})`,async()=>{
 const f=fixture({fault});
 const local={solved:{0:true},badges:{},shards:9,xp:10},remote={...local,solved:{0:true,1:true},shards:8};
 const raw=JSON.stringify(local);f.values.set('lumenProgressV1',raw);
 const write=f.storage.setItem;
 f.storage.setItem=(k,v)=>{if(k==='lumenProgressV1'&&v!==raw&&f.values.has('lumenBeforeCloudRestore_100'))throw Object.assign(Error('full'),{name:'QuotaExceededError'});write(k,v)};
 const previous=globalThis.indexedDB;globalThis.indexedDB=f.indexedDB;
 try{
  if(fault){await assert.rejects(()=>reconcileCloudAchievementsDurably(f.storage,remote));assert.equal(f.values.get('lumenProgressV1'),raw)}
  else{
   assert.equal((await reconcileCloudAchievementsDurably(f.storage,remote)).changed,true);
   assert.equal(JSON.parse(f.values.get('lumenProgressV1')).solved[1],true);
   assert.equal(JSON.parse(f.values.get('lumenProgressV1')).shards,9,'wallet difference stays unconfirmed');
   assert.equal(f.archives.get('localStorage:lumenBeforeCloudRestore_100'),'old-original');
   assert.equal(f.values.get('lumenBeforeCloudRestore_200'),'recent');
   assert.ok([...f.values.values()].includes(raw),'pre-install original is retained');
  }
  assert.equal(f.values.get('lumenCanonicalOutboxV2:private'),'pending-intent');
 }finally{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous}
});
for(const change of ['owner','profile','session'])test(`achievement quota retry stops on ${change} change during archival`,async()=>{
 let valid=true;
 const f=fixture({onRead(){if(change==='session')valid=false;else f.values.set(change==='owner'?'lumenCloudOwnerId':'lumenProgressV1','replacement')}});
 const local={solved:{0:true},badges:{},shards:9,xp:10},remote={...local,solved:{0:true,1:true}};
 const raw=JSON.stringify(local);f.values.set('lumenProgressV1',raw);const write=f.storage.setItem;
 f.storage.setItem=(k,v)=>{if(k==='lumenProgressV1'&&v!==raw)throw Object.assign(Error('full'),{name:'QuotaExceededError'});write(k,v)};
 const previous=globalThis.indexedDB;globalThis.indexedDB=f.indexedDB;
 try{
  const result=await reconcileCloudAchievementsDurably(f.storage,remote,{sessionValid:()=>valid});
  assert.equal(result.changed,false);assert.equal(result.interrupted,true);
  assert.equal(f.values.get('lumenProgressV1'),change==='profile'?'replacement':raw);
  assert.equal(f.values.get('lumenBeforeCloudRestore_100'),'old-original');
 }finally{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous}
});
test('measurement reports category sizes without keys, values or account identities',async()=>{
 const {measureLocalStorage}=await load();const f=fixture();const before=[...f.values];
 const report=measureLocalStorage(f.storage),json=JSON.stringify(report);
 assert.equal(report.available,true);assert.equal(report.entries,f.values.size);
 assert.equal(report.bytes,[...f.values].reduce((sum,[k,v])=>sum+2*(k.length+v.length),0));
 assert.equal(report.categories.backups.entries,4);assert.equal(report.categories.logs.entries,1);
 for(const secret of ['private-owner','private-current','secret-token','unknown-secret-key','old-original'])assert(!json.includes(secret));
 assert.deepEqual([...f.values],before);
});
test('unreadable storage is unavailable rather than empty',async()=>{
 const {measureLocalStorage}=await load();assert.equal(measureLocalStorage({get length(){throw Error('denied')}}).available,false);
});
test('browser quota is a separate estimate and never claims device free space',async()=>{
 const {storageReport}=await load();const f=fixture();
 const result=await storageReport(f.storage,{storage:{estimate:async()=>({usage:12345,quota:999999999})}});
 assert.equal(result.browser.usage,12345);assert.equal(result.deviceFreeSpaceKnown,false);
 assert.notEqual(result.local.bytes,result.browser.usage);
 const unavailable=await storageReport(f.storage,{storage:{estimate:async()=>{throw Error('unavailable')}}});
 assert.equal(unavailable.local.available,true);assert.equal(unavailable.browser.available,false);
});
test('IndexedDB inventory reads existing stores without creating databases or disclosing contents',async()=>{
 const {storageReport}=await load();const opened=[],modes=[];
 const indexedDB={databases:async()=>[{name:'lumenCloudRecoveryV1'}],open(name,...args){
  assert.equal(args.length,0);opened.push(name);const request={};
  queueMicrotask(()=>{request.result={close(){},transaction(store,mode){
   modes.push(mode);assert.equal(store,'snapshots');
   const tx={objectStore:()=>({openCursor(){const cursor={};let index=0;
    const next=()=>queueMicrotask(()=>{cursor.result=index++?null:{key:'private-archive-key',value:'private-save',continue:next};cursor.onsuccess();if(!cursor.result)tx.oncomplete()});next();return cursor;
   }})};return tx;
  }};request.onsuccess()});return request;
 }};
 const report=await storageReport(fixture().storage,{},indexedDB);
 assert.equal(report.indexed.available,true);assert.equal(report.indexed.categories.archives.entries,1);
 assert.equal(report.indexed.categories.checkpoints.entries,0);
 assert.deepEqual(opened,['lumenCloudRecoveryV1']);assert.deepEqual(modes,['readonly']);
 assert(!JSON.stringify(report).includes('private'));
});
test('retention archives the exact oldest original and keeps two recent copies and all active data',async()=>{
 const {archiveRecoveryBackups}=await load();const f=fixture();
 const result=await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB});
 assert.equal(result.archived,1);assert.equal(result.failed,false);
 assert.equal(f.values.has('lumenBeforeCloudRestore_100'),false);
 assert.equal(f.archives.get('localStorage:lumenBeforeCloudRestore_100'),'old-original');
 assert.equal(f.values.get('lumenBeforeCloudRestore_200'),'recent');
 assert.equal(f.values.get('lumenProgressV1'),'private-current');
 assert.equal(f.values.get('lumenCanonicalOutboxV2:private'),'pending-intent');
 assert.equal(f.values.get('lumenUnsyncedCloudBackupV2:private-owner:latest'),'latest-evidence');
 assert.equal(f.values.get('unknown-secret-key'),'secret-token');
 assert.equal((await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB})).archived,0);
});
for(const fault of ['open','write','write-sync','read','commit'])test(`archive ${fault} failure never authorizes removing the original`,async()=>{
 const {archiveRecoveryBackups}=await load();const f=fixture({fault});const before=[...f.values];
 const result=await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB});
 assert.equal(result.archived,0);assert.equal(result.failed,true);assert.deepEqual([...f.values],before);
});
test('an inventory race aborts creation of a database removed after enumeration',async()=>{
 const {storageReport}=await load();let aborted=false;
 const indexedDB={databases:async()=>[{name:'lumenCloudRecoveryV1'}],open(){const request={transaction:{abort(){aborted=true}}};queueMicrotask(()=>request.onupgradeneeded());return request}};
 const report=await storageReport(fixture().storage,{},indexedDB);
 assert.equal(aborted,true);assert.equal(report.indexed.available,false);
});
for(const change of ['owner','profile','backup','session'])test(`${change} change during archival cancels local removal`,async()=>{
 const {archiveRecoveryBackups}=await load();let valid=true;
 const f=fixture({onRead(){if(change==='owner')f.values.set('lumenCloudOwnerId','replacement');if(change==='profile')f.values.set('lumenProgressV1','new-progress');if(change==='backup')f.values.set('lumenBeforeCloudRestore_100','new-evidence');if(change==='session')valid=false}});
 const result=await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB,sessionValid:()=>valid});
 assert.equal(result.archived,0);assert.equal(f.values.get('lumenBeforeCloudRestore_100'),change==='backup'?'new-evidence':'old-original');
});
test('an existing different archive is never overwritten',async()=>{
 const {archiveRecoveryBackups}=await load();const f=fixture();f.archives.set('localStorage:lumenBeforeCloudRestore_100','different-original');
 const result=await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB});
 assert.equal(result.failed,true);assert.equal(f.archives.get('localStorage:lumenBeforeCloudRestore_100'),'different-original');assert.equal(f.values.get('lumenBeforeCloudRestore_100'),'old-original');
});
test('a silently refused local removal reports failure while preserving both copies',async()=>{
 const {archiveRecoveryBackups}=await load();const f=fixture();f.storage.removeItem=()=>{};
 const result=await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB});
 assert.equal(result.failed,true);assert.equal(result.archived,0);
 assert.equal(f.values.get('lumenBeforeCloudRestore_100'),'old-original');
 assert.equal(f.archives.get('localStorage:lumenBeforeCloudRestore_100'),'old-original');
});
test('checkpoint retention is per owner and never consumes latest pointers or V1 evidence',async()=>{
 const {archiveRecoveryBackups}=await load();const f=fixture();
 for(const owner of ['first','second'])for(const stamp of [10,20,30])f.values.set('lumenUnsyncedCloudBackupV2:'+owner+':'+stamp+':abc','original-'+owner+'-'+stamp);
 f.values.set('lumenUnsyncedCloudBackupV1:first','legacy-original');
 const result=await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB});
 assert.equal(result.archived,3);
 for(const owner of ['first','second']){
  assert.equal(f.values.has('lumenUnsyncedCloudBackupV2:'+owner+':10:abc'),false);
  assert.equal(f.values.get('lumenUnsyncedCloudBackupV2:'+owner+':20:abc'),'original-'+owner+'-20');
 }
 assert.equal(f.values.get('lumenUnsyncedCloudBackupV1:first'),'legacy-original');
});
test('#723: launch maintenance frees a quota saturated by account-switch copies, verified and deduplicated',async()=>{
 const {archiveRecoveryBackups}=await load();const f=fixture();
 const big=label=>label+'-'+'x'.repeat(4000);
 const copies={1000:big('A'),1100:big('A'),1200:big('B'),1300:big('C'),1400:big('C'),1500:big('D')};
 for(const [stamp,value] of Object.entries(copies))f.values.set('lumenBeforeAccountSwitch_'+stamp,value);
 for(const [stamp,value] of Object.entries({10:'attempt-x',20:'attempt-x',30:'attempt-y',40:'attempt-z'}))f.values.set('lumenBeforeAccountSwitchAttempt_'+stamp,value);
 // A browser quota: writes fail while the copies fill localStorage.
 const used=()=>[...f.values].reduce((n,[k,v])=>n+2*(k.length+v.length),0),limit=used()+1000,setItem=f.storage.setItem;
 f.storage.setItem=(k,v)=>{if(used()+2*(k.length+String(v).length)>limit)throw Object.assign(Error('quota'),{name:'QuotaExceededError'});setItem(k,v)};
 assert.throws(()=>f.storage.setItem('lumenProgressV1Next',big('progress')),/quota/,'Saturated before maintenance');
 const before=new Map(f.values);
 const result=await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB,families:['AccountSwitch','AccountSwitchAttempt']});
 assert.equal(result.failed,false);assert.equal(result.interrupted,false);
 assert.equal(result.archived,6);assert.equal(result.deduplicated,3);
 // The two most recent distinct copies of each family stay in place.
 assert.deepEqual([...f.values.keys()].filter(k=>k.startsWith('lumenBeforeAccountSwitch_')).sort(),['lumenBeforeAccountSwitch_1400','lumenBeforeAccountSwitch_1500']);
 assert.deepEqual([...f.values.keys()].filter(k=>k.startsWith('lumenBeforeAccountSwitchAttempt_')).sort(),['lumenBeforeAccountSwitchAttempt_30','lumenBeforeAccountSwitchAttempt_40']);
 // Every removed copy is readable in IndexedDB exactly as it was; identical copies are stored once.
 const archived=new Set(f.archives.values());
 for(const [key,value] of before)if(!f.values.has(key)){assert(key.startsWith('lumenBeforeAccountSwitch'),'Only account-switch copies move: '+key);assert(archived.has(value),'Readable in IndexedDB: '+key)}
 assert.deepEqual([...f.archives.keys()].sort(),['localStorage:lumenBeforeAccountSwitchAttempt_20','localStorage:lumenBeforeAccountSwitch_1100','localStorage:lumenBeforeAccountSwitch_1200','localStorage:lumenBeforeAccountSwitch_1400']);
 assert.equal(f.archives.get('localStorage:lumenBeforeAccountSwitch_1400'),copies[1400],'The twin of a kept copy is archived under its key');
 // Other families and active data are untouched by the launch maintenance.
 assert.equal(f.values.get('lumenBeforeCloudRestore_100'),'old-original');
 assert.equal(f.values.get('lumenProgressV1'),'private-current');assert.equal(f.values.get('lumenCanonicalOutboxV2:private'),'pending-intent');
 // Space is back.
 f.storage.setItem('lumenProgressV1Next',big('progress'));assert.equal(f.values.has('lumenProgressV1Next'),true);
 assert.equal((await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB,families:['AccountSwitch','AccountSwitchAttempt']})).archived,0,'Idempotent');
});
test('#723: a twin whose archive key holds different content is never removed',async()=>{
 const {archiveRecoveryBackups}=await load();const f=fixture();
 for(const [stamp,value] of Object.entries({1:'same',2:'same',3:'other',4:'newest'}))f.values.set('lumenBeforeAccountSwitch_'+stamp,value);
 f.archives.set('localStorage:lumenBeforeAccountSwitch_2','conflicting');
 const result=await archiveRecoveryBackups(f.storage,{indexedDB:f.indexedDB,families:['AccountSwitch']});
 assert.equal(result.failed,true);assert.equal(f.values.get('lumenBeforeAccountSwitch_1'),'same');assert.equal(f.values.get('lumenBeforeAccountSwitch_2'),'same');
});
test('#723: the game runs the silent launch maintenance for account-switch copies only',()=>{
 const source=ui.replace(/\r\n/g,'\n');
 assert.match(source,/archiveRecoveryBackups\(localStorage,\{families:\['AccountSwitch','AccountSwitchAttempt'\],/);
 assert.match(source,/sessionValid:\(\)=>lumenUser===user&&lumenSupabase===client&&!authSessionPending\}\)/);
 assert.match(source,/\nsetTimeout\(\(\)=>void autoArchiveAccountSwitchCopies\(\),15000\);\n/);
 assert.match(source,/if\(qaActive\|\|switchCopiesTries>=3\)return;/);
});

// #962: above the threshold every backup family is archived automatically, in batches,
// keeping the two newest copies per family; below it nothing moves.
test('automatic maintenance archives every family beyond two copies when over the threshold',async()=>{
 const {maintainRecoveryBackups}=await load();
 const f=fixture();
 for(let i=0;i<120;i++)f.values.set('lumenBeforeCloudRestore_'+(1000+i),'copy-'+i+'-'+'x'.repeat(5000));
 const idle=await maintainRecoveryBackups(f.storage,{indexedDB:f.indexedDB,thresholdBytes:1e12});
 assert.equal(idle.ran,false);assert.equal(f.archives.size,0);
 const done=await maintainRecoveryBackups(f.storage,{indexedDB:f.indexedDB,thresholdBytes:1024});
 assert.equal(done.ran,true);assert(done.batches>=3,'more than one 50-copy batch');assert.equal(done.failed,false);
 const left=[...f.values.keys()].filter(k=>k.startsWith('lumenBeforeCloudRestore_'));
 assert.equal(left.length,2,'two newest copies kept');assert.deepEqual(left.sort(),['lumenBeforeCloudRestore_1118','lumenBeforeCloudRestore_1119']);
 assert.equal(f.archives.size,done.archived,'every removed copy is in the archive');
 assert.equal(f.values.get('lumenCanonicalOutboxV2:private'),'pending-intent','pending work untouched');
 assert.equal(f.values.get('lumenProgressV1'),'private-current');
});
test('automatic maintenance stops on a failed archive without removing copies',async()=>{
 const {maintainRecoveryBackups}=await load();
 const f=fixture({fault:'commit'});
 for(let i=0;i<10;i++)f.values.set('lumenBeforeCloudRestore_'+(1000+i),'copy-'+i);
 const before=[...f.values.keys()].length;
 const result=await maintainRecoveryBackups(f.storage,{indexedDB:f.indexedDB,thresholdBytes:1});
 assert.equal(result.failed,true);assert.equal([...f.values.keys()].length,before,'nothing removed without a committed archive');
});
