import assert from 'node:assert/strict';
export async function verifySupport({send,evaluate,url}){
 const previous=await evaluate('performance.timeOrigin');
 await send('Page.navigate',{url:new URL('/scripts/fixtures/incident-investigation.html',url).href});
 for(let i=0;i<100;i++){
  if(await evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'&&!!document.getElementById('incidentFixtureReady')`).catch(()=>false))break;
  await new Promise(r=>setTimeout(r,50));
 }
 const initial=await evaluate(`(async()=>{
  const {mountSupportPanel,mountSupportDossier}=await import('/src/ui/support-panel.js');
  const markup=new DOMParser().parseFromString(await(await fetch('/index.html')).text(),'text/html');
  const host=document.importNode(markup.getElementById('supportAssistance'),true);document.body.append(host);
  let active=false,allow=true,actor='synthetic-owner',badHash=false,blobs=0;const calls=[];
  const originalBlob=URL.createObjectURL.bind(URL);URL.createObjectURL=b=>{blobs++;return originalBlob(b)};
  const client={rpc:async(name,a)=>{
   calls.push(a);
   const dossier={id:'synthetic-case',state:'active',activated_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),captures:[]};
   const content=JSON.stringify({format:1,events:[],copies:[]}),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(content)))].map(v=>v.toString(16).padStart(2,'0')).join('');
   return {data:a.p_action==='activate'?dossier:a.p_action==='status'?{state:'disabled'}:a.p_action==='capture'?{capture_id:a.p_capture_id,received_at:new Date().toISOString()}:a.p_action==='list'?dossier:a.p_action==='download'?{reference:'synthetic-case',captures:[{content,sha256:badHash?'corrupt':hash}]}:{state:'deleted'}};
  }};
  const session=mountSupportPanel(host,{storage:localStorage,context:()=>({userId:actor,client}),capture:()=>({format:1,events:[],version:'unknown',code:'manual',copies:[{source:'local',facts:[]}]})});
  host.querySelector('details').open=true;
  window.supportFixture={host,session,calls,client,mountSupportDossier,allowed:()=>allow,deny:()=>{allow=false},corrupt:()=>{badHash=true},blobs:()=>blobs,switch:()=>{actor='different-owner';session.changed()}};
  return {initial:host.textContent.includes('Assistance désactivée'),consent:host.querySelector('input').checked,disabled:host.querySelector('[data-support-activate]').disabled};
 })()`,true);
 assert.deepEqual(initial,{initial:true,consent:false,disabled:true});
 // Native pointer input, including the consent control and primary CTA.
 async function click(selector){
  const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});
 }
 async function wait(state){for(let i=0;i<80;i++){if(await evaluate(`window.supportFixture.session.view().state===${JSON.stringify(state)}`))return;await new Promise(r=>setTimeout(r,25))}throw Error('Support state not reached: '+state)}
 await click('[data-support-consent]');await click('[data-support-activate]');await wait('ready');
 await click('[data-support-send]');await wait('confirmed');
 assert.equal(await evaluate(`window.supportFixture.calls.filter(c=>c.p_action==='capture').length`),1);
 await click('[data-support-revoke]');await wait('deleted');
 assert.equal(await evaluate(`window.supportFixture.host.querySelector('input').checked`),false);
 await click('[data-support-consent]');
 assert.equal(await evaluate(`(()=>{const f=window.supportFixture;f.switch();return f.host.querySelector('input').checked})()`),false,'Account change must reset consent');
 const admin=await evaluate(`(async()=>{const f=window.supportFixture,host=document.createElement('div');document.body.append(host);await f.mountSupportDossier(host,{client:f.client,owner:'admin',target:'player',authorized:f.allowed});host.querySelector('details').open=true;f.admin=host;return host.querySelector('summary').textContent})()`,true);
 assert.equal(admin,'Dossier d’assistance');
 for(let i=0;i<80;i++){if(await evaluate(`window.supportFixture.admin.querySelectorAll('button').length===2`))break;await new Promise(r=>setTimeout(r,25))}
 await evaluate(`window.supportFixture.admin.querySelector('button').click()`);
 for(let i=0;i<80;i++){if(await evaluate(`window.supportFixture.blobs()===1`))break;await new Promise(r=>setTimeout(r,25))}
 assert.equal(await evaluate(`window.supportFixture.blobs()`),1,'Verified download should create one local Blob');
 await evaluate(`window.supportFixture.corrupt();window.supportFixture.admin.querySelector('button').click()`);
 for(let i=0;i<80;i++){if(await evaluate(`window.supportFixture.admin.textContent.includes('non confirmé')`))break;await new Promise(r=>setTimeout(r,25))}
 assert.equal(await evaluate(`window.supportFixture.blobs()`),1,'Corrupt download must never be saved');
 const stale=await evaluate(`(()=>{const f=window.supportFixture;const b=f.admin.querySelector('button');f.admin.remove();const before=f.calls.length;b.click();f.deny();return f.calls.length===before})()`);
 assert.equal(stale,true,'Detached admin actions must not access a dossier');
 const layout=await evaluate(`(()=>{document.documentElement.style.fontSize='150%';return {overflow:document.documentElement.scrollWidth>innerWidth,status:window.supportFixture.host.querySelector('[role=status]').textContent}})()`);
 assert.equal(layout.overflow,false);assert.match(layout.status,/désactivée/);
 const ax=await send('Accessibility.getFullAXTree');assert.ok(ax.nodes.some(n=>n.role?.value==='checkbox'));
 return {consent:true,manualAcknowledged:true,revocationConfirmed:true,accountConsentReset:true,hashVerifiedDownload:true,corruptionRefused:true,staleAdminRefused:true,largeTextNoOverflow:true,accessibilityTree:true};
}
