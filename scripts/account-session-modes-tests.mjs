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
assert.match(html,/Continuer sans compte/);assert.match(html,/Continuer avec Google/);
assert.match(cloud,/signInWithPassword/);assert.match(ui,/requestPasswordRecovery\(email\)/);
assert.match(ui,/editor\.dataset\.open="true";editor\.hidden=false/);
assert.match(ui,/renderDaily\(\);\s*refreshJourney\(\);updateAuthUI\(\)/);
console.log('Account session regressions passed: startup race, sign-out before deferred restore, recovery, failed-link preservation, local-only logout and two public modes.');
