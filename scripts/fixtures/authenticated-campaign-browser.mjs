// Synthetic RPC fixture shared by authenticated browser regression suites.
export function authenticatedCampaignFixture(profile){return `localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenTutorialCompletedV1','1');localStorage.setItem('lumenSound','off');if(!sessionStorage.getItem('grandChienFixture')){localStorage.setItem('lumenCloudOwnerId','synthetic-frontier');localStorage.setItem('lumenProgressV1',JSON.stringify(${JSON.stringify(profile)}));sessionStorage.setItem('grandChienFixture',JSON.stringify(${JSON.stringify(profile)}));}
if(sessionStorage.getItem('solvedBoardOnLoad')){const a=JSON.parse(localStorage.getItem('lumenActiveAttemptV1'));a.board=JSON.parse(sessionStorage.getItem('solvedBoardOnLoad'));localStorage.setItem('lumenActiveAttemptV1',JSON.stringify(a));sessionStorage.removeItem('solvedBoardOnLoad');}
window.__profile=JSON.parse(sessionStorage.getItem('grandChienFixture'));window.__canonicalReceipts=new Map(JSON.parse(sessionStorage.getItem('canonicalReceipts')||'[]'));window.__canonicalGrants=Number(sessionStorage.getItem('canonicalGrants')||0);
if(sessionStorage.getItem('recreatedCaptureOnLoad')){const fixture=JSON.parse(sessionStorage.getItem('recreatedCaptureOnLoad'));localStorage.setItem('lumenActiveAttemptV1',JSON.stringify(fixture.attempt));localStorage.setItem('lumenCanonicalVictoryOutboxV2:'+fixture.entry.userId+':'+fixture.entry.operationId,JSON.stringify(fixture.entry));if(fixture.paused)localStorage.setItem('lumenCanonicalVictoryRetryV1:'+fixture.entry.userId+':v2-'+fixture.entry.operationId,JSON.stringify({version:1,userId:fixture.entry.userId,questId:fixture.entry.questId,operationId:fixture.entry.operationId,intentCreatedAt:fixture.entry.createdAt,kind:'review',code:'22023'}));sessionStorage.removeItem('recreatedCaptureOnLoad');}
window.supabase={createClient(){return {auth:{getSession:async()=>{if(navigator.onLine===false)throw Error('Synthetic expired session refresh unavailable');await new Promise(resolve=>setTimeout(resolve,300));return {data:{session:{user:{id:sessionStorage.getItem('grandChienOwner')||'synthetic-frontier'}}}}},onAuthStateChange(){}},rpc:async(name,args)=>{
 if(navigator.onLine===false)throw new TypeError('Synthetic RPC offline');
 if(name==='lumen_restore_profile')return {data:structuredClone(window.__profile)};
 if(name==='lumen_cas_profile'){const stable=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):Array.isArray(value)?value.map(stable):value;if(JSON.stringify(stable(args.p_expected))!==JSON.stringify(stable(window.__profile)))return {data:false,error:null};if(JSON.stringify(args.p_payload.performances||{})!==JSON.stringify(window.__profile.performances||{}))return {data:null,error:{code:'22023',message:'legacy victory command required; preserve pending data and update client'}};window.__profile=structuredClone(args.p_payload);sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));return {data:true}};
 if(name==='lumen_wallet_command_version')return {data:1};
 if(name==='lumen_get_wallet_command')return {data:JSON.parse(sessionStorage.getItem('walletReceipts')||'{}')[args.p_operation_id]??null};
 if(name==='lumen_commit_wallet_command'){
  const receipts=JSON.parse(sessionStorage.getItem('walletReceipts')||'{}');let receipt=receipts[args.p_operation_id];
  if(!receipt){
   const cost=args.p_request.kind==='hint'&&args.p_request.sequence>1?2:1;
   if(window.__profile.shards<cost)return {error:{code:'P0001',message:'insufficient wallet balance'}};
   window.__profile.shards-=cost;window.__profile.walletRevision++;
   receipt={version:1,operationId:args.p_operation_id,request:args.p_request,revision:window.__profile.walletRevision,balance:window.__profile.shards,balanceDelta:-cost};
   receipts[args.p_operation_id]=receipt;sessionStorage.setItem('walletReceipts',JSON.stringify(receipts));sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));sessionStorage.setItem('walletDebits',String(Number(sessionStorage.getItem('walletDebits')||0)+1));
  }
  return {data:receipt};
 }
 if(name==='lumen_canonical_command_version')return {data:1,error:null};
 if(name==='lumen_get_quest_command'){
  const receipt=window.__canonicalReceipts.get(args.p_operation_id);
  return {data:receipt?.request?receipt:receipt?{request:receipt,outcome:{newlyCompleted:receipt.newlyCompleted},recordedAt:receipt.recordedAt}:null,error:null};
 }
 if(name==='lumen_commit_quest_command'){
  const prior=window.__canonicalReceipts.get(args.p_operation_id);
  if(prior&&!prior.request)return {data:null,error:{code:'22023'},status:400};
  if(prior&&JSON.stringify(prior.request.facts)!==JSON.stringify(args.p_facts))return {data:null,error:{code:'22023'},status:400};
  if(!prior){
   const {applyQuestVictory}=await import('/src/campaign/quest-victory.js');
   const {canonicalQuestById}=await import('/src/campaign/canonical-quests.js');
   const outcome=applyQuestVictory(window.__profile,canonicalQuestById(args.p_quest_id),args.p_facts);
   if(outcome.firstCompletion)window.__canonicalGrants++;
   window.__canonicalReceipts.set(args.p_operation_id,{request:{version:2,operationId:args.p_operation_id,questId:args.p_quest_id,facts:args.p_facts},outcome,recordedAt:new Date().toISOString()});
   sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));
  }
  sessionStorage.setItem('canonicalReceipts',JSON.stringify([...window.__canonicalReceipts]));sessionStorage.setItem('canonicalGrants',String(window.__canonicalGrants));
  return {data:{profile:structuredClone(window.__profile)},error:null};
 }
 if(name==='lumen_get_canonical_command')return {data:window.__canonicalReceipts.get(args.p_operation_id)??null,error:null};
 if(name==='lumen_commit_canonical_command'){
  const prior=window.__canonicalReceipts.get(args.p_operation_id);
  if(prior&&(prior.questId!==args.p_quest_id||JSON.stringify(prior.badges)!==JSON.stringify(args.p_badges)||JSON.stringify(prior.performance)!==JSON.stringify(args.p_performance)))return {data:null,error:{code:'22023',message:'operation evidence changed'},status:400};
  if(!prior){
   const {acknowledgeCanonicalVictory}=await import('/src/persistence/canonical-progress.js');
   const result=acknowledgeCanonicalVictory(window.__profile,args.p_quest_id,{badges:args.p_badges,performance:args.p_performance,stars:1});
   window.__profile=result.profile;if(result.newlyCompleted)window.__canonicalGrants++;
   sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));
   window.__canonicalReceipts.set(args.p_operation_id,{version:1,operationId:args.p_operation_id,questId:args.p_quest_id,badges:args.p_badges,performance:args.p_performance,newlyCompleted:result.newlyCompleted,recordedAt:new Date().toISOString()});
  }
  sessionStorage.setItem('canonicalReceipts',JSON.stringify([...window.__canonicalReceipts]));sessionStorage.setItem('canonicalGrants',String(window.__canonicalGrants));
  return {data:{profile:structuredClone(window.__profile),newlyCompleted:!prior},error:null};
 }
 if(name==='lumen_get_progress')return {data:Object.keys(window.__profile.solved).map(k=>({puzzle_id:Number(k)+1}))};
 return {data:[],error:null};
}}}};Object.defineProperty(window,'supabase',{value:window.supabase,writable:false,configurable:true});`}
