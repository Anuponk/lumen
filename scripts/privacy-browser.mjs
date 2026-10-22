import assert from 'node:assert/strict';

export async function verifyPrivacyRequests({send,evaluate},baseUrl){
 const results=[];
 // The request page has no SDK and this test must never send mail or call Auth.
 await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*supabase.co/*']});
 const before=await evaluate(`JSON.stringify(['lumenProgressV1','lumenActiveAttemptV1'].map(k=>[k,localStorage.getItem(k)]))`);
 for(const width of [390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<700});
  const previous=await evaluate('performance.timeOrigin');
  await send('Page.navigate',{url:new URL('/supprimer-compte.html',baseUrl).href});
  let ready=false;
  for(let i=0;i<100;i++){
   try{if(await evaluate(`performance.timeOrigin!==${JSON.stringify(previous)}&&document.readyState==='complete'&&!!document.getElementById('accountDeletionRequest')`)){ready=true;break}}
   catch(error){if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error}
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  // This independent public page intentionally has no game diagnostics/SDK.
  assert(ready,'external deletion request page must load without the game');
  await evaluate(`(async()=>{const {wireAccountDeletionForm}=await import('/src/privacy/account-deletion.js');window.__preparedDeletionMail=[];wireAccountDeletionForm(document,href=>window.__preparedDeletionMail.push(href))})()`,true);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'deletion page fits mobile and desktop');
  await evaluate(`document.getElementById('deletionAccountAddress').value='parent+fixture@example.test';document.querySelector('button[type=submit]').click()`);
  assert.equal(await evaluate('__preparedDeletionMail.length'),0,'confirmation is required before preparing the request');
  await evaluate(`document.getElementById('deletionConfirmation').checked=true;document.querySelector('button[type=submit]').click()`);
  const result=await evaluate(`({count:__preparedDeletionMail.length,href:__preparedDeletionMail[0],status:document.getElementById('deletionRequestStatus').textContent,hasSdk:!!window.supabase})`);
  assert.equal(result.count,1);
  assert.equal(new URL(result.href).searchParams.get('body').includes('parent+fixture@example.test'),true);
  assert(result.status.includes('aucune suppression'));
  assert.equal(result.hasSdk,false);
  assert.equal(await evaluate(`JSON.stringify(['lumenProgressV1','lumenActiveAttemptV1'].map(k=>[k,localStorage.getItem(k)]))`),before,'preparing deletion does not clear or alter the save/attempt');
  for(const [path,title] of [['/mentions-legales.html','Mentions légales'],['/confidentialite.html','Confidentialité']]){
   const origin=await evaluate('performance.timeOrigin');
   await send('Page.navigate',{url:new URL(path,baseUrl).href});
   let loaded=false;
   for(let i=0;i<100;i++){
    try{if(await evaluate(`performance.timeOrigin!==${JSON.stringify(origin)}&&document.readyState==='complete'&&document.querySelector('h1')?.textContent===${JSON.stringify(title)}`)){loaded=true;break}}
    catch(error){if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error}
    await new Promise(resolve=>setTimeout(resolve,100));
   }
   assert(loaded,'legal candidate page loads independently without Auth');
   assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'legal copy fits mobile and desktop');
   assert.equal(await evaluate(`document.querySelectorAll('script').length`),0,'legal pages need no SDK or script');
   assert.equal(await evaluate(`!!document.querySelector('nav a[href="/supprimer-compte.html"]')`),true,'rights request remains directly accessible');
   assert.equal(await evaluate(`document.querySelector('aside')?.textContent.includes('Version candidate')`),true,'unapproved legal policy is not presented as published compliance');
   assert.equal(await evaluate(`JSON.stringify(['lumenProgressV1','lumenActiveAttemptV1'].map(k=>[k,localStorage.getItem(k)]))`),before,'reading legal pages preserves save and attempt');
  }
  results.push({width,confirmationRequired:true,mailPreparedOnly:true,savePreserved:true,liveDeletion:false,legalCandidatePages:2});
 }
 return results;
}

// Run after the independent request-page checks, which must remain SDK-free.
export async function verifyBundledLibraries({evaluate}){
 const result=await evaluate(`(async()=>{
  const inventory=await fetch('/content/legal/browser-dependencies.json').then(response=>response.json());
  const loaded=[];
  for(const library of inventory.libraries){
   const script=document.createElement('script');script.src='/'+library.path;
   await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Bundled library failed to load'));document.head.append(script)});
   loaded.push(new URL(script.src).origin===location.origin);
  }
  const target=document.createElement('div');document.body.append(target);
  new QRCode(target,{text:'https://example.test/challenge?code=fixture',width:128,height:128});
  const rendered=!!target.querySelector('canvas,img,table');target.remove();
  return {localOnly:loaded.every(Boolean),sdkAvailable:typeof supabase?.createClient==='function',qrRendered:rendered};
 })()`,true);
 assert.deepEqual(result,{localOnly:true,sdkAvailable:true,qrRendered:true});
 return {...result,liveAuth:false};
}
