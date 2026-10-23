import assert from 'node:assert/strict';
// Native module / DOM in the existing isolated account browser, no live RPC.
export async function verifyIncidentInvestigation({evaluate}){
 const result=await evaluate(`(async()=>{
  const {renderIncidentInvestigation}=await import('/src/ui/incident-investigation.js');
  const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;background:white;z-index:99999;overflow:auto;color:black';document.body.append(host);
  let allowed=true;
  const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
  const row=(code,sequence,trace=2)=>({session_id:id(1),trace_id:id(trace),sequence,code,stage:'guided',kind:'unknown',app_version:'1.11.1+500',platform:'desktop',browser:'chromium',before_state:'unknown',after_state:code.endsWith('blocked')?'blocked':'unknown',message:'Bearer SECRET',email:'secret@example.invalid'});
  const data={signatures:[{code:'guided_error',stage:'guided',occurrences:2,sessions:1}],timeline:[row('guided_error',1),row('guided_undo',2),row('guided_input_blocked',3),row('guided_input_released',1,3)]};
  renderIncidentInvestigation(host,data,{authorized:()=>allowed});
  const cards=host.lastElementChild.querySelectorAll('details'),preview=host.querySelector('textarea'),checkbox=host.querySelector('input'),draft=cards[0].querySelectorAll('a')[1];
  const report=preview.value,initialHidden=draft.hidden&&!draft.hasAttribute('href');
  checkbox.click();const url=draft.href,reviewEnabled=!draft.hidden;
  checkbox.click();const revoked=draft.hidden&&!draft.hasAttribute('href');
  const filter=host.querySelector('select');filter.value='blocked';filter.dispatchEvent(new Event('change'));
  const blockedOnly=host.lastElementChild.querySelectorAll('details').length===1;
  allowed=false;const staleDraft=host.lastElementChild.querySelector('details a:nth-of-type(2)');
  const click=new MouseEvent('click',{bubbles:true,cancelable:true});staleDraft.dispatchEvent(click);
  renderIncidentInvestigation(host,data,{authorized:()=>allowed});const denied=host.children.length===0;host.remove();
  return {episodes:cards.length,report,url,initialHidden,reviewEnabled,revoked,blockedOnly,denied,staleClickPrevented:click.defaultPrevented};
 })()`,true);
 assert.equal(result.episodes,2);
 for(const key of ['initialHidden','reviewEnabled','revoked','blockedOnly','denied','staleClickPrevented'])assert.equal(result[key],true,key);
 assert.equal(new URL(result.url).pathname,'/Anuponk/lumen/issues/new');
 for(const value of [result.report,decodeURIComponent(result.url)])for(const forbidden of ['SECRET','secret@','00000000-0000-0000'])assert(!value.includes(forbidden));
 return {nativeDOM:true,reviewBeforeGitHub:true,noIssueCreated:true,closedExport:true,filter:true,revocation:true};
}
