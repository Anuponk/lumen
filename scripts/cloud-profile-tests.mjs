import assert from 'node:assert/strict';
import {backupAndVerifyProfile,loadVerifiedProfile,validateCloudProfile,restoreIntoEmptyGuestStorage} from '../src/persistence/cloud-profile.js';
const source={solved:{0:1,1:1},historyBackup:{0:1,1:1},badges:{0:{speed:true}},stars:{0:3},shards:7,daily:{dates:{"2026-10-09":1}},performances:{1:{bestTime:44}},xp:13};
let saved=null;
const fake={async rpc(method,args){
  if(method==='lumen_backup_profile'){saved=structuredClone(args.p_payload);return {error:null}}
  if(method==='lumen_restore_profile')return {data:saved,error:null};
  throw Error('Unexpected RPC: '+method)
}};
assert.equal((await backupAndVerifyProfile(fake,source)).solved,2);
assert.deepEqual(await loadVerifiedProfile(fake),source);
assert.throws(()=>validateCloudProfile({solved:{}}),/Badges/);
await assert.rejects(()=>backupAndVerifyProfile({rpc:async()=>({error:{message:'network'}})},source),/refusée/);
await assert.rejects(()=>backupAndVerifyProfile({rpc:async method=>method==='lumen_backup_profile'?{error:null}:{data:{solved:{},badges:{}},error:null}},source),/non vérifiée/);
assert.equal(source.shards,7,'Local original untouched');
console.log('Cloud profile backup validation and read-back tests passed');

const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))}};
const fresh=storage();assert.equal(restoreIntoEmptyGuestStorage(fresh,source).solved,2);
assert.deepEqual(JSON.parse(fresh.getItem('lumenProgressV1')),source);
assert.throws(()=>restoreIntoEmptyGuestStorage(fresh,source),/Progression déjà présente/);
const occupied=storage();occupied.setItem('lumenProgressV1',JSON.stringify({solved:{0:1},badges:{}}));
assert.throws(()=>restoreIntoEmptyGuestStorage(occupied,source),/Progression déjà présente/);
assert.equal(JSON.parse(occupied.getItem('lumenProgressV1')).solved[0],1);
const corrupt=storage();corrupt.setItem('lumenProgressV1','{not-json');
assert.throws(()=>restoreIntoEmptyGuestStorage(corrupt,source),/illisible/);

const cloudSrc=(await import('node:fs')).readFileSync(new URL('../src/persistence/cloud.js',import.meta.url),'utf8');
const uiSrc=(await import('node:fs')).readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const html=(await import('node:fs')).readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.equal((cloudSrc.match(/afterAuthCloudSync\\?\\.\\(\\)/g)||[]).length,2,'Cloud sync must run after both session and sign-in auth flows');
assert.match(uiSrc,/afterAuthCloudSync:async/);
assert.match(uiSrc,/backupAndVerifyProfile\\(lumenSupabase,lumenProgress\\)/);
assert.match(uiSrc,/restoreIntoEmptyGuestStorage\\(localStorage,remote\\)/);
assert.doesNotMatch(html,/id="migrationCloud(?:Save|Restore)"/);
