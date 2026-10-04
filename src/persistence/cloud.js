export function createCloudPersistence(model,hooks,environment){
const {activeGameSeconds,exactSkyScoreForSolvedPrefix,saveLumenProgress,refreshJourney,init,updateAuthUI,showRewardToast,renderDaily}=hooks;
const campaignQuestCount=()=>Math.max(0,Number(hooks.campaignQuestCount?.()??100));
const {document,location,alert,setTimeout,console}=environment;
const cloudWritesDisabled=()=>!!environment.qaMode;
async function loadLumenProfile(){
 if(!model.lumenSupabase||!model.lumenUser)return;
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_profile");if(error){console.warn("LUMEN profile",error);return}
 model.lumenNickname=(data&&data[0]&&data[0].nickname)||"";
 const input=document.getElementById("nicknameInput");if(input)input.value=model.lumenNickname;
 updateAuthUI();
}

async function saveLumenNickname(){
 const input=document.getElementById("nicknameInput"),value=(input?.value||"").trim();
 if(value.length<2||value.length>24){showRewardToast("Pseudo : 2 à 24 caractères");return}
 const {data,error}=await model.lumenSupabase.rpc("lumen_set_nickname",{p_nickname:value});
 if(error){showRewardToast("Ce pseudo n’est pas valide");return}
 model.lumenNickname=data||value;updateAuthUI();showRewardToast("Pseudo enregistré ✦");
}

async function loadInternalCapabilities(){
 if(!model.lumenSupabase||!model.lumenUser){model.lumenCapabilities=[];return []}
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_internal_capabilities");
 if(error){console.warn("LUMEN capabilities",error);model.lumenCapabilities=[];return []}
 model.lumenCapabilities=data||[];updateAuthUI();return model.lumenCapabilities;
}

async function loadEntitlements(){
 if(!model.lumenSupabase||!model.lumenUser){model.lumenEntitlements=[];return []}
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_entitlements");
 if(error){console.warn("LUMEN entitlements",error);model.lumenEntitlements=[];return []}
 model.lumenEntitlements=data||[];refreshJourney();return model.lumenEntitlements;
}

async function cloudSavePuzzle(index){
 if(cloudWritesDisabled()||!model.lumenSupabase||!model.lumenUser)return;
 const seconds=activeGameSeconds();
 const {error}=await model.lumenSupabase.rpc("lumen_save_progress",{p_puzzle_id:index+1,p_duration_seconds:seconds,p_hints_used:model.usedHintThisGame?1:0});
 if(error)console.warn("LUMEN sync save",error);
}

async function cloudMergeProgress(){
 if(cloudWritesDisabled()||!model.lumenSupabase||!model.lumenUser)return;
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_progress");
 if(error){console.warn("LUMEN sync load",error);return}
 const cloud=new Set((data||[]).map(x=>Number(x.puzzle_id)-1).filter(x=>x>=0&&x<campaignQuestCount()));
 const local=Object.keys(model.lumenProgress.solved||{}).filter(k=>model.lumenProgress.solved[k]).map(Number).filter(x=>x>=0&&x<campaignQuestCount());
 const backup=Object.keys(model.lumenProgress.historyBackup||{}).filter(k=>model.lumenProgress.historyBackup[k]).map(Number).filter(x=>x>=0&&x<campaignQuestCount());
 const authoritative=cloud.size?cloud:new Set([...backup,...local]);
 let count=0;while(count<campaignQuestCount()&&authoritative.has(count))count++;
 const restored={};for(let i=0;i<count;i++)restored[i]=1;
 model.lumenProgress.solved=restored;
 model.lumenProgress.historyBackup={...restored};
 model.sequentialSolvedCount=count;
 model.lumenProgress.skyScore=exactSkyScoreForSolvedPrefix();
 model.lumenProgress.skyHistoryVersion=4;
 saveLumenProgress();
 for(const i of local)if(!cloud.has(i)){
   const {error:e}=await model.lumenSupabase.rpc("lumen_save_progress",{p_puzzle_id:i+1,p_duration_seconds:null,p_hints_used:(model.lumenProgress.noHint&&model.lumenProgress.noHint[i])?0:1});
   if(e)console.warn("LUMEN import local",e);
 }
 model.levelIndex=Math.min(count,campaignQuestCount()-1);
 refreshJourney(); init();
 model.lumenCloudReady=true;
}

async function initLumenCloud(){
 if(!model.lumenSupabase){updateAuthUI();return}
 const {data}=await model.lumenSupabase.auth.getSession();
 model.lumenUser=data.session?.user||null; updateAuthUI();
 if(model.lumenUser){await loadLumenProfile();await loadEntitlements();await loadInternalCapabilities();if(!cloudWritesDisabled()){await cloudMergeProgress();await cloudMergeDaily();}}else {model.lumenEntitlements=[];model.lumenCapabilities=[];}
 model.lumenSupabase.auth.onAuthStateChange((event,session)=>{
   const previous=model.lumenUser?.id; model.lumenUser=session?.user||null; updateAuthUI();
   if(model.lumenUser&&model.lumenUser.id!==previous)setTimeout(async()=>{await loadEntitlements();await loadInternalCapabilities();if(!cloudWritesDisabled()){await cloudMergeProgress();await cloudMergeDaily()}},0);else if(!model.lumenUser){model.lumenEntitlements=[];model.lumenCapabilities=[];refreshJourney();updateAuthUI()}
 });
 const login=document.getElementById("authLogin"),logout=document.getElementById("authLogout");
 if(login)login.onclick=async()=>{
   const redirectTo=location.origin+location.pathname;
   const {error}=await model.lumenSupabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
   if(error)alert("Connexion impossible : "+error.message);
 };
 if(logout)logout.onclick=async()=>{await model.lumenSupabase.auth.signOut();model.lumenUser=null;model.lumenEntitlements=[];model.lumenCapabilities=[];model.lumenCloudReady=false;updateAuthUI();refreshJourney()};
}

async function cloudSaveDaily(date,index){
 if(cloudWritesDisabled()||!model.lumenSupabase||!model.lumenUser)return null;
 const {data,error}=await model.lumenSupabase.rpc("lumen_claim_daily",{p_puzzle_id:index+1});
 if(error){console.warn("LUMEN daily save",error);return null}
 return data?.[0]||null;
}

async function cloudMergeHistoricalPerformance(anonymousId){
 if(cloudWritesDisabled()||!model.lumenSupabase)return;
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_historical_performance",{p_anonymous_id:anonymousId||null});
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

return {loadLumenProfile,saveLumenNickname,loadEntitlements,loadInternalCapabilities,cloudSavePuzzle,cloudMergeProgress,initLumenCloud,cloudSaveDaily,cloudMergeDaily,cloudMergeHistoricalPerformance};
}
