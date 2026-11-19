// #820: e-mail confirmation verdicts, password recovery request contract and
// password update classification. Node only, no network: Auth/Edge mocked.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readNativeAuthLinkResult,classifyAuthLinkError,scrubNativeAuthLinkError,authLinkMessage} from '../src/persistence/auth-link-result.js';
import {createCloudPersistence} from '../src/persistence/cloud.js';

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

function harness({session=null,verify=async()=>({error:null}),updateUser=async()=>({error:null}),fetch=null,bootAuthLink=null,href=host}={}){
 let callback;const events=[],calls=[],replaced=[];
 globalThis.window={location:{href},history:{state:null,replaceState:(_,__,url)=>{replaced.push(url);globalThis.window.location.href=new URL(url,host).href}}};
 if(fetch)globalThis.fetch=fetch;
 const model={lumenUser:null,lumenSupabase:{auth:{
  onAuthStateChange:fn=>{callback=fn},
  getSession:async()=>({data:{session}}),
  verifyOtp:async value=>{calls.push(['verify',value.type,replaced.length]);const result=await verify(value);if(!result.error&&value.type==='signup'){session={user:{id:'confirmed'}};callback('SIGNED_IN',session)}return result},
  updateUser:async value=>{calls.push(['updateUser']);return updateUser(value)}
 },rpc:async name=>{calls.push([name]);return {data:[],error:null}}}};
 const api=createCloudPersistence(model,{onAccountChanged:e=>events.push(e),refreshJourney:()=>{},renderDaily:()=>{},holdLegacyMergeForFullRestore:async()=>true,afterAuthCloudSync:async()=>{}},{console:{warn:()=>{}},setTimeout:()=>{},bootAuthLink});
 return {api,model,events,calls,replaced};
}
const token='c'.repeat(64);
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
 assert.deepEqual(sent[0].body,{type:'recovery',email:'player@example.test'},'No password or redirect is sent with recovery');
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
assert.match(ui,/if\(accountPasswordSavePending\)return;/);
assert.match(ui,/result\?\.status==='verified'&&result\.kind==='recovery'\)sessionStorage\.setItem\('lumenPasswordRecoveryPending','1'\)/);
assert(ui.indexOf('const bootAuthLink=')<ui.indexOf('window.supabase.createClient('),'The boot URL is read before the Auth SDK can consume it');
console.log('Auth link and recovery (#820): native/branded verdicts, no false success, expired/network links, recovery request contract, password update classification and UI wiring passed');
