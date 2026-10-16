Warning: truncated output (original token count: 55420)
Total output lines: 2692

import {qualifyDifficulty} from "../campaign/difficulty.js";
import {streakVisual,lostStreak} from "../campaign/streak-visual.js";
import {learningStep, dragLearningStep, learningAllows, learningCopy} from "../game/learning.js";
import {createAnalytics,attemptAnalyticsProperties} from "../analytics/events.js";
import {createHintTestSuite} from "../testing/hint-tests.js";
import {createDiagnostics} from "../testing/diagnostics.js";
import {createLocalPersistence} from "../persistence/local.js";
import {createCloudPersistence} from "../persistence/cloud.js";
import {reconcileDailyIntoCloudProfile} from "../persistence/daily-hydration.js";
import {backupAndVerifyProfile,backupIfUnchanged,loadVerifiedProfile,restoreIntoEmptyGuestStorage,restoreRicherCloudProfile,reconcileCloudAchievements,cloudSafelyCoversLocal,sameCloudProfile,initializeCloudProfile,compareAndSwapCloudProfile,installCloudProfileLocally,reconcileDominantLocalProfile,reconcileCompatibleCloudProfiles} from "../persistence/cloud-profile.js";
import {LUMEN_SUPABASE_URL,LUMEN_SUPABASE_KEY} from "../persistence/config.js";
import {CAT,LEVELS} from "../campaign/catalogue.js";
import {playableQuest,playableQuestCount} from "../campaign/playable-quests.js";
import {extendedSequentialCount,extendedQuestLimit} from "../campaign/extended-boundary.js";
import {generatedQuestReward,generatedAdventureRewards} from "../campaign/generated-rewards.js";
import {generatedQuestProgress} from "../campaign/generated-progression.js";
import {adminCatalogueTree,adminCanonicalCatalogueTree} from "../campaign/admin-catalogue.js";
import {mapConstellationRange,generatedMapSummary} from "../campaign/generated-map.js";
import {CONTENT_CONSTELLATIONS,contentMapModel,packForLegacyQuest,contentAccessForLegacyQuest,preserveStartedAdventureAccess} from "../campaign/content.js";
import {createSkyNavigation} from "./sky-navigation.js";
import {astronomicalDisplayShape} from "./astronomical-shapes.js";
import {astronomicalReferenceSvg,astronomicalPrimarySvg} from "./astronomical-reference-svg.js";
import {LUMEN_META,CAMPAIGN6_ORDER,CAMPAIGN_SIZE_SCHEDULE,SKY_TARGET,CONSTELLATIONS,CONSTELLATION_GRID_COUNTS,badgeDefs} from "../campaign/data.js";
import {performanceEligibility,speedTargetSeconds,localCalendarDay,performanceAttempt,badgeCooldownRemaining,badgeCooldownLabel} from "../campaign/performance.js";
import {challengeEligibility,challengeSnapshot,compareChallenge,createChallengeClient,normalizeChallengeName,validChallengeName} from "../campaign/social-challenge.js";
import {resolveChallengeQuest} from "../campaign/canonical-challenges.js";
import {canonicalDisplayForLegacy,canonicalQuestList,canonicalAdventureSummary,canonicalQuestByOrdinal,canonicalQuestForLegacy,canonicalNextUnsolved,canonicalConstellationCatchupAvailable,unlockedAdventureProgress} from "../campaign/canonical-quests.js";
import {acknowledgeCanonicalVictory,commitCanonicalVictoryViaLedger as commitCanonicalVictory,questIsCompleted} from "../persistence/canonical-progress.js";
import {createCanonicalVictoryOutbox,replayCanonicalVictoryOutbox} from "../persistence/canonical-outbox.js";
import {createCampaign,sequentialCount,campaignQuestCount,isCampaignFinalQuest,isCampaignComplete,constellationQuestIndices,constellationGridRange,chapterForGrid,milestoneFor,skyStarsForGrid,bonusChallengeFor,challengeFor,constellationCheckpoint,constellationStateForEarned,starsAwardedForGrid} from "../campaign/progression.js";
import {createGameEngine} from "../game/engine.js";
import {createAttemptEngine,ATTEMPT_STATES} from "../game/attempt-engine.js";
import {localDateKey,dateOffsetKey,formatDuration} from "../ui/format.js";
import {streakFromDates,dailyState,cycleDay,nextReward,qualifiesDailyActivity,grantDaily,grantAutonomyMilestone} from "../campaign/daily-engagement.js";
import {createTutorial} from "./tutorial.js";
import {createSound} from "./sound.js";

export function startGameScreen(){
const qaParams=new URL(location.href).searchParams;
const qaMode=qaParams.get("qa")==="new"?"new":null;
const qaActive=qaMode==="new";
const qaFresh=qaActive&&qaParams.get("qaFresh")==="1";
if(qaFresh){
 Object.keys(localStorage).filter(key=>key.startsWith("lumenQa")).forEach(key=>localStorage.removeItem(key));
 history.replaceState(null,"",location.pathname+"?"+(()=>{const p=new URLSearchParams(location.search);p.delete("qaFresh");return p.toString()})()+location.hash);
}
const qaKey=suffix=>qaActive?"lumenQa"+suffix:suffix;
const {normalizeSequentialProgress,solvedCount,exactSkyScoreForSolvedPrefix,ensureSkyScore,skyStarsEarned,challengeRewardKeys,constellationProgress,constellationLitAt,awards,performanceRun,savePerformance}=createCampaign(()=>lumenProgress,()=>saveLumenProgress(),()=>({activeGameSeconds,assistanceUsed:!!attemptEngine.snapshot()?.assistanceUsed,mistakeCommitted:!!attemptEngine.snapshot()?.mistakeCommitted,qualifying:!!attemptEngine.snapshot()?.qualifying}));
let cloudProfileReady=false,cloudProfileTimer=null,cloudProfileBusy=false,cloudProfileDirty=false,cloudProfileBaseline=null,cloudProfileInFlight=null,cloudProfileFailure=null;
// Local-only, privacy-safe cloud diagnostics. Never log IDs, emails, tokens or save payloads.
const cloudDiagKey="lumenCloudDiagnosticsV1";
function recordCloudDiagnostic(event,details={}){
 try{
  const previous=JSON.parse(localStorage.getItem(cloudDiagKey)||"[]");
  const entry={at:new Date().toISOString(),event,...details};
  localStorage.setItem(cloudDiagKey,JSON.stringify([...previous.slice(-39),entry]));
  recordCloudHealth(event,details);
  // Best-effort, bounded telemetry: never transmit account IDs, profile
  // contents, diagnostic details, or tokens. The server derives identity from JWT.
  if(["hydration_failed","hydration_ready","hydration_reconciliation"].includes(event)&&
     lumenSupabase&&lumenUser&&!qaActive){
   const reason=typeof details.reason==="string"?details.reason.slice(0,64):null;
   const outcome=typeof details.result==="string"?details.result.slice(0,32):null;
   Promise.resolve(lumenSupabase.rpc("lumen_record_sync_health",{
    p_event:event,p_reason:reason,p_outcome:outcome,
    p_version:String(document.getElementById("lumenAccountVersion")?.textContent||"unknown").slice(0,80)
   })).catch(()=>{});
  }
  console.info("[Lumen cloud diagnostic]",entry);
 }catch(_){}
}
// Health counters are deliberately aggregate-only: no player identifiers or profile data.
const cloudHealthKey="lumenCloudHealthV1";
function cloudHealthSnapshot(){
 try{return JSON.parse(localStorage.getItem(cloudHealthKey)||"{}")}catch{return {}}
}
function recordCloudHealth(event,details={}){
 try{
  const state=cloudHealthSnapshot();
  const now=Date.now();
  const next={...state,updatedAt:new Date(now).toISOString(),lastEvent:event,
   failures:Number(state.failures||0)+(event==="hydration_failed"?1:0),
   blocked:Number(state.blocked||0)+(event==="hydration_reconciliation"&&details.result==="blocked"?1:0)};
  if(event==="hydration_ready"){next.lastReadyAt=new Date(now).toISOString();next.blockedSince=null;next.failuresSinceReady=0}
  if(event==="hydration_failed"||(event==="hydration_reconciliation"&&details.result==="blocked")){
   next.blockedSince=state.blockedSince||new Date(now).toISOString();
   next.failuresSinceReady=Number(state.failuresSinceReady||0)+1;
  }
  next.stalled=!!next.blockedSince&&now-Date.parse(next.blockedSince)>15*60*1000;
  localStorage.setItem(cloudHealthKey,JSON.stringify(next));
 }catch(_){}
}
function cloudDiagnosticReport(){
 try{return JSON.stringify({app:"Lumen",version:document.getElementById("lumenAccountVersion")?.textContent||"unknown",events:JSON.parse(localStorage.getItem(cloudDiagKey)||"[]")},null,2)}
 catch(_){return "Diagnostics indisponibles"}
}
// Explicit player-controlled export: never uploads or mutates any backup.
async function exportLumenRecoveryBundle(){
 const prefixList=["lumenProgressV1","lumenUnsyncedCloudBackupV1:","lumenUnsyncedCloudBackupV2:","lumenBeforeCloud","lumenBeforeAccountSwitch_"];
 const local={};
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);
  if(prefixList.some(prefix=>key.startsWith(prefix)))local[key]=localStorage.getItem(key);
 }
 const indexed={};
 if(typeof indexedDB!=="undefined"){
  await new Promise((resolve,reject)=>{
   const request=indexedDB.open("lumen-unsynced-checkpoints",1);
   request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("snapshots"))db.createObjectStore("snapshots")};
   request.onerror=()=>reject(request.error||Error("IndexedDB unavailable"));
   request.onsuccess=()=>{
    const db=request.result;
    const tx=db.transaction("snapshots","readonly");
    const store=tx.objectStore("snapshots");
    const cursor=store.openCursor();
    cursor.onsuccess=()=>{const item=cursor.result;if(item){indexed[item.key]=item.value;item.continue()}};
    cursor.onerror=()=>{db.close();reject(cursor.error||Error("IndexedDB read failed"))};
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error||Error("IndexedDB transaction failed"))};
   };
  });
 }
 const bundle={app:"Lumen",format:"recovery-export-v1",exportedAt:new Date().toISOString(),localStorage:local,indexedDB:indexed};
 const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:"application/json"}));
 try{
  const a=document.createElement("a");a.href=url;a.download="lumen-sauvegarde-"+new Date().toISOString().slice(0,10)+".json";
  document.body.append(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),60000)}
}
async function flushCloudProfile(){
 if(cloudProfileBusy){
  cloudProfileDirty=true;
  await cloudProfileInFlight;
  return flushCloudProfile();
 }
 if(!cloudProfileReady||!lumenUser||!lumenSupabase||qaActive){
  recordCloudDiagnostic("flush_blocked",{profileReady:cloudProfileReady,signedIn:!!lumenUser,clientReady:!!lumenSupabase,qa:qaActive,sessionPending:authSessionPending});
  if(lumenUser&&!qaActive)preserveUnsyncedCloudProgress("cloud-not-ready");return false
 }
 cloudProfileBusy=true;
 const savingUserId=lumenUser.id;
 const savingCloudClient=lumenSupabase;
 const sameSavingSession=()=>lumenUser?.id===savingUserId&&lumenSupabase===savingCloudClient&&!authSessionPending&&!qaActive&&cloudProfileReady;
 const current=JSON.parse(JSON.stringify(lumenProgress));
 cloudProfileInFlight=(async()=>{
  try{
   const savedBaseline=await compareAndSwapCloudProfile(savingCloudClient,current,cloudProfileBaseline);
   if(!sameSavingSession())return false;
   cloudProfileBaseline=savedBaseline;
   // Verify the secondary legacy progress table as well as the full profile.
   // Failure must remain observable, not masquerade as successful sync.
   const mirror=await verifyLegacyProgressMirror();
   if(!sameSavingSession())return false;
   if(!mirror.ok){
    cloudProfileFailure={reason:"legacy_mirror",detail:mirror.reason};
    recordCloudDiagnostic("legacy_mirror_failed",{kind:mirror.reason,pending:Number(mirror.pending||0)});
    preserveUnsyncedCloudProgress("legacy-mirror-failed");
    return false;
   }
   cloudProfileFailure=null;
   recordCloudDiagnostic("flush_success",{profileReady:cloudProfileReady,legacyMirrorVerified:true});
   return true;
  }catch(e){
   if(!sameSavingSession())return false;
   cloudProfileFailure={reason:"network"};
   recordCloudDiagnostic("flush_failed",{kind:"write",errorCode:String(e?.code||e?.status||"unknown").slice(0,48),profileReady:cloudProfileReady});
   preserveUnsyncedCloudProgress("save-failed");
   try{
    const remote=await loadVerifiedProfile(savingCloudClient);
    if(!sameSavingSession())return false;
    if(remote && sameCloudProfile(remote,current)){
     // A matching snapshot does not prove that the secondary progress mirror
     // was saved. Apply the same verification as the normal successful path.
     cloudProfileBaseline=remote;
     const mirror=await verifyLegacyProgressMirror();
     if(!sameSavingSession())return false;
     if(!mirror.ok){
      cloudProfileFailure={reason:"legacy_mirror",detail:mirror.reason};
      recordCloudDiagnostic("legacy_mirror_failed",{kind:mirror.reason,pending:Number(mirror.pending||0)});
      preserveUnsyncedCloudProgress("legacy-mirror-failed");
      return false;
     }
     cloudProfileFailure=null;
     recordCloudDiagnostic("flush_success",{profileReady:cloudProfileReady,legacyMirrorVerified:true,recoveredAfterError:true});
     return true;
    }
    if(remote && cloudProfileBaseline && !sameCloudProfile(remote,cloudProfileBaseline)){cloudProfileFailure={reason:"conflict"};recordCloudDiagnostic("flush_conflict",{kind:"version"});preserveUnsyncedCloudProgress("version-conflict")}
   }catch(readError){console.warn("Lumen cloud verification unavailable",readError)}
   console.warn("Lumen cloud save not confirmed; progress must not advance",e);
   return false;
  }finally{
   cloudProfileBusy=false;
   if(cloudProfileDirty){cloudProfileDirty=false;scheduleCloudProfile()}
  }
 })();
 return cloudProfileInFlight;
}
// Secondary durable store when localStorage quota is exhausted. Never deletes older snapshots.
function preserveUnsyncedInIndexedDB(uid,payload){
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==="undefined"){reject(Error("IndexedDB unavailable"));return}
  const request=indexedDB.open("lumen-unsynced-checkpoints",1);
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains("snapshots"))db.createObjectStore("snapshots")};
  request.onerror=()=>reject(request.error||Error("IndexedDB open failed"));
  request.onsuccess=()=>{
   const db=request.result;
   const key=uid+":"+Date.now()+":"+Math.random().toString(36).slice(2);
   let tx;
   try{tx=db.transaction("snapshots","readwrite");tx.objectStore("snapshots").put(payload,key)}
   catch(error){db.close();reject(error);return}
   tx.onerror=()=>{db.close();reject(tx.error||Error("IndexedDB write failed"))};
   tx.onabort=()=>{db.close();reject(tx.error||Error("IndexedDB write aborted"))};
   tx.oncomplete=()=>{
    // Verify the committed record in a separate transaction.
    try{
     const read=db.transaction("snapshots","readonly").objectStore("snapshots").get(key);
     read.onsuccess=()=>{db.close();read.result===payload?resolve(true):reject(Error("IndexedDB verification failed"))};
     read.onerror=()=>{db.close();reject(read.error||Error("IndexedDB verification failed"))};
    }catch(error){db.close();reject(error)}
   };
  };
 })
}
// Preserve unsynced changes independently of the normal cloud authority slot.
// The backup is intentionally never consumed automatically; recovery needs a review.
function preserveUnsyncedCloudProgress(reason){
 // Immutable checkpoints: a previous unsynced victory must not be overwritten
 // just because a later snapshot has the same (or smaller) solved count.
 try{
  const uid=lumenUser?.id;
  if(!uid||qaActive)return false;
  const prefix="lumenUnsyncedCloudBackupV2:"+uid+":";
  const progress=JSON.parse(JSON.stringify(lumenProgress));
  const payload=JSON.stringify({savedAt:new Date().toISOString(),reason,progress});
  const latestKey=prefix+"latest";
  const latest=localStorage.getItem(latestKey);
  if(latest){
   try{
    const prev=JSON.parse(latest);
    if(sameCloudProfile(prev.progress,progress))return true;
   }catch(_){}
  }
  const key=prefix+Date.now()+":"+Math.random().toString(36).slice(2);
  // Write immutable checkpoint first, then update the convenient latest pointer.
  localStorage.setItem(key,payload);
  if(localStorage.getItem(key)!==payload)throw Error("Unsynced checkpoint not verified");
  try{localStorage.setItem(latestKey,payload)}catch(_){}
  recordCloudDiagnostic("outbox_preserved",{verified:true});
  return true;
 }catch(error){
  // Fallback to legacy slot; NEVER prune immutable checkpoints to save space.
  try{
   const key="lumenUnsyncedCloudBackupV1:"+lumenUser?.id;
   if(!localStorage.getItem(key)){
    const value=JSON.stringify({savedAt:new Date().toISOString(),reason,progress:lumenProgress});
    localStorage.setItem(key,value);
    return localStorage.getItem(key)===value;
   }
  }catch(_){}
  // localStorage may be full; keep an independent durable copy in IndexedDB.
  if(error?.name==="QuotaExceededError"&&lumenUser?.id){
   const payload=JSON.stringify({savedAt:new Date().toISOString(),reason,progress:lumenProgress});
   preserveUnsyncedInIndexedDB(lumenUser.id,payload)
    .then(()=>recordCloudDiagnostic("outbox_preserved",{verified:true,store:"indexeddb"}))
    .catch(()=>recordCloudDiagnostic("outbox_preservation_failed",{kind:"quota",store:"indexeddb"}));
   return false; // Async fallback: do not claim success before verification.
  }
  recordCloudDiagnostic("outbox_preservation_failed",{kind:error?.name==="QuotaExceededError"?"quota":"other"});
  console.warn("LUMEN unsynced backup could not be verified",error);
  return false;
 }
}
async function confirmCloudReward(){
 recordCloudDiagnostic("victory_preflight",{profileReady:cloudProfileReady,signedIn:!!lumenUser,clientReady:!!lumenSupabase,qa:qaActive,sessionPending:authSessionPending});
 if(qaActive||!lumenUser)return true;
 if(cloudProfileTimer!==null){clearTimeout(cloudProfileTimer);cloudProfileTimer=null}
 while(!(await flushCloudProfile())){
  const retry=await new Promise(resolve=>{
   const panel=document.createElement("div");
   panel.id="cloudRewardPending";
   panel.setAttribute("role","alertdialog");
   panel.setAttribute("aria-modal","true");
   panel.style.cssText="position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(0,0,0,.8);padding:24px";
   const card=document.createElement("div");
   card.style.cssText="background:#182238;color:white;padding:24px;max-width:420px;border-radius:14px;text-align:center";
   const title=document.createElement("h2");title.textContent="Sauvegarde en attente";
   const copy=document.createElement("p");copy.textContent=cloudProfileFailure?.reason==="conflict"?"Le profil cloud a changé sur le serveur. Tes changements sont conservés sur cet appareil dans une copie de secours. Ne recharge pas : la réconciliation doit être vérifiée.":cloudProfileFailure?.reason==="network"?"La sauvegarde cloud n’a pas pu être confirmée. Une copie locale de secours est conservée. Réessaie quand la connexion revient.":"Le cloud n’est pas encore prêt. La synchronisation est bloquée : ne vide pas les données du navigateur et ne réinstalle pas Lumen avant récupération.";
   const again=document.createElement("button");again.textContent="Réessayer la sauvegarde";again.className="primary";
   if(cloudProfileFailure?.reason==="conflict"||!cloudProfileReady){again.disabled=true;again.title="Un nouvel essai ne résoudra pas le conflit."}
   again.onclick=()=>{panel.remove();resolve(true)};
   const close=document.createElement("button");close.textContent="Conserver ma progression locale";
   close.onclick=()=>{preserveUnsyncedCloudProgress("user-deferred");panel.remove();resolve(false)};
   const diagnostics=document.createElement("button");
   diagnostics.type="button";diagnostics.textContent="Copier le diagnostic";
   diagnostics.onclick=async()=>{
    const report=cloudDiagnosticReport();
    try{await navigator.clipboard.writeText(report);diagnostics.textContent="Diagnostic copié ✓"}
    catch(_){const pre=document.createElement("textarea");pre.readOnly=true;pre.value=report;pre.style.cssText="width:100%;min-height:100px";card.append(pre);pre.select();diagnostics.textContent="Sélectionner puis copier"}
   };
   const exportButton=document.createElement("button");
   exportButton.type="button";exportButton.textContent="Exporter ma sauvegarde";
   exportButton.onclick=async()=>{
    exportButton.disabled=true;
    try{await exportLumenRecoveryBundle();exportButton.textContent="Export demandé — vérifier Téléchargements"}
    catch(error){exportButton.textContent="Export impossible — réessayer";exportButton.disabled=false;console.warn("Lumen recovery export failed",error)}
   };
   recordCloudDiagnostic("victory_dialog",{reason:cloudProfileFailure?.reason||"not_ready",profileReady:cloudProfileReady,retryAllowed:!again.disabled});
   card.append(title,copy,again,close,diagnostics,exportButton);panel.append(card);document.body.append(panel);again.focus();
  });
  if(!retry)return false;
 }
 return true;
}
function scheduleCloudProfile(){
 if(!cloudProfileReady||!lumenUser||qaActive)return;
 if(cloudProfileTimer!==null)clearTimeout(cloudProfileTimer);
 cloudProfileTimer=setTimeout(()=>{cloudProfileTimer=null;flushCloudProfile()},1800);
}
// Reconnect only retries a previously failed write. Never replay arbitrary
// unsynced checkpoints: those require reconciliation against verified cloud.
// A victory saved while offline must be retried even when the full profile
// had no pending dirty snapshot. Only the signed-in session may replay it.
let canonicalOutboxRetryInFlight=false;
async function retryPendingCanonicalOutboxOnReconnect(){
 if(canonicalOutboxRetryInFlight||qaActive||!lumenUser||!lumenSupabase||!cloudProfileReady||cloudProfileBusy||cloudProfileDirty||canonicalActiveQuest)return;
 const userId=lumenUser.id,client=lumenSupabase;
 const sessionValid=()=>lumenUser?.id===userId&&lumenSupabase===client&&!qaActive&&cloudProfileReady;
 let remaining;
 try{remaining=canonicalVictoryOutbox.pending(userId)}catch(error){recordCloudDiagnostic("canonical_outbox_read_failed",{reason:"integrity"});return}
 if(!remaining.length)return;
 canonicalOutboxRetryInFlight=true;
 try{
  const confirmed=await replayCanonicalVictoryOutbox(canonicalVictoryOutbox,userId,
   (questId,reward)=>commitCanonicalVictory(client,questId,reward),{sessionValid});
  if(!sessionValid())return;
  if(confirmed.length){
   recordCloudDiagnostic("canonical_outbox_reconnect_replayed",{count:confirmed.length});
   // Do not overwrite in-memory local progress that could include an unsynced
   // play. Re-run the normal non-destructive hydration on next navigation.
   if(!cloudProfileDirty&&!cloudProfileBusy&&!canonicalActiveQuest)location.reload();
  }
 }catch(error){recordCloudDiagnostic("canonical_outbox_reconnect_failed",{reason:"retry"})}
 finally{canonicalOutboxRetryInFlight=false}
}
function retryPendingCloudWriteOnReconnect(){
 if(qaActive||!lumenUser||!lumenSupabase||!cloudProfileReady)return;
 void retryPendingCanonicalOutboxOnReconnect();
 if(!["network","legacy_mirror"].includes(cloudProfileFailure?.reason))return;
 if(cloudProfileBusy||cloudProfileTimer!==null)return;
 recordCloudDiagnostic("flush_retry_online",{reason:cloudProfileFailure.reason});
 scheduleCloudProfile();
}
window.addEventListener("online",retryPendingCloudWriteOnReconnect);
// Returning to an installed PWA does not necessarily dispatch an online event.
// Retry only the same recoverable errors, once the document is visible and
// the browser reports connectivity. Never attempt a divergent snapshot.
document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible"&&navigator.onLine!==false)
  retryPendingCloudWriteOnReconnect();
});
const {loadLumenProgress,saveLumenProgress}=createLocalPersistence(localStorage,()=>lumenProgress,{progressKey:qaActive?"lumenQaProgressV1":"lumenProgressV1",onSave:scheduleCloudProfile});
const persistenceModel={
get lumenSupabase(){return lumenSupabase},set lumenSupabase(value){lumenSupabase=value},
get lumenEntitlements(){return lumenEntitlements},set lumenEntitlements(value){lumenEntitlements=Array.isArray(value)?value:[]},
get lumenCapabilities(){return lumenCapabilities},set lumenCapabilities(value){lumenCapabilities=Array.isArray(value)?value:[]},
get lumenUser(){return lumenUser},set lumenUser(value){lumenUser=value},
get lumenCloudReady(){return lumenCloudReady},set lumenCloudReady(value){lumenCloudReady=value},
get lumenNickname(){return lumenNickname},set lumenNickname(value){lumenNickname=value},
get lumenProgress(){return lumenProgress},set lumenProgress(value){lumenProgress=value},
get sequentialSolvedCount(){return sequentialSolvedCount},set sequentialSolvedCount(value){sequentialSolvedCount=value},
get levelIndex(){return levelIndex},set levelIndex(value){levelIndex=value},
get navigationLocked(){return !!socialChallenge},
get usedHintThisGame(){return usedHintThisGame},set usedHintThisGame(value){usedHintThisGame=value}
};
const {loadLumenProfile,saveLumenNickname,loadEntitlements,loadInternalCapabilities,cloudSavePuzzle,verifyLegacyProgressMirror,cloudMergeProgress,initLumenCloud,cloudSaveDaily,cloudMergeDaily,cloudMergeHistoricalPerformance,signIn,emailPasswordAuth,setAccountPassword,requestPasswordRecovery,sendEmailOtp,verifyEmailOtp,signOut}=createCloudPersistence(persistenceModel,{activeGameSeconds:(...args)=>activeGameSeconds(...args),campaignQuestCount:()=>playableQuestCount(),exactSkyScoreForSolvedPrefix:(...args)=>exactSkyScoreForSolvedPrefix(...args),saveLumenProgress:(...args)=>saveLumenProgress(...args),refreshJourney:(...args)=>refreshJourney(...args),init:(...args)=>init(...args),onAccountChanged:(event)=>{if(event?.type==="profile"){const input=document.getElementById("nicknameInput");if(input)input.value=lumenNickname}updateAuthUI();if(event?.type==="password_recovery"){const menu=document.getElementById("mobileAuthPopover");if(menu)menu.hidden=false;const password=document.getElementById("setPasswordPanel");if(password)password.hidden=false;document.getElementById("setPasswordValue")?.focus()}},renderDaily:(...args)=>renderDaily(...args),afterAuthCloudSync:async()=>{
 if(qaActive||!lumenUser||!lumenSupabase)return;
 cloudProfileReady=false;cloudProfileBaseline=null;
 let hydrationStage="start";
 try{
  hydrationStage="local_read";
  const original=localStorage.getItem("lumenProgressV1");
  const incoming=original?JSON.parse(original):lumenProgress;
  // First login: create the profile exactly once. An existing cloud profile wins.
  const ownerKey='lumenCloudOwnerId';
  const currentOwner=localStorage.getItem(ownerKey);
  const accountId=lumenUser.id;
  hydrationStage="cloud_restore";
  const existing=await loadVerifiedProfile(lumenSupabase);
  const fresh={...incoming,solved:{},historyBackup:{},badges:{},stars:{},performances:{},noHint:{},xp:0,skyScore:0,shards:3};
  hydrationStage="cloud_initialize";
  let cloud=existing||await initializeCloudProfile(lumenSupabase,currentOwner===accountId?incoming:fresh);
  // Resume verified canonical victory intents before installing the cloud profile.
  // Keep unacknowledged entries on read/write failure; do not replay any other
  // legacy rewards or unknown account's snapshots.
  const hydrationClient=lumenSupabase;
  const sessionValid=()=>lumenUser?.id===accountId&&lumenSupabase===hydrationClient&&!qaActive;
  const recovered=await replayCanonicalVictoryOutbox(canonicalVictoryOutbox,accountId,
   (questId,reward)=>commitCanonicalVictory(hydrationClient,questId,reward),{sessionValid});
  if(!sessionValid())throw Error("Session changée pendant la reprise");
  if(recovered.length){
   cloud=await loadVerifiedProfile(hydrationClient);
   if(!sessionValid()||!cloud)throw Error("Restauration cloud non vérifiée");
   recordCloudDiagnostic("canonical_outbox_replayed",{count:recovered.length});
  }
  const outstanding=canonicalVictoryOutbox.pending(accountId).length;
  if(outstanding)recordCloudDiagnostic("canonical_outbox_pending",{count:outstanding});
  // Daily RPC is authoritative. Restore it BEFORE installing the full cloud snapshot,
  // otherwise a stale daily.dates snapshot erases days fetched during login.
  hydrationStage="daily_rpc";
  const [{data:dailyRows,error:dailyError},{data:engagementRows,error:engagementError}]=await Promise.all([
   lumenSupabase.rpc("lumen_get_daily"),
   lumenSupabase.rpc("lumen_get_engagement")
  ]);
  if(dailyError)throw Error("Daily history unavailable: "+dailyError.message);
  if(engagementError)throw Error("Daily rewards unavailable: "+engagementError.message);
  hydrationStage="daily_reconcile";
  const reconciled=reconcileDailyIntoCloudProfile(cloud,dailyRows,engagementRows);
  if(reconciled.changed){
   hydrationStage="daily_cloud_commit";
   cloud=await compareAndSwapCloudProfile(lumenSupabase,reconciled.profile,cloud);
  }
  hydrationStage="owner_backup";
  // A brand-new browser or an account switch has no authoritative local
  // progress for this account. Preserve its guest/previous-account snapshot,
  // then install the authenticated cloud without comparing different owners.
  const switchingOwner=currentOwner!==accountId;
  const currentLocal=localStorage.getItem("lumenProgressV1");
  if(switchingOwner&&currentLocal){
   const backupKey="lumenBeforeAccountSwitch_"+Date.now();
   localStorage.setItem(backupKey,currentLocal);
   if(localStorage.getItem(backupKey)!==currentLocal)throw Error("Sauvegarde du profil invité non vérifiée");
  }
  hydrationStage="local_reconciliation";
  if(currentLocal&&existing&&!switchingOwner){
   let conflict=false;
   try{conflict=!cloudSafelyCoversLocal(JSON.parse(currentLocal),cloud)}catch{conflict=true}
   if(conflict){
    let resolution=await reconcileDominantLocalProfile(lumenSupabase,localStorage,cloud);
    if(resolution.status==="blocked"&&["missing_cloud_achievements","mutable_balance","mutable_ledger"].includes(resolution.reason)){
     hydrationStage="bidirectional_reconciliation";
     resolution=await reconcileCompatibleCloudProfiles(lumenSupabase,localStorage,cloud);
    }
    recordCloudDiagnostic("hydration_reconciliation",{result:resolution.status,reason:resolution.reason||"none",fields:Array.isArray(resolution.fields)?resolution.fields:[],conflictId:typeof resolution.conflictId==="string"?resolution.conflictId.slice(0,96):null,conflictKeys:Array.isArray(resolution.conflictKeys)?resolution.conflictKeys.filter(k=>typeof k==="string").slice(0,8):[]});
    if(resolution.status==="reconciled"||resolution.status==="cloud_dominant")cloud=resolution.profile;
   }
  }
  // When full reconciliation is blocked, recover only server-verified
  // achievements. The routine backs up the old local snapshot and never
  // overwrites local currencies, daily ledger, or conflicting rewards.
  // This is a partial display recovery, NOT a completed cloud sync.
  if(currentLocal&&existing&&!switchingOwner){
   let covered=false;
   try{covered=cloudSafelyCoversLocal(JSON.parse(localStorage.getItem("lumenProgressV1")),cloud)}catch{}
   if(!covered){
    try{
     const partial=reconcileCloudAchievements(localStorage,cloud);
     if(partial.changed){
      recordCloudDiagnostic("cloud_achievements_locally_recovered",{fullSync:false});
      location.reload();
      return;
     }
    }catch(error){
     recordCloudDiagnostic("cloud_achievements_recovery_blocked",{reason:"conflicting_rewards_or_storage"});
    }
   }
  }
  // Achievements may be recovered while balances or immutable reward
  // histories still disagree. Never attempt the unsafe full replacement,
  // and do not report this expected protection as an auth failure.
  if(currentLocal&&existing&&!switchingOwner){
   let fullyCovered=false;
   try{fullyCovered=cloudSafelyCoversLocal(JSON.parse(localStorage.getItem("lumenProgressV1")),cloud)}catch{}
   if(!fullyCovered){
    cloudProfileFailure={reason:"partial_reconciliation",detail:"cloud_local_divergence"};
    recordCloudDiagnostic("hydration_partial_reconciliation_pending",{profileReady:false});
    renderDaily();
    return;
   }
  }
  hydrationStage="local_install";
  let changed;
  if(switchingOwner){
   // The previous local state has been backed up and verified above.
   // Do not let a different owner (or anonymous starter state) block login.
   if(currentLocal!==null)localStorage.removeItem("lumenProgressV1");
   try{
    changed=installCloudProfileLocally(localStorage,cloud);
    localStorage.setItem(ownerKey,accountId);
    if(localStorage.getItem(ownerKey)!==accountId)throw Error("Propriétaire cloud local non vérifié");
   }catch(error){
    if(currentLocal!==null&&localStorage.getItem("lumenProgressV1")===null)
     localStorage.setItem("lumenProgressV1",currentLocal);
    throw error;
   }
  }else changed=installCloudProfileLocally(localStorage,cloud);
  cloudProfileBaseline=cloud;
  if(changed==="memory_only"){
   // Cloud is verified; a full localStorage must not deadlock signed-in play.
   // The authoritative cloud snapshot is installed in memory without reload.
   lumenProgress=structuredClone(cloud);
   recordCloudDiagnostic("hydration_local_quota_bypass",{cloudVerified:true});
  }else if(changed){recordCloudDiagnostic("hydration_reload",{stage:"local_install"});location.reload();return}
  cloudProfileReady=true;
  // Do not claim hydration is fully synchronized until the quest mirror is
  // repaired and read back. Preserve the full profile on partial failure.
  const mirror=await verifyLegacyProgressMirror();
  if(!mirror.ok){
   recordCloudDiagnostic("legacy_mirror_failed",{kind:mirror.reason,pending:Number(mirror.pending||0)});
   preserveUnsyncedCloudProgress("legacy-mirror-failed");
   cloudProfileFailure={reason:"legacy_mirror",detail:mirror.reason};
  }else recordCloudDiagnostic("legacy_mirror_verified",{count:mirror.count});
  recordCloudDiagnostic("hydration_ready",{profileReady:true,legacyMirrorVerified:mirror.ok});
  renderDaily();
  maybeShowStreakLoss();
  const gate=document.getElementById("accountOptin");if(gate){const wasVisible=!gate.hidden;gate.hidden=true;if(wasVisible)showAccountSavedConfirmation()}
 }catch(e){recordCloudDiagnostic("hydration_failed",{errorCode:String(e?.code||e?.status||"unknown").slice(0,48),errorName:String(e?.name||"unknown").slice(0,48),stage:String(e?.stage||hydrationStage).slice(0,48),reason:e?.message?.startsWith("Profil local divergent")?"local_divergence":e?.message?.startsWith("Daily history unavailable")?"daily_history":e?.message?.startsWith("Daily rewards unavailable")?"daily_rewards":e?.message?.startsWith("Impossible de restaurer le profil")?"cloud_restore":e?.message?.startsWith("Sauvegarde cloud impossible")?"cloud_cas":"other",kind:e?.code==="LOCAL_STORAGE_QUOTA"||e?.name==="QuotaExceededError"||e?.code===22?"local_quota":"other"});console.warn("Lumen cloud-first auth synchronization failed; progress locked",e)}
},holdLegacyMergeForFullRestore:async()=>true},{setTimeout,console,qaMode});
let skipFirstGridTutorial=false;
try{skipFirstGridTutorial=localStorage.getItem(qaKey('lumenSkipFirstGridTutorial'))==='1'}catch(_){}
function skipFirstGridGuidance(){
 if(levelIndex!==0||socialChallenge)return;
 skipFirstGridTutorial=true;
 try{localStorage.setItem(qaKey('lumenSkipFirstGridTutorial'),'1')}catch(_){}
 learningTip=null;
 learningIntroStep=LEARNING_INTRO.length;
 updateScriptedLearning();
 configureLearningMode();
 render();
}
function tutorialCompletedProof(){
 try{if(localStorage.getItem(qaKey("lumenTutorialCompletedV1"))==="1")return true}catch(_){}
 return !!(lumenProgress?.solved?.[0]&&lumenProgress?.solved?.[1]);
}
function markTutorialCompleted(){
 try{localStorage.setItem(qaKey("lumenTutorialCompletedV1"),"1")}catch(_){}
}
function skipTutorialReplay(){
 if(learningReplayActive()&&tutorialCompletedProof()){finishLearningReplay();return}
 skipFirstGridGuidance();
}
const {renderTutorial,openTutorial,closeTutorial,setupTutorial}=createTutorial(()=>levelIndex<=1,{tutorialSeenKey:qaActive?"lumenQaTutorialSeen":"lumenTutorialSeen",canSkip:()=>levelIndex===0||tutorialCompletedProof()&&!qaFresh,onSkip:skipTutorialReplay});
let authSessionPending=true;
let lumenSupabase=null,lumenUser=null,lumenCloudReady=false,lumenEntitlements=[],lumenCapabilities=[];
try{lumenSupabase=window.supabase.createClient(LUMEN_SUPABASE_URL,LUMEN_SUPABASE_KEY)}catch(e){console.warn("LUMEN cloud unavailable",e)}
let lumenNickname="";

let accountOfferSignInPending=false;
let accountEmailMode="signup";
let accountOfferResumeNext=false;
function accountOfferKey(name){return qaKey("lumenAccountOffer"+name)}
function showAccountSavedConfirmation(){const toast=document.getElementById("accountSavedToast");if(!toast)return;toast.hidden=false;setTimeout(()=>{toast.hidden=true},2200)}
function accountOfferMilestone(){return solvedCount()>=5?5:0}
function accountRequired(){
 if(authSessionPending||qaActive||socialChallenge||lumenUser)return false;
 const next=Number(localStorage.getItem(accountOfferKey("NextMilestone"))||5);
 return solvedCount()>=next;
}
function maybeOfferAccount(){
 if(!accountRequired())return false;
 const box=document.getElementById("accountOptin");
 if(!box||!box.hidden)return false;
 box.hidden=false;
 trackLumenEvent("account_offer_shown",null,{milestone:solvedCount(),source:"quest_milestone",qa:qaActive});
 return true;
}
function dismissAccountOffer(){
 const box=document.getElementById("accountOptin");if(!box)return;
 box.hidden=true;
 localStorage.setItem(accountOfferKey("NextMilestone"),String(solvedCount()<12?12:999999));
 trackLumenEvent("account_offer_dismissed",null,{milestone:solvedCount(),source:"quest_milestone",qa:qaActive});
 if(accountOfferResumeNext){accountOfferResumeNext=false;document.getElementById("successNew")?.click()}
}
async function acceptAccountOffer(){const box=document.getElementById("accountOptin");if(box)box.hidden=true;const milestone=accountOfferMilestone();trackLumenEvent("account_offer_accept",null,{milestone,source:"constellation_complete",qa:qaActive});if(!lumenSupabase){trackLumenEvent("account_signin_failure",null,{milestone,reason:"cloud_unavailable",qa:qaActive});return}accountOfferSignInPending=true;try{sessionStorage.setItem("lumenAccountOfferSignInPending","1")}catch(_){}const result=await signIn(new URL("/", location.origin).toString());if(!result.ok){accountOfferSignInPending=false;try{sessionStorage.removeItem("lumenAccountOfferSignInPending")}catch(_){}trackLumenEvent("account_signin_failure",null,{milestone,reason:result.reason||"oauth",qa:qaActive})}}
function openEmailAccountOffer(mode="signup"){
 accountEmailMode=mode==="login"?"login":"signup";
 const login=accountEmailMode==="login";
 const offer=document.getElementById("accountOptin");if(offer)offer.hidden=false;
 const title=document.getElementById("accountOptinTitle");if(title)title.textContent=login?"Retrouve ton aventure":"Garde tes étoiles avec toi ✨";
 const description=document.getElementById("accountOptinDescription");if(description)description.textContent=login?"Connecte-toi pour retrouver ta progression, tes étoiles et tes constellations.":"Crée un compte pour retrouver ton aventure sur tous tes appareils. Tu peux aussi continuer sans compte : ta progression restera sur cet appareil.";
 const password=document.getElementById("accountPassword"),submit=document.getElementById("accountPasswordSubmit");
 if(password){password.autocomplete=login?"current-password":"new-password";password.minLength=login?1:12;}
 if(submit)submit.textContent=login?"Me connecter →":"Créer mon compte →";
 const legacy=document.getElementById("accountLegacyOtp");if(legacy)legacy.hidden=!login;
 const recover=document.getElementById("accountRecovery");if(recover)recover.hidden=!login;
 const signup=document.getElementById("accountSignupTab"),switcher=document.getElementById("accountAuthSwitch");
 if(signup)signup.setAttribute("aria-pressed",String(!login));
 if(switcher)switcher.setAttribute("aria-pressed",String(login));
 const status=document.getElementById("accountEmailStatus");if(status)status.textContent="";
 const send=document.getElementById("accountEmailSend");if(send)send.hidden=true;
 const otp=document.getElementById("accountOtpStep");if(otp)otp.hidden=true;
 document.getElementById("accountEmail")?.focus();
 trackLumenEvent("account_email_selected",null,{milestone:5,source:"quest_5_gate",qa:qaActive});
}
async function submitAccountPassword(){
 const email=document.getElementById("accountEmail")?.value;
 const password=document.getElementById("accountPassword")?.value;
 const status=document.getElementById("accountEmailStatus");
 if(status)status.textContent="Connexion en cours…";
 const result=await emailPasswordAuth(email,password,new URL("/",location.origin).toString(),{createUser:accountEmailMode==="signup"});
 if(!result.ok){
  if(status)status.textContent=result.reason==="email"?"Entre une adresse email valide.":result.reason==="password"?"Utilise un mot de passe d'au moins 12 caractères.":accountEmailMode==="login"?"Connexion impossible. Vérifie le mot de passe, ou crée un compte si cette adresse est nouvelle.":"Inscription impossible. Vérifie cette adresse ou essaie de te connecter.";
  return;
 }
 if(result.pendingConfirmation){
  if(status)status.textContent="Vérifie ton email pour confirmer ton inscription.";
 }else{
  accountOfferSignInPending=true;
  try{sessionStorage.setItem("lumenAccountOfferSignInPending","1")}catch(_){}
  if(status)status.textContent="Compte connecté ✓";
 }
}
async function recoverAccountPassword(){
 const email=document.getElementById("accountEmail")?.value;
 const status=document.getElementById("accountEmailStatus");
 const result=await requestPasswordRecovery(email);
 if(status)status.textContent=result.ok?"Si cette adresse est enregistrée, un lien de récupération a été envoyé.":result.reason==="email"?"Entre une adresse email valide.":"Récupération indisponible pour le moment.";
}
function showLegacyOtp(){
 const sender=document.getElementById("accountEmailSend"),step=document.getElementById("accountOtpStep");
 if(sender)sender.hidden=false;if(step)step.hidden=true;
 const status=document.getElementById("accountEmailStatus");
 if(status)status.textContent="Pour ton ancien compte OTP, reçois un code puis définis ton mot de passe une fois connecté.";
}
async function requestAccountEmailOtp(){const email=document.getElementById("accountEmail")?.value,status=document.getElementById("accountEmailStatus");if(status)status.textContent="Envoi du code…";const result=await sendEmailOtp(email,new URL("/",location.origin).toString(),{createUser:accountEmailMode==="signup"});if(!result.ok){if(status)status.textContent=result.reason==="email"?"Entre une adresse email valide.":"Impossible d’envoyer le code. Réessaie.";trackLumenEvent("account_signin_failure",null,{milestone:5,method:"email_otp",stage:"send",qa:qaActive});return}accountOfferSignInPending=true;try{sessionStorage.setItem("lumenAccountOfferSignInPending","1");sessionStorage.setItem("lumenAccountOtpEmail",result.email)}catch(_){}const step=document.getElementById("accountOtpStep");if(step)step.hidden=false;if(status)status.textContent="Code envoyé. Vérifie tes emails.";document.getElementById("accountOtp")?.focus();trackLumenEvent("account_otp_sent",null,{milestone:5,qa:qaActive})}
async function confirmAccountEmailOtp(){const status=document.getElementById("accountEmailStatus"),token=document.getElementById("accountOtp")?.value;let email=document.getElementById("accountEmail")?.value;try{email=sessionStorage.getItem("lumenAccountOtpEmail")||email}catch(_){}if(status)status.textContent="Vérification…";const result=await verifyEmailOtp(email,token);if(!result.ok){if(status)status.textContent=result.reason==="otp"?"Entre le code reçu par email (6 à 10 chiffres).":"Code incorrect ou expiré. Réessaie.";trackLumenEvent("account_signin_failure",null,{milestone:5,method:"email_otp",stage:"verify",qa:qaActive});return}if(status)status.textContent="Compte connecté ✓";trackLumenEvent("account_otp_verified",null,{milestone:5,qa:qaActive})}
// Bind the two exit actions before asynchronous game startup; both must always close the dialog.
function setupAccountOfferDismiss(){
 const close=document.getElementById("accountOptinClose"),later=document.getElementById("accountOptinLater");
 for(const button of [close,later])if(button)button.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();dismissAccountOffer()},{capture:true});
}
setupAccountOfferDismiss();
function openAccountFromMenu(){const menu=document.getElementById("mobileAuthPopover");if(menu)menu.hidden=true;openEmailAccountOffer("signup")} 
async function saveExistingAccountPassword(){
 const password=document.getElementById("setPasswordValue")?.value;
 const status=document.getElementById("setPasswordStatus");
 const result=await setAccountPassword(password);
 if(status)status.textContent=result.ok?"Mot de passe défini ✓":result.reason==="password"?"Utilise au moins 12 caractères.":"Impossible de modifier le mot de passe. Une réauthentification peut être nécessaire.";
 if(result.ok){const input=document.getElementById("setPasswordValue");if(input)input.value="";}
}
function syncMobileAuthUI(){
 syncAdministrationMenu();
 const status=document.getElementById("mobileAuthStatus"),action=document.getElementById("mobileAuthAction"),icon=document.getElementById("mobileAccount");
 if(!status||!action||!icon)return;
 const signedIn=Boolean(lumenUser);
 const show=(id,visible)=>{const el=document.getElementById(id);if(el)el.hidden=!visible};
 if(!signedIn){const editor=document.getElementById("accountProfileEditor");if(editor)editor.dataset.open="false"}
 show("editAccountProfile",signedIn);
 show("accountProfileEditor",signedIn&&document.getElementById("accountProfileEditor")?.dataset.open==="true");
 show("guestSaveExplainer",!signedIn);
 status.textContent=signedIn?(lumenNickname||"Progression synchronisée"):"Progression enregistrée sur cet appareil";
 action.textContent=signedIn?"Déconnexion":"Se connecter / Créer un compte";
 icon.textContent=signedIn?"●":"♙";
 icon.setAttribute("aria-label",signedIn?"Compte connecté":"Compte invité");
 action.disabled=!signedIn&&!lumenSupabase;
 action.title=action.disabled?"Connexion momentanément indisponible":"";
}

function hasInternalCapability(name){return lumenCapabilities.some(x=>(typeof x==="string"?x:x?.capability)===name)}
// Administrative catalogue access is transient: never persist it as a purchase or player entitlement.
function adventureAccessEntitlements(){
 if(!lumenUser||qaActive||!(hasInternalCapability("all_adventures_access")))return lumenEntitlements;
 return [...new Set([...lumenEntitlements,...CONTENT_PACKS.map(pack=>pack.id)])];
}
function unlimitedShardsEnabled(){return hasInternalCapability("unlimited_shards")&&localStorage.getItem("lumenAdminUnlimitedShards")==="1"}
function syncAdministrationMenu(){
 const entry=document.getElementById("administrationEntry");
 const panel=document.getElementById("administrationPanel");
 const toggle=document.getElementById("administrationToggle");
 const qaTools=document.getElementById("qaAccountTools");
 const authorized=hasInternalCapability("unlimited_shards")||hasInternalCapability("analytics_cockpit");
 // The standard account menu is identical for all players; only authorized
 // accounts get the Administration submenu. QA retains its exit controls.
 const visible=qaActive||authorized;
 if(entry)entry.hidden=!visible;
 if(qaTools)qaTools.hidden=!(qaActive||authorized);
 if(!visible&&panel)panel.hidden=true;
 if(toggle)toggle.setAttribute("aria-expanded",String(visible&&!!panel&&!panel.hidden));
}
function updateAdminTools(){
 syncAdministrationMenu();
 const box=document.getElementById("adminTools"),toggle=document.getElementById("adminUnlimitedShards"),cockpit=document.getElementById("adminCockpitOpen"),qaTools=document.getElementById("qaAccountTools");
 if(!box||!toggle)return;
 const shards=hasInternalCapability("unlimited_shards"),analytics=hasInternalCapability("analytics_cockpit");
 box.hidden=!(shards||analytics||qaActive);
 if(qaTools)qaTools.hidden=!(shards||analytics||qaActive);
 toggle.parentElement.hidden=!shards;toggle.checked=shards&&unlimitedShardsEnabled();
 if(cockpit)cockpit.hidden=!analytics;
}
function updateAuthUI(){
 authSessionPending=false;
 const initialControls=document.getElementById("authSessionControls");if(initialControls)initialControls.hidden=false;
 const wasOfferPending=accountOfferSignInPending||(()=>{try{return sessionStorage.getItem("lumenAccountOfferSignInPending")==="1"}catch(_){return false}})();
 const u=document.getElementById("authUser"),login=document.getElementById("authLogin"),logout=document.getElementById("authLogout");
 if(!u||!login||!logout)return;
 if(lumenUser){
   u.textContent=lumenNickname||"Progression synchronisée";
   login.hidden=true; logout.hidden=false;
 }else{
   u.textContent="Progression enregistrée sur cet appareil";
   login.hidden=false; logout.hidden=true;
 }
 syncMobileAuthUI();updateAdminTools();
 if(!lumenUser&&accountRequired())maybeOfferAccount();
 if(lumenUser&&wasOfferPending){accountOfferSignInPending=false;try{sessionStorage.removeItem("lumenAccountOfferSignInPending")}catch(_){}trackLumenEvent("account_signin_success",null,{source:"account_offer",qa:qaActive});const box=document.getElementById("accountOptin");if(box)box.hidden=true}
}
function setupQaMode(){
 if(!qaActive)return;
 document.body.classList.add("qa-mode");
 const banner=document.getElementById("qaBanner"),exit=document.getElementById("qaExit");
 if(banner)banner.hidden=false;
 if(exit)exit.onclick=()=>{
   const url=new URL(location.href);url.searchParams.delete("qa");location.href=url.pathname+url.search+url.hash;
 };
}
function setupRulesHelp(){
 const open=document.getElementById("tutorialHelp"),modal=document.getElementById("rulesModal"),close=document.getElementById("closeRulesModal"),replay=document.getElementById("replayLearning");
 if(!open||!modal||!close)return;
 const hide=(restoreFocus=true)=>{modal.hidden=true;if(restoreFocus)open.focus()};
 open.onclick=()=>{modal.hidden=false;close.focus()};
 close.onclick=()=>hide();
 modal.onclick=e=>{if(e.target===modal)hide()};
 modal.addEventListener("keydown",e=>{if(e.key==="Escape")hide()});
 if(replay)replay.onclick=()=>{hide(false);startLearningReplay()};
}
setupRulesHelp();
function setupDailyInfo(){
 const btn=document.getElementById("mobileStreak"),pop=document.getElementById("dailyInfoPopover"),auth=document.getElementById("mobileAuthPopover");
 if(!btn||!pop)return;
 btn.onclick=(e)=>{e.stopPropagation();if(auth)auth.hidden=true;pop.hidden=!pop.hidden};
 pop.onclick=(e)=>e.stopPropagation();
 document.addEventListener("click",()=>{if(!pop.hidden)pop.hidden=true});
}
function setupMobileAuth(){
 const menu=document.getElementById("mobileAuthPopover"),account=document.getElementById("mobileAccount"),action=document.getElementById("mobileAuthAction");
 if(!menu||!account||!action)return;
 account.onclick=(e)=>{e.stopPropagation();const d=document.getElementById("dailyInfoPopover");if(d)d.hidden=true;menu.hidden=!menu.hidden};
 menu.onclick=(e)=>e.stopPropagation();
 const editor=document.getElementById("accountProfileEditor");
 const edit=document.getElementById("editAccountProfile");if(edit)edit.onclick=()=>{if(!lumenUser||!editor)return;editor.dataset.open="true";syncMobileAuthUI();document.getElementById("nicknameInput")?.focus()};
 const closeProfile=document.getElementById("closeAccountProfile");if(closeProfile)closeProfile.onclick=()=>{if(!editor)return;editor.dataset.open="false";syncMobileAuthUI()};
 syncAdministrationMenu();
 const adminToggle=document.getElementById("administrationToggle");
 if(adminToggle)adminToggle.onclick=()=>{
  syncAdministrationMenu();
  const entry=document.getElementById("administrationEntry"),panel=document.getElementById("administrationPanel");
  if(!entry||entry.hidden||!panel)return;
  panel.hidden=!panel.hidden;
  adminToggle.setAttribute("aria-expanded",String(!panel.hidden));
 };
 document.addEventListener("click",()=>{if(!menu.hidden)menu.hidden=true});
 action.onclick=async()=>{
   menu.hidden=true;
   if(!lumenSupabase)return;
   if(lumenUser){await signOut();return}
   openEmailAccountOffer("signup");
 };
 const qaSwitch=document.getElementById("qaAccountSwitch"),qaReset=document.getElementById("qaAccountReset");
 const adminUnlimited=document.getElementById("adminUnlimitedShards");
 if(adminUnlimited)adminUnlimited.onchange=()=>{if(!hasInternalCapability("unlimited_shards")){adminUnlimited.checked=false;return}localStorage.setItem("lumenAdminUnlimitedShards",adminUnlimited.checked?"1":"0");updateHintButton();updateVerifyButton();showRewardToast(adminUnlimited.checked?"Mode test : Éclats illimités":"Mode test : économie normale")};
 if(qaSwitch){
   qaSwitch.textContent=qaActive?"Revenir à mon profil réel":"Tester comme nouveau joueur";
   qaSwitch.onclick=()=>{
     const url=new URL(location.href);
     if(qaActive){url.searchParams.delete("qa");url.searchParams.delete("qaFresh");}else{url.searchParams.set("qa","new");url.searchParams.set("qaFresh","1");}
     location.href=url.pathname+url.search+url.hash;
   };
 }
 if(qaReset){
   qaReset.hidden=!qaActive;
   qaReset.onclick=()=>{
     if(!confirm("Réinitialiser toute la progression de test QA et recommencer comme un nouveau joueur ?"))return;
     Object.keys(localStorage).filter(key=>key.startsWith("lumenQa")).forEach(key=>localStorage.removeItem(key));
     const url=new URL(location.href);url.searchParams.set("qa","new");location.href=url.pathname+url.search+url.hash;
   };
 }
}

const {lumenAnonymousId,lumenSessionId,trackLumenEvent,captureReferral}=createAnalytics(()=>lumenSupabase,{localStorage,crypto,location,console,qaMode});
function currentAttemptAnalytics(extra={}){
 const attempt=attemptEngine.snapshot(),constellationIndex=chapterForGrid(levelIndex),constellation=CONSTELLATIONS[constellationIndex],prior=lumenProgress.performances?.[levelIndex]||{};
 return attemptAnalyticsProperties({
  attempt,questIndex:levelIndex,gridSize:n,constellationIndex,constellationName:constellation?.name||null,
  solvedCount:solvedCount(),questAttemptNumber:(Number(prior.attempts)||0)+1,
  guidedEnabled:guidedErrorsEnabled(),autoMarkingEnabled:!!document.getElementById("autoCross")?.checked
 },extra);
}
function trackAttemptEvent(name,extra={}){return trackLumenEvent(name,levelIndex+1,currentAttemptAnalytics(extra))}

let lastTrackedPuzzle=null;

const appVersion=()=>document.querySelector('meta[name="lumen-build"]')?.content||document.getElementById("lumenVersion")?.textContent||"unknown";
const analyticsContext=()=>({app_version:appVersion(),device:innerWidth<=760?"mobile":"desktop",standalone:!!(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)});
trackLumenEvent("session_start",null,analyticsContext());
function lumenIsStandalone(){
 const display=window.matchMedia&&["standalone","fullscreen","minimal-ui"].some(mode=>window.matchMedia("(display-mode: "+mode+")").matches);
 return !!(display||navigator.standalone||document.referrer.startsWith("android-app://")||window.LUMEN_NATIVE_APP===true);
}
async function lumenAlreadyInstalled(){
 if(lumenIsStandalone()||localStorage.getItem(qaKey("lumenInstalled"))==="1")return true;
 // Android Chrome can report installed related apps once a future Play package
 // is declared in manifest.related_applications. No package ID is guessed here.
 if(typeof navigator.getInstalledRelatedApps==="function"){
  try{const related=await navigator.getInstalledRelatedApps();if(related.some(app=>app.platform==="play"||app.platform==="webapp"))return true}catch(e){console.info("Related apps lookup unavailable",e)}
 }
 return false;
}
let lumenInstallPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();lumenInstallPrompt=e});
window.addEventListener("appinstalled",()=>{localStorage.setItem(qaKey("lumenInstalled"),"1");localStorage.removeItem(qaKey("lumenInstallLater"));document.getElementById("installOptin")?.setAttribute("hidden","");trackLumenEvent("pwa_installed")});
async function maybeOfferInstall(){
 // Do not disrupt the 1-11 onboarding, the account gate, or other modals.
 if(solvedCount()<12||accountRequired()||await lumenAlreadyInstalled())return;
 if(["accountOptin","badgeUnlockOverlay","autoCrossUnlockOverlay","autonomyOverlay","tutorialOverlay","skyReveal","successOverlay","pushOptin"].some(id=>{const el=document.getElementById(id);return el&&!el.hidden&&getComputedStyle(el).display!=="none"}))return;
 const last=Number(localStorage.getItem(qaKey("lumenInstallLater"))||0);
 if(last&&Date.now()-last<7*86400000)return;
 const box=document.getElementById("installOptin"),copy=document.getElementById("installOptinCopy"),btn=document.getElementById("installEnable");
 if(!box||!copy||!btn)return;
 const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
 // Chromium browsers without an install prompt should not display a dead CTA.
 if(!ios&&!lumenInstallPrompt)return;
 if(ios&&!lumenInstallPrompt){copy.textContent="Pour retrouver LUMEN facilement : touche Partager puis « Sur l’écran d’accueil ».";btn.textContent="J’ai compris"}
 else{copy.textContent="Ajoute LUMEN à ton écran d’accueil pour retrouver ton ciel en un geste.";btn.textContent="Installer LUMEN"}
 box.hidden=false;trackLumenEvent("pwa_install_offer",null,{ios,qa:qaActive});
}

async function installLumen(){const box=document.getElementById("installOptin"),ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if(ios&&!lumenInstallPrompt){box.hidden=true;localStorage.setItem(qaKey("lumenInstallLater"),String(Date.now()));return}if(!lumenInstallPrompt){box.hidden=true;return}const p=lumenInstallPrompt;lumenInstallPrompt=null;await p.prompt();const choice=await p.userChoice;trackLumenEvent("pwa_install_choice",null,{outcome:choice.outcome,qa:qaActive});box.hidden=true;if(choice.outcome==="dismissed")localStorage.setItem(qaKey("lumenInstallLater"),String(Date.now()))}
function lumenReferralCode(){return lumenUser?.id?("u"+lumenUser.id.replace(/-/g,"").slice(0,12)):("a"+lumenAnonymousId.replace(/-/g,"").slice(0,12))}
function lumenShareUrl(){const u=new URL(location.origin+location.pathname);u.searchParams.set("ref",lumenReferralCode());return u.toString()}
function showShareToast(t){let e=document.createElement("div");e.className="share-toast";e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),1800)}
function successAchievement(){
 const canonicalQuest=canonicalActiveQuest??canonicalQuestForLegacy(levelIndex);
 const canonicalNumber=canonicalQuest?.ordinal??levelIndex+1;
 const generated=generatedQuestProgress(levelIndex);let ch=generated?{name:generated.constellationLabel}:CONSTELLATIONS[chapterForGrid(levelIndex)],legacyRange=generated?{quests:mapConstellationRange(24+Math.floor((levelIndex-196)/10)).quests,count:generated.total}:constellationGridRange(chapterForGrid(levelIndex));
 const constellationQuests=canonicalQuest?canonicalQuestList().filter(q=>q.constellationId===canonicalQuest.constellationId):null;
 const range=constellationQuests?{count:constellationQuests.length}:legacyRange;
 const pos=canonicalQuest?.position??Math.max(1,legacyRange.quests.indexOf(levelIndex)+1);
 const run=performanceRun(levelIndex),secs=activeGameSeconds();
 const {completed:solved,total:availableQuests}=unlockedAdventureProgress(lumenProgress,lumenEntitlements,attemptEngine.snapshot());
 const canonicalLabel=canonicalQuest?CONTENT_CONSTELLATIONS.find(x=>x.id===canonicalQuest.constellationId)?.label:null;
  if(canonicalLabel)ch={name:canonicalLabel};
  let kicker="QUÊTE "+canonicalNumber+" ACCOMPLIE",main=(ch?.name||"Constellation")+" · "+pos+"/"+range.count+" quêtes",detail=solved+"/"+availableQuests+" quêtes accomplies";
 const milestone=generated?null:milestoneFor(levelIndex);
 if(milestone?.kind==="boss"){kicker="CONSTELLATION COMPLÉTÉE";main=ch.name;detail=solved+"/"+campaignQuestCount()+" quêtes accomplies · "+skyStarsEarned()+" étoiles allumées"}
 else if(run.qualifying&&run.mastery){kicker="MAÎTRISE";main="Rapide, autonome et sans erreur";detail=(ch?.name||"Constellation")+" · Quête "+canonicalNumber+" · "+formatDuration(secs)}
 else if(run.qualifying&&run.noError){kicker="SANS ERREUR";main=(ch?.name||"Constellation")+" · Quête "+canonicalNumber;detail=formatDuration(secs)+" · résolution propre"}
 else if(run.qualifying&&run.speed){kicker="RAPIDITÉ";main="Quête "+canonicalNumber+" en "+formatDuration(secs);detail=(ch?.name||"Constellation")}
 else if(run.qualifying&&run.autonomy){kicker="AUTONOMIE";main=(ch?.name||"Constellation")+" · Quête "+canonicalNumber;detail=formatDuration(secs)+" · sans aide"}
 return {kicker,main,detail,ch,pos,total:range.count,solved,run,secs,canonicalNumber};
}
function renderSuccessAchievement(){
 const a=successAchievement(),k=document.getElementById("successAchievementKicker"),m=document.getElementById("successAchievementMain"),d=document.getElementById("successAchievementDetail");
 if(k)k.textContent=a.kicker;if(m)m.textContent=a.main;if(d)d.textContent=a.detail;
}

function shareCardCanvas(a){
 const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;const x=canvas.getContext("2d"),cx=540;
 const bg=x.createLinearGradient(0,0,0,1350);bg.addColorStop(0,"#07111d");bg.addColorStop(1,"#10233a");x.fillStyle=bg;x.fillRect(0,0,1080,1350);
 // deterministic star field
 x.fillStyle="#dffaff";for(let i=0;i<70;i++){const sx=(i*173+71)%1040+20,sy=(i*257+53)%1280+20,r=i%9===0?3:1.5;x.globalAlpha=.25+(i%5)*.12;x.beginPath();x.arc(sx,sy,r,0,Math.PI*2);x.fill()}x.globalAlpha=1;
 x.textAlign="center";x.fillStyle="#68e7ff";x.font="900 52px Arial";x.fillText("L U M E N",cx,125);
 x.fillStyle="#ffe3a1";x.shadowColor="rgba(255,210,100,.8)";x.shadowBlur=25;x.font="900 120px Arial";x.fillText("★",cx,300);x.shadowBlur=0;
 x.fillStyle="#68e7ff";x.font="900 30px Arial";x.fillText(a.kicker,cx,410);
 x.fillStyle="#f2fbff";x.font="900 58px Arial";wrapCanvasText(x,a.main,cx,495,900,70);
 x.fillStyle="#a9bfd0";x.font="700 30px Arial";wrapCanvasText(x,a.detail,cx,660,900,42);
 x.strokeStyle="rgba(104,231,255,.35)";x.lineWidth=2;x.strokeRect(105,790,870,210);
 x.fillStyle="#f2fbff";x.font="900 44px Arial";x.fillText("Quête "+(a.canonicalNumber??levelIndex+1)+" / "+campaignQuestCount(),cx,860);
 x.fillStyle="#68e7ff";x.font="800 32px Arial";x.fillText((a.ch?.name||"Constellation")+" · "+a.pos+"/"+a.total,cx,920);
 x.fillStyle="#a9bfd0";x.font="700 28px Arial";x.fillText("◷ "+formatDuration(a.secs)+(a.run.noHint?"   ·   Sans indice":""),cx,970);
 x.fillStyle="#eefaff";x.font="800 32px Arial";x.fillText("Peux-tu rallumer le ciel ?",cx,1120);
 x.fillStyle="#7891a5";x.font="700 24px Arial";x.fillText(location.host,cx,1190);
 return canvas;
}
function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight){const words=String(text).split(" ");let line="",yy=y;for(const w of words){const test=line?line+" "+w:w;if(ctx.measureText(test).width>maxWidth&&line){ctx.fillText(line,x,yy);line=w;yy+=lineHeight}else line=test}if(line)ctx.fillText(line,x,yy)}
async function shareLumenResult(){
 const a=successAchievement(),url=lumenShareUrl(),text="✦ LUMEN · "+a.kicker+"\n"+a.main+"\n"+a.detail+"\n\nPeux-tu rallumer le ciel ?";
 let method="copy";
 try{
  const canvas=shareCardCanvas(a),blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png")),file=blob?new File([blob],"lumen-quete-"+(levelIndex+1)+".png",{type:"image/png"}):null;
  if(navigator.share&&file&&navigator.canShare?.({files:[file]})){await navigator.share({title:"Ma réussite LUMEN",text,url,files:[file]});method="native_image"}
  else if(navigator.share){await navigator.share({title:"Ma réussite LUMEN",text,url});method="native"}
  else{await navigator.clipboard.writeText(text+"\n"+url);showShareToast("Résultat copié — prêt à partager")}
 }catch(err){if(err?.name==="AbortError")return;try{await navigator.clipboard.writeText(text+"\n"+url);showShareToast("Résultat copié — prêt à partager")}catch(_){}}
 trackLumenEvent("result_shared",levelIndex+1,{method,ref:lumenReferralCode(),achievement:a.kicker});
}
captureReferral();

let lumenProgress=loadLumenProgress(),usedHintThisGame=false,questStarted=true,questFailed=false;
// A canonical-only quest is never mapped to an old numeric save index.
let canonicalActiveQuest=null;if(!lumenProgress.xp)lumenProgress.xp=0;if(!lumenProgress.challenges)lumenProgress.challenges={};if(!lumenProgress.stars)lumenProgress.stars={};if(!Number.isFinite(lumenProgress.shards))lumenProgress.shards=3;if(!lumenProgress.performances)lumenProgress.performances={};
if(!lumenProgress.daily)lumenProgress.daily={dates:{},rewards:{}};if(!Number.isFinite(lumenProgress.skyScore))lumenProgress.skyScore=null;

function dailyStreak(){return streakFromDates(lumenProgress.daily.dates,localDateKey())}
// Show the loss transition only when the account history is ready, once per lost series.
function maybeShowStreakLoss(){
 if(authSessionPending||(lumenUser&&!cloudProfileReady))return;
 const loss=lostStreak(lumenProgress.daily?.dates,localDateKey());
 if(!loss)return;
 const key="lumenStreakLossShownV1:"+(lumenUser?.id||"guest")+":"+loss.last;
 try{if(localStorage.getItem(key)==="1")return;localStorage.setItem(key,"1")}catch(_){}
 const modal=document.getElementById("streakLossModal");if(!modal)return;
 const count=document.getElementById("streakLossCount");if(count)count.textContent=loss.prior+" jours de lumière";
 modal.hidden=false;
}
function closeStreakLoss(){
 const modal=document.getElementById("streakLossModal");if(modal)modal.hidden=true;
}
function setupStreakLoss(){
 // The modal is declared inside #mapModal in HTML. Move it to the body so
 // a closed sky dialog cannot hide the preview or the normal startup animation.
 const lossModal=document.getElementById("streakLossModal");
 if(lossModal&&lossModal.parentElement!==document.body)document.body.appendChild(lossModal);
 const qaPreview=document.getElementById("qaPreviewStreakLoss");
 if(qaPreview){
  qaPreview.hidden=!qaActive;
  qaPreview.addEventListener("click",()=>{
   if(!qaActive)return;
   const menu=document.getElementById("mobileAuthPopover");if(menu)menu.hidden=true;
   const count=document.getElementById("streakLossCount");if(count)count.textContent="4 jours de lumière · aperçu QA";
   const modal=document.getElementById("streakLossModal");if(!modal)return;
   modal.hidden=false;
   const shard=modal.querySelector(".streak-loss-stars .shatter");
   if(shard){shard.style.animation="none";void shard.offsetWidth;shard.style.animation=""}
  });
 }
 const restart=document.getElementById("streakLossRestart");
 const returnToPlay=()=>{
  closeStreakLoss();
  const map=document.getElementById("mapModal");
  if(map)map.hidden=true;
  // QA preview only closes; a qualified quest is still required to earn a new streak.
 };
 if(restart){
  restart.onclick=event=>{event.preventDefault();event.stopPropagation();returnToPlay()};
  // A mobile overlay can intercept the synthesized click before it reaches the
  // button. Capture the real tap by coordinates, regardless of its event target.
  document.addEventListener("pointerup",event=>{
   if(lossModal?.hidden||event.pointerType==="mouse")return;
   const rect=restart.getBoundingClientRect();
   if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)return;
   event.preventDefault();
   event.stopImmediatePropagation();
   returnToPlay();
  },true);
 }
}
function renderDaily(){
 const stars=document.getElementById("dailyStars");if(!stars)return;stars.innerHTML="";
 // Never present a transient zero while authenticated daily history is hydrating.
 if(authSessionPending||(lumenUser&&!cloudProfileReady)){
  const meta=document.getElementById("dailyMeta"),title=document.getElementById("dailyTitle"),reward=document.getElementById("dailyReward");
  if(title)title.textContent="Synchronisation de ta Série de lumière…";
  if(meta)meta.textContent="Historique en cours de chargement";
  if(reward)reward.textContent="";
  return;
 }
 const today=localDateKey(),status=dailyState(lumenProgress.daily.dates,today),streak=status.streak,cycle=cycleDay(streak),next=nextReward(streak);
 const visual=streakVisual(lumenProgress.daily.dates,today);
 const highlightedIndex=status.done?visual.slots.findLastIndex(slot=>slot.kind==="lit"):visual.focus;
 for(const [i,slot] of visual.slots.entries()){const e=document.createElement("span");e.className="daily-star "+slot.kind+(i===highlightedIndex?" today":"");e.textContent="✦";stars.appendChild(e)}
 const protectedLabel=document.getElementById("dailyProtection");if(protectedLabel)protectedLabel.hidden=!visual.missed;
 document.getElementById("dailyTitle").textContent=visual.protectedDay?"Lumière du jour protégée":status.done?"Lumière du jour entretenue":"Joue aujourd’hui pour continuer ta Série";
 document.getElementById("dailyMeta").textContent="Série · "+streak+" jour"+(streak>1?"s":"")+(visual.missed?" · 1 jour manqué":" · Cycle "+cycle+"/7");
 document.getElementById("dailyReward").textContent="Prochaine récompense : +"+next.amount+" ✦ à J"+(next.cycleDay+(visual.missed?1:0));
 const card=document.getElementById("dailyCard"),compact=document.getElementById("dailyCompactHelp");if(card)card.hidden=false;if(compact)compact.hidden=true;
 const ms=document.getElementById("mobileStreak");if(ms)ms.textContent="🔥 "+streak;
 const infoStars=document.getElementById("dailyInfoStars");if(infoStars){infoStars.innerHTML="";for(let i=1;i<=7;i++){let e=document.createElement("span");e.className=i<=cycle?"on":"";e.textContent="✦";infoStars.appendChild(e)}}
 const infoStatus=document.getElementById("dailyInfoStatus");if(infoStatus)infoStatus.textContent=status.done?"✓ Aujourd’hui validé · série de "+streak+" jour"+(streak>1?"s":""):status.grace?"Ta Série de lumière est protégée aujourd’hui. Joue pour la continuer.":"Aujourd’hui : réussis une nouvelle quête ou améliore un badge éligible.";
}
function maybeShowReturnWelcome(){
 const today=localDateKey(),key="lumenWelcomeDayV1",seen=localStorage.getItem(key),hasHistory=Object.keys(lumenProgress.solved||{}).length>0||Object.keys(lumenProgress.daily.dates||{}).length>0;
 if(seen===today||!hasHistory)return;
 localStorage.setItem(key,today);
 const toast=document.getElementById("returnToast"),copy=document.getElementById("returnToastCopy"),stars=document.getElementById("returnToastStars");if(!toast)return;
 const status=dailyState(lumenProgress.daily.dates,today),streak=status.streak,cycle=cycleDay(streak),next=nextReward(streak);
 copy.textContent=status.done?"Ta progression est bien enregistrée.":status.grace?"Ta Série de lumière est protégée aujourd’hui. Joue pour la continuer.":"Reprends ton exploration du ciel là où tu l’as laissée.";
 if(status.done)copy.textContent+=" · Prochaine récompense : +"+next.amount+" ✦ à J"+next.cycleDay+".";
 stars.textContent="✦".repeat(cycle)+"·".repeat(7-cycle);toast.hidden=false;
 const close=()=>{toast.classList.add("hide");setTimeout(()=>toast.hidden=true,260)};toast.onclick=close;setTimeout(close,5200);
}
// A single celebration per validated calendar day, even across reloads.
function scheduleDailyCelebration(claim){
 if(!claim?.credited)return;
 const day=localDateKey(),key="lumenDailyCelebratedV1:"+day;
 try{if(localStorage.getItem(key)==="1")return;localStorage.setItem(key,"1")}catch(_){}
 setTimeout(()=>{if(localDateKey()===day)showDailyCelebration(claim)},1600);
}
function showDailyCelebration(claim){
 if(!claim)return;
 const state=dailyState(lumenProgress.daily.dates,localDateKey()),streak=state.streak,cycle=cycleDay(streak),modal=document.getElementById("dailyCelebration");if(!modal)return;
 const stars=document.getElementById("dailyCelebrationStars");stars.replaceChildren();for(let i=1;i<=7;i++){const star=document.createElement("span");star.textContent="✦";star.className=i<=cycle?"on":"";stars.appendChild(star)}
 document.getElementById("dailyCelebrationCount").textContent=streak+" jour"+(streak>1?"s":"")+" de lumière · Jour "+cycle+"/7";
 document.getElementById("dailyCelebrationReward").textContent=Number(claim.reward)>0?"Récompense : +"+Number(claim.reward)+" ✦":"Ta série continue ! Prochaine récompense : +"+nextReward(streak).amount+" ✦ à J"+nextReward(streak).cycleDay;
 modal.hidden=false;document.getElementById("dailyCelebrationContinue")?.focus();
}
function setupDailyCelebration(){
 const modal=document.getElementById("dailyCelebration"),close=document.getElementById("dailyCelebrationContinue");if(close)close.onclick=()=>{modal.hidden=true};if(modal)modal.onclick=e=>{if(e.target===modal)modal.hidden=true};
 const help=document.getElementById("dailyHelpModal"),hide=()=>{help.hidden=true};for(const id of ["dailyHelp","dailyCompactHelp"]){const btn=document.getElementById(id);if(btn)btn.onclick=()=>{const s=dailyState(lumenProgress.daily.dates,localDateKey());document.getElementById("dailyHelpCurrent").textContent="Série actuelle : "+s.streak+" jour(s). "+(s.done?"Aujourd’hui validé.":s.grace?"Jour de grâce.":"Joue aujourd’hui pour continuer.");help.hidden=false;document.getElementById("dailyHelpClose")?.focus()}}document.getElementById("dailyHelpClose")?.addEventListener("click",hide);if(help)help.onclick=e=>{if(e.target===help)hide()};document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(modal&&!modal.hidden)modal.hidden=true;if(help&&!help.hidden)hide()}});
}
setupDailyCelebration();
setupStreakLoss();
async function completeDaily(){
 if(persistenceModel.lumenUser){
   const wasValidated=!!lumenProgress.daily?.dates?.[localDateKey()];
   const claim=await cloudSaveDaily(localDateKey(),levelIndex);
   if(!claim)return null;
   await cloudMergeDaily();
   if(!wasValidated&&lumenProgress.daily?.dates?.[localDateKey()]&&claim.credited!==false){renderDaily();scheduleDailyCelebration({...claim,credited:true})}
   return claim;
 }
 const today=localDateKey(),result=grantDaily(lumenProgress,today);if(!result.credited)return result;
 saveLumenProgress();renderDaily();
 scheduleDailyCelebration(result);
 return result;
}

let legacyAttempt=null;try{legacyAttempt=JSON.parse(localStorage.getItem(qaKey("lumenActiveAttemptV1")))}catch(_){}
if(preserveStartedAdventureAccess(lumenProgress,legacyAttempt))saveLumenProgress();
let sequentialSolvedCount=normalizeSequentialProgress();

const LUMEN_PUSH_PUBLIC_KEY="BCL-qkJ1SC1tTi8VMB080_bbliipUDgx2KyrQ1u8hL9HX-EL8xYNPjT1m6Sa8InjWQjjeizlSw1_CuYE_Rn3bqk";
const LUMEN_PUSH_URL=LUMEN_SUPABASE_URL+"/functions/v1/lumen-push";
function pushKey(s){const p="=".repeat((4-s.length%4)%4),b=(s+p).replace(/-/g,"+").replace(/_/g,"/"),raw=atob(b);return Uint8Array.from([...raw].map(x=>x.charCodeAt(0)))}
async function currentPushSubscription(){if(!("serviceWorker"in navigator))return null;const reg=await navigator.serviceWorker.ready;return reg.pushManager.getSubscription()}
async function pushApi(action,extra={}){
 try{
  const session=await lumenSupabase?.auth?.getSession?.(),token=session?.data?.session?.access_token;
  const headers={"Content-Type":"application/json"};if(token)headers.Authorization="Bearer "+token;
  await fetch(LUMEN_PUSH_URL,{method:"POST",headers,body:JSON.stringify({action,anonymous_id:lumenAnonymousId,...extra})});
 }catch(e){console.warn("LUMEN push",e)}
}
async function enableLumenPush(){
 if(!("Notification"in window)||!("PushManager"in window)){showRewardToast("Rappels non disponibles sur cet appareil");return}
 const optin=document.getElementById("pushOptin");
 // Close LUMEN's prompt before Android takes over, so it cannot reappear behind the system dialog.
 optin.hidden=true;
 let permission;
 try{permission=await Notification.requestPermission()}catch(e){optin.hidden=false;return}
 if(permission!=="granted"){localStorage.setItem("lumenPushChoice","denied");return}
 try{
  const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:pushKey(LUMEN_PUSH_PUBLIC_KEY)});
  await pushApi("subscribe",{subscription:sub.toJSON(),social_enabled:true});localStorage.setItem("lumenPushChoice","enabled");showRewardToast("Notifications LUMEN activées ✦");
 }catch(e){console.warn("LUMEN push subscribe",e);localStorage.removeItem("lumenPushChoice");showRewardToast("Impossible d’activer le rappel pour le moment")}
}
async function markLumenSeen(){if(localStorage.getItem("lumenPushChoice")!=="enabled")return;const sub=await currentPushSubscription();if(sub){await pushApi("subscribe",{subscription:sub.toJSON(),social_enabled:true});pushApi("seen",{endpoint:sub.endpoint})}}
function maybeOfferPush(){if(solvedCount()<3||localStorage.getItem("lumenPushChoice"))return;if(!("Notification"in window)||Notification.permission==="denied")return;document.getElementById("pushOptin").hidden=false}
async function disableLumenPush(){const sub=await currentPushSubscription();if(sub){await pushApi("unsubscribe",{endpoint:sub.endpoint});await sub.unsubscribe()}localStorage.setItem("lumenPushChoice","off");}


function challengeDisplayName(){
 return normalizeChallengeName(lumenNickname||localStorage.getItem("lumenGuestName")||"");
}
const challengeClient=createChallengeClient(lumenSupabase,{
 getUserId:()=>lumenUser?.id||null,
 getAnonymousId:()=>lumenAnonymousId,
 getDisplayName:()=>challengeDisplayName()
});
function askChallengeName(){
 const current=challengeDisplayName();if(validChallengeName(current))return Promise.resolve(current);
 const modal=document.getElementById("challengeNameModal"),input=document.getElementById("challengeNameInput"),error=document.getElementById("challengeNameError");
 modal.hidden=false;input.value=current;input.focus();
 return new Promise(resolve=>{
  const finish=value=>{modal.hidden=true;document.getElementById("challengeNameSave").onclick=null;document.getElementById("challengeNameCancel").onclick=null;resolve(value)};
  document.getElementById("challengeNameSave").onclick=()=>{
   const value=normalizeChallengeName(input.value);if(!validChallengeName(value)){error.textContent="Choisis un prénom ou pseudo de 2 à 24 caractères.";return}
   error.textContent="";localStorage.setItem("lumenGuestName",value);if(!lumenNickname)lumenNickname=value;finish(value);
  };
  document.getElementById("challengeNameCancel").onclick=()=>finish("");
 });
}
function socialChallengeUrl(id){const u=new URL(location.origin+location.pathname);u.searchParams.set("challenge",id);return u.toString()}
async function createSocialChallengeFromSuccess(){
 if(!lastChallengeOffer?.eligibility?.canChallenge)return;
 const name=await askChallengeName();if(!name)return;
 try{
  const created=await challengeClient.create(lastChallengeOffer.snapshot),id=created?.challenge_id;if(!id)throw new Error("missing_challenge_id");
  pendingChallengeUrl=socialChallengeUrl(id);trackLumenEvent("challenge_created",levelIndex+1,{remarkable:!!lastChallengeOffer.eligibility.remarkable});
  const copy=document.getElementById("challengeShareCopy");copy.textContent=lastChallengeOffer.eligibility.remarkable?"✦ Maîtrise du premier coup. À ton ami de relever le défi !":"Ta première performance est figée. À ton ami de faire mieux en une tentative.";
  const modal=document.getElementById("challengeShareModal");modal.hidden=false;
  const qr=document.getElementById("challengeQr");if(qr){qr.replaceChildren();if(typeof window.QRCode==="function")new window.QRCode(qr,{text:pendingChallengeUrl,width:220,height:220,correctLevel:window.QRCode.CorrectLevel.M});else qr.textContent="QR code indisponible : utilise Copier le lien.";}
  maybeOfferSocialPush();
 }catch(e){console.warn("challenge create",e);showRewardToast("Impossible de créer le défi pour le moment")}
}
async function sharePendingChallenge(){
 if(!pendingChallengeUrl)return;const text="Je te défie sur LUMEN. Tu as une tentative pour faire mieux !";
 try{if(navigator.share){await navigator.share({title:"Défi LUMEN",text,url:pendingChallengeUrl});trackLumenEvent("challenge_share_completed",levelIndex+1,{method:"native"})}else{await navigator.clipboard.writeText(text+"\n"+pendingChallengeUrl);showShareToast("Lien du défi copié")}}catch(e){if(e?.name!=="AbortError")…15420 tokens truncated…entById("endgameAutonomy").textContent=stats.autonomy;
 document.getElementById("endgameNoError").textContent=stats.noError;
 document.getElementById("endgameMastery").textContent=stats.mastery;
 try{localStorage.setItem(endgameSeenKey(),"1")}catch(_){}
 overlay.hidden=false;
 trackLumenEvent("campaign_completed",null,{content_quests:stats.quests,constellations:stats.constellations,stars:stats.stars,autonomy_badges:stats.autonomy,no_error_badges:stats.noError,mastery_badges:stats.mastery});
 for(let i=0;i<36;i++){const spark=document.createElement("span");spark.className="endgame-spark";spark.textContent=i%4?"✦":"★";spark.style.left=(5+(i*37)%90)+"vw";spark.style.top=(8+(i*29)%82)+"vh";spark.style.animationDelay=((i%9)*.07)+"s";document.body.appendChild(spark);setTimeout(()=>spark.remove(),3600)}
}
function closeEndgameToSky(focus=true){
 const overlay=document.getElementById("endgameOverlay");if(overlay)overlay.hidden=true;
 openJourneyMap(focus);
}

function hideSuccess(){
 let o=document.getElementById("successOverlay");
 if(o)o.classList.remove("show");
 board.classList.remove("win");
 document.querySelectorAll(".confetti").forEach(x=>x.remove());
 if(celebrated){document.getElementById("undo").disabled=true;document.getElementById("hint").disabled=true;document.getElementById("autoCross").disabled=true}
}
function setLearningReplaySuccessMode(active){
 for(const id of ["successRetry","successShare","successSky","successAchievement","successRewards"]){const el=document.getElementById(id);if(el)el.hidden=active}
 if(active){const difficulty=document.getElementById("difficultyBox"),result=document.getElementById("questResult");if(difficulty)difficulty.hidden=true;if(result)result.hidden=true}
}
function celebrateLearningReplaySuccess(){
 celebrated=true;attemptEngine.complete();clearInterval(timer);board.classList.add("win");
 document.getElementById("successTitle").textContent=levelIndex===0?"Première étape terminée":"Apprentissage terminé";
 document.getElementById("successSub").textContent=levelIndex===0?"Continue avec la quête 2.":"Tu peux reprendre ta quête là où tu l’avais laissée.";
 document.getElementById("successTime").textContent=document.getElementById("time").textContent;
 document.getElementById("successNew").textContent=levelIndex===0?"Continuer l’apprentissage":"Retour à ma quête";
 setLearningReplaySuccessMode(true);document.getElementById("successOverlay").classList.add("show");
}

function renderSuccessRewards(stars,savedPerformance,priorBadges={}){let el=document.getElementById("successRewards");if(!el)return;const run=savedPerformance.run,earned=savedPerformance.badges,qualifying=savedPerformance.qualifying,rewards=[];if(stars>0)rewards.push({cls:"star",icon:"★",label:"+"+stars+" étoile"+(stars>1?"s":"")});if(qualifying&&earned.autonomy&&!priorBadges.autonomy)rewards.push({cls:"autonomy",icon:performanceIcon("autonomy"),label:"Autonomie"});if(qualifying&&earned.speed&&!priorBadges.speed)rewards.push({cls:"speed",icon:performanceIcon("speed"),label:"Rapidité"});if(qualifying&&earned.noError&&!priorBadges.noError)rewards.push({cls:"no-error",icon:performanceIcon("noError"),label:"Sans erreur"});if(qualifying&&earned.mastery&&!priorBadges.mastery)rewards.push({cls:"mastery",icon:performanceIcon("mastery"),label:"Maîtrise"});el.innerHTML=rewards.map((r,i)=>'<span class="success-reward '+r.cls+'" style="--reward-delay:'+(220+i*210)+'ms"><span>'+r.icon+'</span><span>'+r.label+'</span></span>').join("");el.classList.toggle("mastery-earned",!!qualifying&&!!earned.mastery&&!priorBadges.mastery)}
// Canonical achievements use stable-ID cloud CAS, never the historical
// puzzle_id RPC or the old `solved[levelIndex]` reward calculation.
const canonicalVictoryOutbox=createCanonicalVictoryOutbox(localStorage);
async function celebrateCanonicalSuccess(){
 const q=canonicalActiveQuest;if(!q||celebrated)return;
 const seconds=activeGameSeconds(),attempt=attemptEngine.snapshot();
 const assisted=!!attempt?.assistanceUsed||!!usedHintThisGame;
 const badges={speed:seconds<=60,autonomy:!assisted,noError:!attempt?.mistakeCommitted};
 badges.mastery=badges.speed&&badges.autonomy&&badges.noError;
 const reward={badges,performance:{bestTime:seconds,assisted,seconds},stars:1};
 let committed;
 try{
  if(qaActive){committed=acknowledgeCanonicalVictory(lumenProgress,q.id,reward)}
  else{
   if(!lumenUser)throw Error("Compte requis pour sauvegarder la victoire");
   // Even when cloud hydration is unavailable, capture the victory BEFORE
   // awaiting readiness. Closing an offline PWA must not lose its sole intent.
   const ownerId=lumenUser.id;
   const pending=canonicalVictoryOutbox.enqueue(ownerId,q.id,reward);
   if(!cloudProfileReady)throw Error("Victoire conservée localement, cloud non prêt");
   if(!(await confirmCloudReward()))return;
   if(lumenUser?.id!==ownerId)throw Error("Compte modifié pendant la sauvegarde");
   committed=await commitCanonicalVictory(lumenSupabase,q.id,pending.reward);
   if(lumenUser?.id!==ownerId)throw Error("Compte modifié pendant la sauvegarde");
   if(!committed.profile?.canonicalQuestState?.[q.id]?.solved)throw Error("Victoire non confirmée par le cloud");
   // Remote victory was read back successfully. A local quota/storage error
   // when clearing the outbox must not make the player replay a saved win.
   // The retained intent is harmless: CAS replay sees solved and won't re-award.
   try{canonicalVictoryOutbox.acknowledge(ownerId,q.id)}catch(error){
    console.warn("Canonical outbox cleanup deferred",error);
    recordCloudDiagnostic("canonical_outbox_cleanup_pending",{reason:"storage"});
   }
  }
 }catch(error){
  console.error("Canonical victory not saved",error);
  let locallySaved=false;
  try{locallySaved=!!lumenUser&&canonicalVictoryOutbox.pending(lumenUser.id).some(entry=>entry.questId===q.id)}catch(readError){
   recordCloudDiagnostic("canonical_outbox_read_failed",{reason:"integrity"});
  }
  msg.textContent=locallySaved
   ?"Victoire conservée sur cet appareil, en attente de synchronisation. Reconnecte-toi sur cet appareil pour la récupérer."
   :"Sauvegarde de la quête impossible : la conservation locale n'est pas confirmée. Ne quitte pas cette grille et réessaie.";
  return;
 }
 // Install only the acknowledged profile; never optimistically mutate a
 // legacy quest or attempt to upload new IDs as numeric puzzle IDs.
 lumenProgress=committed.profile;
 if(!qaActive){cloudProfileBaseline=structuredClone(committed.profile)}
 const previousCloudReady=cloudProfileReady;
 cloudProfileReady=false;try{saveLumenProgress()}finally{cloudProfileReady=previousCloudReady}
 trackAttemptEvent("attempt_completed",{outcome:"success",canonical_id:q.id,first_completion:committed.newlyCompleted});
 celebrated=true;attemptEngine.complete();clearInterval(timer);pauseGameClock();clock();
 board.classList.add("win");
 document.getElementById("successTitle").textContent="Quête "+q.ordinal+" accomplie !";
 document.getElementById("successSub").textContent=committed.newlyCompleted?"+ "+(badges.autonomy?15:10)+" XP · +1 étoile · "+[["speed","Rapidité"],["autonomy","Autonomie"],["noError","Sans erreur"],["mastery","Maîtrise"]].filter(([key])=>badges[key]).map(([,label])=>label).join(" · ")+" · sauvegarde confirmée":"Quête déjà réussie · sauvegarde confirmée";
 document.getElementById("successTime").textContent=document.getElementById("time").textContent;
 const share=document.getElementById("successShare");if(share)share.hidden=true;
 const achievements=document.getElementById("successAchievement");if(achievements)achievements.hidden=true;
 const rewards=document.getElementById("successRewards");if(rewards)rewards.hidden=true;
 const challenge=document.getElementById("questResult");if(challenge)challenge.hidden=true;
 document.getElementById("successNew").textContent="Quête suivante";
 document.getElementById("successOverlay").classList.add("show");refreshJourney();
}

async function celebrateSuccess(){
 if(celebrated)return;
 haptic([28,45,38]);
 if(socialChallenge){celebrateSocialChallengeSuccess();return}
 if(canonicalActiveQuest){await celebrateCanonicalSuccess();return}
 if(learningReplayActive()){celebrateLearningReplaySuccess();return}
 const firstCompletion=!lumenProgress.solved[levelIndex];
 trackAttemptEvent("attempt_completed",{outcome:"success",first_completion:firstCompletion,hint_uses:hintUsesThisGame,verify_uses:verifyUsesThisGame,auto_marking_used:!!autoUsedThisGame});
 trackLumenEvent("puzzle_complete",levelIndex+1,currentAttemptAnalytics({duration_seconds:activeGameSeconds(),hint_used:!!usedHintThisGame,first_completion:firstCompletion}));
 celebrated=true;attemptEngine.complete();
 // Progress is tied to the game's real victory event (not overlay visibility).
 const generatedQuest=levelIndex>=campaignQuestCount();
 const skyEarnedBefore=skyStarsEarned();
 lumenProgress.solved[levelIndex]=1;
 const playedPack=packForLegacyQuest(levelIndex);const adventureQuests=playedPack?canonicalQuestList().filter(q=>q.packId===playedPack.id):[];
 adventurePending=firstCompletion&&playedPack&&!isCampaignFinalQuest(levelIndex)&&adventureQuests.length>0&&adventureQuests.every(q=>questIsCompleted(lumenProgress,q.id))?playedPack:null;
 endgamePending=firstCompletion&&isCampaignFinalQuest(levelIndex)&&isCampaignComplete(lumenProgress.solved);
 if(firstCompletion&&!generatedQuest)lumenProgress.skyScore=Math.min(SKY_TARGET,skyEarnedBefore+skyStarsForGrid(levelIndex));
 if(firstCompletion)lumenProgress.xp=(lumenProgress.xp||0)+10;
 if(firstCompletion&&!usedHintThisGame)lumenProgress.xp+=5;
 const ch=generatedQuest?null:bonusChallengeFor(levelIndex);let questPassed=false;
 if(ch&&!lumenProgress.stars[ch.id]){
   questPassed=!questFailed&&(ch.seconds!==null?activeGameSeconds()<=ch.seconds:(ch.type===2?!usedHintThisGame:true));
   if(questPassed){lumenProgress.stars[ch.id]=1;lumenProgress.challenges[ch.id]=1;lumenProgress.xp+=25;lumenProgress.shards=(lumenProgress.shards||0)+1}
 }
 const earnedThisRun=generatedQuest?generatedQuestReward(levelIndex,firstCompletion).stars:starsAwardedForGrid(levelIndex,firstCompletion,questPassed);
 const priorPerformance=lumenProgress.performances[levelIndex]||{},priorBadges=priorPerformance.version>=2?{...(priorPerformance.badges||{})}:{};
 launchWinStar(earnedThisRun);
 const savedPerformance=savePerformance(levelIndex,earnedThisRun);
 const socialEligibility=challengeEligibility({priorPerformance,run:savedPerformance.run});
 lastChallengeOffer={eligibility:socialEligibility,snapshot:challengeSnapshot({questIndex:levelIndex,seconds:activeGameSeconds(),run:savedPerformance.run,assistanceUsed:!!attemptEngine.snapshot()?.assistanceUsed})};
 const shareBtn=document.getElementById("successShare"),remarkable=document.getElementById("remarkableChallenge");
 if(shareBtn){shareBtn.hidden=!socialEligibility.canChallenge;shareBtn.classList.toggle("remarkable",socialEligibility.remarkable)}
 if(remarkable)remarkable.hidden=!socialEligibility.remarkable;
 const autonomyShard=grantAutonomyMilestone(lumenProgress,{firstCompletion,autonomy:!!savedPerformance.run.autonomy});
 const dailyQualified=qualifiesDailyActivity({firstCompletion,performanceQualifying:savedPerformance.qualifying,priorBadges,earnedBadges:savedPerformance.badges});
 if(dailyQualified)completeDaily();
 renderSuccessRewards(earnedThisRun,savedPerformance,priorBadges);renderSuccessAchievement();
 if(!usedHintThisGame){
   if(!lumenProgress.noHint)lumenProgress.noHint={};
   lumenProgress.noHint[levelIndex]=1;
   // Autonomy rewards are handled from the shared #30 assistance definition.
 }
 saveLumenProgress();
 if(!(await confirmCloudReward()))return;
 if(firstCompletion){void cloudSavePuzzle(levelIndex).then(result=>{if(!result?.ok&&lumenUser&&!qaActive){recordCloudDiagnostic("legacy_mirror_failed",{kind:result?.reason||"unknown",pending:1});preserveUnsyncedCloudProgress("legacy-mirror-failed");}});setTimeout(maybeOfferInstall,1600);setTimeout(maybeOfferPush,5200)}
 refreshJourney();
 pauseGameClock();
 clearInterval(timer);
 clock();
 board.classList.add("win");
 board.querySelectorAll(".cell").forEach((cell,i)=>{cell.style.setProperty("--victory-delay",(i*18)+"ms");cell.classList.add("victory-wave")});
 setTimeout(()=>board.querySelectorAll(".cell").forEach(cell=>cell.classList.remove("victory-wave")),1500);
 document.getElementById("successTime").textContent=document.getElementById("time").textContent;
 const qr=document.getElementById("questResult");if(ch){qr.hidden=false;qr.className="quest-result "+(questPassed||lumenProgress.stars[ch.id]?"success":"fail");qr.textContent=questPassed?"✦ Défi réussi ! +25 XP et un éclat gagné.":lumenProgress.stars[ch.id]?"✦ Défi déjà accompli":"Défi échoué — la quête est tout de même accomplie."}else qr.hidden=true;
 const m=generatedQuest?null:milestoneFor(levelIndex),sub=document.getElementById("successSub");if(sub)sub.textContent=m?(m.kind==="boss"?"Défi final réussi · constellation complétée":"Défi intermédiaire réussi · +1 ★ bonus"):(questPassed?"Quête réussie · +25 XP et +1 ✦":"Ton ciel progresse");
 if(levelIndex===1&&sub)sub.textContent="Ton ciel progresse. Rapidité arrive à la quête 3 ; Autonomie et Maîtrise à la quête 6.";
 if(levelIndex<=1)try{localStorage.setItem(qaActive?"lumenQaTutorialSeen":"lumenTutorialSeen","1")}catch(_){}
 if(levelIndex===1)markTutorialCompleted();
 configureSuccessFeedback(questPassed);
 const skyEarnedAfter=skyStarsEarned(),crossedConstellation=firstCompletion&&(()=>{let total=0;for(const cs of CONSTELLATIONS){total+=cs.count;if(skyEarnedBefore<total&&skyEarnedAfter>=total)return true}return false})();
 const checkpoint=firstCompletion&&!crossedConstellation?constellationCheckpoint(skyEarnedBefore,skyEarnedAfter):null;
 const revealDelay=!generatedQuest&&earnedThisRun>0?2250:0;
 const clearVictoryConfetti=()=>document.getElementById("victoryConfetti")?.remove();
 if(firstCompletion&&earnedThisRun>0&&!generatedQuest){document.getElementById("successOverlay").classList.remove("show");setTimeout(()=>{clearVictoryConfetti();showSkyReveal(skyEarnedBefore,checkpoint)},revealDelay)}else if(questPassed||crossedConstellation||checkpoint){document.getElementById("successOverlay").classList.remove("show");setTimeout(()=>{clearVictoryConfetti();showSkyReveal(skyEarnedBefore,checkpoint)},revealDelay)}else setTimeout(()=>document.getElementById("successOverlay").classList.add("show"),revealDelay);

 // Deliberately varied shapes/positions; purely visual, no game-state effect.
 const palette=["#68e7ff","#5ea7ff","#8b7cff","#67d8c2","#d7f8ff","#87bfff"];
 const confettiCount=matchMedia("(max-width: 700px)").matches?28:40;
 const confettiHost=document.createElement("div");confettiHost.id="victoryConfetti";confettiHost.className="victory-confetti";const confettiFragment=document.createDocumentFragment();
 for(let i=0;i<confettiCount;i++){
  let x=document.createElement("i");
  x.className="confetti";
  x.style.left=((i*37)%101)+"vw";
  x.style.background=palette[i%palette.length];
  x.style.setProperty("--dur",(2.2+(i%9)*.16)+"s");
  x.style.setProperty("--rot",((i*47)%360)+"deg");
  x.style.animationDelay=((i%13)*.035)+"s";
  if(i%3===0){x.style.borderRadius="50%";x.style.width="10px";x.style.height="10px"}
  confettiFragment.appendChild(x);
 }
 confettiHost.appendChild(confettiFragment);document.body.appendChild(confettiHost);
 setTimeout(clearVictoryConfetti,3600);
}

function haptic(pattern){try{if("vibrate" in navigator)navigator.vibrate(pattern)}catch(_){}}
const {audioContext,tone,guardianSound,errorSound,halfSound,victorySound,starArrivalSound,constellationSound,updateSoundToggle,setSoundEnabled}=createSound();
let halfRewardShown=false,lastPlacedCount=0,rewardToastTimer=null;
function updateLiveReward(q){
 const m=document.getElementById("masteryLive"),p=document.getElementById("progressLive");if(!m||!p)return;
 const eligibility=currentPerformanceEligibility(levelIndex),assisted=!!attemptEngine.snapshot()?.assistanceUsed,within=activeGameSeconds()<speedTargetSeconds(levelIndex),masteryVisible=eligibility.mastery&&!assisted&&within;
 // Never expose the hidden Sans erreur state during play: a committed mistake
 // must not change this live indicator before the result screen.
 m.textContent=!Object.values(eligibility).some(Boolean)?"Performances bientôt":eligibility.mastery?(masteryVisible?"✦ Maîtrise en cours":"○ Maîtrise à retenter"):"⚡ Rapidité disponible";m.classList.toggle("lost",eligibility.mastery&&!masteryVisible);
 p.textContent="";
}
function showRewardToast(text){
 const t=document.getElementById("rewardToast");if(!t)return;t.textContent=text;t.classList.add("show");clearTimeout(rewardToastTimer);rewardToastTimer=setTimeout(()=>t.classList.remove("show"),1900);
}
function rewardProgressPulse(q){
 if(q>lastPlacedCount){
  guardianSound(q);
  const momentum=Math.max(1,Math.min(4,q-lastPlacedCount+Math.floor(q/Math.max(1,Math.ceil(n/3)))));
  board.style.setProperty("--lumen-energy",String(q/Math.max(1,n)));
  board.classList.remove("energy-pulse");void board.offsetWidth;board.classList.add("energy-pulse");
  requestAnimationFrame(()=>{const cells=[...board.querySelectorAll(".cell")],lit=cells.filter(d=>d.querySelector(".lumen-orb"));lit.forEach((d,i)=>{d.style.setProperty("--spark-delay",(i*32)+"ms");d.classList.add("just-lit")});setTimeout(()=>cells.forEach(d=>d.classList.remove("just-lit")),520)});
  if(q>1&&q<n&&momentum>=3)showRewardToast(q>=n-1?"✦ Le ciel s'aligne…":"✦ Belle avancée");
 }
 if(!halfRewardShown&&q>=Math.ceil(n/2)){halfRewardShown=true;halfSound();board.classList.add("board-half");showRewardToast("✦ Mi-chemin · le ciel s’éveille");setTimeout(()=>board.classList.remove("board-half"),780)}
 lastPlacedCount=q;updateLiveReward(q);
}
function launchWinStar(stars){
 if(stars<=0)return;victorySound();setTimeout(starArrivalSound,1900);const x=document.createElement("div");x.className="win-flight";x.textContent=stars>1?"★ +"+stars:"★";document.body.appendChild(x);showRewardToast(stars>1?"+"+stars+" étoiles gagnées":"Étoile gagnée");setTimeout(()=>x.remove(),2550);
}
let dragCross=null,dragCrossSuppressClick=false;
function dragCrossCellAt(x,y){
 const el=document.elementFromPoint(x,y)?.closest?.(".cell");
 if(!el||!board.contains(el))return null;
 return [Number(el.dataset.row),Number(el.dataset.col)];
}
function paintCell(r,c){
 const d=board.querySelector('.cell[data-row="'+r+'"][data-col="'+c+'"]');if(!d)return;
 const shown=displayedCellState(r,c);
 if(d.dataset.shown===String(shown))return;
 d.dataset.shown=String(shown);
 d.innerHTML=shown===1||shown===3?'<span class="lumen-dim" aria-label="Emplacement assombri"></span>':shown===2?'<span class="lumen-orb" aria-label="Gardien positionné"></span>':"";
 d.classList.toggle("auto-x",shown===3);
}
function paintBoardState(){
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)paintCell(r,c);
 const q=state.flat().filter(v=>v===2).length,countEl=document.getElementById("count");if(countEl)countEl.textContent=q+"/"+n;
 updateLiveReward(q);if(scriptedLearningActive())updateScriptedLearning();
}
function resolutionSnapshot(){
 const shown=[];for(let r=0;r<n;r++)for(let c=0;c<n;c++)shown.push(displayedCellState(r,c));
 return shown;
}
function pulseResolvedCells(cells,cls,delay=0){
 cells.forEach(([r,c],i)=>{const el=guidedCell(r,c);if(!el)return;el.style.setProperty("--resolve-delay",(delay+i*18)+"ms");el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),900+delay+i*18)});
}
function animateLogicalResolution(r,c,before){
 haptic(14);
 if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
 const newlyAuto=[];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;if(before[i]!==3&&displayedCellState(y,x)===3)newlyAuto.push([y,x])}
 // Show the rule consequence as a fast cascade: nearest cells react first.
 newlyAuto.sort((a,b)=>(Math.abs(a[0]-r)+Math.abs(a[1]-c))-(Math.abs(b[0]-r)+Math.abs(b[1]-c)));
 pulseResolvedCells([[r,c]],"guardian-impact");
 pulseResolvedCells(newlyAuto,"cascade-cross",70);
 const rowDone=state[r].some(v=>v===2),colDone=state.some(row=>row[c]===2),region=puz.reg[r][c];
 if(rowDone)pulseResolvedCells(Array.from({length:n},(_,x)=>[r,x]),"unit-resolved",180);
 if(colDone)pulseResolvedCells(Array.from({length:n},(_,y)=>[y,c]),"unit-resolved",240);
 const regionCells=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(puz.reg[y][x]===region)regionCells.push([y,x]);
 if(regionCells.some(([y,x])=>state[y][x]===2))pulseResolvedCells(regionCells,"territory-resolved",300);
}
function markDragCross(r,c){
 if(!dragCross||dragCross.visited.has(r+","+c)||state[r]?.[c]===2)return;
 if(dragCross.lesson&&!learningAllows(dragCross.lesson,r,c))return;
 dragCross.visited.add(r+","+c);
 if(state[r][c]!==1){
  if(attemptEngine.snapshot()?.wrongGuardianPending)attemptEngine.commitMistake();
  state[r][c]=1;dragCross.changed=true;paintCell(r,c)
 }
}
board.addEventListener("pointerdown",e=>{
 if(celebrated||guidedPending||verifyPending)return;
 if(!learningDragAllowed())return;
 const cell=e.target.closest(".cell");if(!cell)return;
 if(scriptedLearningActive()&&currentLearningStep().phase==="intro")return;
 if(scriptedLearningActive()&&!learningMarkAllowed(Number(cell.dataset.row),Number(cell.dataset.col)))return;
 if(e.pointerType==="mouse"&&e.button!==0)return;
 ensureAttemptStarted();
 // touch-action:none prevents scrolling while preserving the native tap/click cycle.
 dragCross={id:e.pointerId,startX:e.clientX,startY:e.clientY,dragging:false,changed:false,visited:new Set(),snapshot:state.map(x=>x.slice()),lesson:scriptedLearningActive()?currentLearningStep():null};
},{passive:false});
function moveDragCross(e){
 if(!dragCross||dragCross.id!==e.pointerId)return;
 e.preventDefault();
 if(!dragCross.dragging&&Math.hypot(e.clientX-dragCross.startX,e.clientY-dragCross.startY)>8){
   dragCross.dragging=true;dragCrossSuppressClick=true;
   const start=dragCrossCellAt(dragCross.startX,dragCross.startY);if(start)markDragCross(start[0],start[1]);
 }
 if(!dragCross.dragging)return;
 const hit=dragCrossCellAt(e.clientX,e.clientY);if(hit)markDragCross(hit[0],hit[1]);
}
board.addEventListener("pointermove",moveDragCross,{passive:false});
function endDragCross(e){
 if(!dragCross||dragCross.id!==e.pointerId)return;
 const wasDragging=dragCross.dragging,changed=dragCross.changed,snapshot=dragCross.snapshot;
 dragCross=null;
 if(wasDragging){
   if(changed){hist.push(snapshot);persistAttemptBoard()}
   hi=null;hiCells=[];hintStage=0;hintFocus=null;msg.textContent="";
   paintBoardState();updateScriptedLearning();if(scriptedLearningActive())finishManualLearningMarks();else if(levelIndex===1)showLearningTip("tools","À toi de poursuivre","Glissé acquis ! Poursuis librement et essaie Indice pour apprendre une logique de résolution. Les indices sont offerts jusqu’à la quête 10.");setTimeout(()=>{dragCrossSuppressClick=false},0);
 }
}
board.addEventListener("pointerup",endDragCross);
board.addEventListener("pointercancel",endDragCross);

function render(){
 board.dataset.size=String(n);
 board.classList.remove("scripted-board");
 board.style.gridTemplateColumns=`repeat(${n},minmax(0,1fr))`;board.style.gridTemplateRows=`repeat(${n},minmax(0,1fr))`;board.innerHTML="";
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  let d=document.createElement("div");
  let highlighted=(hi&&hi[0]===r&&hi[1]===c)||hiCells.some(q=>q[0]===r&&q[1]===c);
  d.className="cell"+(highlighted?" hi":"");
  let g=puz.reg[r][c],tc=TERRITORY_COLORS[g%TERRITORY_COLORS.length];
  d.style.setProperty("--territory",tc);
  d.dataset.t=(r===0||puz.reg[r-1][c]!==g)?"1":"0";
  d.dataset.b=(r===n-1||puz.reg[r+1][c]!==g)?"1":"0";
  d.dataset.l=(c===0||puz.reg[r][c-1]!==g)?"1":"0";
  d.dataset.r=(c===n-1||puz.reg[r][c+1]!==g)?"1":"0";
  let shown=displayedCellState(r,c);
  d.dataset.shown=String(shown);
  if(shown===1||shown===3)d.innerHTML='<span class="lumen-dim" aria-label="Emplacement assombri"></span>';
  else if(shown===2)d.innerHTML='<span class="lumen-orb" aria-label="Gardien positionné"></span>';
  else d.innerHTML="";
  if(levelIndex===0&&learningIntroActive()&&shown===0){
   const flatIndex=r*n+c,firstIndex=puz.reg.flat().findIndex(region=>region===g);
   if(flatIndex===firstIndex)d.innerHTML='<span class="learning-territory-number" aria-label="Territoire '+(g+1)+'">'+(g+1)+'</span>';
  }
  if(shown===3)d.classList.add("auto-x");
  d.dataset.row=r;d.dataset.col=c;
  d.onclick=async()=>{if(celebrated||dragCrossSuppressClick||guidedPending||verifyPending||performance.now()<suppressGuidedClickUntil)return;
 let shown=displayedCellState(r,c),next=shown===3?2:(state[r][c]+1)%3,currentGuardians=state.flat().filter(v=>v===2).length;
 if(scriptedLearningActive()){
  if(learningStage==="intro")return;
  if(learningStage==="place"){if(!scriptedAllowsGuardian(r,c))return;if(state[r][c]===0){next=1}else if(state[r][c]===1){next=2}else next=0}
  else if(currentLearningStep().dragLesson)return;
  else if(learningMarkAllowed(r,c)){next=1}
  else return;
 }
 ensureAttemptStarted();
 if(next===2&&state[r][c]!==2&&currentGuardians>=n)return;
 // Guided mode validates a Guardian only when the player commits to the next
 // action. This preserves the normal cross -> Guardian -> empty correction cycle.
 if(guidedDeferred){
  const correctingDeferred=guidedDeferred.r===r&&guidedDeferred.c===c&&state[r][c]===2&&next===0;
  if(correctingDeferred)guidedDeferred=null;
  else{
   const deferred=guidedDeferred;guidedDeferred=null;
   attemptEngine.markAssistance();
   trackAttemptEvent("guided_intervention",{action:"guardian",deferred:true});
   mistakesThisGame++;
   msg.textContent="";
   errorSound();
   showGuidedConflict(deferred.r,deferred.c,deferred.info);
   updateLiveReward(state.flat().filter(v=>v===2).length);
   return;
  }
 }
 let deferredGuidedError=null;
 if(guidedErrorsEnabled()&&next===2)deferredGuidedError=guidedConflictForAction(r,c,next);
 const actionKey=r+","+c,pending=attemptEngine.snapshot()?.wrongGuardianPending,correctingPending=pending===actionKey&&state[r][c]===2&&next===0;
 if(pending){
  if(correctingPending)attemptEngine.clearWrongGuardianPending(actionKey);
  else attemptEngine.commitMistake();
 }
 const resolutionBefore=next===2?resolutionSnapshot():null;
 hist.push(state.map(x=>x.slice()));
 if(shown===3){state[r][c]=2}else{state[r][c]=next}
 if(next===2&&puz.sol[r]!==c)attemptEngine.setWrongGuardianPending(actionKey);
 if(deferredGuidedError)guidedDeferred={r,c,info:deferredGuidedError};
 if(next===2&&document.getElementById("autoCross")?.checked)attemptEngine.markAssistance();
 clearHintDisplay();hintStage=0;hintFocus=null;msg.textContent="";
 paintBoardState();if(next===2&&resolutionBefore)animateLogicalResolution(r,c,resolutionBefore);updateScriptedLearning();if(levelIndex===1&&next===2&&!scriptedLearningActive())showLearningTip("tools","Cette quête est à toi","Tu joues librement. Essaie Indice pour apprendre une nouvelle déduction : les indices sont offerts jusqu’à la quête 10. Vérifier examine tes choix.");persistAttemptBoard();
 const q=state.flat().filter(v=>v===2).length;
 if(q===n&&!scriptedLearningActive())render()
};board.appendChild(d)
 }
 let q=state.flat().filter(v=>v===2).length;const countEl=document.getElementById("count");countEl.textContent=q+"/"+n;rewardProgressPulse(q);updateScriptedLearning();
 if(q===n&&(!scriptedLearningActive()||learningStage==="complete")){
   // Victory must validate the placed Guardians themselves.
   // Manual/automatic exclusion marks must never make a correct completed board fail.
   const {placed,rows,cols,regs,nonTouching,conflicts}=validateGuardians();
   if(placed.length===n&&rows.size===n&&cols.size===n&&regs.size===n&&nonTouching){
     msg.textContent="Constellation complète.";
     celebrateSuccess();
   }else if(placed.length===n){
     // There is no explicit "Validate" action: reaching n guardians can be a
     // transient state while correcting a tap. Never turn that into a mastery
     // fault automatically.
     hi=null;hiCells=[];
     msg.textContent="Cette constellation ne fonctionne pas encore. Tu peux la corriger ou demander un indice.";
   }
 }
}

function broadClue(h){
 if(!h||!h.detail)return null;
 let d=h.detail;
 if(d.rule==="single"){
  const cells=(d.source&&d.source.length?d.source:[h.cell]).map(cell=>cell.slice());
  if(d.axis==="row")return {text:`Sur la ligne ${d.index+1}, il ne reste qu’une possibilité : la case surlignée.`,cells};
  if(d.axis==="col")return {text:`Dans la colonne ${d.index+1}, il ne reste qu’une possibilité : la case surlignée.`,cells};
  if(d.axis==="region")return {text:"Dans ce territoire, il ne reste qu’une possibilité : la case surlignée.",cells};
 }
 return null;
}
function clearHintDisplay(){
 hi=null;hiCells=[];hintStage=0;hintFocus=null;const card=document.getElementById("hintCard");if(card)card.hidden=true;
}
function showHintMessage(text){
 learningTip=null;document.getElementById("scriptedLearn").hidden=true;
 const raw=String(text||""),card=document.getElementById("hintCard"),title=document.getElementById("hintTitle"),copy=document.getElementById("hintCopy");
 if(!card||!title||!copy){msg.textContent=raw;return}
 let label="Indice Lumen",body=raw;
 const match=raw.match(/^(Piste|Indice final|Indice|À jouer|Marquage manquant|⚠️ Erreur)\s*:\s*(.*)$/s);
 if(match){label=match[1]==="⚠️ Erreur"?"À vérifier":match[1]==="Marquage manquant"?"Marquage à compléter":match[1];body=match[2]}
 title.textContent=label;copy.textContent=body+(levelIndex===1&&hintUsesThisGame===1?" Cet indice est offert. Tu peux demander une explication plus précise si tu en as besoin.":"");card.hidden=false;msg.textContent="";
}
document.getElementById("hint").onclick=()=>{
 if(scriptedLearningActive())return;
 if(levelIndex===1&&hintUsesThisGame===0)showLearningTip("hint-learning","Apprends avec les indices","Un indice t’explique une déduction logique plutôt que de jouer à ta place. Ils sont offerts jusqu’à la quête 10 : utilise-les pour apprendre les raisonnements.");
 if(!consumeHintCost())return;
 hi=null; hiCells=[];

 // 1. Always correct a player mistake before giving new information.
 let err=playerError();
 if(err){
  hi=err.cell; hintStage=0; hintFocus=null;
  showHintMessage("⚠️ Erreur : "+err.text);
  render(); return;
 }

 // 2. Point out a missing obvious cross caused directly by a placed diamond.
 let dx=directMissingCross();
 if(dx){
  hi=[dx[0],dx[1]]; hintStage=0; hintFocus=null;
  showHintMessage("Marquage manquant : "+dx[2]+" Tu peux écarter la case surlignée.");
  render(); return;
 }

 // 3. Prefer the simplest valid explanation, then fall back to the strict proof engine.
 let h=simpleForcedPlacement()||proofEngine(); proofs=h.why||{};

 if(h.kind==="elim"){
  let d=h.detail, id="e:"+h.cell.join(",")+":"+(d?d.rule:"");
  if(hintFocus!==id){hintFocus=id;hintStage=1}else hintStage++;

  if(d&&d.rule==="contradiction"){
   hi=h.cell;hiCells=[];
   if(hintStage===1){
    showHintMessage(`Piste : teste mentalement la case L${h.cell[0]+1}C${h.cell[1]+1}. Suppose qu'elle accueille un Gardien et suis les contraintes : ligne, colonne, territoire et cases voisines.`);
    render();return;
   }
   if(hintStage===2){
    showHintMessage(`Indice : cette hypothèse finit par rendre au moins une ligne, colonne ou territoire impossible à compléter. La case peut donc être éliminée sans choisir au hasard.`);
    render();return;
   }
   showHintMessage(`À jouer : tu peux écarter L${h.cell[0]+1}C${h.cell[1]+1}. C'est une élimination par contradiction.`);
   render();return;
  }

  if(d&&d.rule==="group"){
   hiCells=d.source.slice();
   let word=d.axis==="col"?"colonnes":"lignes";
   let nums=d.indices.map(x=>x+1).join(" et ");
   if(hintStage===1){
    showHintMessage(`Piste : observe ensemble les territoires surlignés. Leurs Gardiens ne peuvent se placer que dans ${d.indices.length} ${word}. Essaie d'identifier lesquelles.`);
    render();return;
   }
   if(hintStage===2){
    showHintMessage(`Indice : ces ${d.regions.length} territoires doivent placer ${d.regions.length} Gardiens dans exactement les ${word} ${nums}. Ces ${word} sont donc entièrement réservées à ces territoires.`);
    render();return;
   }
   hiCells=d.source.concat([h.cell]);
   showHintMessage(`À jouer : L${h.cell[0]+1}C${h.cell[1]+1} appartient à un autre territoire mais utilise une de ces ${word}. Tu peux l’écarter.`);
   render();return;
  }

  if(d&&d.rule==="locked"){
   hiCells=d.source.slice();
   let axisName=d.axis==="col"?"colonne":"ligne", num=d.index+1;
   if(hintStage===1){
    showHintMessage(`Piste : observe les ${d.source.length} cases surlignées de ce territoire. Elles sont toutes sur la même ${axisName}. Qu'est-ce que cela implique pour le Gardien de ce territoire ?`);
    render();return;
   }
   if(hintStage===2){
    showHintMessage(`Indice : le Gardien de ce territoire sera forcément quelque part sur la ${axisName} ${num}. Comme une ${axisName} ne peut accueillir qu'un seul Gardien, aucune case de cette ${axisName} située hors du territoire ne peut en accueillir.`);
    render();return;
   }
   hiCells=d.source.concat([h.cell]);
   showHintMessage(`À jouer : L${h.cell[0]+1}C${h.cell[1]+1} est hors de ce territoire mais sur la ${axisName} ${num}. Tu peux donc l’écarter.`);
   render();return;
  }

  hi=h.cell;hiCells=[];
  if(hintFocus!==id||hintStage<=1){
   showHintMessage("Piste : regarde la case surlignée et la contrainte qui agit sur elle. Essaie d'identifier pourquoi elle ne peut pas accueillir de Gardien.");
  }else{
   showHintMessage("Indice : "+h.text+` Tu peux donc écarter L${h.cell[0]+1}C${h.cell[1]+1}.`);
  }
  render(); return;
 }

 if(h.kind==="place"){
  if(h.detail&&h.detail.rule==="contradiction-place"){
   let id="cp:"+h.cell.join(",");
   if(hintFocus!==id){hintFocus=id;hintStage=1}else hintStage++;
   hi=h.cell;hiCells=[];
   if(hintStage===1){
    showHintMessage(`Piste : les déductions déjà faites réduisent fortement les configurations possibles. Regarde la case surlignée et vérifie ce qui se passe si tu essaies de l'éviter.`);
    render();return;
   }
   if(hintStage===2){
    showHintMessage(`Indice : toutes les configurations encore compatibles imposent un Gardien sur cette case. Ce n'est pas un choix au hasard : l'alternative mène à une contradiction.`);
    render();return;
   }
   showHintMessage(`À jouer : place un Gardien en L${h.cell[0]+1}C${h.cell[1]+1}.`);
   render();return;
  }
  let id=h.cell.join(",");
  if(hintFocus!==id){hintFocus=id;hintStage=1}else hintStage++;

  // 4. First press: only direct attention.
  if(hintStage===1){
   let clue=broadClue(h);
   if(!clue){
    hintStage=0;hintFocus=null;
    showHintMessage("Indice refusé : le moteur connaît une case forcée mais ne possède pas une preuve pédagogique suffisante.");
    render();return;
   }
   hi=null;hiCells=clue.cells||[];
   showHintMessage("Piste : "+clue.text);
   render();return;
  }
  // 5. Second press: explain the logical rule, but don't say "place a diamond" yet.
  if(hintStage===2){
   hi=h.cell;hiCells=[];
   showHintMessage("Indice : "+h.text+" Vérifie toi-même les autres possibilités avant de jouer.");
   render();return;
  }
  // 6. Third press: reveal the forced placement as last resort.
  hi=h.cell;hiCells=[];
  showHintMessage(`Indice final : la case L${h.cell[0]+1}C${h.cell[1]+1} est forcée. Tu peux y placer un Gardien.`);
  render();return;
 }

 hintStage=0;hintFocus=null;
 showHintMessage("Cette quête a échoué au solveur explicable. Elle ne devrait pas être dans le catalogue.");
};

const testModel={
get n(){return n},set n(value){n=value},
get puz(){return puz},set puz(value){puz=value},
get state(){return state},set state(value){state=value},
get celebrated(){return celebrated},set celebrated(value){celebrated=value},
get lumenProgress(){return lumenProgress},set lumenProgress(value){lumenProgress=value},
get ac(){return ac},
get levelIndex(){return levelIndex},set levelIndex(value){levelIndex=value},
get replayMode(){return replayMode},set replayMode(value){replayMode=value},
get learningIntroStep(){return learningIntroStep},set learningIntroStep(value){learningIntroStep=value}
};
const runHintTests=createHintTestSuite(testModel,{handleSuccessAdvance,getSkyTourSteps:()=>SKY_TOUR_STEPS,maybeShowAutoCrossUnlock,maybeShowBadgeMilestone,saveLumenNickname,maybeOfferInstall,lumenShareUrl,successAchievement,shareLumenResult,captureReferral,enableLumenPush,markLumenSeen,maybeOfferPush,board,key,simpleForcedPlacement,proofEngine,playerError,guidedConflictForAction,scriptedLearningActive,maybeShowManualCrossTip,showGuidedConflict,configureLearningMode,maybeShowAutonomy,hideSuccess,celebrateSuccess,paintCell,paintBoardState,moveDragCross,updateLiveReward,render,celebrateConstellationReveal,showSkyReveal,closeAutonomyOverlay,setupOutsideDefaults,openJourneyMap:()=>openJourneyMap,closeMapOverlay:()=>closeMapOverlay,renderMap:()=>renderMap,advanceToNextPuzzle,startReplay});
let runTestsButton=document.getElementById("runTests");
if(runTestsButton)runTestsButton.onclick=runHintTests;

const hintClose=document.getElementById("hintClose");
if(hintClose)hintClose.onclick=()=>{clearHintDisplay();hintStage=0;hintFocus=null;render()};
document.getElementById("undo").onclick=()=>{if(celebrated||scriptedLearningActive())return;if(hist.length){const previous=hist.pop(),pending=attemptEngine.snapshot()?.wrongGuardianPending;if(pending){const [pr,pc]=pending.split(",").map(Number);if(previous?.[pr]?.[pc]!==2)attemptEngine.clearWrongGuardianPending(pending)}state=previous;clearHintDisplay();hintStage=0;hintFocus=null;msg.textContent="";render();persistAttemptBoard()}};
const ac=document.getElementById("autoCross");
const lumenAutoCrossStored=localStorage.getItem("lumenAutoCross");const legacyAutoCrossStored=localStorage.getItem("regaliaAutoCross");ac.checked=(lumenAutoCrossStored??legacyAutoCrossStored)!=="0";if(lumenAutoCrossStored===null&&legacyAutoCrossStored!==null){localStorage.setItem("lumenAutoCross",legacyAutoCrossStored);localStorage.removeItem("regaliaAutoCross")};
ac.onchange=()=>{if(celebrated){ac.checked=!ac.checked;return}if(levelIndex<=4&&!replayMode){ac.checked=false;return}if(ac.checked){autoUsedThisGame=true;attemptEngine.markAssistance();trackAttemptEvent("auto_marking_enabled")}localStorage.setItem("lumenAutoCross",ac.checked?"1":"0");if(!ac.checked)maybeShowManualCrossTip();hi=null;render()};
function advanceToNextPuzzle(){
 if(canonicalActiveQuest){
  if(!questIsCompleted(lumenProgress,canonicalActiveQuest.id))return;
  const next=canonicalQuestByOrdinal(canonicalActiveQuest.ordinal+1);
  if(next?.legacyIndex===null&&canonicalQuestAvailable(next)){hideSuccess();startCanonicalQuest(next);return}
  canonicalActiveQuest=null;hideSuccess();
  if(next&&next.legacyIndex!==null&&questIsAccessible(next.legacyIndex)){
   levelIndex=next.legacyIndex;replayMode=!!lumenProgress.solved[levelIndex];
   for(const id of ["undo","hint","autoCross"])document.getElementById(id).disabled=false;
   loadPuzzle();refreshJourney();return;
  }
  openJourneyMap();return;
 }
 const canonicalPrevious=canonicalQuestForLegacy(levelIndex);
 const canonicalFollowing=canonicalPrevious&&canonicalQuestByOrdinal(canonicalPrevious.ordinal+1);
 if(lumenProgress.solved[levelIndex]&&canonicalFollowing?.legacyIndex===null&&!historicalContinuationAllowed(levelIndex+1)){
  if(canonicalQuestAvailable(canonicalFollowing)){hideSuccess();startCanonicalQuest(canonicalFollowing);return}
  // Do not skip an inserted quest just because the legacy numeric index continues.
  hideSuccess();openJourneyMap();return;
 }
 if(accountRequired()&&maybeOfferAccount()){accountOfferResumeNext=true;hideSuccess();return}
 if(!lumenProgress.solved[levelIndex])return;
 // Canonical order, not consecutive legacy storage IDs, controls unlocking.
 if(canonicalFollowing&&canonicalFollowing.legacyIndex!==null&&canonicalFollowing.legacyIndex!==levelIndex+1){hideSuccess();openJourneyMap();return}
 if(levelIndex===4&&!replayMode&&!socialChallenge&&typeof maybeOfferAccount==='function'&&maybeOfferAccount()){accountOfferResumeNext=true;hideSuccess();return}
 // "Quête suivante" is relative to the quest just played, including replays.
 // sequentialSolvedCount remains the highest unlocked campaign position.
 const next=levelIndex+1;
 replayMode=false;
 if(next>=currentQuestLimit())return;
 if(!questIsAccessible(next)){hideSuccess();openJourneyMap();skyNavigation.showLocked(packForLegacyQuest(next));return}
 document.getElementById("undo").disabled=false;document.getElementById("hint").disabled=false;document.getElementById("autoCross").disabled=false;
 hideSuccess();
 if(next<currentQuestLimit())levelIndex=next;
 loadPuzzle();usedHintThisGame=false;refreshJourney();
}
document.getElementById("successRetry").onclick=()=>{
 attemptEngine.clear();replayMode=true;
 hideSuccess();
 document.getElementById("undo").disabled=false;
 document.getElementById("hint").disabled=false;
 document.getElementById("autoCross").disabled=false;
 loadPuzzle();usedHintThisGame=false;refreshJourney();
};
document.getElementById("successSky").onclick=()=>{const played=canonicalActiveQuest||canonicalQuestForLegacy(levelIndex);const targetConstellationId=played?.constellationId||null;const targetLegacyIndex=played?.legacyIndex??CONTENT_CONSTELLATIONS.find(c=>c.id===targetConstellationId)?.questStart??levelIndex;hideSuccess();let learningTour=false;try{learningTour=levelIndex===7&&localStorage.getItem("lumenSkyTourSeen")!=="1"}catch(_){}openJourneyMap(true,{detail:true,advanceOnClose:true,learningTour,questIndex:targetLegacyIndex,constellationId:targetConstellationId})};
function learningSkyDiscoveryRequired(){return !canonicalActiveQuest&&levelIndex===7&&!replayMode&&!socialChallenge}
function updateLearningSuccessCTA(){
 const b=document.getElementById("successNew");if(!b)return;
 b.textContent=learningSkyDiscoveryRequired()?"✦ Découvrir Mon ciel":"Quête suivante";
}
function clearSkyTourFocus(){document.querySelectorAll(".sky-tour-focus").forEach(el=>el.classList.remove("sky-tour-focus"))}
function renderSkyTourStep(){
 const tour=document.getElementById("skyTour");if(!tour||tour.hidden)return;
 const step=SKY_TOUR_STEPS[Math.min(skyTourStep,SKY_TOUR_STEPS.length-1)],target=document.getElementById(step.target);
 document.getElementById("mapModal").dataset.tourTarget=step.target;
 skyNavigation.setView(["skyNavigation","sectorTabs"].includes(step.target)?"overview":"detail");
 document.getElementById("closeMap").disabled=skyTourStep<SKY_TOUR_STEPS.length-1;
 clearSkyTourFocus();if(target){target.classList.add("sky-tour-focus");target.scrollIntoView({behavior:"smooth",block:"center"})}
 document.getElementById("skyTourTitle").textContent=step.title;
 document.getElementById("skyTourCopy").textContent=step.copy;
 const next=document.getElementById("skyTourNext");next.textContent=skyTourStep===SKY_TOUR_STEPS.length-1?"Jouer la quête 9":"Suivant";
}
function advanceSkyTour(){
 if(skyTourStep<SKY_TOUR_STEPS.length-1){skyTourStep++;renderSkyTourStep();return}
 try{localStorage.setItem("lumenSkyTourSeen","1")}catch(_){}
 clearSkyTourFocus();closeMapOverlay();
}

function handleSuccessAdvance(){
 if(learningReplayActive()){
  hideSuccess();
  if(levelIndex===0){levelIndex=1;loadPuzzle()}else finishLearningReplay();
  return;
 }
 if(learningSkyDiscoveryRequired()){hideSuccess();openJourneyMap(true,{advanceOnClose:true,learningTour:true});return}
 advanceToNextPuzzle();
}
document.getElementById("successNew").onclick=handleSuccessAdvance;
const attemptMask=document.getElementById("attemptMask");
if(attemptMask)attemptMask.onclick=()=>{const a=attemptEngine.snapshot();if(a?.state===ATTEMPT_STATES.PAUSED)resumeGameClock();else if(a?.state===ATTEMPT_STATES.READY){ensureAttemptStarted();attemptMask.hidden=true}};
const attemptPause=document.getElementById("attemptPause");
if(attemptPause)attemptPause.onclick=()=>{const a=attemptEngine.snapshot();if(a?.state===ATTEMPT_STATES.RUNNING)pauseGameClock();else if(a?.state===ATTEMPT_STATES.PAUSED)resumeGameClock()};
const attemptAbandon=document.getElementById("attemptAbandon");
if(attemptAbandon)attemptAbandon.onclick=async()=>{const a=attemptEngine.snapshot();if(!a)return;if(!confirm("Abandonner cette tentative ?"))return;trackAttemptEvent("attempt_abandoned",{reason:"explicit"});attemptEngine.abandon();if(socialChallenge){trackLumenEvent("challenge_abandoned",levelIndex+1,currentAttemptAnalytics({reason:"explicit"}));await finishSocialChallenge("abandoned");return}attemptEngine.clear();init()};


let mapConstellation=0,skyTourStep=0,mapCatalogueOverride=null;
const skyNavigation=createSkyNavigation({document,getModel:()=>mapCatalogueOverride||contentMapModel(adventureAccessEntitlements(),{progress:lumenProgress,attempt:attemptEngine.snapshot()}),getQuest:()=>currentQuestPosition(),
 getSolved:i=>!!lumenProgress.solved[i],
 getCanonicalQuests:id=>canonicalQuestList().filter(q=>q.constellationId===id),
 getCanonicalSolved:q=>questIsCompleted(lumenProgress,q.id),
 getCanonicalAvailable:q=>canonicalQuestAvailable(q),getCanonicalPackQuests:id=>canonicalQuestList().filter(q=>q.packId===id),
 onCanonicalQuest:q=>startCanonicalQuest(q),getLit:entry=>CONSTELLATIONS[entry.legacyIndex]?constellationLitAt(entry.legacyIndex):0,getShape:entry=>astronomicalDisplayShape(entry.shape||CONSTELLATIONS[entry.legacyIndex]),getMastered:entry=>{const eligible=Array.from({length:entry.questCount},(_,offset)=>entry.questStart+offset).filter(i=>currentPerformanceEligibility(i).mastery);return eligible.length>0&&eligible.every(i=>lumenProgress.performances?.[i]?.badges?.mastery)},getBadgeCounts:entry=>{const badges={autonomy:0,speed:0,noError:0,mastery:0};const quests=entry.constellations?canonicalQuestList().filter(q=>q.packId===entry.id):canonicalQuestList().filter(q=>q.constellationId===entry.id);for(const quest of quests){const earned=quest.legacyIndex!==null?lumenProgress.performances?.[quest.legacyIndex]?.badges:lumenProgress.canonicalQuestState?.[quest.id]?.badges;for(const key of Object.keys(badges))if(earned?.[key])badges[key]++}return badges},onConstellation:entry=>{if(entry.canonicalOnly)return;if(mapConstellationRange(entry.legacyIndex)){mapConstellation=entry.legacyIndex;renderMap()}}});
const SKY_TOUR_STEPS=[
 {target:"skyNavigation",title:"Ciels et Aventures",copy:"Choisis un Ciel, puis une Aventure. Les autres restent compactes ; un cadenas indique un contenu verrouillé. Consulter une autre Aventure ne change pas ta progression."},
 {target:"sectorTabs",title:"Tes constellations",copy:"Ton ciel est organisé en constellations. Elles se débloquent au fil de ton aventure."},
 {target:"puzzleGrid",title:"Tes quêtes",copy:"Chaque constellation regroupe ses quêtes. Ici tu vois celles qui sont réussies, celle à jouer et celles encore verrouillées."},
 {target:"performanceLegend",title:"Tes performances",copy:"Les badges récompensent ta façon de résoudre une quête : autonomie, rapidité, sans erreur et maîtrise. Tu pourras revenir améliorer une quête réussie."},
 {target:"skyCard",title:"Ta constellation",copy:"Chaque réussite allume des étoiles. À mesure que tu avances, la constellation se dessine dans ton ciel."}
];
function starDisplayName(p,i){return p.stars&&p.stars[i]?p.stars[i]:"Étoile "+(i+1)}

function renderSky(index=mapConstellation){let el=document.getElementById("skyCard");if(!el)return;index=Math.max(0,Math.min(index,CONSTELLATIONS.length-1));let c=astronomicalDisplayShape(CONSTELLATIONS[index]),lit=constellationLitAt(index),p={index,...c,lit},active=index===constellationProgress().index,lines=p.edges.map(e=>'<line class="sky-line '+(e[0]<lit&&e[1]<lit?'on':'')+'" x1="'+p.pts[e[0]][0]+'" y1="'+p.pts[e[0]][1]+'" x2="'+p.pts[e[1]][0]+'" y2="'+p.pts[e[1]][1]+'"/>').join(""),stars=p.pts.map((v,i)=>'<g><circle class="sky-star '+(i<lit?'on':'')+'" cx="'+v[0]+'" cy="'+v[1]+'" r="'+(i<lit?4:3)+'"/>'+(i<lit?'<text class="sky-label" x="'+(v[0]+6)+'" y="'+(v[1]-5)+'">'+starDisplayName(p,i)+'</text>':'')+'</g>').join("");el.innerHTML='<div class="sky-head"><span class="sky-name">'+p.name+'</span><span>'+lit+' / '+p.count+' étoiles</span></div><svg class="sky-svg" viewBox="0 0 290 115">'+(astronomicalPrimarySvg({id:CONTENT_CONSTELLATIONS[index]?.id},lit,p.count)||lines+stars)+'</svg><div class="sky-note">'+(active?"Constellation active":lit===p.count?"Constellation complétée":lit===0?"Constellation à découvrir":"Constellation en cours")+'</div>'}

function celebrateConstellationReveal(){
 const o=document.getElementById("skyReveal"),card=o?.querySelector(".sky-reveal-card");if(!o||!card)return;
 o.classList.add("complete-celebration");
 const bravo=document.createElement("div");bravo.className="sky-bravo";bravo.textContent="BRAVO !";card.insertBefore(bravo,document.getElementById("skyRevealTitle"));
 for(let i=0;i<28;i++){const s=document.createElement("span");s.className="sky-spark";s.textContent=i%3?"✦":"★";s.style.left=(8+(i*31)%84)+"vw";s.style.top=(28+(i*17)%55)+"vh";s.style.animationDelay=((i%8)*.08)+"s";document.body.appendChild(s);setTimeout(()=>s.remove(),2500)}
 setTimeout(()=>o.classList.remove("complete-celebration"),3800);
}
function showSkyReveal(beforeEarned=null,checkpoint=null){
 const after=skyStarsEarned(),crossed=beforeEarned!==null&&after>beforeEarned;
 const completed=[];
 if(crossed){let total=0;for(let i=0;i<CONSTELLATIONS.length;i++){total+=CONSTELLATIONS[i].count;if(beforeEarned<total&&after>=total)completed.push(i)}}
 const completedIndex=completed.length?completed[completed.length-1]:-1;
 const p=completedIndex>=0?{index:completedIndex,...CONSTELLATIONS[completedIndex],lit:CONSTELLATIONS[completedIndex].count}:checkpoint?{index:checkpoint.index,...CONSTELLATIONS[checkpoint.index],lit:checkpoint.lit}:constellationProgress();
 const idx=Math.max(0,p.lit-1),canvas=document.getElementById("skyRevealCanvas"),o=document.getElementById("skyReveal"),k=document.getElementById("skyRevealKicker"),t=document.getElementById("skyRevealTitle");
 if(completedIndex>=0){
   constellationSound();
   k.textContent="CONSTELLATION COMPLÉTÉE";
   t.textContent="✦ "+p.name.replace(" · Grand Chariot","");
   document.getElementById("skyRevealName").textContent=completedIndex<CONSTELLATIONS.length-1?"La constellation suivante est maintenant à découvrir.":"Ton ciel est entièrement révélé.";
 }else if(checkpoint){
   k.textContent=checkpoint.stage===1?"TON CIEL PREND FORME":"PRESQUE RÉVÉLÉE";
   t.textContent="✦ "+p.name.replace(" · Grand Chariot","");
   const remaining=p.count-p.lit;
   document.getElementById("skyRevealName").textContent=checkpoint.stage===1?"La constellation prend forme. Continue à l’illuminer.":remaining===1?"Plus qu’une étoile avant de la révéler.":"Plus que "+remaining+" étoiles avant de la révéler.";
 }else{
   k.textContent="NOUVELLE ÉTOILE";
   t.textContent="Une nouvelle étoile s’allume";
   document.getElementById("skyRevealName").textContent=starDisplayName(p,idx)+" · "+p.name;
 }
 let lines=p.edges.map(e=>{let on=e[0]<p.lit&&e[1]<p.lit,newLine=on&&(e[0]===idx||e[1]===idx);return '<line class="sky-line '+(on?'on ':'')+(newLine?'new-line':'')+'" x1="'+p.pts[e[0]][0]+'" y1="'+p.pts[e[0]][1]+'" x2="'+p.pts[e[1]][0]+'" y2="'+p.pts[e[1]][1]+'"/>'}).join("");
 let stars=p.pts.map((v,i)=>'<circle class="sky-star '+(i<p.lit?'on ':'')+(i===idx?'new-star':'')+'" cx="'+v[0]+'" cy="'+v[1]+'" r="'+(i===idx?6:i<p.lit?4:3)+'"/>').join("");
 canvas.innerHTML='<svg class="sky-reveal-svg" viewBox="0 0 290 115">'+(astronomicalPrimarySvg({id:CONTENT_CONSTELLATIONS[p.index]?.id},p.lit,p.count)||lines+stars)+'</svg><div>'+p.lit+' / '+p.count+' étoiles</div>';o.hidden=false;
 const result=document.getElementById("skyRevealResults"),continueButton=document.getElementById("skyRevealContinue");
 const victory=document.getElementById("successOverlay");
 const isNormalVictory=!!victory&&!document.getElementById("successNew")?.hidden&&!document.getElementById("successRetry")?.hidden;
 if(result&&continueButton){
  result.hidden=!isNormalVictory;
  continueButton.hidden=isNormalVictory;
  if(isNormalVictory){
   document.getElementById("skyRevealTime").textContent=document.getElementById("successTime")?.textContent||"";
   document.getElementById("skyRevealRewards").innerHTML=document.getElementById("successRewards")?.innerHTML||"";
   document.getElementById("skyRevealRewards").className="sky-reveal-rewards "+(document.getElementById("successRewards")?.className||"");
   const feedback=document.getElementById("skyRevealFeedback");
   feedback.replaceChildren();
   const source=document.getElementById("difficultyBox");
   if(source&&!source.hidden){
    const copy=source.cloneNode(true);copy.removeAttribute("id");
    copy.querySelectorAll("button[data-rating]").forEach(b=>b.onclick=()=>source.querySelector('button[data-rating="'+b.dataset.rating+'"]')?.click());
    feedback.appendChild(copy);
   }
   for(const [target,sourceId] of [["skyRevealNext","successNew"],["skyRevealSky","successSky"],["skyRevealShare","successShare"],["skyRevealRetry","successRetry"]]){
    const button=document.getElementById(target),original=document.getElementById(sourceId);
    button.hidden=!!original?.hidden;
    button.onclick=()=>{if(target==="skyRevealNext"&&adventurePending){const completed=adventurePending;adventurePending=null;closeUnifiedSkyReveal();original?.click();openJourneyMap();skyNavigation.showCompletion(completed);return}if(closeUnifiedSkyReveal())return;original?.click()};
   }
  }
 }
 if(completedIndex>=0)celebrateConstellationReveal();
}
function closeUnifiedSkyReveal(){
 const o=document.getElementById("skyReveal");
 o.hidden=true;o.classList.remove("complete-celebration");
 o.querySelectorAll(".sky-bravo").forEach(x=>x.remove());
 document.querySelectorAll(".sky-spark").forEach(x=>x.remove());
 if(adventurePending){const completed=adventurePending;adventurePending=null;hideSuccess();openJourneyMap();skyNavigation.showCompletion(completed);return true}
 if(endgamePending){endgamePending=false;showEndgameCelebration();return true}
 return false;
}
document.getElementById("skyRevealContinue").onclick=()=>{const completedReveal=document.getElementById("skyReveal").classList.contains("complete-celebration");if(closeUnifiedSkyReveal())return;document.getElementById("successOverlay").classList.add("show");if(completedReveal)setTimeout(maybeOfferAccount,450)};
function renderXP(){let q=bonusChallengeFor(levelIndex),m=milestoneFor(levelIndex),ch=m||q,box=document.getElementById("challengeBanner");if(!box)return;box.hidden=!ch;if(ch){let done=q&&lumenProgress.stars[q.id];document.getElementById("challengeTitle").textContent=ch.title+(done?" · ★":"");document.getElementById("challengeCopy").textContent=done?"Bonus obtenu":ch.copy}}

function refreshJourney(){awards();let sky=constellationProgress(),earned=skyStarsEarned(),completed=CONSTELLATIONS.slice(0,sky.index).length;
document.getElementById("progressFill").style.width=(sky.count?Math.round(sky.lit/sky.count*100):0)+"%";
document.getElementById("progressText").textContent=completed+" constellation"+(completed>1?"s":"")+" découverte"+(completed>1?"s":"");
let ss=document.getElementById("skySummary");if(ss)ss.textContent=sky.name.replace(" · Grand Chariot","")+" · "+sky.lit+"/"+sky.count+" ★";
document.getElementById("journeyTitle").textContent=sky.name.replace(" · Grand Chariot","");
document.getElementById("sectorProgress").textContent=sky.lit+"/"+sky.count+" étoiles · "+earned+"/"+SKY_TARGET+" dans le ciel";
updateHintButton();renderXP();if(!document.getElementById("mapModal").hidden)skyNavigation.render();
}

function performanceIcon(type){const icons={autonomy:'<span aria-hidden="true">🧠</span>',speed:'<span aria-hidden="true">⚡</span>',noError:'<span aria-hidden="true">✓</span>',mastery:'<span aria-hidden="true">✦</span>'};return icons[type]||""}
function performanceBadges(i){
 const p=lumenProgress.performances?.[i],earned=p?.version>=2?p.badges||{}:{},eligibility=currentPerformanceEligibility(i);
 const badges=[{cls:"autonomy",key:"autonomy",label:"Autonomie"},{cls:"speed",key:"speed",label:"Rapidité"},{cls:"no-error",key:"noError",label:"Sans erreur"},{cls:"mastery",key:"mastery",label:"Maîtrise"}];
 const remaining=badgeCooldownRemaining(p);const statusLabel=remaining?`Badges en pause : ${badgeCooldownLabel(remaining)}`:"Badges disponibles";
 const status="";
  return '<span class="performance-grid" aria-label="Performance">'+badges.map(x=>{const locked=!eligibility[x.key],got=!!earned[x.key],state=locked?" verrouillé":got?" obtenu":" disponible";return '<span class="performance-slot '+x.cls+(got?' earned':'')+(locked?' locked':'')+'" title="'+x.label+state+'" aria-label="'+x.label+state+'">'+(locked?'🔒':got?performanceIcon(x.key):'')+'</span>'}).join("")+'</span>'+status
}
function canonicalPerformanceBadges(questId){
 const earned=lumenProgress.canonicalQuestState?.[questId]?.badges||{};
 const entries=[{cls:"autonomy",key:"autonomy",label:"Autonomie"},{cls:"speed",key:"speed",label:"Rapidité"},{cls:"no-error",key:"noError",label:"Sans erreur"},{cls:"mastery",key:"mastery",label:"Maîtrise"}];
 return '<span class="performance-grid" aria-label="Performance">'+entries.map(x=>{
  const got=!!earned[x.key],state=got?" obtenu":" disponible";
  return '<span class="performance-slot '+x.cls+(got?' earned':'')+'" title="'+x.label+state+'" aria-label="'+x.label+state+'">'+(got?performanceIcon(x.key):'')+'</span>';
 }).join("")+'</span>';
}
function launchReplay(i){canonicalActiveQuest=null;levelIndex=i;replayMode=true;document.getElementById("mapModal").hidden=true;document.getElementById("undo").disabled=false;document.getElementById("hint").disabled=false;document.getElementById("autoCross").disabled=false;loadPuzzle();usedHintThisGame=false;refreshJourney()}
function startReplay(i){
 if(!lumenProgress.solved[i])return;
 const remaining=badgeCooldownRemaining(lumenProgress.performances?.[i]);
 if(!remaining){launchReplay(i);return}
 const modal=document.getElementById("replayCooldownModal");
 if(!modal)return;
 const cancel=document.getElementById("replayCooldownCancel"),play=document.getElementById("replayCooldownPlay");
 const delay=document.getElementById("replayCooldownDelay");
 delay.textContent=badgeCooldownLabel(remaining)+". Tu pourras alors tenter de gagner de nouveaux badges.";
 const close=()=>{modal.hidden=true;document.removeEventListener("keydown",onKey);cancel.onclick=null;play.onclick=null};
 const onKey=e=>{if(e.key==="Escape"){e.preventDefault();close()}else if(e.key==="Tab"){const target=e.shiftKey?cancel:play;if(document.activeElement===(e.shiftKey?cancel:play)){e.preventDefault();(e.shiftKey?play:cancel).focus()}}};
 cancel.onclick=()=>{close();document.getElementById("closeMap")?.focus()};
 play.onclick=()=>{close();launchReplay(i)};
 document.addEventListener("keydown",onKey);
 modal.hidden=false;cancel.focus();
}
function renderMap(){
 maybeShowStreakLoss();
 // Refresh the streak from the same live daily state used by its help dialog.
 // Previously this card retained the initial 0 until another daily event fired.
 renderDaily();
 skyNavigation.render();const puzzleGrid=document.getElementById("puzzleGrid");
 puzzleGrid.innerHTML="";let range=mapConstellationRange(mapConstellation)||constellationGridRange(mapConstellation);for(const [offset,i] of range.quests.entries()){let solved=!!lumenProgress.solved[i],current=i===currentQuestPosition()&&questIsAccessible(i),b=document.createElement("button"),pos=offset+1,meta=performanceBadges(i);b.className="puzzle-card"+(solved?" done":"")+(current?" current":"")+(!solved&&!current?" locked":"")+(solved&&badgeCooldownRemaining(lumenProgress.performances?.[i])?" badge-on-cooldown":"");b.innerHTML=solved?meta:(current?'<span class="puzzle-new-icon">✦</span><span class="puzzle-new-label">Nouvelle</span><span class="puzzle-new-number">Quête '+pos+'</span>':'<span class="puzzle-lock-only" aria-hidden="true">🔒</span>');b.title=solved?"Rejouer la quête "+pos+" pour améliorer ta performance":current?"Nouvelle quête disponible · quête "+pos:"Quête "+pos+" · verrouillée";b.onclick=()=>{if(solved&&questIsAccessible(i)){startReplay(i);return}if(!current)return;canonicalActiveQuest=null;levelIndex=i;replayMode=false;document.getElementById("mapModal").hidden=true;loadPuzzle();refreshJourney()};puzzleGrid.appendChild(b)}
 // Use the same canonical quest collection as the cockpit. Historic range.quests
 // omits inserted grids, which previously left Grande Ourse at only six cards.
 const mappedConstellation=CONTENT_CONSTELLATIONS[mapConstellation];
 if(mappedConstellation){
  const canonicalCards=canonicalQuestList().filter(q=>q.constellationId===mappedConstellation.id);
  if(canonicalCards.length){
   puzzleGrid.replaceChildren();
   for(const [offset,quest] of canonicalCards.entries()){
    const legacy=quest.legacyIndex;
    const solved=legacy!==null?!!lumenProgress.solved?.[legacy]:!!lumenProgress.canonicalQuestState?.[quest.id]?.solved;
    const available=legacy===null?canonicalQuestAvailable(quest):questIsAccessible(legacy);
    const button=document.createElement("button");
    button.type="button";
    button.className="puzzle-card"+(solved?" done":"")+(available&&!solved?" current":"")+(!available&&!solved?" locked":"")+(solved&&legacy!==null&&badgeCooldownRemaining(lumenProgress.performances?.[legacy])?" badge-on-cooldown":"");
    button.dataset.questId=quest.id;
    button.title="Quête "+quest.ordinal+(solved?(available?" · terminée, rejouable":" · terminée, compte à synchroniser"):available?" · disponible":(!qaActive&&(!lumenUser||!cloudProfileReady)?" · connexion et synchronisation requises":" · termine d’abord les quêtes précédentes"));
    const lockReason=!qaActive&&(!lumenUser||!cloudProfileReady)?"Connecte-toi pour synchroniser ta progression":"Termine les quêtes précédentes";
     button.innerHTML=legacy!==null&&solved?performanceBadges(legacy):solved?canonicalPerformanceBadges(quest.id):available?'<span class="puzzle-new-icon">✦</span><span class="puzzle-new-label">Nouvelle</span><span class="puzzle-new-number">Quête '+quest.ordinal+'</span>' :'<span class="puzzle-lock-only" aria-hidden="true">🔒</span>';
     button.setAttribute("aria-label",`Quête ${quest.ordinal} · ${available?(solved?"terminée, rejouable":"disponible"):lockReason}`);
    button.disabled=!available;
    if(available)button.onclick=()=>{
     if(legacy===null){startCanonicalQuest(quest);return}
     if(solved){startReplay(legacy);return}
     canonicalActiveQuest=null;levelIndex=legacy;replayMode=false;
     document.getElementById("mapModal").hidden=true;loadPuzzle();refreshJourney();
    };
    puzzleGrid.appendChild(button);
   }
  }
 }
 if(range.generated){const summary=generatedMapSummary(mapConstellation,lumenProgress.solved);const skyCard=document.getElementById("skyCard");if(skyCard&&summary)skyCard.textContent=summary.name+" · "+summary.completed+"/"+summary.total+" quêtes · "+generatedAdventureRewards(lumenProgress.solved).stars+" ★";}else renderSky(mapConstellation)
}
// Refresh cooldown icons while Mon ciel is visible; no additional gameplay scroll.
let badgeCooldownRefreshTimer=null;
function startBadgeCooldownRefresh(){
 if(badgeCooldownRefreshTimer)clearInterval(badgeCooldownRefreshTimer);
 badgeCooldownRefreshTimer=setInterval(()=>{
  if(document.getElementById("mapModal")?.hidden){clearInterval(badgeCooldownRefreshTimer);badgeCooldownRefreshTimer=null;return}
  document.querySelectorAll("#puzzleGrid .puzzle-card").forEach((card,offset)=>{
   const range=mapConstellationRange(mapConstellation)||constellationGridRange(mapConstellation);
   const index=range?.quests?.[offset];
   if(index===undefined||!lumenProgress.solved[index])return;
   const html=performanceBadges(index);
   if(card.innerHTML!==html)card.innerHTML=html;
  });
 },15000);
}
function openJourneyMap(focusSky=false,{detail=false,advanceOnClose=false,learningTour=false,questIndex=null,constellationId=null}={}){const skyQuestIndex=Number.isInteger(questIndex)?questIndex:levelIndex;mapConstellation=constellationId?CONTENT_CONSTELLATIONS.findIndex(c=>c.id===constellationId):-1;if(mapConstellation<0)mapConstellation=CONTENT_CONSTELLATIONS.findIndex(c=>c.questIndices.includes(skyQuestIndex));if(mapConstellation<0)mapConstellation=chapterForGrid(skyQuestIndex);const modal=document.getElementById("mapModal");modal.hidden=false;skyNavigation.open({detail,questIndex:skyQuestIndex,constellationId});renderMap();startBadgeCooldownRefresh();const tour=document.getElementById("skyTour");document.getElementById("closeMap").disabled=learningTour;if(tour)tour.hidden=!learningTour;if(learningTour){skyTourStep=0;requestAnimationFrame(renderSkyTourStep)}else clearSkyTourFocus();modal.dataset.advanceOnClose=advanceOnClose&&!!lumenProgress.solved[levelIndex]?"1":"";const attemptMask=document.getElementById("attemptMask");if(attemptMask)attemptMask.hidden=true;document.getElementById(learningTour?"skyTourNext":"closeMap").focus();}

const performanceLegend=document.getElementById("performanceLegend"),badgeRulesModal=document.getElementById("badgeRulesModal"),closeBadgeRules=document.getElementById("closeBadgeRules");function openBadgeRules(){if(badgeRulesModal){badgeRulesModal.hidden=false;closeBadgeRules&&closeBadgeRules.focus()}}function hideBadgeRules(){if(badgeRulesModal){badgeRulesModal.hidden=true;performanceLegend&&performanceLegend.focus()}}if(performanceLegend){performanceLegend.onclick=openBadgeRules;performanceLegend.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openBadgeRules()}}}if(closeBadgeRules)closeBadgeRules.onclick=hideBadgeRules;if(badgeRulesModal)badgeRulesModal.onclick=e=>{if(e.target===badgeRulesModal)hideBadgeRules()};document.addEventListener("keydown",e=>{if(e.key==="Escape"&&badgeRulesModal&&!badgeRulesModal.hidden)hideBadgeRules()});
const shardMeter=document.getElementById("shardMeter"),shardRulesModal=document.getElementById("shardRulesModal"),closeShardRules=document.getElementById("closeShardRules");function openShardRules(){if(shardRulesModal){shardRulesModal.hidden=false;closeShardRules&&closeShardRules.focus()}}function hideShardRules(){if(shardRulesModal){shardRulesModal.hidden=true;shardMeter&&shardMeter.focus()}}if(shardMeter){shardMeter.onclick=openShardRules;shardMeter.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openShardRules()}}}if(closeShardRules)closeShardRules.onclick=hideShardRules;if(shardRulesModal)shardRulesModal.onclick=e=>{if(e.target===shardRulesModal)hideShardRules()};document.addEventListener("keydown",e=>{if(e.key==="Escape"&&shardRulesModal&&!shardRulesModal.hidden)hideShardRules()});
function bindOutsideDefault(id,action){
 const o=document.getElementById(id);if(!o)return;
 o.addEventListener("click",e=>{if(e.target!==o)return;e.preventDefault();action()});
}
function dismissInstallLater(){const o=document.getElementById("installOptin");if(!o||o.hidden)return;o.hidden=true;try{localStorage.setItem(qaKey("lumenInstallLater"),String(Date.now()))}catch(_){}trackLumenEvent("pwa_install_later",null,{qa:qaActive})}
function dismissPushLater(){const o=document.getElementById("pushOptin");if(!o||o.hidden)return;o.hidden=true;try{localStorage.setItem("lumenPushChoice","later")}catch(_){}}
function continueSkyReveal(){document.getElementById("skyRevealContinue")?.click()}
function startQuestFromOverlay(){document.getElementById("questGo")?.click()}
function closeAutonomyOverlay(){finishAutonomyChoice(false);resumeGameClock()}
function closeMapOverlay(){const o=document.getElementById("mapModal");if(!o)return;if(!document.getElementById("skyTour").hidden&&skyTourStep<SKY_TOUR_STEPS.length-1)return;const advance=o.dataset.advanceOnClose==="1";o.hidden=true;const tour=document.getElementById("skyTour");if(tour)tour.hidden=true;o.dataset.advanceOnClose="";if(advance){advanceToNextPuzzle();return}updateAttemptUI();document.getElementById("openSky").focus()}
function setupOutsideDefaults(){
 const successOverlay=document.getElementById("successOverlay");
 if(successOverlay)successOverlay.addEventListener("click",e=>{if(e.target!==successOverlay)return;e.preventDefault();if(learningSkyDiscoveryRequired())return;handleSuccessAdvance()});
 bindOutsideDefault("skyReveal",continueSkyReveal);
 bindOutsideDefault("questStart",startQuestFromOverlay);
 bindOutsideDefault("autonomyOverlay",closeAutonomyOverlay);
 bindOutsideDefault("mapModal",closeMapOverlay);
 bindOutsideDefault("installOptin",dismissInstallLater);
 bindOutsideDefault("accountOptin",dismissAccountOffer);
 bindOutsideDefault("pushOptin",dismissPushLater);
 // badgeRulesModal, shardRulesModal and feedbackModal already close on their backdrop.
 // Guided explanations and verification corrections deliberately require their explicit action.
 const tutorial=document.getElementById("tutorialOverlay");
 if(tutorial)tutorial.addEventListener("click",e=>{if(e.target!==tutorial)return;let seen=false;try{seen=localStorage.getItem(qaActive?"lumenQaTutorialSeen":"lumenTutorialSeen")==="1"}catch(_){}if(seen)closeTutorial(false)});
}
const skyTourNext=document.getElementById("skyTourNext");if(skyTourNext)skyTourNext.onclick=advanceSkyTour;
const endgameBadges=document.getElementById("endgameBadges"),endgameSky=document.getElementById("endgameSky");
if(endgameBadges)endgameBadges.onclick=()=>closeEndgameToSky(false);
if(endgameSky)endgameSky.onclick=()=>closeEndgameToSky(true);
const endgameOverlay=document.getElementById("endgameOverlay");if(endgameOverlay)endgameOverlay.addEventListener("click",e=>{if(e.target===endgameOverlay)closeEndgameToSky(true)});


const openSky=document.getElementById("openSky");if(openSky)openSky.onclick=()=>openJourneyMap(true);
document.getElementById("closeMap").onclick=closeMapOverlay;document.getElementById("hint").addEventListener("click",()=>{if(!hintWasGranted)return;attemptEngine.markAssistance();hintWasGranted=false;trackAttemptEvent("hint_used",{hint_number:hintUsesThisGame});usedHintThisGame=true;updateHintButton()});

const autoCrossUnlockOk=document.getElementById("autoCrossUnlockOk");if(autoCrossUnlockOk)autoCrossUnlockOk.onclick=closeAutoCrossUnlock;
const badgeUnlockOk=document.getElementById("badgeUnlockOk");if(badgeUnlockOk)badgeUnlockOk.onclick=closeBadgeMilestone;
const autonomyTry=document.getElementById("autonomyTry"),autonomyKeep=document.getElementById("autonomyKeep");
if(autonomyTry)autonomyTry.onclick=()=>{finishAutonomyChoice(false);resumeGameClock()};
if(autonomyKeep)autonomyKeep.onclick=()=>{finishAutonomyChoice(true);resumeGameClock()};
document.getElementById("new").onclick=()=>{
  if(celebrated)return;
  if(!confirm(socialChallenge?"Réinitialiser la grille ? Dans un défi, le chrono, les aides et les erreurs restent comptabilisés.":"Réinitialiser la grille ? Tu repars sur un nouvel essai pour les badges : chrono, aides et erreurs sont remis à zéro."))return;
  hideSuccess();
  const resetSnapshot=attemptEngine.snapshot();trackAttemptEvent("attempt_reset",{reason:"manual",next_run_index:(Number(resetSnapshot?.resetCount)||0)+2});
  state=Array.from({length:n},()=>Array(n).fill(0));hist=[];clearHintDisplay();hintStage=0;hintFocus=null;msg.textContent="";
  if(!socialChallenge){usedHintThisGame=false;hintUsesThisGame=0;hintWasGranted=false;mistakesThisGame=0;verifyUsesThisGame=0;verifyPending=null;questFailed=false;updateHintButton();updateVerifyButton()}
  attemptEngine.reset(state);
  if(!socialChallenge)trackAttemptEvent("attempt_run_started",{trigger:"reset"});
  render();clock();refreshJourney();
};
document.getElementById("learningCoachDismiss").onclick=()=>{learningTip=null;updateScriptedLearning()};
document.getElementById("learningCoachNext").onclick=advanceLearningIntro;
 const learningSkip=document.getElementById("learningSkip");if(learningSkip)learningSkip.onclick=()=>{if(learningReplayActive()&&tutorialCompletedProof())finishLearningReplay();else skipFirstGridGuidance()};
document.addEventListener("click",handleLearningTap,true);
// Start after campaign data are initialized. A deep-linked social challenge resolves its
// server snapshot before the board is created so campaign progression is never mutated.
setupMobileAuth();setupTutorial();setupOutsideDefaults();setupQaMode();
async function bootGame(){await bootstrapSocialChallenge();init();refreshJourney();maybeShowReturnWelcome();const focus=new URL(location.href).searchParams.get("myChallenges");if(focus)openMyChallenges(focus);else loadMyChallenges()}
bootGame();

setupBetaFeedback();
const manualCrossTipOk=document.getElementById("manualCrossTipOk");if(manualCrossTipOk)manualCrossTipOk.onclick=closeManualCrossTip;
const guidedAck=document.getElementById("guidedAck");if(guidedAck)guidedAck.onclick=closeGuidedConflict;
const verifyBtn=document.getElementById("verify");if(verifyBtn)verifyBtn.onclick=runVerification;const verifyFix=document.getElementById("verifyFix");if(verifyFix)verifyFix.onclick=fixVerificationErrors;
const nicknameSave=document.getElementById("nicknameSave");if(nicknameSave)nicknameSave.onclick=async()=>{const input=document.getElementById("nicknameInput"),result=await saveLumenNickname(input?.value);if(result.ok)showRewardToast("Pseudo enregistré ✦");else showRewardToast(result.reason==="length"?"Pseudo : 2 à 24 caractères":"Ce pseudo n’est pas valide")};
const guidedErrors=document.getElementById("guidedErrors");if(guidedErrors)guidedErrors.onchange=()=>{if(levelIndex<=4&&!replayMode){guidedErrors.checked=true;return}localStorage.setItem("lumenGuidedErrors",guidedErrors.checked?"on":"off")};
const accountOptinEnable=document.getElementById("accountOptinEnable"),accountOptinLater=document.getElementById("accountOptinLater"),accountOptinEmail=document.getElementById("accountOptinEmail"),accountEmailSend=document.getElementById("accountEmailSend"),accountOtpVerify=document.getElementById("accountOtpVerify");if(accountOptinEnable)accountOptinEnable.onclick=acceptAccountOffer;if(accountOptinLater)accountOptinLater.onclick=dismissAccountOffer;if(accountOptinEmail)accountOptinEmail.onclick=()=>openEmailAccountOffer("signup");const passwordSubmit=document.getElementById("accountPasswordSubmit"),legacyOtp=document.getElementById("accountLegacyOtp");
if(passwordSubmit)passwordSubmit.onclick=submitAccountPassword;
const switcher=document.getElementById("accountAuthSwitch");if(switcher)switcher.onclick=()=>openEmailAccountOffer("login");const signupTab=document.getElementById("accountSignupTab");if(signupTab)signupTab.onclick=()=>openEmailAccountOffer("signup");const visibility=document.getElementById("accountPasswordVisibility");if(visibility)visibility.onclick=()=>{const input=document.getElementById("accountPassword");if(!input)return;input.type=input.type==="password"?"text":"password";visibility.setAttribute("aria-label",input.type==="password"?"Afficher le mot de passe":"Masquer le mot de passe");};
const closeAccount=document.getElementById("accountOptinClose");if(closeAccount)closeAccount.onclick=dismissAccountOffer;
const accountLater=document.getElementById("accountOptinLater");if(accountLater)accountLater.onclick=dismissAccountOffer;
const setPasswordSave=document.getElementById("setPasswordSave");if(setPasswordSave)setPasswordSave.onclick=saveExistingAccountPassword;
if(legacyOtp)legacyOtp.onclick=showLegacyOtp;
const recovery=document.getElementById("accountRecovery");if(recovery)recovery.onclick=recoverAccountPassword;
if(accountEmailSend)accountEmailSend.onclick=requestAccountEmailOtp;if(accountOtpVerify)accountOtpVerify.onclick=confirmAccountEmailOtp;
const installEnable=document.getElementById("installEnable"),installLater=document.getElementById("installLater");if(installEnable)installEnable.onclick=installLumen;if(installLater)installLater.onclick=dismissInstallLater;const successShare=document.getElementById("successShare");if(successShare)successShare.onclick=createSocialChallengeFromSuccess;
const nativeChallengeShare=document.getElementById("challengeNativeShare"),copyChallengeLink=document.getElementById("challengeCopyLink"),closeChallengeShare=document.getElementById("challengeShareClose");if(nativeChallengeShare)nativeChallengeShare.onclick=sharePendingChallenge;if(copyChallengeLink)copyChallengeLink.onclick=copyPendingChallenge;if(closeChallengeShare)closeChallengeShare.onclick=()=>document.getElementById("challengeShareModal").hidden=true;
const openChallenges=document.getElementById("openMyChallenges"),closeChallenges=document.getElementById("myChallengesClose");if(openChallenges)openChallenges.onclick=()=>openMyChallenges();if(closeChallenges)closeChallenges.onclick=()=>document.getElementById("myChallengesModal").hidden=true;
const challengeHome=document.getElementById("challengeResultHome"),challengeReshare=document.getElementById("challengeResultReshare");if(challengeHome)challengeHome.onclick=()=>{location.href=location.pathname};if(challengeReshare)challengeReshare.onclick=()=>{document.getElementById("challengeResultModal").hidden=true;createSocialChallengeFromSuccess()};
const pushEnable=document.getElementById("pushEnable"),pushLater=document.getElementById("pushLater");
if(pushEnable)pushEnable.onclick=enableLumenPush;
if(pushLater)pushLater.onclick=dismissPushLater;
markLumenSeen();
if(!qaActive)cloudMergeHistoricalPerformance(lumenAnonymousId);
initLumenCloud();

if("serviceWorker" in navigator){
 let lumenReloadingForSW=false;
 const updateStatus=message=>{const node=document.getElementById("appUpdateStatus");if(node)node.textContent=message};
 const activateWaitingWorker=registration=>{if(registration.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"})};
 const checkLumenUpdate=async({manual=false}={})=>{
  try{
   if(manual)updateStatus("Recherche d’une mise à jour…");
   const registration=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
   await registration.update();
   activateWaitingWorker(registration);
   if(manual&&!registration.waiting&&!registration.installing)updateStatus("LUMEN est à jour · "+appVersion());
   return registration;
  }catch(error){
   console.warn("LUMEN service worker",error);
   if(manual)updateStatus("Impossible de vérifier la mise à jour.");
   return null;
  }
 };
 navigator.serviceWorker.addEventListener("controllerchange",()=>{
  if(lumenReloadingForSW)return;
  lumenReloadingForSW=true;
  if(new URLSearchParams(location.search).has("code")||location.hash.includes("access_token=")){lumenReloadingForSW=false;return}
  location.reload();
 });
 window.addEventListener("load",()=>checkLumenUpdate());
 const forceUpdate=document.getElementById("forceAppUpdate");
 if(forceUpdate)forceUpdate.onclick=async()=>{
  updateStatus("Mise à jour forcée…");
  if("caches" in window)await caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("lumen-assets-")).map(key=>caches.delete(key))));
  const registration=await checkLumenUpdate({manual:true});
  if(registration?.waiting){activateWaitingWorker(registration);return}
  location.reload();
 };
}

// Preserve the public browser testing entry points.
window.runHintTests=runHintTests;
window.lumenDiagnostics=createDiagnostics(testModel,{init,runHintTests,setSoundEnabled,closeTutorial,hideSuccess,render});
Object.assign(window.lumenDiagnostics,{skySnapshot:()=>skyNavigation.snapshot(),setSkyCatalogue:(model,{reset=true}={})=>{mapCatalogueOverride=model;if(reset)skyNavigation.open();else skyNavigation.render()},refreshSky:()=>skyNavigation.render()});
}
