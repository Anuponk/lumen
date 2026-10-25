import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {createLocalPersistence} from '../src/persistence/local.js';
import {validateCloudProfile} from '../src/persistence/cloud-profile.js';
import {profileStorageBytes} from '../src/persistence/profile-size.js';
const profile={solved:{5:1},badges:{},shards:3};
function fixture(raw=null,{write=()=>{},read=()=>{}}={}){
 const values=new Map(raw===null?[]:[['lumenProgressV1',raw]]),issues=[];let saved=0;
 const storage={getItem(key){read(key);return values.get(key)??null},setItem(key,value){if(write(key,value)!==false)values.set(key,value)}};
 const api=createLocalPersistence(storage,()=>profile,{onSave:()=>saved++,onIssue:issue=>issues.push(issue)});
 return {api,values,storage,issues,saved:()=>saved};
}
test('save returns verified durable success and notifies only afterwards',()=>{
 const f=fixture();assert.deepEqual(f.api.saveLumenProgress(),{ok:true,durable:true});
 assert.equal(f.values.get('lumenProgressV1'),JSON.stringify(profile));assert.equal(f.saved(),1);
});
test('quota and silent write refusal return failure without notification',()=>{
 for(const write of [()=>{throw Error('synthetic private quota')},()=>false]){
  const f=fixture(null,{write}),result=f.api.saveLumenProgress();assert.equal(result.ok,false);assert.equal(result.durable,false);
  assert.equal(f.saved(),0);assert.equal(f.issues.length,1);assert(!JSON.stringify(f.issues).includes('private'));
 }
});
test('unreadable storage never becomes permission to overwrite the profile',()=>{
 const f=fixture('retained',{read:()=>{throw Error('denied')}});f.api.loadLumenProgress();
 assert.equal(f.api.saveLumenProgress().ok,false);assert.equal(f.values.get('lumenProgressV1'),'retained');
});
test('corrupt bytes are archived and read back before a replacement is written',()=>{
 const raw='{synthetic broken JSON',f=fixture(raw);f.api.loadLumenProgress();
 assert.equal(f.api.saveLumenProgress().ok,true);
 const archives=[...f.values].filter(([key])=>key.startsWith('lumenLocalQuarantineV1:'));
 assert.equal(archives.length,1);assert.equal(archives[0][1],raw);
 assert.equal(f.api.saveLumenProgress().ok,true);assert.equal([...f.values].filter(([key])=>key.startsWith('lumenLocalQuarantineV1:')).length,1);
});
test('failed or silently refused quarantine keeps the only original untouched',()=>{
 for(const write of [(key)=>{if(key!=='lumenProgressV1')throw Error('full')},key=>key==='lumenProgressV1']){
  const raw='{retained original',f=fixture(raw,{write});f.api.loadLumenProgress();
  assert.equal(f.api.saveLumenProgress().ok,false);assert.equal(f.values.get('lumenProgressV1'),raw);assert.equal(f.saved(),0);
 }
});
test('unsupported future catalogue origin is held rather than replaced by a starter',()=>{
 const raw=JSON.stringify({...profile,catalogueOrigin:999999}),f=fixture(raw);
 assert.deepEqual(f.api.loadLumenProgress().solved,profile.solved,'Unknown versions retain their visible acquisitions');
 assert.equal(f.api.saveLumenProgress().ok,false);assert.equal(f.values.get('lumenProgressV1'),raw);
});
test('a changed source during archival cancels replacement and keeps both originals',()=>{
 const old='{old invalid',newer='{new invalid';let f;
 f=fixture(old,{write:key=>{if(key.startsWith('lumenLocalQuarantineV1:'))f.values.set('lumenProgressV1',newer)}});
 f.api.loadLumenProgress();assert.equal(f.api.saveLumenProgress().ok,false);assert.equal(f.values.get('lumenProgressV1'),newer);
 assert([...f.values.values()].includes(old));
});
test('cloud limit counts UTF-8 bytes, including JSONB separator overhead',()=>{
 assert.throws(()=>validateCloudProfile({...profile,padding:'é'.repeat(270000)}),/volumineuse/);
 const base={solved:{},badges:{}},json=JSON.stringify({...base,padding:''});
 // Three member colons and two commas add five bytes in JSONB text.
 const fits={...base,padding:'x'.repeat(524288-Buffer.byteLength(json)-5)};
 assert.deepEqual(validateCloudProfile(fits),fits);
 assert.throws(()=>validateCloudProfile({...fits,padding:fits.padding+'xxxxx'}),/volumineuse/);
});
test('size reserve handles escaped punctuation and expanded scientific numbers',()=>{
 assert.equal(profileStorageBytes('{"a":"é,:\\\"","b":[1,2]}'),Buffer.byteLength('{"a": "é,:\\\"", "b": [1, 2]}'));
 for(const [number,expanded] of [[1e21,'1000000000000000000000'],[1.2e-7,'0.00000012'],[-1e21,'-1000000000000000000000']]){
  assert.equal(profileStorageBytes(JSON.stringify({n:number})),Buffer.byteLength('{"n": '+expanded+'}'));
 }
});
test('the actual UI reports local refusals visibly without exposing raw codes or data',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8'),status={hidden:true,textContent:''},events=[];
 const ctx=vm.createContext({document:{getElementById:()=>status},recordCloudDiagnostic:(...args)=>events.push(args)});
 vm.runInContext(functionSource(source,'reportLocalPersistence'),ctx);
 ctx.reportLocalPersistence({ok:false,durable:false,code:'LOCAL_WRITE_FAILED'});
 assert.equal(status.hidden,false);assert.match(status.textContent,/pas confirmée/);assert(!status.textContent.includes('LOCAL_WRITE_FAILED'));
 ctx.reportLocalPersistence({ok:true,durable:true});assert.equal(status.hidden,true);assert.equal(events.length,1);
});
test('presentation callback failure cannot invalidate a verified durable save',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const api=createLocalPersistence(storage,()=>profile,{onSave:()=>{throw Error('synthetic view failure')}});
 assert.deepEqual(api.saveLumenProgress(),{ok:true,durable:true});assert.equal(values.get('lumenProgressV1'),JSON.stringify(profile));
});
