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
  await evaluate(`(async()=>{const {wireAccountDeletionForm}=await import('/src/privacy/account-deletion.js');window.__preparedDeletionMail=[];wireAccountDeletionForm(document,href=>window.__preparedDeletionMail.push(href))})()`);
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
  results.push({width,confirmationRequired:true,mailPreparedOnly:true,savePreserved:true,liveDeletion:false});
 }
 return results;
}
