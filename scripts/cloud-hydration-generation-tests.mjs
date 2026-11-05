import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import {hydrationFailureDiagnostic} from '../src/persistence/cloud-profile.js';
const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const marker='afterAuthCloudSync:async()=>{',start=source.indexOf(marker)+marker.length,end=source.indexOf('},holdLegacyMergeForFullRestore',start);
for(const change of ['account','client','generation','logout','none'])test('late rejected restore with '+change+' preserves the current session',async()=>{
 const events=[],calls=[],raw=JSON.stringify({solved:{},badges:{},shards:3});let ctx;
 const replacement={reason:'replacement'};
 ctx=vm.createContext({qaActive:false,lumenUser:{id:'a'},lumenSupabase:{},cloudHydrationGeneration:0,
  canonicalRecoveryContext:null,canonicalRecovery:{cancel(){}},cloudProfileReady:true,cloudProfileBaseline:{},cloudProfileFailure:null,
  sessionStorage:{getItem:()=>null},localStorage:{getItem:key=>key==='lumenProgressV1'?raw:key==='lumenCloudOwnerId'?'a':null},
  recordCloudDiagnostic:event=>events.push(event),hydrationFailureDiagnostic,updateAuthUI:()=>calls.push('auth'),console:{warn(){}},
  loadVerifiedProfile:async()=>{
   if(change==='account')ctx.lumenUser={id:'b'};
   if(change==='client')ctx.lumenSupabase={replacement:true};
   if(change==='generation')ctx.cloudHydrationGeneration++;
   if(change==='logout')ctx.lumenUser=null;
   ctx.cloudProfileFailure=replacement;throw Error('synthetic private late failure');
  }});
 await vm.runInContext('(async()=>{'+source.slice(start,end)+'})()',ctx);
 if(change==='none'){assert.equal(ctx.cloudProfileFailure.reason,'restore_failed');assert(events.includes('hydration_failed'));assert.deepEqual(calls,['auth']);}
 else {assert.equal(ctx.cloudProfileFailure,replacement);assert(!events.includes('hydration_failed'));assert.deepEqual(calls,[]);}
});
