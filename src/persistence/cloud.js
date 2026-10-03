export function createCloudPersistence(model,hooks,environment){
const {activeGameSeconds,exactSkyScoreForSolvedPrefix,saveLumenProgress,refreshJourney,init,updateAuthUI,showRewardToast,renderDaily}=hooks;
const {document,location,alert,setTimeout,console}=environment;
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

async function loadEntitlements(){
 if(!model.lumenSupabase||!model.lumenUser)return [];
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_entitlements");
 if(error){console.warn("LUMEN entitlements",error);return []}
 return data||[];
}

async function cloudSavePuzzle(index){
 if(!model.lumenSupabase||!model.lumenUser)return;
 const seconds=activeGameSeconds();
 const {error}=await model.lumenSupabase.rpc("lumen_save_progress",{p_puzzle_id:index+1,p_duration_seconds:seconds,p_hints_used:model.usedHintThisGame?1:0});
 if(error)console.warn("LUMEN sync save",error);
}

async function cloudMergeProgress(){
 if(!model.lumenSupabase||!model.lumenUser)return;
 const {data,error}=await model.lumenSupabase.rpc("lumen_get_progress");
 if(error){console.warn("LUMEN sync load",error);return}
 const cloud=new Set((data||[]).map(x=>Number(x.puzzle_id)-1).filter(x=>x>=0&&x<100));
 const local=Object.keys(model.lumenProgress.solved||{}).filter(k=>model.lumenProgress.solved[k]).map(Number).filter(x=>x>=0&&x<100);
 const backup=Object.keys(model.lumenProgress.historyBackup||{}).filter(k=>model.lumenProgress.historyBackup[k]).map(Number).filter(x=>x>=0&&x<100);
 const authoritative=cloud.size?cloud:new Set([...backup,...local]);
 let count=0;while(count<100&&authoritative.has(count))count++;
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
 model.levelIndex=Math.min(count,99);
 refreshJourney(); init();
 model.lumenCloudReady=true;
}

async function initLumenCloud(){
 if(!model.lumenSupabase){updateAuthUI();return}
 const {data}=await model.lumenSupabase.auth.getSession();
 model.lumenUser=data.session?.user||null; updateAuthUI();
 if(model.lumenUser){await loadLumenProfile();await cloudMergeProgress();await cloudMergeDaily();}
 model.lumenSupabase.auth.onAuthStateChange((event,session)=>{
   const previous=model.lumenUser?.id; model.lumenUser=session?.user||null; updateAuthUI();
   if(model.lumenUser&&model.lumenUser.id!==previous)setTimeout(async()=>{await cloudMergeProgress();await cloudMergeDaily()},0);
 });
 const login=document.getElementById("authLogin"),logout=document.getElementById("authLogout");
 if(login)login.onclick=async()=>{
   const redirectTo=location.origin+location.pathname;
   const {error}=await model.lumenSupabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
   if(error)alert("Connexion impossible : "+error.message);
 };
 if(logout)logout.onclick=async()=>{await model.lumenSupabase.auth.signOut();model.lumenUser=null;model.lumenCloudReady=false;updateAuthUI()};
}

async function cloudSaveDaily(date,index){if(!model.lumenSupabase||!model.lumenUser)return;let {error}=await model.lumenSupabase.rpc("lumen_save_daily",{p_play_date:date,p_puzzle_id:index+1});if(error)console.warn("LUMEN daily save",error)}

async function cloudMergeDaily(){
 if(!model.lumenSupabase||!model.lumenUser)return;let {data,error}=await model.lumenSupabase.rpc("lumen_get_daily");if(error){console.warn("LUMEN daily load",error);return}
 for(const x of data||[])model.lumenProgress.daily.dates[String(x.play_date)]=1;saveLumenProgress();renderDaily();
}

return {loadLumenProfile,saveLumenNickname,loadEntitlements,cloudSavePuzzle,cloudMergeProgress,initLumenCloud,cloudSaveDaily,cloudMergeDaily};
}
