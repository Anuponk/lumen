import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCloudPersistence} from '../src/persistence/cloud.js';
function harness({session=null,readSession,verifyError=null}={}){
 let callback;const queue=[],events=[],calls=[];
 const model={lumenUser:null,lumenSupabase:{auth:{
  onAuthStateChange:fn=>{callback=fn},
  getSession:async()=>readSession?readSession():{data:{session}},
  verifyOtp:async value=>{calls.push(['verify',value]);if(!verifyError)callback('PASSWORD_RECOVERY',{user:{id:'recovering'}});return {error:verifyError}},
  signOut:async value=>{calls.push(['signOut',value]);return {error:null}}
 },rpc:async name=>{calls.push([name]);return {data:[],error:null}}}};
 const api=createCloudPersistence(model,{onAccountChanged:e=>events.push(e.type),refreshJourney:()=>{},renderDaily:()=>{},holdLegacyMergeForFullRestore:async()=>true,afterAuthCloudSync:async()=>calls.push(['hydrate',model.lumenUser.id])},{console:{warn:()=>{}},setTimeout:fn=>queue.push(fn)});
 return {api,model,calls,events,queue,event:(...args)=>callback(...args),drain:async()=>{while(queue.length)await queue.shift()()}};
}
let resolveRead;
const h=harness({readSession:()=>new Promise(resolve=>resolveRead=resolve)});
const loading=h.api.initLumenCloud();
while(!resolveRead)await Promise.resolve();
h.event('SIGNED_IN',{user:{id:'player'}});
resolveRead({data:{session:null}});await loading;await h.drain();
assert.equal(h.model.lumenUser.id,'player');
assert.equal(h.calls.filter(c=>c[0]==='hydrate').length,1);
h.event('SIGNED_IN',{user:{id:'other'}});h.event('SIGNED_OUT',null);await h.drain();
assert.equal(h.model.lumenUser,null);
assert.equal(h.calls.filter(c=>c[0]==='hydrate').length,1);
globalThis.window={location:{href:'https://lumen.nopuna.fr/?lumen_confirm='+('a'.repeat(64))+'&type=recovery'},history:{replaceState(){},state:null}};
const recovery=harness({session:{user:{id:'recovering'}}});
await recovery.api.initLumenCloud();await recovery.drain();
assert.ok(recovery.events.includes('password_recovery'));
assert.equal(recovery.calls.some(c=>c[0]==='signOut'),false);
assert.equal(recovery.model.lumenUser.id,'recovering');
const expired=harness({session:{user:{id:'existing'}},verifyError:{message:'expired'}});
await expired.api.initLumenCloud();
assert.equal(expired.model.lumenUser.id,'existing');
assert.equal(expired.calls.some(c=>c[0]==='signOut'),false);
delete globalThis.window;
await recovery.api.signOut();assert.deepEqual(recovery.calls.at(-1),['signOut',{scope:'local'}]);
const cloud=fs.readFileSync('src/persistence/cloud.js','utf8'),ui=fs.readFileSync('src/ui/game-screen.js','utf8'),html=fs.readFileSync('index.html','utf8');
assert.doesNotMatch(cloud,/sendEmailOtp|verifyEmailOtp|requestLumenAuthMail\("magiclink"/);
assert.doesNotMatch(html,/id="account(?:LegacyOtp|Otp|EmailSend)/);
assert.match(html,/id="accountOptinLater"[^>]*>Retour au jeu/);assert.match(html,/Continuer avec Google/);
assert.match(cloud,/signInWithPassword/);assert.match(ui,/requestPasswordRecovery\(email\)/);
assert.match(ui,/editor\.dataset\.open="true";editor\.hidden=false/);
assert.match(ui,/renderDaily\(\);\s*refreshJourney\(\);updateAuthUI\(\)/);
console.log('Account session regressions passed: startup race, sign-out before deferred restore, recovery, failed-link preservation, local-only logout and two public modes.');

// Exercise the real menu renderer while the SDK has not finished restoration.
const {default:vm}=await import('node:vm');
const {functionSource}=await import('./source-tools.mjs');
const {gameplayDomainState}=await import('../src/persistence/gameplay-sync.js');
const authNodes=new Map();
for(const id of ['mobileAuthStatus','mobileAuthAction','mobileAccount','mobileAuthPopover','guestSaveExplainer','accountProfileEditor','editAccountProfile','retryAccountSync'])authNodes.set(id,{textContent:'',disabled:false,hidden:false,dataset:{},classList:{toggle(){}},setAttribute(){}});
const recoveryState=new Map([['lumenPasswordRecoveryPending','1']]);
const menuContext=vm.createContext({document:{getElementById:id=>authNodes.get(id)},sessionStorage:{getItem:k=>recoveryState.get(k)??null,removeItem:k=>recoveryState.delete(k)},
 gameplayDomainState,qaActive:false,cloudHydrationGeneration:0,canonicalRecoveryContext:null,
 syncAdministrationMenu(){},lumenUser:null,lumenSupabase:{},authSessionPending:true,canonicalOutboxNotice:null,cloudProfileReady:false,cloudProfileFailure:null,lumenNickname:'',cloudProfileBusy:false,cloudProfileDirty:false,navigator:{onLine:true}});
vm.runInContext(functionSource(ui,'cloudReconciliationMessage'),menuContext);
vm.runInContext(functionSource(ui,'gameplaySyncState'),menuContext);
vm.runInContext(functionSource(ui,'syncMobileAuthUI'),menuContext);menuContext.syncMobileAuthUI();
assert.equal(authNodes.get('mobileAuthAction').disabled,true,'No sign-in prompt while an existing session is still loading');
assert(!authNodes.get('mobileAuthAction').textContent.includes('Se connecter'));
assert.equal(authNodes.get('guestSaveExplainer').hidden,true);
assert.equal(recoveryState.get('lumenPasswordRecoveryPending'),'1','Pending restore must not clear password-recovery state');
menuContext.authSessionPending=false;menuContext.lumenUser={id:'restored-player'};menuContext.syncMobileAuthUI();
assert.equal(authNodes.get('mobileAuthAction').disabled,false);assert(!authNodes.get('mobileAuthAction').textContent.includes('Se connecter'));
menuContext.lumenUser=null;menuContext.syncMobileAuthUI();
assert.equal(authNodes.get('mobileAuthAction').disabled,false);assert(authNodes.get('mobileAuthAction').textContent.includes('Se connecter'));
console.log('The mobile account menu distinguishes pending restoration, a restored account and a confirmed guest');

// A nickname must never replace the actual sync verdict.
recoveryState.clear();menuContext.lumenUser={id:'restored-player'};menuContext.lumenNickname='Anupon';menuContext.cloudProfileReady=true;
menuContext.cloudProfileBusy=false;menuContext.cloudProfileDirty=false;menuContext.navigator={onLine:true};
menuContext.syncMobileAuthUI();
assert.match(authNodes.get('mobileAuthStatus').textContent,/Progression synchronis/,'Healthy named accounts need an explicit success verdict');
for(const change of ['busy','dirty','offline','failure','pending']){
 menuContext.cloudProfileBusy=change==='busy';menuContext.cloudProfileDirty=change==='dirty';menuContext.navigator.onLine=change!=='offline';
 menuContext.cloudProfileFailure=change==='failure'?{reason:'legacy_mirror'}:null;menuContext.canonicalOutboxNotice=change==='pending'?'pending':null;
 menuContext.syncMobileAuthUI();assert.doesNotMatch(authNodes.get('mobileAuthStatus').textContent,/Progression synchronis/,change+' must not announce successful synchronization');
}

// Finishing a flush refreshes a diagnostic already open, after clearing busy.
menuContext.canonicalOutboxNotice=null;
for(const detail of ['canonical_reward_conflict','storage_quota','backup_unverified']){
 menuContext.cloudProfileFailure={reason:'partial_reconciliation',detail};menuContext.syncMobileAuthUI();
 assert.match(authNodes.get('mobileAuthStatus').textContent,/conservées/);
 assert.doesNotMatch(authNodes.get('mobileAuthStatus').textContent,/Progression synchronis/);
 assert.equal(authNodes.get('retryAccountSync').hidden,false,'Held reconciliation offers a safe retry');
}
const verdicts=[];
const flushContext=vm.createContext({legacyCommandInFlight:false,cloudProfileBusy:false,cloudProfileDirty:false,cloudProfileReady:true,
 lumenUser:{id:'a'},lumenSupabase:{},qaActive:false,authSessionPending:false,lumenProgress:{solved:{},badges:{}},cloudProfileBaseline:{solved:{},badges:{}},cloudProfileInFlight:null,cloudProfileFailure:null,
 compareAndSwapCloudProfile:async()=>({solved:{},badges:{}}),verifyLegacyProgressMirror:async()=>({ok:true}),recordCloudDiagnostic(){},
 syncMobileAuthUI(){verdicts.push(flushContext.cloudProfileBusy)}});
vm.runInContext(functionSource(ui,'flushCloudProfile'),flushContext);
assert.equal(await flushContext.flushCloudProfile(),true);assert.deepEqual(verdicts,[false],'Refresh the visible verdict after releasing the busy state');
