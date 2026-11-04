import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {rememberVerifiedOfflineOwner,clearVerifiedOfflineOwner,isVerifiedOfflineOwner,verifiedOfflineWallet,preparedOfflineUser} from '../src/persistence/offline-verified-owner.js';
function storage(){const m=new Map();return {setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k)??null,removeItem:k=>m.delete(k)}}
test('verified owner resumes offline only for the matching account and bounded age',()=>{
 const s=storage();rememberVerifiedOfflineOwner(s,'alice',100000);
 assert.equal(isVerifiedOfflineOwner(s,'alice',{offline:true,now:100001}),true);
 assert.equal(isVerifiedOfflineOwner(s,'bob',{offline:true,now:100001}),false);
 assert.equal(isVerifiedOfflineOwner(s,'alice',{offline:false,now:100001}),false);
 assert.equal(isVerifiedOfflineOwner(s,'alice',{offline:true,now:100000+31*86400000}),false);
 clearVerifiedOfflineOwner(s);
 assert.equal(isVerifiedOfflineOwner(s,'alice',{offline:true,now:100001}),false);
});

test('a prepared offline cold start does not wait for an expired-token network refresh',async()=>{
 const s=storage();s.setItem('lumenCloudOwnerId','alice');rememberVerifiedOfflineOwner(s,'alice');
 const source=fs.readFileSync('src/ui/game-screen.js','utf8'),events=[];let reconnect;
 const ctx={localStorage:s,navigator:{onLine:false},preparedOfflineUser,persistenceModel:{},lumenSupabase:{},
  initLumenCloud:async()=>{events.push('auth')},updateAuthUI:()=>events.push('ui'),resumeOfflineAfterAuth:async id=>events.push('resume:'+id),
  window:{addEventListener:(event,fn,options)=>{assert.equal(event,'online');assert.equal(options.once,true);reconnect=fn}},recordCloudDiagnostic(){},console};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'initializeAccountSession'),ctx);
 await ctx.initializeAccountSession();assert.deepEqual(events,['ui','resume:alice']);assert.equal(ctx.persistenceModel.lumenUser.id,'alice');
 ctx.navigator.onLine=true;await reconnect();assert.equal(events.at(-1),'auth');
 s.setItem('lumenCloudOwnerId','bob');assert.equal(preparedOfflineUser(s,{offline:true}),null);
 assert.equal(preparedOfflineUser(s,{offline:false}),null);
});

test('offline Auth restart reads durable pending navigation and wallet work before resuming',async()=>{
 const source=fs.readFileSync('src/ui/game-screen.js','utf8');
 for(const changed of [false,true]){
  const events=[],client={};
  const context={lumenUser:{id:'alice'},lumenSupabase:client,navigator:{onLine:false},offlineQuestAccessContext:()=>({verifiedSession:true}),
   refreshCanonicalOutboxNotice:async()=>{events.push('read');if(changed)context.lumenUser={id:'bob'}},
   refreshJourney:()=>events.push('navigation'),updateHintButton:()=>events.push('balance'),resumeCanonicalVictoryAfterHydration:()=>events.push('resume'),recordCloudDiagnostic(){}};
  vm.createContext(context);vm.runInContext(functionSource(source,'resumeOfflineAfterAuth'),context);
  await context.resumeOfflineAfterAuth('alice',client);
  assert.deepEqual(events,changed?['read']:['read','navigation','balance','resume']);
 }
});

test('live access context persists hydration proof and restores it after page restart',async()=>{
 const source=fs.readFileSync('src/ui/game-screen.js','utf8');
 const s=storage();
 // Resolve the UI's actual imports so a missing runtime binding fails here.
 const bindings={};
 for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]*offline-verified-owner\.js)['"]/g)){
  const module=await import(new URL(match[2],new URL('../src/ui/game-screen.js',import.meta.url)));
  for(const name of match[1].split(',').map(n=>n.trim()))bindings[name]=module[name];
 }
 const context={...bindings,localStorage:s,navigator:{onLine:true},lumenUser:{id:'alice'},cloudProfileReady:true,cloudProfileBaseline:{shards:3},verifiedOfflineOwnerId:'alice'};
 vm.createContext(context);vm.runInContext(functionSource(source,'offlineQuestAccessContext'),context);
 assert.equal(context.offlineQuestAccessContext().verifiedSession,true);
 context.verifiedOfflineOwnerId=null;context.cloudProfileReady=false;context.navigator.onLine=false;
 assert.equal(context.offlineQuestAccessContext().verifiedSession,true,'Durable proof survives fresh in-memory state');
 assert.equal(verifiedOfflineWallet(s,'alice',{offline:true}),3,'Only the verified cloud baseline funds offline aids');
 context.lumenUser={id:'bob'};
 assert.equal(context.offlineQuestAccessContext().verifiedSession,false,'Account switch cannot inherit proof');
});
