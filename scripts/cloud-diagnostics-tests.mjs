import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
for(const key of ['function recordCloudDiagnostic','function cloudDiagnosticReport','flush_blocked','flush_failed','flush_conflict','victory_preflight','victory_dialog','hydration_failed','hydration_ready','Copier le diagnostic'])assert(src.includes(key),key);
const section=src.slice(src.indexOf('function recordCloudDiagnostic'),src.indexOf('async function flushCloudProfile'));
assert(!/JSON\.stringify\(lumenProgress\)|lumenUser\?\.id|email|access_token|refresh_token/.test(section),'Diagnostics must not leak progress, identity or tokens');
assert(src.includes('previous.slice(-39)'),'Local log storage stays bounded');
const recorder=src.slice(src.indexOf('function recordCloudDiagnostic'),src.indexOf('// Health counters'));
for(const fault of ['get','set','corrupt','health','console','none']){
 const calls=[];
 const storage={
  getItem(){if(fault==='get')throw Error('storage denied');return fault==='corrupt'?'{}':'[]'},
  setItem(){if(fault==='set')throw Object.assign(Error('full'),{name:'QuotaExceededError'})}
 };
 const context=vm.createContext({localStorage:storage,cloudDiagKey:'test',qaActive:false,
  lumenUser:{id:'must-never-be-sent'},lumenSupabase:{rpc:(name,payload)=>{calls.push({name,payload});return Promise.resolve({})}},
  document:{getElementById:()=>({textContent:'1.11.1+test'})},
  recordCloudHealth(){if(fault==='health')throw Error('health failed')},
  console:{info(){if(fault==='console')throw Error('logging failed')}}});
 vm.runInContext(recorder,context);
 vm.runInContext('recordCloudDiagnostic("hydration_failed", {reason:"local_quota", profile:{private:"not-to-send"}})',context);
 assert.equal(calls.length,1,`server health survives ${fault} failure`);
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{name:'lumen_record_sync_health',payload:{
  p_event:'hydration_failed',p_reason:'local_quota',p_outcome:null,p_version:'1.11.1+test'}});
 assert(!JSON.stringify(calls).includes('not-to-send'));
 assert(!JSON.stringify(calls).includes('must-never-be-sent'));
 // No remote event for guests, QA or unrelated local-only diagnostics.
 vm.runInContext('recordCloudDiagnostic("victory_dialog")',context);
 vm.runInContext('qaActive=true; recordCloudDiagnostic("hydration_failed")',context);
 vm.runInContext('qaActive=false; lumenUser=null; recordCloudDiagnostic("hydration_failed")',context);
 assert.equal(calls.length,1,'remote telemetry retains authenticated/QA/event guards');
}
console.log('Privacy-safe cloud diagnostics contract passed');
