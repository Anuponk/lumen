import {createTranslator} from '../src/ui/i18n.js';
// #820: e-mail confirmation verdicts, password recovery request contract and
// password update classification. Node only, no network: Auth/Edge mocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readNativeAuthLinkResult,classifyAuthLinkError,scrubNativeAuthLinkError,authLinkMessage} from '../src/persistence/auth-link-result.js';
import {createCloudPersistence} from '../src/persistence/cloud.js';
import {createPasswordRecoveryFlow,passwordRecoveryView,validateNewPassword,passwordRecoveryErrorCopy} from '../src/ui/password-recovery.js';

// Native Supabase redirects.
const host='https://lumen.nopuna.fr/';
assert.deepEqual(readNativeAuthLinkResult(host+'#access_token=t&refresh_token=r&type=signup'),{status:'verified',kind:'signup'});
assert.deepEqual(readNativeAuthLinkResult(host+'#access_token=t&type=recovery'),{status:'verified',kind:'recovery'});
assert.deepEqual(readNativeAuthLinkResult(host+'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'),{status:'error',kind:null,reason:'expired_or_used'});
assert.deepEqual(readNativeAuthLinkResult(host+'?error=server_error&error_description=Unable+to+exchange'),{status:'error',kind:null,reason:'invalid'});
assert.equal(readNativeAuthLinkResult(host),null,'An ordinary visit has no verdict');
assert.equal(readNativeAuthLinkResult(host+'#type=signup'),null,'A type without a verified session is not a success');
assert.equal(readNativeAuthLinkResult(host+'#access_token=t&type=unknown'),null);
assert.equal(readNativeAuthLinkResult('not a url'),null);
assert.equal(classifyAuthLinkError('otp_expired',''),'expired_or_used');
assert.equal(classifyAuthLinkError(undefined,'TypeError: Failed to fetch'),'network');
assert.equal(classifyAuthLinkError('weird',''),'invalid');

// Only error parameters are removed; the remaining fragment survives.
{
 const calls=[];const win={location:{href:host+'?ref=x#error=access_denied&error_code=otp_expired&keep=1'},history:{state:null,replaceState:(_,__,url)=>calls.push(url)}};
 assert.equal(scrubNativeAuthLinkError(win),true);
 assert.deepEqual(calls,['/?ref=x#keep=1']);
 assert.equal(scrubNativeAuthLinkError({location:{href:host},history:{replaceState:()=>{throw Error('no write')}}}),false);
}

// Player-facing copy: success only after verification, action follows the session.
{
 const signedIn=authLinkMessage({status:'verified',kind:'signup'},{signedIn:true});
 assert.equal(signedIn.title+' '+signedIn.text,'Adresse e-mail confirmée ! Ton compte Lumen est prêt.');
 assert.equal(signedIn.label,'Continuer mon aventure');assert.equal(signedIn.action,'continue');
 const signedOut=authLinkMessage({status:'verified',kind:'signup'},{signedIn:false});
 assert.equal(signedOut.title,'Adresse e-mail confirmée !');assert.equal(signedOut.label,'Se connecter');assert.equal(signedOut.action,'signin');
 assert.equal(authLinkMessage({status:'verified',kind:'recovery'}),null,'Recovery opens the password editor instead');
 for(const reason of ['expired_or_used','invalid','network'])for(const kind of ['signup','recovery',null])for(const signed of [true,false]){
  const message=authLinkMessage({status:'error',kind,reason},{signedIn:signed});
  assert.doesNotMatch(message.title+message.text,/confirmée|est prêt/,'A failed link never states success');
 }
 assert.equal(authLinkMessage({status:'error',kind:'recovery',reason:'expired_or_used'}).action,'recover');
 assert.equal(authLinkMessage({status:'error',kind:'signup',reason:'expired_or_used'},{signedIn:false}).action,'signin');
}

function harness({session=null,verify=async()=>({error:null}),readSession,afterSignup=()=>{},updateUser=async()=>({error:null}),fetch=null,bootAuthLink=null,href=host}={}){
 let callback;const events=[],calls=[],replaced=[];
 globalThis.window={location:{href},history:{state:null,replaceState:(_,__,url)=>{replaced.push(url);globalThis.window.location.href=new URL(url,host).href}}};
 if(fetch)globalThis.fetch=fetch;
 const model={lumenUser:null,lumenSupabase:{auth:{
  onAuthStateChange:fn=>{callback=fn},
  getSession:async()=>readSession?readSession():{data:{session}},
  verifyOtp:async value=>{calls.push(['verify',value.type,replaced.length]);const result=await verify(value);if(!result.error&&value.type==='signup'){session=result.data?.session||{user:{id:'confirmed'}};callback('SIGNED_IN',session);afterSignup(callback)}return result},
  updateUser:async value=>{calls.push(['updateUser']);return updateUser(value)}
 },rpc:async name=>{calls.push([name]);return {data:[],error:null}}}};
 const api=createCloudPersistence(model,{onAccountChanged:e=>events.push(e),refreshJourney:()=>{},renderDaily:()=>{},holdLegacyMergeForFullRestore:async()=>true,afterAuthCloudSync:async()=>calls.push(['hydrate',model.lumenUser.id])},{console:{warn:()=>{}},setTimeout:()=>{},bootAuthLink});
 return {api,model,events,calls,replaced};
}
const token='c'.repeat(64);
// #1037: a confirmed account must restore its sky even if a redundant Auth
// snapshot would fail.
{
 const session={user:{id:'confirmed'}},h=harness({href:host+'?lumen_confirm='+token+'&type=signup',
  verify:async()=>({data:{session},error:null}),
  readSession:async()=>({data:{session:null},error:{status:0,message:'Failed to fetch'}})});
 await h.api.initLumenCloud();
 assert.deepEqual(h.calls.filter(([name])=>name==='hydrate'),[['hydrate','confirmed']]);
 assert.equal(h.events.some(event=>event.type==='restore_failed'),false);
}
for(const newer of [null,{user:{id:'other'}}]){
 const session={user:{id:'confirmed'}},h=harness({href:host+'?lumen_confirm='+token+'&type=signup',
  verify:async()=>({data:{session},error:null}),
  afterSignup:notify=>notify(newer?'SIGNED_IN':'SIGNED_OUT',newer),
  readSession:async()=>({data:{session:newer},error:null})});
 await h.api.initLumenCloud();
 assert.equal(h.model.lumenUser?.id,newer?.user.id);
 assert.deepEqual(h.calls.filter(([name])=>name==='hydrate'),newer?[['hydrate','other']]:[]);
}
// Branded sign-up link: tokens leave the URL before verification; one verdict after the session.
{
 const h=harness({href:host+'?lumen_confirm='+token+'&type=signup'});
 await h.api.initLumenCloud();
 assert.deepEqual(h.calls[0],['verify','signup',1],'The token hash is removed before contacting Auth');
 assert.equal(h.replaced[0],'/');
 const verdicts=h.events.filter(e=>e.type==='auth_link');
 assert.equal(verdicts.length,1);
 assert.deepEqual(verdicts[0].result,{status:'verified',kind:'signup'});
 assert.equal(h.model.lumenUser.id,'confirmed');
}
// Expired, reused, thrown and malformed links: classified, never a success, session kept.
for(const [verify,reason] of [
 [async()=>({error:{code:'otp_expired',message:'Email link is invalid or has expired'}}),'expired_or_used'],
 [async()=>{throw Object.assign(Error('Failed to fetch'),{name:'AuthRetryableFetchError'})},'network']
]){
 const h=harness({session:{user:{id:'existing'}},verify,href:host+'?lumen_confirm='+token+'&type=signup'});
 await h.api.initLumenCloud();
 assert.deepEqual(h.events.find(e=>e.type==='auth_link').result,{status:'error',kind:'signup',reason});
 assert.equal(h.model.lumenUser.id,'existing','A failed link never revokes a valid session');
}
{
 const h=harness({href:host+'?lumen_confirm=nothex&type=recovery'});
 await h.api.initLumenCloud();
 assert.equal(h.calls.some(c=>c[0]==='verify'),false,'A malformed hash never reaches Auth');
 assert.deepEqual(h.events.find(e=>e.type==='auth_link').result,{status:'error',kind:'recovery',reason:'invalid'});
}
// Native verdict captured at boot is reported once, after the session is known.
{
 const h=harness({session:{user:{id:'native'}},bootAuthLink:{status:'verified',kind:'signup'}});
 await h.api.initLumenCloud();
 const index=h.events.findIndex(e=>e.type==='auth_link');
 assert(index>h.events.findIndex(e=>e.type==='account'),'Verdict follows the restored session');
 assert.equal(h.events.filter(e=>e.type==='auth_link').length,1);
 const none=harness();await none.api.initLumenCloud();
 assert.equal(none.events.some(e=>e.type==='auth_link'),false,'No verdict without a link');
}

// Password recovery request: HTTP status alone is not proof (#820).
const response=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>{if(body===undefined)throw SyntaxError('no json');return body}});
for(const [reply,expected] of [
 [()=>response(200,{ok:true}),{ok:true}],
 [()=>response(200,{ok:false}),{ok:false,reason:'unavailable'}],
 [()=>response(200,undefined),{ok:false,reason:'unavailable'}],
 [()=>response(429,{ok:false,reason:'rate_limited'}),{ok:false,reason:'rate_limited'}],
 [()=>response(502,{ok:false,reason:'mail_provider_rejected'}),{ok:false,reason:'unavailable'}],
 [()=>response(503,{ok:false}),{ok:false,reason:'unavailable'}],
 [()=>{throw TypeError('Failed to fetch')},{ok:false,reason:'network'}]
]){
 const sent=[];
 const h=harness({fetch:async(url,init)=>{sent.push({url,body:JSON.parse(init.body)});return reply()}});
 assert.deepEqual(await h.api.requestPasswordRecovery('  Player@Example.TEST '),expected);
 assert.deepEqual(sent[0].body,{type:'recovery',email:'player@example.test',locale:'fr'},'Only the email and display language are sent with recovery');
}
{
 let fetched=false;const h=harness({fetch:async()=>{fetched=true;return response(200,{ok:true})}});
 assert.deepEqual(await h.api.requestPasswordRecovery('not-an-email'),{ok:false,reason:'email'});
 assert.equal(fetched,false);
}

// Password update classification, without echoing provider messages.
// Synthetic 16-character value built at runtime: no credential in the source.
const syntheticPassword='x'.repeat(16);
for(const [updateUser,expected] of [
 [async()=>({error:null}),{ok:true}],
 [async()=>({error:{code:'same_password',message:'x'}}),{ok:false,reason:'same_password'}],
 [async()=>({error:{code:'weak_password',message:'x'}}),{ok:false,reason:'weak_password'}],
 [async()=>({error:{code:'session_not_found',status:403}}),{ok:false,reason:'session_expired'}],
 [async()=>({error:{status:401}}),{ok:false,reason:'session_expired'}],
 [async()=>({error:{name:'AuthRetryableFetchError',status:0}}),{ok:false,reason:'network'}],
 [async()=>{throw TypeError('Failed to fetch')},{ok:false,reason:'network'}],
 [async()=>({error:{code:'unexpected_failure',status:500}}),{ok:false,reason:'password_update'}]
]){
 const h=harness({updateUser});h.model.lumenUser={id:'recovering'};
 assert.deepEqual(await h.api.setAccountPassword(syntheticPassword),expected);
}
{
 const h=harness();h.model.lumenUser={id:'recovering'};
 assert.deepEqual(await h.api.setAccountPassword('short'),{ok:false,reason:'password'});
 assert.equal(h.calls.some(c=>c[0]==='updateUser'),false);
}
delete globalThis.window;

// UI wiring: verdict dialog, guarded submissions and a native recovery link
// opening the password editor even if the SDK event arrives late.
const ui=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(html,/id="authLinkResult"[^>]*role="alertdialog"[^>]*hidden/);
assert.match(ui,/if\(event\?\.type==="auth_link"\)showAuthLinkResult\(event\.result\)/);
assert.match(ui,/if\(passwordRecoveryRequestPending\)return;/);
assert.match(html,/id="passwordRecovery"[^>]*role="dialog"[^>]*hidden/);
assert.match(ui,/#authLinkResult,#passwordRecovery,/,'Tutorial tap filtering never blocks the recovery screen');
assert.match(html,/id="passwordRecoveryNew"[^>]*autocomplete="new-password"/);
assert.match(html,/id="passwordRecoveryConfirm"[^>]*autocomplete="new-password"/);
assert.doesNotMatch(html,/id="setPasswordPanel"/,'Recovery no longer reuses the account editor');
assert.doesNotMatch(ui,/lumenPasswordRecoveryPending"\);location\.reload\(\)/,'No reload hides the success verdict');
assert.match(ui,/if\(event\?\.type==="password_recovery"\)openPasswordRecovery\(\)/);
assert.match(ui,/result\?\.status==='verified'&&result\.kind==='recovery'\)sessionStorage\.setItem\('lumenPasswordRecoveryPending','1'\)/);
assert(ui.indexOf('const bootAuthLink=')<ui.indexOf('window.supabase.createClient('),'The boot URL is read before the Auth SDK can consume it');
assert.match(ui,/addEventListener\('hashchange',\(\)=>\{try\{if\(readNativeAuthLinkResult\(location\.href\)\)location\.reload\(\)\}catch\{\}\}\)/,'A same-document auth fragment is handled after a reload');
// #820 (20/11 field test): dedicated recovery screen state machine.
assert.equal(validateNewPassword('x'.repeat(11),'x'.repeat(11)),'password');
assert.equal(validateNewPassword('x'.repeat(12),'y'.repeat(12)),'mismatch');
assert.equal(validateNewPassword('x'.repeat(12),'x'.repeat(12)),null);
{
 const secret='s'.repeat(14);
 const make=({user={id:'owner',email:'qa@example.test'},replies=[{ok:true}]}={})=>{
  const calls=[],renders=[];let current=user;
  const flow=createPasswordRecoveryFlow({updatePassword:async value=>{calls.push(value);const reply=replies.shift();if(reply instanceof Error)throw reply;return reply},
   currentUser:()=>current,render:(state,view)=>renders.push(view)});
  return {flow,calls,renders,setUser:u=>{current=u}};
 };
 // Neutral state while the link is verified; never the sign-in form.
 {const h=make();h.flow.verifying();const v=passwordRecoveryView(h.flow.state);
  assert.equal(v.title,'Vérification de ton lien…');assert.equal(v.form,false);
  h.flow.open();const f=passwordRecoveryView(h.flow.state);
  assert.equal(f.title,'Choisis ton nouveau mot de passe');assert.match(f.text,/Ton lien de réinitialisation a été vérifié/);
  assert.equal(f.form,true);assert.equal(f.submitLabel,'Enregistrer mon nouveau mot de passe');}
 // Mismatch keeps the form, no provider call; corrected entry succeeds first time.
 {const h=make();h.flow.open();
  assert.deepEqual(await h.flow.submit(secret,secret+'!'),{ok:false,reason:'mismatch'});
  assert.equal(h.calls.length,0);assert.equal(h.flow.state.phase,'form');
  assert.match(passwordRecoveryView(h.flow.state).error,/ne correspondent pas/);
  assert.deepEqual(await h.flow.submit(secret,secret),{ok:true});
  assert.equal(h.calls.length,1);const done=passwordRecoveryView(h.flow.state);
  assert.equal(done.title,'Mot de passe modifié !');assert.equal(done.action,'continue');assert.equal(done.label,'Continuer mon aventure');}
 // Double submission: one provider call only.
 {let release;const calls=[];const flow=createPasswordRecoveryFlow({updatePassword:v=>{calls.push(v);return new Promise(r=>{release=r})},currentUser:()=>({id:'owner'})});
  flow.open();const first=flow.submit(secret,secret);
  assert.equal(passwordRecoveryView(flow.state).busy,true);
  assert.deepEqual(await flow.submit(secret,secret),{ok:false,reason:'busy'});
  release({ok:true});assert.deepEqual(await first,{ok:true});assert.equal(calls.length,1);}
 // First attempt fails on the network, the form survives, the retry succeeds.
 {const h=make({replies:[new TypeError('Failed to fetch'),{ok:true}]});h.flow.open();
  assert.deepEqual(await h.flow.submit(secret,secret),{ok:false,reason:'network'});
  assert.equal(h.flow.state.phase,'form');assert.match(passwordRecoveryView(h.flow.state).error,/n’a pas été modifié/);
  assert.deepEqual(await h.flow.submit(secret,secret),{ok:true});assert.equal(h.calls.length,2);}
 // Provider rules keep the form with a precise message.
 for(const reason of ['weak_password','same_password','password_update']){const h=make({replies:[{ok:false,reason}]});h.flow.open();
  await h.flow.submit(secret,secret);assert.equal(h.flow.state.phase,'form',reason);assert.equal(passwordRecoveryView(h.flow.state).error,passwordRecoveryErrorCopy(reason));}
 // Expired session: no success, new link proposed.
 {const h=make({replies:[{ok:false,reason:'session_expired'}]});h.flow.open();await h.flow.submit(secret,secret);
  const v=passwordRecoveryView(h.flow.state);assert.equal(v.action,'recover');assert.equal(v.label,'Demander un nouveau lien');assert.doesNotMatch(v.title+v.text,/modifié !/);}
 // Account changed after the link opened: never update another account.
 {const h=make();h.flow.open();h.setUser({id:'someone-else'});
  assert.deepEqual(await h.flow.submit(secret,secret),{ok:false,reason:'session_changed'});assert.equal(h.calls.length,0);}
 // No session at all: invalid, never a form.
 {const h=make({user:null});h.flow.verifying();h.flow.open();assert.equal(h.flow.state.phase,'invalid');
  const h2=make();h2.flow.verifying();h2.flow.sessionMissing();assert.equal(passwordRecoveryView(h2.flow.state).action,'recover');
  const h3=make();h3.flow.verifying();h3.flow.unreachable();assert.equal(passwordRecoveryView(h3.flow.state).title,'Vérification impossible pour le moment');}
 // Success without a remaining session proposes sign-in instead of continuing.
 {const h=make();h.flow.open();const pending=h.flow.submit(secret,secret);h.setUser(null);await pending;
  assert.equal(passwordRecoveryView(h.flow.state).action,'signin');}
 // The password never reaches state or rendered text.
 {const h=make({replies:[{ok:false,reason:'network'},{ok:true}]});h.flow.open();await h.flow.submit(secret,secret);await h.flow.submit(secret,secret);
  assert.equal(JSON.stringify(h.renders).includes(secret),false);assert.equal(JSON.stringify(h.flow.state).includes(secret),false);}
}
console.log('Auth link and recovery (#820): native/branded verdicts, no false success, expired/network links, recovery request contract, password update classification, dedicated recovery screen and UI wiring passed');

{
 const t=createTranslator({locale:'en'}).t;
 const form=passwordRecoveryView({phase:'form',email:'player@example.test',error:'mismatch'},t);
 assert.match(form.text,/Account: player@example\.test/);
 assert.equal(form.submitLabel,'Save my new password');
 assert.match(form.error,/passwords don’t match/);
 const invalid=passwordRecoveryView({phase:'invalid'},t);
 assert.equal(invalid.action,'recover');
 assert.equal(invalid.label,'Request a new link');
}
