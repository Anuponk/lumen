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
 const model={lumenSupabase:null,lumenUser:options.guest?null:{id:'test-user'},lumenCloudReady:false,lumenNickname:'',lumenProgress:{solved:{0:1,1:1,2:1},historyBackup:{0:1,1:1,2:1},noHint:{0:1},daily:{dates:{},rewards:{}},badges:{},performances:{}},sequentialSolvedCount:3,levelIndex:2,usedHintThisGame:false};
 const client={
  async rpc(name,args){trace.push({name,args});if(options.networkError)return {data:null,error:{message:'fixture offline'}};return {error:null,data:name==='lumen_get_progress'?options.cloud:name==='lumen_get_daily'?[{play_date:'2026-10-01'}]:name==='lumen_get_profile'?[{nickname:'Player'}]:name==='lumen_set_nickname'?'Tester':name==='lumen_get_entitlements'?['fixture']:null}},
  auth:{async getSession(){return {data:{session:options.guest?null:{user:{id:'test-user'}}}}},onAuthStateChange(callback){authCallback=callback},async signOut(){trace.push({auth:'signOut'})},async signInWithOAuth(args){trace.push({auth:'signInWithOAuth',args});return {error:null}}}
 };
 model.lumenSupabase=client;
 if(options.guest)model.lumenUser=null;
 const environment={document,location:{origin:'http://localhost',pathname:'/'},alert:message=>trace.push({alert:message}),setTimeout:callback=>queue.push(callback),console:{warn:(...args)=>warnings.push(args)}};
 let scope=model;
 const hooks={
  activeGameSeconds:()=>42,
  exactSkyScoreForSolvedPrefix(){let score=0;for(let i=0;i<100&&scope.lumenProgress.solved[i];i++)score+=skyStarsForGrid(i);return score},
  saveLumenProgress:()=>trace.push({save:plain(scope.lumenProgress)}),
  refreshJourney:()=>trace.push({ui:'refreshJourney'}),init:()=>trace.push({ui:'init'}),updateAuthUI:()=>trace.push({ui:'updateAuthUI'}),showRewardToast:copy=>trace.push({toast:copy}),renderDaily:()=>trace.push({ui:'renderDaily'})
 };
 let api;
 if(legacy){scope={...model,...environment,...hooks};vm.createContext(scope);vm.runInContext(names.map(name=>functionSource(source,name)).join('\n'),scope);api=scope}
 else api=createCloudPersistence(model,hooks,environment);
 await api.cloudMergeProgress();await api.cloudSavePuzzle(2);if(!options.guest)await api.cloudMergeDaily();await api.cloudSaveDaily('2026-10-03',2);await api.loadLumenProfile();await api.loadEntitlements();await api.saveLumenNickname();await api.initLumenCloud();
 if(authCallback&&!options.guest){authCallback('SIGNED_IN',{user:{id:'another-user'}});for(const callback of queue)await callback();authCallback('SIGNED_OUT',null)}
 if(controls.get('authLogin')?.onclick)await controls.get('authLogin').onclick();
 if(controls.get('authLogout')?.onclick)await controls.get('authLogout').onclick();
 return plain({progress:scope.lumenProgress,user:scope.lumenUser,nickname:scope.lumenNickname,ready:scope.lumenCloudReady,sequential:scope.sequentialSolvedCount,level:scope.levelIndex,trace,warnings});
}
const scenarios=[{guest:true,cloud:[]},{cloud:[]},{cloud:[{puzzle_id:1},{puzzle_id:2}]},{cloud:[{puzzle_id:1},{puzzle_id:3}]},{cloud:[],networkError:true}];
for(const options of scenarios){
 const actual=await fixture(options,false),legacy=await fixture(options,true);
 // #29 intentionally restores daily-history merge during authenticated init/sign-in.
 // Compare the legacy contract after removing only the new, documented daily-sync effects.
 const normalized=plain(actual),expected=plain(legacy);
 if(!options.guest&&!options.networkError){
   normalized.progress.daily.dates={};
   expected.progress.daily.dates={};
   const normalizeDailySyncTrace=trace=>{
     const out=[];
     for(let i=0;i<trace.length;i++){
       if(trace[i].name==='lumen_get_daily'){
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
   for(const x of normalized.trace)if(x.save?.daily?.dates?.['2026-10-01'])x.save.daily.dates={};
   for(const x of expected.trace)if(x.save?.daily?.dates?.['2026-10-01'])x.save.daily.dates={};
 }
 assert.deepEqual(normalized,expected,'Cloud/persistence behavior changed outside intentional #29 daily sync: '+JSON.stringify(options));
 if(!options.guest&&!options.networkError){
   assert.equal(actual.progress.daily.dates['2026-10-01'],1,'Authenticated init must merge server daily history');
   assert.ok(actual.trace.some(x=>x.name==='lumen_get_daily'),'Authenticated init must call lumen_get_daily');
 }
}
console.log(JSON.stringify({baseline,localFixtures:4,cloudFixtures:scenarios.length,authCallbacks:true,rpcPayloads:'legacy except intentional daily sync',result:'passing',liveCloudWrites:false}));
