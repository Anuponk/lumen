import {LUMEN_SUPABASE_URL,LUMEN_SUPABASE_KEY} from "./config.js";
import {baseCampaignQuestCount} from "../campaign/content.js";
export function createCloudPersistence(model,hooks,environment){
const {activeGameSeconds,exactSkyScoreForSolvedPrefix,saveLumenProgress,refreshJourney,init,onAccountChanged=()=>{},renderDaily}=hooks;
const campaignQuestCount=()=>Math.max(0,Number(hooks.campaignQuestCount?.()??baseCampaignQuestCount()));
const {setTimeout,console}=environment;
const cloudWritesDisabled=()=>!!environment.qaMode;
async function registerLumenUser(){
 if(!model.lumenSupabase||!model.lumenUser||cloudWritesDisabled())return;
 const {error}=await model.lumenSupabase.rpc("lumen_register_user");
 if(error)console.warn("LUMEN user registration",error);
}
async function loadLumenProfile(){
 if(!model.lumenSupabase||!model.lumenUser)return;
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_profile");if(error){console.warn("LUMEN profile",error);return}
 model.lumenNickname=(data&&data[0]&&data[0].nickname)||"";
 onAccountChanged({type:"profile",nickname:model.lumenNickname});
}

async function saveLumenNickname(value){
 value=String(value||"").trim();
 if(value.length<2||value.length>24)return {ok:false,reason:"length"};
 if(!model.lumenSupabase||!model.lumenUser)return {ok:false,reason:"signed_out"};
 const {data,error}=await model.lumenSupabase.rpc("lumen_set_nickname",{p_nickname:value});
 if(error)return {ok:false,reason:"invalid",error};
 model.lumenNickname=data||value;onAccountChanged({type:"profile",nickname:model.lumenNickname});return {ok:true,nickname:model.lumenNickname};
}

async function loadInternalCapabilities(){
 if(!model.lumenSupabase||!model.lumenUser){model.lumenCapabilities=[];return []}
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_internal_capabilities");
 if(error){console.warn("LUMEN capabilities",error);model.lumenCapabilities=[];return []}
 model.lumenCapabilities=data||[];onAccountChanged({type:"account"});return model.lumenCapabilities;
}

async function loadEntitlements(){
 if(!model.lumenSupabase||!model.lumenUser){model.lumenEntitlements=[];return []}
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_entitlements");
 if(error){console.warn("LUMEN entitlements",error);model.lumenEntitlements=[];return []}
 model.lumenEntitlements=data||[];refreshJourney();return model.lumenEntitlements;
}

async function cloudSavePuzzle(index){
 if(cloudWritesDisabled()||!model.lumenSupabase||!model.lumenUser)return {ok:false,reason:"not_authenticated"};
 const seconds=activeGameSeconds();
 const {error}=await model.lumenSupabase.rpc("lumen_save_progress",{p_puzzle_id:index+1,p_duration_seconds:seconds,p_hints_used:model.usedHintThisGame?1:0});
 if(error){console.warn("LUMEN sync save",error);return {ok:false,reason:"write_failed"}}
 const {data,error:readError}=await model.lumenSupabase.rpc("lumen_get_progress");
 if(readError||!Array.isArray(data)||!data.some(row=>Number(row.puzzle_id)===index+1)){
  if(readError)console.warn("LUMEN sync verification failed",readError);
  return {ok:false,reason:"verification_failed"};
 }
 return {ok:true};
}
// The legacy progress table is a secondary read model. It must never be
// considered synchronized merely because the full-profile CAS succeeded.
async function verifyLegacyProgressMirror(){
 if(cloudWritesDisabled()||!model.lumenSupabase||!model.lumenUser)return {ok:false,reason:"not_authenticated"};
 const expected=Object.keys(model.lumenProgress.solved||{}).filter(key=>model.lumenProgress.solved[key]).map(Number).filter(Number.isSafeInteger).filter(i=>i>=0&&i<campaignQuestCount());
 const read=()=>model.lumenSupabase.rpc("lumen_get_progress");
 let {data,error}=await read();
 if(error||!Array.isArray(data))return {ok:false,reason:"read_failed"};
 const present=new Set(data.map(row=>Number(row.puzzle_id)-1));
 const missing=expected.filter(i=>!present.has(i));
 for(const index of missing){
  const {error:writeError}=await model.lumenSupabase.rpc("lumen_save_progress",{p_puzzle_id:index+1,p_duration_seconds:null,p_hints_used:model.lumenProgress.noHint?.[index]?0:1});
  if(writeError){console.warn("LUMEN legacy mirror write failed",writeError);return {ok:false,reason:"write_failed",pending:missing.length}}
 }
 if(missing.length){({data,error}=await read());if(error||!Array.isArray(data))return {ok:false,reason:"verification_failed"}}
 const confirmed=new Set(data.map(row=>Number(row.puzzle_id)-1));
 const remaining=expected.filter(i=>!confirmed.has(i));
 return remaining.length?{ok:false,reason:"verification_failed",pending:remaining.length}:{ok:true,count:expected.length};
}

async function cloudMergeProgress(){
 if(cloudWritesDisabled()||!model.lumenSupabase||!model.lumenUser)return;
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_progress");
 if(error){console.warn("LUMEN sync load",error);return}
 const cloud=new Set((data||[]).map(x=>Number(x.puzzle_id)-1).filter(x=>x>=0&&x<campaignQuestCount()));
 const local=Object.keys(model.lumenProgress.solved||{}).filter(k=>model.lumenProgress.solved[k]).map(Number).filter(x=>x>=0&&x<campaignQuestCount());
 const backup=Object.keys(model.lumenProgress.historyBackup||{}).filter(k=>model.lumenProgress.historyBackup[k]).map(Number).filter(x=>x>=0&&x<campaignQuestCount());
 // Progress is monotonic: a stale cloud snapshot must never erase newer
 // local/backup completions (notably around Adventure boundaries).
 const authoritative=new Set([...cloud,...backup,...local]);
 let count=0;while(count<campaignQuestCount()&&authoritative.has(count))count++;
 const restored={};for(let i=0;i<count;i++)restored[i]=1;
 model.lumenProgress.solved=restored;
 model.lumenProgress.historyBackup={...restored};
 model.sequentialSolvedCount=count;
 model.lumenProgress.skyScore=exactSkyScoreForSolvedPrefix(Math.min(count,baseCampaignQuestCount()));
 model.lumenProgress.skyHistoryVersion=4;
 saveLumenProgress();
 for(const i of local)if(!cloud.has(i)){
   const {error:e}=await model.lumenSupabase.rpc("lumen_save_progress",{p_puzzle_id:i+1,p_duration_seconds:null,p_hints_used:(model.lumenProgress.noHint&&model.lumenProgress.noHint[i])?0:1});
   if(e)console.warn("LUMEN import local",e);
 }
 if(!model.navigationLocked){
   model.levelIndex=Math.min(count,baseCampaignQuestCount()-1);
   refreshJourney(); init();
 }else refreshJourney();
 model.lumenCloudReady=true;
}

async function confirmBrandedAuthLink(){
 // Cloud persistence is also executed in Node.js regression fixtures.
 if(typeof window==="undefined"||!window.location||!window.history)return;
 const loc=window.location;
 const url=new URL(loc.href);
 const hash=url.searchParams.get("lumen_confirm");
 const type=url.searchParams.get("type");
 if(!hash)return;
 // Discard sensitive tokens from URL/history before contacting any service.
 url.searchParams.delete("lumen_confirm");
 url.searchParams.delete("type");
 window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);
 if(!/^[a-f0-9]{64}$/i.test(hash)||!["signup","recovery"].includes(type||""))return;
 const {error}=await model.lumenSupabase.auth.verifyOtp({
  token_hash:hash,type
 });
 if(error){
  console.warn("LUMEN confirmation link could not be validated",error.message);
  // An expired/reused link must not revoke an otherwise valid session.
  onAccountChanged({type:"confirmation_failed"});
  return;
 }
}
async function initLumenCloud(){
 if(!model.lumenSupabase){onAccountChanged({type:"account"});return}
 let revision=0,booting=true;
 // Subscribe before confirmation/restore I/O: login, recovery and sign-out
 // events can arrive while those requests are still in flight.
 model.lumenSupabase.auth.onAuthStateChange((event,session)=>{
   revision++;
   const previous=model.lumenUser?.id; model.lumenUser=session?.user||null; onAccountChanged({type:event==="PASSWORD_RECOVERY"?"password_recovery":"account",authEvent:event});
   // Wait for confirmation before restoring/reloading the profile. Recovery
   // must have time to open its password editor, even with an existing session.
   if(booting)return;
   const accountId=model.lumenUser?.id;
   if(model.lumenUser&&model.lumenUser.id!==previous)setTimeout(async()=>{if(model.lumenUser?.id!==accountId)return;try{await registerLumenUser();await loadLumenProfile();await loadEntitlements();await loadInternalCapabilities();if(model.lumenUser?.id!==accountId)return;if(!cloudWritesDisabled() && !(await hooks.holdLegacyMergeForFullRestore?.())){await cloudMergeProgress();await cloudMergeDaily()}await hooks.afterAuthCloudSync?.();}catch(error){console.warn("LUMEN account restoration",error);onAccountChanged({type:"restore_failed"})}},0);else if(model.lumenUser&&(event==="SIGNED_IN"||event==="TOKEN_REFRESHED"||event==="USER_UPDATED")){
    // Same-account session renewals must refresh server-authorized cockpit rights.
    // Never grant a capability locally: the RPC remains authoritative.
    setTimeout(()=>loadInternalCapabilities().catch(error=>console.warn("LUMEN capabilities refresh",error)),0);
   }else if(!model.lumenUser){model.lumenEntitlements=[];model.lumenCapabilities=[];refreshJourney();onAccountChanged({type:"account"})}
 });
 await confirmBrandedAuthLink();
 const snapshotRevision=revision;
 const {data,error}=await model.lumenSupabase.auth.getSession();
 // A late startup snapshot must never undo a more recent auth event.
 booting=false;
 if(snapshotRevision===revision&&!error){model.lumenUser=data.session?.user||null;onAccountChanged({type:"account"})}
 if(error){console.warn("LUMEN session restore",error);onAccountChanged({type:"restore_failed"});return}
 const accountId=model.lumenUser?.id;
 if(model.lumenUser){await registerLumenUser();await loadLumenProfile();await loadEntitlements();await loadInternalCapabilities();if(model.lumenUser?.id!==accountId)return;if(!cloudWritesDisabled() && !(await hooks.holdLegacyMergeForFullRestore?.())){await cloudMergeProgress();await cloudMergeDaily();}await hooks.afterAuthCloudSync?.();}else {model.lumenEntitlements=[];model.lumenCapabilities=[];}
}

async function cloudSaveDaily(date,index){
 if(cloudWritesDisabled()||!model.lumenSupabase||!model.lumenUser)return null;
 const {data,error}=await model.lumenSupabase.rpc("lumen_claim_daily",{p_puzzle_id:index+1});
 if(error){console.warn("LUMEN daily save",error);return null}
 return data?.[0]||null;
}

async function cloudMergeHistoricalPerformance(anonymousId){
 // Once opted in, reward summaries are command-owned. Historical discovery
 // remains available before activation; never mutate a migrated projection.
 if(model.lumenProgress?.legacyVictoryRevision)return;
 if(cloudWritesDisabled()||!model.lumenSupabase)return;
 const owner=model.lumenUser?.id,client=model.lumenSupabase;
 const {data,error}=await client.rpc("lumen_get_historical_performance",{p_anonymous_id:anonymousId||null});
 if(model.lumenUser?.id!==owner||model.lumenSupabase!==client||model.lumenProgress?.legacyVictoryRevision)return;
 if(error){console.warn("LUMEN history recovery",error);return}
 model.lumenProgress.performances=model.lumenProgress.performances||{};
 let changed=false;
 for(const row of data||[]){
   const i=Number(row.puzzle_id)-1;if(i<0||i>=campaignQuestCount())continue;
   const old=model.lumenProgress.performances[i]||{},badges=old.badges||{};
   // Historical recovery can include the approximate Sans erreur backfill.
   // Always preserve badges already earned locally.
   const merged={autonomy:!!badges.autonomy||!!row.autonomy,speed:!!badges.speed||!!row.speed,noError:!!badges.noError||!!row.no_error,mastery:!!badges.mastery||!!row.mastery};
   if(merged.autonomy!==!!badges.autonomy||merged.speed!==!!badges.speed||merged.noError!==!!badges.noError||merged.mastery!==!!badges.mastery){
     model.lumenProgress.performances[i]={...old,version:Math.max(Number(old.version)||2,3),questIndex:i,badges:merged};changed=true;
   }
 }
 if(changed){saveLumenProgress();refreshJourney()}
}

async function cloudMergeDaily(){
 if(cloudWritesDisabled()||!model.lumenSupabase||!model.lumenUser)return;
 const [{data,error},{data:engagement,error:engagementError}]=await Promise.all([
   model.lumenSupabase.rpc("lumen_get_daily"),
   model.lumenSupabase.rpc("lumen_get_engagement")
 ]);
 if(error){console.warn("LUMEN daily load",error);return}
 if(engagementError)console.warn("LUMEN engagement load",engagementError);
 model.lumenProgress.daily=model.lumenProgress.daily||{dates:{},rewards:{}};
 model.lumenProgress.daily.dates=model.lumenProgress.daily.dates||{};
 model.lumenProgress.daily.rewards=model.lumenProgress.daily.rewards||{};
 for(const x of data||[])model.lumenProgress.daily.dates[String(x.play_date)]=1;
 const rewards=engagement?.[0]?.rewarded_days||{};
 for(const [day,amountRaw] of Object.entries(rewards)){
   const key="streak:"+day,amount=Math.max(0,Number(amountRaw)||0);
   if(amount&&!model.lumenProgress.daily.rewards[key]){
     model.lumenProgress.daily.rewards[key]=amount;
     model.lumenProgress.shards=Math.max(0,Number(model.lumenProgress.shards)||0)+amount;
   }
 }
 saveLumenProgress();renderDaily();
}

async function signIn(redirectTo){
 if(!model.lumenSupabase)return {ok:false,reason:"unavailable"};
 const target=String(redirectTo||environment.lumenAuthReturnUrl||"").trim();
 if(!target)return {ok:false,reason:"redirect"};
 try{environment.sessionStorage?.setItem("lumenAuthReturnUrl",target)}catch(_){}
 const {error}=await model.lumenSupabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:target}});
 return error?{ok:false,reason:"oauth",error}:{ok:true};
}
async function requestLumenAuthMail(type,email,password){
 const response=await fetch(LUMEN_SUPABASE_URL+"/functions/v1/lumen-auth-mail",{
  method:"POST",headers:{"content-type":"application/json","apikey":LUMEN_SUPABASE_KEY},
  body:JSON.stringify({type,email,...(type==="signup"?{password}:{})})
 });
 return response.ok;
}
async function requestPasswordRecovery(email){
 const normalized=String(email||"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))return {ok:false,reason:"email"};
 try{return {ok:await requestLumenAuthMail("recovery",normalized)}}catch{return {ok:false,reason:"unavailable"}}
}
async function emailPasswordAuth(email,password,redirectTo,{createUser=false}={}){
 if(!model.lumenSupabase)return {ok:false,reason:"unavailable"};
 const normalized=String(email||"").trim().toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))return {ok:false,reason:"email"};
 if(typeof password!=="string"||(createUser?password.length<12:password.length<1))return {ok:false,reason:"password"};
 const callback=String(redirectTo||environment.lumenAuthReturnUrl||"").trim();
 if(!callback)return {ok:false,reason:"redirect"};
 if(createUser){
  try{const sent=await requestLumenAuthMail("signup",normalized,password);return sent?{ok:true,pendingConfirmation:true}:{ok:false,reason:"signup"}}catch{return {ok:false,reason:"signup"}}
 }
 const response=await model.lumenSupabase.auth.signInWithPassword({email:normalized,password});
 if(response.error)return {ok:false,reason:createUser?"signup":"signin",error:response.error};
 return {ok:true,pendingConfirmation:createUser&&!response.data?.session};
}
async function setAccountPassword(password){
 if(!model.lumenSupabase||!model.lumenUser)return {ok:false,reason:"signed_out"};
 if(typeof password!=="string"||password.length<12)return {ok:false,reason:"password"};
 const {error}=await model.lumenSupabase.auth.updateUser({password});
 return error?{ok:false,reason:"password_update",error}:{ok:true};
}
async function signOut(){
 if(!model.lumenSupabase)return {ok:false,reason:"unavailable"};
 const {error}=await model.lumenSupabase.auth.signOut({scope:"local"});
 if(error)return {ok:false,reason:"signout",error};
 model.lumenUser=null;model.lumenEntitlements=[];model.lumenCapabilities=[];model.lumenCloudReady=false;
 onAccountChanged({type:"account"});refreshJourney();return {ok:true};
}
return {registerLumenUser,loadLumenProfile,saveLumenNickname,loadEntitlements,loadInternalCapabilities,cloudSavePuzzle,verifyLegacyProgressMirror,cloudMergeProgress,initLumenCloud,cloudSaveDaily,cloudMergeDaily,cloudMergeHistoricalPerformance,signIn,emailPasswordAuth,setAccountPassword,requestPasswordRecovery,signOut};
}
