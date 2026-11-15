// #724: admin Adventure access panel in a real browser with a synthetic server.
// Native pointer input; the server answer is the only source of displayed state.
import assert from 'node:assert/strict';
export async function verifyAdventureAccess({send,evaluate,url}){
 const previous=await evaluate('performance.timeOrigin');
 await send('Page.navigate',{url:new URL('/scripts/fixtures/incident-investigation.html',url).href});
 for(let i=0;i<100;i++){
  if(await evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'&&!!document.getElementById('incidentFixtureReady')`).catch(()=>false))break;
  await new Promise(r=>setTimeout(r,50));
 }
 await evaluate(`(async()=>{
  const {mountAdventureAccess}=await import('/src/ui/adventure-access-panel.js');
  const {CONTENT_PACKS}=await import('/src/campaign/content.js');
  const owned=new Map(),history=[],calls=[];let fail=false,allow=true;
  const client={rpc:async(name,a)=>{
   calls.push({name,...a});await new Promise(r=>setTimeout(r,30));
   if(fail)return {data:null,error:{code:'PGRST301'}};
   let changed=false;
   if(a.p_action==='grant'&&!owned.get(a.p_adventure)?.active){owned.set(a.p_adventure,{adventure:a.p_adventure,source:'admin',active:true,granted_at:new Date().toISOString(),expires_at:null});changed=true}
   if(a.p_action==='revoke'&&owned.get(a.p_adventure)?.active){owned.set(a.p_adventure,{...owned.get(a.p_adventure),active:false,expires_at:new Date().toISOString()});changed=true}
   if(changed)history.unshift({adventure:a.p_adventure,action:a.p_action,reason:a.p_reason,occurred_at:new Date().toISOString()});
   return {data:{changed,adventures:[...owned.values()],history}};
  }};
  const host=document.createElement('div');document.body.append(host);
  await mountAdventureAccess(host,{client,owner:'synthetic-admin',target:'synthetic-player',authorized:()=>allow,packs:CONTENT_PACKS});
  window.adventureFixture={host,calls,fail:v=>{fail=v},deny:()=>{allow=false},first:CONTENT_PACKS.find(p=>p.access==='locked').id,
   locked:CONTENT_PACKS.filter(p=>p.access==='locked').length};
  host.querySelector('details').open=true;
 })()`,true);
 const until=async(expr,label)=>{for(let i=0;i<100;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,25))}throw Error('Timed out: '+label)};
 await until(`window.adventureFixture.host.querySelectorAll('[data-adventure-action]').length>0`,'list loaded');
 const first=await evaluate('window.adventureFixture.first');
 const item=`window.adventureFixture.host.querySelector('[data-adventure="${first}"]')`;
 async function clickAction(){
  const p=await evaluate(`(()=>{const e=${item}.querySelector('button');e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});
 }
 const state=()=>evaluate(`(()=>{const f=window.adventureFixture,i=${item};return {text:i.textContent,action:i.querySelector('button').dataset.adventureAction,status:f.host.querySelector('[data-adventure-status]').textContent,calls:f.calls.filter(c=>c.p_action!=='list').length,history:f.host.querySelectorAll('.adventure-access-history li').length}})()`);
 const rows=await evaluate(`window.adventureFixture.host.querySelectorAll('[data-adventure-action]').length`);
 assert.equal(rows,await evaluate('window.adventureFixture.locked'),'One row per locked catalogue Adventure');
 assert.equal((await state()).action,'grant');

 await clickAction();
 let s=await state();
 assert.equal(s.calls,0,'No reason, no server call');assert.match(s.status,/motif/);

 await evaluate(`window.adventureFixture.host.querySelector('[data-adventure-reason]').value='bêta-test'`);
 await clickAction();
 await until(`${item}.querySelector('button').dataset.adventureAction==='revoke'`,'granted');
 s=await state();
 assert.match(s.text,/Débloquée/);assert.match(s.status,/débloquée/);assert.equal(s.history,1);
 const sent=await evaluate(`window.adventureFixture.calls.find(c=>c.p_action==='grant')`);
 assert.deepEqual({owner:sent.p_expected_user_id,target:sent.p_target_user_id,adventure:sent.p_adventure,reason:sent.p_reason,name:sent.name},
  {owner:'synthetic-admin',target:'synthetic-player',adventure:first,reason:'bêta-test',name:'lumen_admin_adventure_access'});

 // A server failure never shows a revocation that did not happen.
 await evaluate(`(()=>{const f=window.adventureFixture;f.fail(true);f.host.querySelector('[data-adventure-reason]').value='fin du test'})()`);
 await clickAction();
 await until(`/non confirmée/.test(window.adventureFixture.host.querySelector('[data-adventure-status]').textContent)`,'failure shown');
 s=await state();assert.match(s.text,/Débloquée/,'Failed revocation keeps the confirmed state');assert.equal(s.action,'revoke');

 await evaluate(`window.adventureFixture.fail(false)`);
 await clickAction();
 await until(`${item}.querySelector('button').dataset.adventureAction==='grant'`,'revoked');
 s=await state();assert.match(s.text,/Retirée/);assert.equal(s.history,2);

 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'No horizontal overflow');

 const stale=await evaluate(`(()=>{const f=window.adventureFixture,b=${item}.querySelector('button');f.host.querySelector('[data-adventure-reason]').value='détaché';f.deny();const before=f.calls.length;b.click();return f.calls.length===before})()`);
 assert.equal(stale,true,'A revoked authorization never reaches the server');
 return {rows,reasonRequired:true,grant:true,failureNotShownAsSuccess:true,revoke:true,noOverflow:true,staleRefused:true};
}
