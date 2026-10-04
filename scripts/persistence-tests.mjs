import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {functionSource} from './source-tools.mjs';
import {createLocalPersistence} from '../src/persistence/local.js';
import {createCloudPersistence} from '../src/persistence/cloud.js';
import {skyStarsForGrid} from '../src/campaign/progression.js';

const baseline='dcd9f3c872e623541be698edc212b64589d3b164';
const source=(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8'})).replace(/\r/g,'');
const names=['loadLumenProfile','saveLumenNickname','loadEntitlements','cloudSavePuzzle','cloudMergeProgress','initLumenCloud','cloudSaveDaily','cloudMergeDaily'];
const plain=value=>JSON.parse(JSON.stringify(value));
for(const stored of [null,'bad JSON',JSON.stringify({solved:{0:1,1:1},badges:{}})]){
 let progress,written;const storage={getItem:()=>stored,setItem:(key,value)=>written={key,value}};
 const local=createLocalPersistence(storage,()=>progress);
 const legacy={localStorage:storage};vm.createContext(legacy);
 vm.runInContext(functionSource(source,'loadLumenProgress')+'\n'+functionSource(source,'saveLumenProgress'),legacy);
 progress=local.loadLumenProgress();assert.deepEqual(plain(progress),plain(legacy.loadLumenProgress()));
 local.saveLumenProgress();const actual=written;legacy.lumenProgress=progress;legacy.saveLumenProgress();assert.deepEqual(actual,written);
}
const denied=createLocalPersistence({getItem(){throw Error('denied')},setItem(){throw Error('denied')}},()=>({solved:{}}));
assert.deepEqual(denied.loadLumenProgress(),{solved:{},badges:{}});denied.saveLumenProgress();

async function fixture(options,legacy){
 const trace=[],queue=[],warnings=[];let authCallback;
 const controls=new Map();const document={getElementById:id=>{if(!controls.has(id))controls.set(id,{value:'Tester'});return controls.get(id)}};
 const model={lumenSupabase:null,lumenUser:options.guest?null:{id:'test-user'},lumenCloudReady:false,lumenNickname:'',lumenEntitlements:[],lumenCapabilities:[],lumenProgress:{solved:{0:1,1:1,2:1},historyBackup:{0:1,1:1,2:1},noHint:{0:1},daily:{dates:{},rewards:{}},badges:{},performances:{}},sequentialSolvedCount:3,levelIndex:2,usedHintThisGame:false};
 const client={
  async rpc(name,args){trace.push({name,args});if(options.networkError)return {data:null,error:{message:'fixture offline'}};return {error:null,data:name==='lumen_get_progress'?options.cloud:name==='lumen_get_daily'?[{play_date:'2026-10-01'}]:name==='lumen_get_engagement'?[{server_day:'2026-10-03',shards:4,rewarded_days:{'2026-10-01':1}}]:name==='lumen_claim_daily'?[{server_day:'2026-10-03',credited:true,reward:1,streak:3}]:name==='lumen_get_profile'?[{nickname:'Player'}]:name==='lumen_set_nickname'?'Tester':name==='lumen_get_entitlements'?[{entitlement:'future-pack',source:'manual',expires_at:null}]:name==='lumen_get_internal_capabilities'?[{capability:'unlimited_shards',source:'manual'}]:null}},
  auth:{async getSession(){return {data:{session:options.guest?null:{user:{id:'test-user'}}}}},onAuthStateChange(callback){authCallback=callback},async signOut(){trace.push({auth:'signOut'});return {error:null}},async signInWithOAuth(args){trace.push({auth:'signInWithOAuth',args});return {error:null}}}
 };
 model.lumenSupabase=client;
 if(options.guest)model.lumenUser=null;
 const environment={document,location:{origin:'http://localhost',pathname:'/'},alert:message=>trace.push({alert:message}),setTimeout:callback=>queue.push(callback),console:{warn:(...args)=>warnings.push(args)}};
 let scope=model;
 const hooks={
  activeGameSeconds:()=>42,
  exactSkyScoreForSolvedPrefix(){let score=0;for(let i=0;i<100&&scope.lumenProgress.solved[i];i++)score+=skyStarsForGrid(i);return score},
  saveLumenProgress:()=>trace.push({save:plain(scope.lumenProgress)}),
  refreshJourney:()=>trace.push({ui:'refreshJourney'}),init:()=>trace.push({ui:'init'}),updateAuthUI:()=>trace.push({ui:'updateAuthUI'}),showRewardToast:copy=>trace.push({toast:copy}),onAccountChanged:event=>trace.push({ui:'account',event}),renderDaily:()=>trace.push({ui:'renderDaily'})
 };
 let api;
 if(legacy){scope={...model,...environment,...hooks};vm.createContext(scope);vm.runInContext(names.map(name=>functionSource(source,name)).join('\n'),scope);api=scope}
 else api=createCloudPersistence(model,hooks,environment);
 await api.cloudMergeProgress();await api.cloudSavePuzzle(2);if(!options.guest)await api.cloudMergeDaily();await api.cloudSaveDaily('2026-10-03',2);await api.loadLumenProfile();await api.loadEntitlements();if(!options.guest){if(legacy)await api.saveLumenNickname();else await api.saveLumenNickname('Player')}await api.initLumenCloud();
 if(authCallback&&!options.guest){authCallback('SIGNED_IN',{user:{id:'another-user'}});for(const callback of queue)await callback();authCallback('SIGNED_OUT',null);for(const callback of queue.splice(0))await callback()}
 
 return plain({progress:scope.lumenProgress,user:scope.lumenUser,nickname:scope.lumenNickname,entitlements:scope.lumenEntitlements||[],capabilities:scope.lumenCapabilities||[],ready:scope.lumenCloudReady,sequential:scope.sequentialSolvedCount,level:scope.levelIndex,trace,warnings});
}
const scenarios=[{guest:true,cloud:[]},{cloud:[]},{cloud:[{puzzle_id:1},{puzzle_id:2}]},{cloud:[{puzzle_id:1},{puzzle_id:3}]},{cloud:[],networkError:true}];
for(const options of scenarios){
 const actual=await fixture(options,false),legacy=await fixture(options,true);
 // #29 intentionally restores daily-history merge during authenticated init/sign-in.
 // Compare the legacy contract after removing only the new, documented daily-sync effects.
 const normalized=plain(actual),expected=plain(legacy);
 if(!options.guest&&!options.networkError){assert.ok(actual.trace.some(x=>x.name==='lumen_get_entitlements'),'Authenticated init must load persistent entitlements');assert.ok(actual.trace.some(x=>x.name==='lumen_get_internal_capabilities'),'Authenticated init must load internal capabilities')}
 assert.deepEqual(actual.entitlements,[],'Fixture ends signed out: account entitlements must be cleared locally');
 assert.deepEqual(actual.capabilities,[],'Fixture ends signed out: internal capabilities must be cleared locally');
 normalized.entitlements=[];expected.entitlements=[];normalized.capabilities=[];expected.capabilities=[];
 normalized.ready=expected.ready;
 const normalizePresentationTrace=trace=>trace.filter(x=>x.ui!=='updateAuthUI'&&x.ui!=='account'&&!x.toast);
 const normalizeOwnershipTrace=trace=>{
   const out=[];let afterSignOut=false;
   for(let i=0;i<trace.length;i++){
     const x=trace[i];
     if(x.name==='lumen_get_entitlements'||x.name==='lumen_get_internal_capabilities'){
       while(trace[i+1]?.ui==='refreshJourney'||trace[i+1]?.ui==='updateAuthUI')i++;
       continue;
     }
     if(x.auth==='signOut'){afterSignOut=true;out.push(x);continue}
     if(afterSignOut&&(x.ui==='refreshJourney'||x.ui==='account'))continue;
     if(afterSignOut)afterSignOut=false;
     if(x.ui==='refreshJourney'&&out.at(-1)?.ui==='updateAuthUI')continue;
     if(x.ui==='account'&&trace[i+1]?.auth==='signInWithOAuth')continue;
     out.push(x);
   }
   return out;
 };
 normalized.trace=normalizePresentationTrace(normalizeOwnershipTrace(normalized.trace));
 expected.trace=normalizePresentationTrace(normalizeOwnershipTrace(expected.trace));
 const stripOwnershipWarnings=warnings=>warnings.filter(x=>x?.[0]!=='LUMEN entitlements'&&x?.[0]!=='LUMEN capabilities');
 normalized.warnings=stripOwnershipWarnings(normalized.warnings);
 expected.warnings=stripOwnershipWarnings(expected.warnings);
 if(!options.guest){
   const stripEntitlementReads=trace=>trace.filter(x=>x.name!=='lumen_get_entitlements'&&x.name!=='lumen_get_internal_capabilities');normalized.trace=stripEntitlementReads(normalized.trace);expected.trace=stripEntitlementReads(expected.trace);
   normalized.progress.daily.dates={};
   expected.progress.daily.dates={};
   const normalizeDailySyncTrace=trace=>{
     const out=[];
     for(let i=0;i<trace.length;i++){
       if(trace[i].name==='lumen_get_daily'||trace[i].name==='lumen_get_engagement'){
         // #29 adds this sync during authenticated init/sign-in. Its immediate
         // save + render are implementation effects of the same intentional sync.
         if(trace[i+1]?.save)i++;
         if(trace[i+1]?.ui==='renderDaily')i++;
         continue;
       }
       out.push(trace[i]);
     }
     return out;
   };
   normalized.trace=normalizeDailySyncTrace(normalized.trace);
   expected.trace=normalizeDailySyncTrace(expected.trace);
   const normalizeDailyWarnings=warnings=>warnings.filter(x=>x?.[0]!=='LUMEN daily load'&&x?.[0]!=='LUMEN engagement load');
   normalized.warnings=normalizeDailyWarnings(normalized.warnings);
   expected.warnings=normalizeDailyWarnings(expected.warnings);
   for(const x of normalized.trace)if(x.save?.daily?.dates?.['2026-10-01'])x.save.daily.dates={};
   for(const x of expected.trace)if(x.save?.daily?.dates?.['2026-10-01'])x.save.daily.dates={};
   // The signed-in write is now an atomic server claim instead of trusting the client date.
   for(const x of normalized.trace)if(x.name==='lumen_claim_daily'){x.name='lumen_save_daily';x.args={p_play_date:'2026-10-03',p_puzzle_id:x.args.p_puzzle_id}}
   normalized.progress.daily.rewards={}; expected.progress.daily.rewards={};
   delete normalized.progress.shards; delete expected.progress.shards;
   for(const x of normalized.trace)if(x.save){x.save.daily.rewards={};delete x.save.shards}
   for(const x of expected.trace)if(x.save){x.save.daily.rewards={};delete x.save.shards}
 }
 assert.deepEqual(normalized,expected,'Cloud/persistence behavior changed outside intentional #29 daily sync: '+JSON.stringify(options));
 if(!options.guest&&!options.networkError){
   assert.equal(actual.progress.daily.dates['2026-10-01'],1,'Authenticated init must merge server daily history');
   assert.ok(actual.trace.some(x=>x.name==='lumen_get_daily'),'Authenticated init must call lumen_get_daily');
   assert.ok(actual.trace.some(x=>x.name==='lumen_get_engagement'),'Authenticated init must merge the server reward ledger');
   assert.ok(actual.trace.some(x=>x.name==='lumen_claim_daily'),'Authenticated daily completion must use the atomic server claim');
 }
}
console.log(JSON.stringify({baseline,localFixtures:4,cloudFixtures:scenarios.length,authCallbacks:true,rpcPayloads:'legacy except intentional daily sync',result:'passing',liveCloudWrites:false}));
