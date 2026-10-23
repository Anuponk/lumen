import assert from 'node:assert/strict';
// Native module / DOM in the existing isolated account browser, no live RPC.
export async function verifyIncidentInvestigation({send,evaluate,url}){
 // The preceding recovery scenario intentionally reloads the game. Do not
 // attach a review fixture to that document while recovery is still settling.
 await send('Page.navigate',{url:new URL('/scripts/fixtures/incident-investigation.html',url).href});
 let ready=false;
 for(let i=0;i<100;i++){
  try{ready=await evaluate(`document.readyState==='complete'&&!!document.getElementById('incidentFixtureReady')`)}
  catch(error){if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error}
  if(ready)break;await new Promise(resolve=>setTimeout(resolve,50));
 }
 assert.equal(ready,true,'The independent review document must be ready');
 const point=await evaluate(`(async()=>{
  const {renderIncidentInvestigation}=await import('/src/ui/incident-investigation.js');
  const host=document.createElement('div');host.id='fixtureIncidentReview';host.className='diagnostic-incidents';host.style.cssText='position:fixed;inset:0;background:white;z-index:99999;overflow:auto;color:black';document.body.append(host);
  let allowed=true;
  const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
  const row=(code,sequence,trace=2)=>({session_id:id(1),trace_id:id(trace),sequence,code,stage:'guided',kind:'unknown',app_version:'1.11.1+500',platform:'desktop',browser:'chromium',before_state:'unknown',after_state:code.endsWith('blocked')?'blocked':'unknown',message:'Bearer SECRET',email:'secret@example.invalid'});
  const data={signatures:[{code:'guided_error',stage:'guided',occurrences:2,sessions:1}],timeline:[row('guided_error',1),row('guided_undo',2),row('guided_input_blocked',3),row('guided_input_released',1,3)]};
  renderIncidentInvestigation(host,data,{authorized:()=>allowed});
  const cards=host.lastElementChild.querySelectorAll('details'),preview=host.querySelector('textarea'),checkbox=host.querySelector('input'),draft=cards[0].querySelectorAll('a')[1];
  const report=preview.value,initialHidden=draft.hidden&&!draft.hasAttribute('href');
  cards[0].open=true;checkbox.scrollIntoView({block:'center'});
  host.reviewFixture={checkbox,draft,report,initialHidden,episodes:cards.length,deny:()=>{allowed=false},renderDenied:()=>renderIncidentInvestigation(host,data,{authorized:()=>allowed})};
  const rect=checkbox.getBoundingClientRect();
  return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,visible:rect.width>0&&rect.height>0,unchecked:!checkbox.checked};
 })()`,true);
 assert.equal(point.visible,true,'The review control must be visible before a real click');
 assert.equal(point.unchecked,true,'A fresh report must require explicit review');
 const click=async()=>{
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
 };
 const until=async(expression)=>{
  for(let i=0;i<30;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,50))}
  const state=await evaluate(`(()=>{const f=document.getElementById('fixtureIncidentReview')?.reviewFixture;return {connected:!!f,checked:f?.checkbox.checked,hidden:f?.draft.hidden}})()`);
  throw Error('Review transition did not settle: '+JSON.stringify(state));
 };
 await click();
 await until(`(()=>{const f=document.getElementById('fixtureIncidentReview').reviewFixture;return f.checkbox.checked&&!f.draft.hidden})()`);
 await evaluate(`(()=>{const f=document.getElementById('fixtureIncidentReview').reviewFixture;f.url=f.draft.href;f.reviewEnabled=!f.draft.hidden})()`);
 await click();
 await until(`(()=>{const f=document.getElementById('fixtureIncidentReview').reviewFixture;return !f.checkbox.checked&&f.draft.hidden&&!f.draft.hasAttribute('href')})()`);
 const result=await evaluate(`(()=>{
  const host=document.getElementById('fixtureIncidentReview'),f=host.reviewFixture;
  const {episodes,report,url,initialHidden,reviewEnabled}=f;
  const revoked=f.draft.hidden&&!f.draft.hasAttribute('href');
  const filter=host.querySelector('select');filter.value='blocked';filter.dispatchEvent(new Event('change'));
  const blockedOnly=host.lastElementChild.querySelectorAll('details').length===1;
  f.deny();const staleDraft=host.lastElementChild.querySelector('details a:nth-of-type(2)');
  const click=new MouseEvent('click',{bubbles:true,cancelable:true});staleDraft.dispatchEvent(click);
  // Re-run the same actual renderer with the now-revoked predicate.
  host.reviewFixture.renderDenied();const denied=host.children.length===0;host.remove();
  return {episodes,report,url,initialHidden,reviewEnabled,revoked,blockedOnly,denied,staleClickPrevented:click.defaultPrevented};
 })()`,true);
 assert.equal(result.episodes,2);
 for(const key of ['initialHidden','reviewEnabled','revoked','blockedOnly','denied','staleClickPrevented'])assert.equal(result[key],true,key);
 assert.equal(new URL(result.url).pathname,'/Anuponk/lumen/issues/new');
 for(const value of [result.report,decodeURIComponent(result.url)])for(const forbidden of ['SECRET','secret@','00000000-0000-0000'])assert(!value.includes(forbidden));
 return {nativeDOM:true,reviewBeforeGitHub:true,noIssueCreated:true,closedExport:true,filter:true,revocation:true};
}
