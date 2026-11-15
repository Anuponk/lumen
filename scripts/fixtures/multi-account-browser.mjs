// Synthetic multi-account server for #711 browser reproductions. Each account
// owns its profile, receipts and wallet; the session decides auth.uid(). Any RPC
// whose expected account differs from the session is refused AND recorded, so a
// cross-account write attempt is observable. Never contacts a real server.
export function multiAccountFixture(accounts, initialOwner) {
  const seed = JSON.stringify({ session: initialOwner ? { user: { id: initialOwner } } : null, accounts: Object.fromEntries(Object.entries(accounts).map(([id, profile]) => [id, { profile, receipts: [], wallet: {}, grants: 0, writes: 0 }])), refused: [] });
  return `localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenTutorialCompletedV1','1');localStorage.setItem('lumenSound','off');
if(!sessionStorage.getItem('multiAccountServer')){sessionStorage.setItem('multiAccountServer',${JSON.stringify(seed)});${initialOwner ? `localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(initialOwner)});localStorage.setItem('lumenProgressV1',JSON.stringify(${JSON.stringify(accounts[initialOwner])}));` : ''}}
window.__server=JSON.parse(sessionStorage.getItem('multiAccountServer'));
window.__saveServer=()=>sessionStorage.setItem('multiAccountServer',JSON.stringify(window.__server));
(()=>{let callback=()=>{};
const uid=()=>window.__server.session?.user?.id??null;
const account=()=>window.__server.accounts[uid()];
const setSession=(event,session)=>{window.__server.session=session;window.__saveServer();callback(event,session)};
const refuse=(name,args)=>{window.__server.refused.push({name,expected:args?.p_expected_user_id??null,session:uid()});window.__saveServer();return {data:null,error:{code:'42501',message:'account changed'},status:403}};
const stable=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):Array.isArray(value)?value.map(stable):value;
window.supabase={createClient(){return {auth:{
 getSession:async()=>{await new Promise(r=>setTimeout(r,150));return {data:{session:window.__server.session}}},
 onAuthStateChange(fn){callback=fn},
 signInWithPassword:async({email})=>{const id=String(email).split('@')[0];if(!window.__server.accounts[id])return {data:null,error:{message:'Invalid login credentials'}};const session={user:{id}};setSession('SIGNED_IN',session);return {data:{session},error:null}},
 signOut:async()=>{setSession('SIGNED_OUT',null);return {error:null}},
 updateUser:async()=>({error:null}),verifyOtp:async()=>({error:null})
},rpc:async(name,args={})=>{
 if(window.__rpcDelay)await new Promise(r=>setTimeout(r,window.__rpcDelay)); // 4G-like latency.
 if(!uid())return {data:null,error:{code:'PGRST301',message:'JWT required'},status:401};
 if(Object.hasOwn(args,'p_expected_user_id')&&args.p_expected_user_id!==uid())return refuse(name,args);
 const a=account();
 if(name==='lumen_restore_profile'&&sessionStorage.getItem('failRestoreFor')===uid())return {data:null,error:{code:'PGRST003',message:'Service unavailable'},status:503};
 if(name==='lumen_restore_profile')return {data:structuredClone(a.profile)};
 if(name==='lumen_cas_profile'){if(JSON.stringify(stable(args.p_expected))!==JSON.stringify(stable(a.profile)))return {data:false};a.profile=structuredClone(args.p_payload);a.writes++;window.__saveServer();return {data:true}}
 if(name==='lumen_wallet_command_version'||name==='lumen_canonical_command_version')return {data:1};
 if(name==='lumen_get_wallet_command')return {data:a.wallet[args.p_operation_id]??null};
 if(name==='lumen_commit_wallet_command'){let r=a.wallet[args.p_operation_id];if(!r){const cost=args.p_request.kind==='hint'&&args.p_request.sequence>1?2:1;if((a.profile.shards||0)<cost)return {error:{code:'P0001',message:'insufficient wallet balance'}};a.profile.shards-=cost;a.profile.walletRevision=(a.profile.walletRevision||0)+1;r={version:1,operationId:args.p_operation_id,request:args.p_request,revision:a.profile.walletRevision,balance:a.profile.shards,balanceDelta:-cost};a.wallet[args.p_operation_id]=r;a.writes++;window.__saveServer()}return {data:r}}
 const receipts=new Map(a.receipts),view=r=>r?.request?r:null;
 if(name==='lumen_get_quest_command')return {data:view(receipts.get(args.p_operation_id))??null};
 if(name==='lumen_get_quest_command_verified'){const r=view(receipts.get(args.p_operation_id));return {data:{version:1,receipt:r??null,profile:r?structuredClone(a.profile):null}}}
 if(name==='lumen_get_canonical_command')return {data:null};
 if(name==='lumen_commit_quest_command'){const prior=receipts.get(args.p_operation_id);if(prior&&JSON.stringify(prior.request.facts)!==JSON.stringify(args.p_facts))return {data:null,error:{code:'22023'},status:400};
  if(!prior){const {applyQuestVictory}=await import('/src/campaign/quest-victory.js');const {canonicalQuestById}=await import('/src/campaign/canonical-quests.js');const outcome=applyQuestVictory(a.profile,canonicalQuestById(args.p_quest_id),args.p_facts);if(outcome.firstCompletion)a.grants++;receipts.set(args.p_operation_id,{request:{version:2,operationId:args.p_operation_id,questId:args.p_quest_id,facts:args.p_facts},outcome,recordedAt:new Date().toISOString()});a.receipts=[...receipts];a.writes++;window.__saveServer()}
  return {data:{profile:structuredClone(a.profile)},error:null}}
 if(name==='lumen_get_internal_capabilities')return {data:JSON.parse(sessionStorage.getItem('fixtureCapabilities')||'[]')};
 if(name==='lumen_get_progress')return {data:Object.keys(a.profile.solved||{}).map(k=>({puzzle_id:Number(k)+1}))};
 return {data:[],error:null};
}}}};Object.defineProperty(window,'supabase',{value:window.supabase,writable:false,configurable:true});})();`;
}
