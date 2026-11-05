import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the real UI handler; only DOM, transport and cleanup are synthetic.
const source=fs.readFileSync('src/ui/game-screen.js','utf8');
const start=source.indexOf('function wireLumenErasureControls(){');
const end=source.indexOf('\nlet lumenSupabase=',start);
assert(start>=0&&end>start);
const success={status:'erased',scope:'lumen',details:'erased'};
test('confirmation explains irreversible loss in Lumen without infrastructure details',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const panel=html.match(/id="eraseLumenConfirmPanel"[\s\S]*?<\/div>/)?.[0];
 assert(panel,'Existing confirmation panel must remain present');
 for(const term of [/Lumen/,/progression/,/irréversible/])assert.match(panel,term);
 assert.doesNotMatch(panel,/Supabase|SoldeZen/);
});
function fixture({body=success,status=200,change,phase='response',signoutOk=true,localOwner='owner',tokenOwner='owner'}={}){
 const calls=[],elements=new Map();let ctx;
 for(const id of ['eraseLumenAccount','eraseLumenConfirmPanel','eraseLumenConfirmText','eraseLumenStatus','eraseLumenExecute','eraseLumenCancel']){
  elements.set(id,{hidden:false,value:id==='eraseLumenConfirmText'?'SUPPRIMER':'',disabled:false,handlers:{},focus(){},addEventListener(name,fn){this.handlers[name]=fn;}});
 }
 const mutate=()=>{
  if(change==='account')ctx.lumenUser={id:'another-owner'};
  if(change==='client')ctx.lumenSupabase={replacement:true};
  if(change==='generation')ctx.cloudHydrationGeneration++;
  if(change==='logout')ctx.lumenUser=null;
 };
 ctx=vm.createContext({lumenUser:{id:'owner'},cloudHydrationGeneration:1,
  LUMEN_SUPABASE_URL:'https://synthetic.invalid',LUMEN_SUPABASE_KEY:'public-fixture',
  localStorage:{getItem:key=>key==='lumenCloudOwnerId'?localOwner:null},
  document:{getElementById:id=>elements.get(id)},MutationObserver:class{observe(){}},
  lumenSupabase:{auth:{getSession:async()=>{if(phase==='session')mutate();return {data:{session:{user:{id:tokenOwner},access_token:'synthetic'}}};}}},
  fetch:async()=>{calls.push('request');if(phase==='response')mutate();const response=new Response(typeof body==='string'?body:JSON.stringify(body),{status});const parse=response.json.bind(response);response.json=async()=>{const result=await parse();if(phase==='json')mutate();return result;};return response;},
  signOut:async()=>{calls.push('signout');if(signoutOk)ctx.lumenUser=null;if(phase==='signout')mutate();return {ok:signoutOk};},
  clearErasedLumenDeviceData:async()=>{calls.push('clear');},
  location:{reload:()=>calls.push('reload')},JSON,Error,
 });
 vm.runInContext(source.slice(start,end)+'\nwireLumenErasureControls();',ctx);
 return {calls,elements,ctx,execute:()=>elements.get('eraseLumenExecute').handlers.click()};
}
test('HTTP success without explicit completed Lumen acknowledgement preserves local data',async()=>{
 for(const body of [{},null,{status:'pending'}, {...success,scope:'other'}, {...success,details:'pending'},'not json']){
  const f=fixture({body});await f.execute();
  assert.deepEqual(f.calls,['request'],JSON.stringify(body));
  assert(!f.elements.get('eraseLumenStatus').textContent.includes('sur le serveur et cet appareil'));
 }
});
test('a late erasure response never signs out or clears a replacement session',async()=>{
 for(const phase of ['session','response','json'])for(const change of ['account','client','generation','logout']){
  const f=fixture({phase,change});await f.execute();
  assert.deepEqual(f.calls,phase==='session'?[]:['request'],phase+'/'+change);
 }
});
test('unverified local owner or a token belonging to another account cannot launch erasure',async()=>{
 for(const options of [{localOwner:null},{localOwner:'other'},{tokenOwner:'other'}]){
  const f=fixture(options);await f.execute();assert.deepEqual(f.calls,[]);
 }
});
test('replacement account during signout keeps its device data',async()=>{
 const f=fixture({phase:'signout',change:'account'});await f.execute();assert.deepEqual(f.calls,['request','signout']);
});
test('double submission starts only one request and cleanup',async()=>{
 const f=fixture();await Promise.all([f.execute(),f.execute()]);assert.deepEqual(f.calls,['request','signout','clear','reload']);
});
test('failed signout preserves local data and permits an explicit retry',async()=>{
 const f=fixture({signoutOk:false});await f.execute();
 assert.deepEqual(f.calls,['request','signout']);assert.equal(f.elements.get('eraseLumenExecute').disabled,false);
});
test('confirmed erasure signs out, clears and reloads once; HTTP failure keeps data',async()=>{
 const f=fixture();await f.execute();assert.deepEqual(f.calls,['request','signout','clear','reload']);
 const refused=fixture({status:409});await refused.execute();assert.deepEqual(refused.calls,['request']);
});
