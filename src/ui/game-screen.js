import {learningStep, dragLearningStep, learningAllows, learningCopy} from "../game/learning.js";
import {createAnalytics} from "../analytics/events.js";
import {createHintTestSuite} from "../testing/hint-tests.js";
import {createDiagnostics} from "../testing/diagnostics.js";
import {createLocalPersistence} from "../persistence/local.js";
import {createCloudPersistence} from "../persistence/cloud.js";
import {LUMEN_SUPABASE_URL,LUMEN_SUPABASE_KEY} from "../persistence/config.js";
import {CAT,LEVELS} from "../campaign/catalogue.js";
import {LUMEN_META,CAMPAIGN6_ORDER,CAMPAIGN_SIZE_SCHEDULE,SKY_TARGET,CONSTELLATIONS,CONSTELLATION_GRID_COUNTS,badgeDefs} from "../campaign/data.js";
import {performanceEligibility,speedTargetSeconds,localCalendarDay,performanceAttempt} from "../campaign/performance.js";
import {challengeEligibility,challengeSnapshot,compareChallenge,createChallengeClient,normalizeChallengeName,validChallengeName} from "../campaign/social-challenge.js";
import {createCampaign,sequentialCount,constellationGridRange,chapterForGrid,milestoneFor,skyStarsForGrid,bonusChallengeFor,challengeFor,constellationCheckpoint,constellationStateForEarned,starsAwardedForGrid} from "../campaign/progression.js";
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
const {loadLumenProgress,saveLumenProgress}=createLocalPersistence(localStorage,()=>lumenProgress,{progressKey:qaActive?"lumenQaProgressV1":"lumenProgressV1"});
const persistenceModel={
get lumenSupabase(){return lumenSupabase},set lumenSupabase(value){lumenSupabase=value},
get lumenUser(){return lumenUser},set lumenUser(value){lumenUser=value},
get lumenCloudReady(){return lumenCloudReady},set lumenCloudReady(value){lumenCloudReady=value},
get lumenNickname(){return lumenNickname},set lumenNickname(value){lumenNickname=value},
get lumenProgress(){return lumenProgress},set lumenProgress(value){lumenProgress=value},
get sequentialSolvedCount(){return sequentialSolvedCount},set sequentialSolvedCount(value){sequentialSolvedCount=value},
get levelIndex(){return levelIndex},set levelIndex(value){levelIndex=value},
get usedHintThisGame(){return usedHintThisGame},set usedHintThisGame(value){usedHintThisGame=value}
};
const {loadLumenProfile,saveLumenNickname,loadEntitlements,cloudSavePuzzle,cloudMergeProgress,initLumenCloud,cloudSaveDaily,cloudMergeDaily,cloudMergeHistoricalPerformance}=createCloudPersistence(persistenceModel,{activeGameSeconds:(...args)=>activeGameSeconds(...args),exactSkyScoreForSolvedPrefix:(...args)=>exactSkyScoreForSolvedPrefix(...args),saveLumenProgress:(...args)=>saveLumenProgress(...args),refreshJourney:(...args)=>refreshJourney(...args),init:(...args)=>init(...args),updateAuthUI:(...args)=>updateAuthUI(...args),showRewardToast:(...args)=>showRewardToast(...args),renderDaily:(...args)=>renderDaily(...args)},{document,location,alert,setTimeout,console,qaMode});
const {renderTutorial,openTutorial,closeTutorial,setupTutorial}=createTutorial(()=>levelIndex<=1,{tutorialSeenKey:qaActive?"lumenQaTutorialSeen":"lumenTutorialSeen"});
let lumenSupabase=null,lumenUser=null,lumenCloudReady=false;
try{lumenSupabase=window.supabase.createClient(LUMEN_SUPABASE_URL,LUMEN_SUPABASE_KEY)}catch(e){console.warn("LUMEN cloud unavailable",e)}
let lumenNickname="";

function syncMobileAuthUI(){
 const status=document.getElementById("mobileAuthStatus"),action=document.getElementById("mobileAuthAction"),icon=document.getElementById("mobileAccount");
 if(!status||!action||!icon)return;
 if(lumenUser){status.textContent=lumenNickname||"Progression synchronisée";action.textContent="Déconnexion";icon.textContent="●";icon.setAttribute("aria-label","Compte connecté");const box=document.getElementById("nicknameBox");if(box)box.hidden=false}
 else{status.textContent="Progression enregistrée sur cet appareil";action.textContent="Se connecter avec Google";icon.textContent="♙";icon.setAttribute("aria-label","Se connecter");const box=document.getElementById("nicknameBox");if(box)box.hidden=true}
}
function updateAuthUI(){
 const u=document.getElementById("authUser"),login=document.getElementById("authLogin"),logout=document.getElementById("authLogout");
 if(!u||!login||!logout)return;
 if(lumenUser){
   u.textContent=lumenNickname||"Progression synchronisée";
   login.hidden=true; logout.hidden=false;
 }else{
   u.textContent="Progression enregistrée sur cet appareil";
   login.hidden=false; logout.hidden=true;
 }
 syncMobileAuthUI();
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
 account.onclick=()=>{const d=document.getElementById("dailyInfoPopover");if(d)d.hidden=true;menu.hidden=!menu.hidden};
 action.onclick=async()=>{
   menu.hidden=true;
   if(!lumenSupabase)return;
   if(lumenUser){await lumenSupabase.auth.signOut();return}
   await lumenSupabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
 };
 const qaSwitch=document.getElementById("qaAccountSwitch"),qaReset=document.getElementById("qaAccountReset");
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
let lastTrackedPuzzle=null;

trackLumenEvent("session_start",null,{standalone:window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches});
function lumenIsStandalone(){return !!((window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone)}
let lumenInstallPrompt=null;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();lumenInstallPrompt=e});
window.addEventListener("appinstalled",()=>{localStorage.setItem("lumenInstalled","1");localStorage.removeItem("lumenInstallLater");document.getElementById("installOptin")?.setAttribute("hidden","");trackLumenEvent("pwa_installed")});
function maybeOfferInstall(){if(lumenIsStandalone()||localStorage.getItem("lumenInstalled")==="1"||solvedCount()<3)return;const last=Number(localStorage.getItem("lumenInstallLater")||0);if(last&&Date.now()-last<7*86400000)return;const box=document.getElementById("installOptin"),copy=document.getElementById("installOptinCopy"),btn=document.getElementById("installEnable");if(!box||!copy||!btn)return;const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if(ios&&!lumenInstallPrompt){copy.textContent="Pour retrouver LUMEN facilement : touche Partager puis « Sur l’écran d’accueil ».";btn.textContent="J’ai compris"}else{copy.textContent="Ajoute LUMEN à ton écran d’accueil pour retrouver ton ciel en un geste.";btn.textContent="Installer LUMEN"}box.hidden=false;trackLumenEvent("pwa_install_offer",null,{ios})}
async function installLumen(){const box=document.getElementById("installOptin"),ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if(ios&&!lumenInstallPrompt){box.hidden=true;localStorage.setItem("lumenInstallLater",String(Date.now()));return}if(!lumenInstallPrompt){box.hidden=true;return}const p=lumenInstallPrompt;lumenInstallPrompt=null;await p.prompt();const choice=await p.userChoice;trackLumenEvent("pwa_install_choice",null,{outcome:choice.outcome});box.hidden=true;if(choice.outcome==="dismissed")localStorage.setItem("lumenInstallLater",String(Date.now()))}
function lumenReferralCode(){return lumenUser?.id?("u"+lumenUser.id.replace(/-/g,"").slice(0,12)):("a"+lumenAnonymousId.replace(/-/g,"").slice(0,12))}
function lumenShareUrl(){const u=new URL(location.origin+location.pathname);u.searchParams.set("ref",lumenReferralCode());return u.toString()}
function showShareToast(t){let e=document.createElement("div");e.className="share-toast";e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),1800)}
function successAchievement(){
 const ch=CONSTELLATIONS[chapterForGrid(levelIndex)],range=constellationGridRange(chapterForGrid(levelIndex)),pos=Math.min(range.count,levelIndex-range.start+1),run=performanceRun(levelIndex),secs=activeGameSeconds(),solved=Math.max(solvedCount(),levelIndex+1);
 let kicker="QUÊTE "+(levelIndex+1)+" ACCOMPLIE",main=(ch?.name||"Constellation")+" · "+pos+"/"+range.count+" quêtes",detail=solved+"/100 quêtes accomplies";
 const milestone=milestoneFor(levelIndex);
 if(milestone?.kind==="boss"){kicker="CONSTELLATION COMPLÉTÉE";main=ch.name;detail=solved+"/100 quêtes accomplies · "+skyStarsEarned()+" étoiles allumées"}
 else if(run.qualifying&&run.mastery){kicker="MAÎTRISE";main="Rapide, autonome et sans erreur";detail=(ch?.name||"Constellation")+" · Quête "+(levelIndex+1)+" · "+formatDuration(secs)}
 else if(run.qualifying&&run.noError){kicker="SANS ERREUR";main=(ch?.name||"Constellation")+" · Quête "+(levelIndex+1);detail=formatDuration(secs)+" · résolution propre"}
 else if(run.qualifying&&run.speed){kicker="RAPIDITÉ";main="Quête "+(levelIndex+1)+" en "+formatDuration(secs);detail=(ch?.name||"Constellation")}
 else if(run.qualifying&&run.autonomy){kicker="AUTONOMIE";main=(ch?.name||"Constellation")+" · Quête "+(levelIndex+1);detail=formatDuration(secs)+" · sans aide"}
 return {kicker,main,detail,ch,pos,total:range.count,solved,run,secs};
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
 x.fillStyle="#f2fbff";x.font="900 44px Arial";x.fillText("Quête "+(levelIndex+1)+" / 100",cx,860);
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

let lumenProgress=loadLumenProgress(),usedHintThisGame=false,questStarted=true,questFailed=false;if(!lumenProgress.xp)lumenProgress.xp=0;if(!lumenProgress.challenges)lumenProgress.challenges={};if(!lumenProgress.stars)lumenProgress.stars={};if(!Number.isFinite(lumenProgress.shards))lumenProgress.shards=3;if(!lumenProgress.performances)lumenProgress.performances={};
if(!lumenProgress.daily)lumenProgress.daily={dates:{},rewards:{}};if(!Number.isFinite(lumenProgress.skyScore))lumenProgress.skyScore=null;

function dailyStreak(){return streakFromDates(lumenProgress.daily.dates,localDateKey())}
function renderDaily(){
 const stars=document.getElementById("dailyStars");if(!stars)return;stars.innerHTML="";
 const today=localDateKey(),status=dailyState(lumenProgress.daily.dates,today),streak=status.streak,cycle=cycleDay(streak),next=nextReward(streak);
 for(let i=1;i<=7;i++){let e=document.createElement("span");e.className="daily-star"+(i<=cycle?" on":"")+(i===cycle?" today":"");e.textContent="✦";stars.appendChild(e)}
 document.getElementById("dailyTitle").textContent=status.done?"Lumière du jour entretenue":status.grace?"Ta Série de lumière est protégée aujourd’hui":"Joue aujourd’hui pour continuer ta Série";
 document.getElementById("dailyMeta").textContent="Série · "+streak+" jour"+(streak>1?"s":"")+" · Cycle "+cycle+"/7";
 document.getElementById("dailyReward").textContent="Prochaine récompense : +"+next.amount+" ✦ à J"+next.cycleDay;
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
async function completeDaily(){
 if(persistenceModel.lumenUser){
   const claim=await cloudSaveDaily(localDateKey(),levelIndex);
   if(!claim)return null;
   await cloudMergeDaily();
   if(Number(claim.reward)>0)showRewardToast("Série de lumière · +"+Number(claim.reward)+" ✦");
   return claim;
 }
 const today=localDateKey(),result=grantDaily(lumenProgress,today);if(!result.credited)return result;
 saveLumenProgress();renderDaily();
 if(result.reward)showRewardToast("Série de lumière · +"+result.reward+" ✦");
 return result;
}

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
  if(window.QRCode?.toCanvas)window.QRCode.toCanvas(document.getElementById("challengeQr"),pendingChallengeUrl,{width:220,margin:1}).catch(()=>{});
  maybeOfferSocialPush();
 }catch(e){console.warn("challenge create",e);showRewardToast("Impossible de créer le défi pour le moment")}
}
async function sharePendingChallenge(){
 if(!pendingChallengeUrl)return;const text="Je te défie sur LUMEN. Tu as une tentative pour faire mieux !";
 try{if(navigator.share){await navigator.share({title:"Défi LUMEN",text,url:pendingChallengeUrl});trackLumenEvent("challenge_share_completed",levelIndex+1,{method:"native"})}else{await navigator.clipboard.writeText(text+"\n"+pendingChallengeUrl);showShareToast("Lien du défi copié")}}catch(e){if(e?.name!=="AbortError")console.warn("challenge share",e)}
}
async function copyPendingChallenge(){if(!pendingChallengeUrl)return;await navigator.clipboard.writeText(pendingChallengeUrl);showShareToast("Lien du défi copié");trackLumenEvent("challenge_share_completed",levelIndex+1,{method:"copy"})}
function maybeOfferSocialPush(){
 if(localStorage.getItem("lumenPushChoice")==="enabled"||!("Notification"in window)||Notification.permission==="denied")return;
 const box=document.getElementById("pushOptin");if(!box)return;box.querySelector("h2").textContent="Préviens-moi quand mon défi est relevé";box.querySelector("p").textContent="Active les notifications pour découvrir quand quelqu’un termine ton défi.";box.hidden=false;
}
function challengePerformanceHtml(name,duration,autonomy,mastery){
 const badge=mastery?"✦ Maîtrise":autonomy?"🧠 Autonome":"Avec aide";return '<div class="challenge-result-player"><strong>'+escapeHtml(name)+'</strong><span>'+badge+' · '+formatDuration(Number(duration)||0)+'</span></div>';
}
function escapeHtml(v){const d=document.createElement("div");d.textContent=String(v??"");return d.innerHTML}
async function showSocialChallengeResult(data){
 if(!data)return;const modal=document.getElementById("challengeResultModal"),title=document.getElementById("challengeResultTitle"),body=document.getElementById("challengeResultBody");
 const participant={status:data.participant_status,duration_seconds:data.participant_duration_seconds,autonomy:data.participant_autonomy,speed:data.participant_speed,mastery:data.participant_mastery};
 const source={duration_seconds:data.source_duration_seconds,autonomy:data.source_autonomy,speed:data.source_speed,mastery:data.source_mastery};
 const cmp=compareChallenge(source,participant);title.textContent=cmp?.headline||"Défi terminé";
 body.innerHTML='<div class="challenge-result-versus">'+challengePerformanceHtml(data.sender_display_name,source.duration_seconds,source.autonomy,source.mastery)+challengePerformanceHtml(data.participant_display_name||challengeDisplayName(),participant.duration_seconds,participant.autonomy,participant.mastery)+'</div><div class="challenge-result-detail">'+escapeHtml(cmp?.detail||"")+'</div>';
 const reshare=document.getElementById("challengeResultReshare"),canPass=data.participant_status==="completed"&&!data.previously_played;
 if(reshare){reshare.hidden=!canPass;if(canPass)reshare.classList.toggle("remarkable",!!data.participant_mastery)}
 if(canPass)lastChallengeOffer={eligibility:{firstPlay:true,remarkable:!!data.participant_mastery,canChallenge:true},snapshot:challengeSnapshot({questIndex:Number(data.puzzle_id)-1,seconds:data.participant_duration_seconds,run:{autonomy:data.participant_autonomy,speed:data.participant_speed,mastery:data.participant_mastery},assistanceUsed:data.participant_assistance_used})};
 modal.hidden=false;trackLumenEvent("challenge_result_viewed",data.puzzle_id,{status:data.participant_status});
}
async function finishSocialChallenge(status){
 const seconds=activeGameSeconds(),assisted=!!attemptEngine.snapshot()?.assistanceUsed,run=performanceAttempt({questIndex:levelIndex,seconds,assistanceUsed:assisted,mistakeCommitted:!!attemptEngine.snapshot()?.mistakeCommitted});
 try{await challengeClient.finish(socialChallenge.challenge_id,{status,durationSeconds:seconds,autonomy:run.autonomy,speed:run.speed,mastery:run.mastery,assistanceUsed:assisted});await pushApi("challenge_result",{challenge_id:socialChallenge.challenge_id});socialChallenge=await challengeClient.get(socialChallenge.challenge_id);await showSocialChallengeResult(socialChallenge)}catch(e){console.warn("challenge finish",e);showRewardToast("Résultat enregistré localement ; synchronisation à réessayer")}
}
function celebrateSocialChallengeSuccess(){
 if(celebrated)return;celebrated=true;attemptEngine.complete();clearInterval(timer);clock();board.classList.add("win");trackLumenEvent("challenge_completed",levelIndex+1,{duration_seconds:activeGameSeconds(),assisted:!!attemptEngine.snapshot()?.assistanceUsed});finishSocialChallenge("completed");
}
async function loadMyChallenges(){
 try{
  const rows=await challengeClient.sent(),list=document.getElementById("myChallengesList"),badge=document.getElementById("challengeUnreadBadge");let unread=0;
  list.innerHTML=(rows||[]).length?(rows||[]).map(row=>{unread+=Number(row.unread_count)||0;const parts=Array.isArray(row.participants)?row.participants:[];return '<div class="challenge-list-item" data-challenge-id="'+row.challenge_id+'"><div class="challenge-list-head"><strong>Quête '+row.puzzle_id+'</strong><span>'+parts.length+' participant'+(parts.length>1?"s":"")+'</span></div><small>Ta référence · '+formatDuration(row.source_duration_seconds)+(row.source_mastery?" · ✦ Maîtrise":row.source_autonomy?" · 🧠 Autonomie":"")+'</small>'+parts.map(p=>'<div class="challenge-participant"><span>'+escapeHtml(p.name)+'</span><span>'+(p.status==="abandoned"?"Abandon":formatDuration(p.duration_seconds)+(p.mastery?" · ✦":p.autonomy?" · 🧠":" · aide"))+'</span></div>').join("")+'</div>'}).join(""):'<p>Aucun défi envoyé pour le moment.</p>';
  if(badge){badge.hidden=!unread;badge.textContent=unread||""}
  return rows||[];
 }catch(e){console.warn("challenge inbox",e);return []}
}
async function openMyChallenges(focusId=null){
 const rows=await loadMyChallenges();document.getElementById("myChallengesModal").hidden=false;
 if(focusId)document.querySelector('[data-challenge-id="'+CSS.escape(focusId)+'"]')?.scrollIntoView({block:"center"});
 const unread=(rows||[]).filter(r=>Number(r.unread_count)>0);for(const row of unread)await challengeClient.markRead(row.challenge_id);
 if(unread.length)loadMyChallenges();
}
async function bootstrapSocialChallenge(){
 const id=new URL(location.href).searchParams.get("challenge");if(!id)return true;
 try{
  socialChallenge=await challengeClient.get(id);if(!socialChallenge)throw new Error("not_found");levelIndex=Number(socialChallenge.puzzle_id)-1;replayMode=false;
  if(["completed","abandoned"].includes(socialChallenge.participant_status)){init();showSocialChallengeResult(socialChallenge);return false}
  const intro=document.getElementById("challengeIntro"),copy=document.getElementById("challengeIntroCopy");copy.textContent=socialChallenge.sender_display_name+" te défie sur la quête "+socialChallenge.puzzle_id+". Sa performance sera révélée après ta tentative.";intro.hidden=false;
  return await new Promise(resolve=>{document.getElementById("challengeStart").onclick=async()=>{const name=await askChallengeName();if(!name)return;try{await challengeClient.start(id,!!lumenProgress.solved[levelIndex]);intro.hidden=true;trackLumenEvent("challenge_started",levelIndex+1,{previously_played:!!lumenProgress.solved[levelIndex]});resolve(true)}catch(e){console.warn("challenge start",e);showRewardToast("Impossible de démarrer le défi")}};document.getElementById("challengeLeave").onclick=()=>{location.href=location.pathname}});
 }catch(e){console.warn("challenge load",e);showRewardToast("Ce défi n’est plus disponible");socialChallenge=null;return true}
}

const COLORS=["#efb37e","#91b5ed","#b4a0db","#a9d692","#ff8267","#ddd9d2","#e5ef83","#bdb6a0","#a9d7d3"];
const TERRITORY_COLORS=["#46c7e8","#6d8fe8","#8b70d7","#49b49b","#d38a54","#b55f86","#67a6bf","#7e9c69","#a8875b"];
let n=6,puz,state,hist=[],start,timer,last={},hi=null,proofs={},hintStage=0,hintFocus=null,celebrated=false,hintUsesThisGame=0,hintWasGranted=false,mistakesThisGame=0,verifyUsesThisGame=0,verifyPending=null,autoUsedThisGame=false,replayMode=false,levelIndex=Math.min(sequentialSolvedCount,99),learningReplayReturn=null;
let socialChallenge=null,lastChallengeOffer=null,pendingChallengeUrl="";
const attemptEngine=createAttemptEngine({onChange:()=>updateAttemptUI()});
function attemptMode(){return socialChallenge?"challenge":replayMode?"replay":"campaign"}
function updateAttemptUI(){
 const a=attemptEngine.snapshot(),mask=document.getElementById("attemptMask"),pause=document.getElementById("attemptPause"),abandon=document.getElementById("attemptAbandon");
 if(!mask)return;
 const ready=a?.state===ATTEMPT_STATES.READY,paused=a?.state===ATTEMPT_STATES.PAUSED;
 mask.hidden=!(ready||paused)||(ready&&learningQuestActive());
 document.getElementById("attemptMaskTitle").textContent=paused?"Tentative en pause":"Touchez la grille pour commencer";
 document.getElementById("attemptMaskCopy").textContent=paused?"Reprendre pour continuer la même tentative.":"Le chrono démarrera au premier geste.";
 if(pause){pause.hidden=!a||![ATTEMPT_STATES.RUNNING,ATTEMPT_STATES.PAUSED].includes(a.state);pause.textContent=paused?"Reprendre":"Pause"}
 if(abandon)abandon.hidden=!a||attemptMode()==="campaign"||![ATTEMPT_STATES.RUNNING,ATTEMPT_STATES.PAUSED].includes(a.state);
}
function ensureAttemptStarted(){
 const a=attemptEngine.snapshot();if(a?.state!==ATTEMPT_STATES.READY)return;
 if(a.qualifying){
  lumenProgress.performances=lumenProgress.performances||{};
  const old=lumenProgress.performances[levelIndex]||{};
  lumenProgress.performances[levelIndex]={...old,questIndex:levelIndex,lastQualifiedDay:localCalendarDay()};
  saveLumenProgress();
 }
 attemptEngine.start();
}
function persistAttemptBoard(){attemptEngine.updateBoard(state)}

const board=document.getElementById("board"),msg=document.getElementById("msg");
let hiCells=[];
const {validateGuardians,key,solutions,isAutoCross,verificationErrors,guardianConflicts,conflictMessage,proofEngine,directMissingCross,playerError,guardianOnlyState,guidedConflictForAction}=createGameEngine(()=>({n,puz,state}),()=>!!document.getElementById("autoCross")?.checked);
function choose(){levelIndex=Math.max(0,Math.min(levelIndex,99));const [size,slot]=CAMPAIGN_SIZE_SCHEDULE[levelIndex];puz=size==="6"?CAT["6"][CAMPAIGN6_ORDER[slot]]:CAT[size][slot];n=puz.reg.length;last[n]=levelIndex}
function loadPuzzle(){init();}
function startLearningReplay(){
 if(learningReplayReturn===null)learningReplayReturn={levelIndex,replayMode};
 learningReplayReturn.active=true;levelIndex=0;replayMode=true;loadPuzzle();
}
function learningReplayActive(){return !!(learningReplayReturn&&learningReplayReturn.active)}
function finishLearningReplay(){
 const back=learningReplayReturn||{levelIndex:Math.min(sequentialSolvedCount,99),replayMode:false};
 learningReplayReturn=null;levelIndex=back.levelIndex;replayMode=back.replayMode;
 document.getElementById("undo").disabled=false;document.getElementById("hint").disabled=false;document.getElementById("autoCross").disabled=false;
 loadPuzzle();refreshJourney();
}

const UNLIMITED_SHARDS_TEST=true;
function hintCost(){if(levelIndex<=4)return 0;if(hintUsesThisGame===0)return 0;if(hintUsesThisGame===1)return 1;return 2}
function updateShardMeter(){const m=document.getElementById("shardMeter");if(!m)return;if(UNLIMITED_SHARDS_TEST){m.innerHTML='<span class="shard-gem on" aria-hidden="true">✦</span><strong style="margin-left:6px">∞</strong>';m.setAttribute("aria-label","Éclats de lumière illimités pendant les tests.");return}const sh=Math.max(0,Number(lumenProgress.shards)||0);m.innerHTML='<span class="shard-gem on" aria-hidden="true">✦</span><strong style="margin-left:6px">'+sh+'</strong>';m.setAttribute("aria-label",sh+" éclat"+(sh>1?"s":"")+" de lumière disponible"+(sh>1?"s":"")+". Voir les règles.")}function updateHintButton(){const b=document.getElementById("hint");if(!b)return;const q=bonusChallengeFor(levelIndex),cost=hintCost(),sh=lumenProgress.shards||0;b.textContent=cost===0?"Indice · gratuit":"Indice · "+cost+" ✦";b.title="Éclats disponibles : "+sh;updateShardMeter();if(q&&q.type===2&&!lumenProgress.stars[q.id])return}
function consumeHintCost(){const cost=hintCost(),sh=lumenProgress.shards||0;if(UNLIMITED_SHARDS_TEST){hintWasGranted=true;hintUsesThisGame++;updateHintButton();return true}if(cost>sh){if(sh===0&&activeGameSeconds()>=90){hintWasGranted=true;hintUsesThisGame++;msg.textContent="Après 90 s de recherche, cet indice est offert.";updateHintButton();return true}msg.textContent="Il te manque "+(cost-sh)+" ✦ éclat"+(cost-sh>1?"s":"")+" pour cet indice. Continue à chercher : à 0 éclat, un indice devient gratuit après 90 s.";return false}if(cost>0){lumenProgress.shards=sh-cost;saveLumenProgress()}hintWasGranted=true;hintUsesThisGame++;updateHintButton();return true}
function verifyCost(){return verifyUsesThisGame===0?0:1}
function updateVerifyButton(){const b=document.getElementById("verify");if(!b)return;const cost=verifyCost();b.textContent=cost===0?"✓ Vérifier · gratuit":"✓ Vérifier · "+cost+" ✦";b.title="Vérifie uniquement tes choix déjà marqués."}
function consumeVerifyCost(){const cost=verifyCost(),sh=lumenProgress.shards||0;if(UNLIMITED_SHARDS_TEST){verifyUsesThisGame++;updateVerifyButton();return true}if(cost>sh){msg.textContent="Il te manque "+(cost-sh)+" ✦ éclat"+(cost-sh>1?"s":"")+" pour vérifier.";return false}if(cost){lumenProgress.shards=sh-cost;saveLumenProgress();updateShardMeter()}verifyUsesThisGame++;updateVerifyButton();return true}

function verificationHappyCopy(){
 const q=state.flat().filter(v=>v===2).length;
 if(q<=2)return ["Bien parti !","Tous tes choix sont corrects. Continue comme ça."];
 if(q>=n-2)return ["Presque là !","Aucune erreur détectée. La constellation est presque complète."];
 return ["Excellent !","Tout est juste jusqu’ici. Ton raisonnement tient bon."];
}
function showVerificationSuccess(){
 const [title,copy]=verificationHappyCopy(),overlay=document.getElementById("verifyCelebration");
 board.classList.add("verify-ok");board.querySelectorAll(".cell .lumen-orb").forEach(o=>o.parentElement.classList.add("verify-ok"));
 overlay.innerHTML='<div class="verify-check">✓</div>'+[['-120px','-90px'],['120px','-75px'],['-135px','70px'],['135px','80px'],['0px','-130px']].map(([x,y])=>'<span class="verify-spark" style="--sx:'+x+';--sy:'+y+'">✦</span>').join("");
 overlay.hidden=false;msg.textContent="✓ "+title+" "+copy;
 setTimeout(()=>{overlay.hidden=true;overlay.innerHTML="";board.classList.remove("verify-ok");board.querySelectorAll(".cell").forEach(x=>x.classList.remove("verify-ok"))},1350);
}
function showVerificationErrors(errors){
 verifyPending=errors;errors.forEach(e=>guidedCell(e.r,e.c)?.classList.add("verify-error"));
 const g=errors.filter(e=>e.kind==="guardian").length,x=errors.length-g;
 document.getElementById("verifyCopy").textContent=errors.length+" choix incorrect"+(errors.length>1?"s":"")+" détecté"+(errors.length>1?"s":"")+". "+(g?g+" Gardien"+(g>1?"s":"")+" mal placé"+(g>1?"s":"")+". ":"")+(x?x+" case"+(x>1?"s":"")+" écartée"+(x>1?"s":"")+" à tort.":"");
 document.getElementById("scriptedLearn").hidden=true;document.getElementById("verifyCard").hidden=false;board.setAttribute("aria-disabled","true");
}
function runVerification(){
 if(celebrated||guidedPending||verifyPending||scriptedLearningActive())return;
 showLearningTip("verify","Vérifier tes choix","Vérifier examine les cases que tu as déjà marquées. La première vérification est gratuite ; les suivantes coûtent un Éclat. Elle compte comme une aide.");
 if(!consumeVerifyCost())return;
 attemptEngine.markAssistance();
 const errors=verificationErrors();
 if(errors.length){mistakesThisGame++;showVerificationErrors(errors);errorSound();updateLiveReward(state.flat().filter(v=>v===2).length)}
 else showVerificationSuccess();
}
function fixVerificationErrors(){
 if(!verifyPending)return;
 hist.push(state.map(x=>x.slice()));verifyPending.forEach(e=>state[e.r][e.c]=0);verifyPending=null;
 document.getElementById("verifyCard").hidden=true;board.removeAttribute("aria-disabled");msg.textContent="Les choix incorrects ont été effacés.";render();
}
let learningStage="place",learningTip=null,learningTipSeen=new Set(),learningIntroStep=0;
const LEARNING_INTRO=[
 {title:"Observe le plateau",copy:"La grille est découpée en plusieurs territoires colorés. Les numéros 1 à 5 t’aident à les distinguer : chaque couleur forme un territoire."},
 {title:"Ton objectif",copy:"Tu vas placer des Gardiens sur la grille. Pour réussir, tous les Gardiens doivent respecter les mêmes quatre règles."},
 {title:"Un par territoire",copy:"Chaque territoire coloré doit contenir exactement un Gardien."},
 {title:"Un par ligne et par colonne",copy:"Chaque ligne contient exactement un Gardien, et chaque colonne aussi."},
 {title:"Ils gardent leurs distances",copy:"Deux Gardiens ne peuvent jamais se toucher, même en diagonale."},
 {title:"Comment jouer",copy:"Un premier toucher pose une croix pour écarter une case. Un deuxième toucher sur la même case y pose un Gardien. Maintenant, essaie-le toi-même."}
];
function learningQuestActive(){return levelIndex<=1&&!socialChallenge&&(!replayMode||learningReplayActive())}
function learningIntroActive(){return levelIndex===0&&learningQuestActive()&&state&&state.flat().every(v=>v===0)&&learningIntroStep<LEARNING_INTRO.length}
function currentLearningStep(){if(learningIntroActive())return {phase:"intro",introStep:learningIntroStep,cells:[],number:0};return levelIndex===1?dragLearningStep(puz,state):learningStep(puz,state)}
function scriptedLearningActive(){return learningQuestActive()&&!!state&&currentLearningStep().phase!=="complete"}
function learningMarkAllowed(r,c){const step=currentLearningStep();return step.phase!=="place"&&learningAllows(step,r,c)}
function scriptedAllowsGuardian(r,c){const step=currentLearningStep();return step.phase==="place"&&learningAllows(step,r,c)}
function learningDragAllowed(){return !scriptedLearningActive()||["reuse","drag","practice"].includes(currentLearningStep().phase)}
function advanceLearningIntro(){
 if(!learningIntroActive())return;
 learningIntroStep++;
 render();
}
function positionLearningCoach(){
 const card=document.getElementById("scriptedLearn");
 if(card.hidden)return;
 const rect=board.getBoundingClientRect(),mobile=innerWidth<=1100;
 const width=Math.min(mobile?innerWidth-20:330,innerWidth-20);
 card.style.width=width+"px";
 const actions=document.querySelector(".actions").getBoundingClientRect();
 const top=mobile?Math.min(innerHeight-card.offsetHeight-8,Math.max(rect.bottom,actions.bottom)+10):Math.max(12,Math.min(rect.top,innerHeight-card.offsetHeight-12));
 const left=mobile?Math.max(10,(innerWidth-width)/2):rect.right+14+width<=innerWidth?rect.right+14:Math.max(10,rect.left-width-14);
 card.style.left=left+"px";card.style.top=top+"px";
}
window.addEventListener("resize",()=>requestAnimationFrame(positionLearningCoach));
function showLearningTip(id,title,copy){
 if(socialChallenge||!((levelIndex===0&&learningQuestActive())||(levelIndex===1&&!replayMode))||learningTipSeen.has(id))return;
 learningTipSeen.add(id);learningTip={title,copy};updateScriptedLearning();
}
function updateScriptedLearning(){
 const card=document.getElementById("scriptedLearn"),wrap=document.getElementById("learningBoardWrap");if(!card)return;
 const guided=scriptedLearningActive(),step=guided?currentLearningStep():null;
 learningStage=step?.phase||"complete";
 board.dataset.learningStage=learningStage;
 board.classList.remove("scripted-board");board.classList.toggle("learning-guided",guided);
 board.querySelectorAll(".cell").forEach(cell=>{
  cell.classList.remove("scripted-focus","scripted-territory","scripted-dim","learning-source","learning-zone");
  cell.classList.toggle("learning-intro-cell",guided&&step?.phase==="intro");
  const r=Number(cell.dataset.row),c=Number(cell.dataset.col),allowed=guided&&learningAllows(step,r,c);
  cell.classList.toggle("coach-dim",guided&&!allowed&&(step.territory===undefined||puz.reg[r][c]!==step.territory));
  cell.classList.toggle("coach-zone",guided&&(allowed||(step.territory!==undefined&&puz.reg[r][c]===step.territory)));
  cell.classList.toggle("coach-target",guided&&step.number===1&&allowed);
  cell.setAttribute("aria-disabled",guided&&!allowed?"true":"false");
 });
 wrap.classList.remove("is-learning");
 const blocked=celebrated||!!guidedPending||!!verifyPending;
 card.hidden=blocked||(!guided&&!learningTip);
 document.getElementById("learningCoachDismiss").hidden=guided;
 const next=document.getElementById("learningCoachNext");
 if(next){next.hidden=!(guided&&step?.phase==="intro");next.textContent=step?.introStep===LEARNING_INTRO.length-1?"À moi de jouer":"Suivant"}
 if(levelIndex<=1&&!socialChallenge)for(const id of ["undo","hint","verify"])document.getElementById(id).disabled=guided;
 if(card.hidden)return;
 const text=step?.phase==="intro"?LEARNING_INTRO[step.introStep]:step?learningCopy(step,state,matchMedia("(pointer:coarse)").matches):learningTip;
 document.getElementById("scriptedLearnTitle").textContent=text.title;
 document.getElementById("scriptedLearnCopy").textContent=text.copy;
 requestAnimationFrame(positionLearningCoach);
}
function finishManualLearningMarks(){updateScriptedLearning();return true}
function handleLearningTap(event){
 if(!scriptedLearningActive())return;
 const target=event.target instanceof Element?event.target:null;if(!target)return;
 if(document.querySelector('#mapModal:not([hidden]),#rulesModal:not([hidden]),#feedbackModal:not([hidden]),#tutorialOverlay:not([hidden]),#shardRulesModal:not([hidden]),#badgeRulesModal:not([hidden])'))return;
 if(target.closest("#new,#tutorialHelp,#attemptPause,#attemptMask,#mobileAccount,#mobileAuthPopover,#feedbackBtn,#learningCoachNext"))return;
 if(target.closest("#board .cell"))return;
 event.preventDefault();event.stopImmediatePropagation();
}

function maybeShowManualCrossTip(){
 let seen=false;try{seen=localStorage.getItem("lumenManualCrossTipSeen")==="1"}catch(_){}
 if(seen)return;const tip=document.getElementById("manualCrossTip");if(tip)tip.hidden=false;
}
function closeManualCrossTip(){const tip=document.getElementById("manualCrossTip");if(tip)tip.hidden=true;try{localStorage.setItem("lumenManualCrossTipSeen","1")}catch(_){}}
function guidedErrorsEnabled(){const g=document.getElementById("guidedErrors");return !!(g&&g.checked)}
let guidedPending=null;

function guidedCell(r,c){return board.querySelector('.cell[data-row="'+r+'"][data-col="'+c+'"]')}
function drawGuidedLink(a,b){
 const ca=guidedCell(a[0],a[1]),cb=guidedCell(b[0],b[1]);if(!ca||!cb)return;
 const br=board.getBoundingClientRect(),ra=ca.getBoundingClientRect(),rb=cb.getBoundingClientRect();
 const x1=ra.left-br.left+ra.width/2,y1=ra.top-br.top+ra.height/2,x2=rb.left-br.left+rb.width/2,y2=rb.top-br.top+rb.height/2;
 const line=document.createElement("div");line.className="guided-link";line.style.left=x1+"px";line.style.top=y1+"px";line.style.width=Math.hypot(x2-x1,y2-y1)+"px";line.style.transform="rotate("+Math.atan2(y2-y1,x2-x1)+"rad)";board.appendChild(line);
}
function showGuidedConflict(r,c,info){
 attemptEngine.markAssistance();
 learningTip=null;document.getElementById("scriptedLearn").hidden=true;
 guidedPending={r,c,info};
 const attempt=guidedCell(r,c);if(!attempt)return;
 attempt.innerHTML='<span class="lumen-orb" aria-label="Gardien tenté"></span>';attempt.classList.add("guided-attempt");
 if(info.cause){
  const cause=guidedCell(info.cause[0],info.cause[1]);if(cause)cause.classList.add("guided-cause");
  if(info.type==="row"){for(let x=Math.min(c,info.cause[1]);x<=Math.max(c,info.cause[1]);x++)guidedCell(r,x)?.classList.add("guided-path")}
  if(info.type==="col"){for(let y=Math.min(r,info.cause[0]);y<=Math.max(r,info.cause[0]);y++)guidedCell(y,c)?.classList.add("guided-path")}
  if(info.type==="region"){const g=puz.reg[r][c];for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(puz.reg[y][x]===g)guidedCell(y,x)?.classList.add("guided-region")}
  if(info.type==="touch")drawGuidedLink([r,c],info.cause);
 }
 document.getElementById("guidedTitle").textContent=info.title;
 const introduceAssist=levelIndex<=1&&!learningTipSeen.has("assist");
 if(introduceAssist)learningTipSeen.add("assist");
 document.getElementById("guidedCopy").textContent=info.copy+(introduceAssist?" Assist te prévient quand une action enfreint une règle. Corrige ton choix, puis continue.":"");
 document.getElementById("guidedCard").hidden=false;
 board.setAttribute("aria-disabled","true");
}
function closeGuidedConflict(){
 guidedPending=null;document.getElementById("guidedCard").hidden=true;board.removeAttribute("aria-disabled");render();
}
let suppressGuidedClickUntil=0;
function dismissGuidedOnAnyTap(e){
 if(!guidedPending)return;
 const pending=guidedPending,cell=e.target.closest&&e.target.closest(".cell");
 const sameAttempt=cell&&Number(cell.dataset.row)===pending.r&&Number(cell.dataset.col)===pending.c;
 e.preventDefault();e.stopPropagation();
 if(sameAttempt){
  hist.push(state.map(x=>x.slice()));
  state[pending.r][pending.c]=1;
 }
 suppressGuidedClickUntil=performance.now()+700;
 closeGuidedConflict();
}
document.addEventListener("pointerdown",dismissGuidedOnAnyTap,true);
function configureLearningMode(){
 for(const id of ["undo","hint","verify"])document.getElementById(id).disabled=scriptedLearningActive();
 const cb=document.getElementById("autoCross"),wrap=document.getElementById("autoCrossWrap"),note=document.getElementById("learningNote"),guided=document.getElementById("guidedErrors"),gwrap=document.getElementById("guidedErrorsWrap");
 if(!cb||!wrap)return;
 if(levelIndex<=4){cb.checked=false;cb.disabled=true;wrap.hidden=false;wrap.classList.add("learning-locked");if(note){note.hidden=true;note.textContent=""}}
 else{cb.disabled=false;cb.checked=false;wrap.hidden=false;wrap.classList.remove("learning-locked");if(note){note.hidden=levelIndex>5;note.textContent=levelIndex===5?"Nouveau · Marquage auto débloqué. Active-le si tu veux que LUMEN écarte les cases impossibles à ta place.":""}}
 if(guided&&gwrap){
  let saved=null;try{saved=localStorage.getItem("lumenGuidedErrors")}catch(_){}
  gwrap.hidden=false;gwrap.classList.remove("learning-locked");
  if(levelIndex<=4){
   guided.checked=true;guided.disabled=true;gwrap.classList.add("learning-locked");
  }else if(levelIndex<=9){
   guided.disabled=false;guided.checked=saved===null?true:saved==="on";
  }else{
   guided.disabled=false;guided.checked=saved==="on";
  }
 }
}
function applyQuestRestrictions(){
 const q=bonusChallengeFor(levelIndex),cb=document.getElementById("autoCross"),wrap=document.getElementById("autoCrossWrap"),note=document.getElementById("learningNote"),hint=document.getElementById("hint");
 if(hint)hint.disabled=scriptedLearningActive();
 if(!q||lumenProgress.stars[q.id])return;
 if(q.noAuto){
  cb.checked=false;cb.disabled=true;wrap.classList.add("learning-locked");
  if(note){note.hidden=false;note.textContent="Quête Éclair · Marquage auto désactivée pour ce défi."}
 }
 if(q.type===2){
  if(hint)hint.disabled=true;
  if(note){note.hidden=false;note.textContent="Quête Esprit clair · aucun indice disponible pendant ce défi."}
 }
}
function setGuidedPreference(enabled){
 const guided=document.getElementById("guidedErrors");if(guided){guided.checked=enabled;guided.disabled=false}
 try{localStorage.setItem("lumenGuidedErrors",enabled?"on":"off")}catch(_){}
}
function finishAutonomyChoice(keepGuided){
 setGuidedPreference(!!keepGuided);lumenProgress.autonomySeen=1;saveLumenProgress();
 const o=document.getElementById("autonomyOverlay");if(o){o.hidden=true;o.style.display="none"}
 trackLumenEvent("guided_autonomy_choice",levelIndex+1,{guided:!!keepGuided});
}
function maybeShowAutoCrossUnlock(){
 if(levelIndex!==5||lumenProgress.autoCrossUnlockSeen)return;
 const o=document.getElementById("autoCrossUnlockOverlay");if(o){o.hidden=false;o.style.display="flex";pauseGameClock()}
}
function closeAutoCrossUnlock(){
 lumenProgress.autoCrossUnlockSeen=1;saveLumenProgress();
 const o=document.getElementById("autoCrossUnlockOverlay");if(o){o.hidden=true;o.style.display="none"}
 resumeGameClock();
}
function maybeShowBadgeMilestone(){
 let kind=null;
 if(levelIndex===2&&!lumenProgress.speedBadgeIntroSeen)kind="speed";
 if(levelIndex===5&&!lumenProgress.fullBadgeIntroSeen)kind="full";
 if(!kind)return;
 const o=document.getElementById("badgeUnlockOverlay"),title=document.getElementById("badgeUnlockTitle"),copy=document.getElementById("badgeUnlockCopy");
 if(!o||!title||!copy)return;
 o.dataset.kind=kind;
 if(kind==="speed"){
  title.textContent="Ton premier badge est à gagner";
  copy.innerHTML="<strong>⚡ Rapidité</strong> est maintenant disponible.<br><br>Réussis la quête avant la fin du temps cible pour l’obtenir. À partir de maintenant, tes performances peuvent donc enrichir chaque quête réussie.";
 }else{
  title.textContent="Tous les badges sont maintenant accessibles";
  copy.innerHTML="<strong>🧠 Autonomie</strong> : réussis sans assistance.<br><br><strong>⚡ Rapidité</strong> : termine avant le temps cible.<br><br><strong>✓ Sans erreur</strong> : réussis sans assistance et sans poursuivre après un mauvais Gardien.<br><br><strong>✦ Maîtrise</strong> : réunis Autonomie, Rapidité et Sans erreur sur le même essai.<br><br>Les assistances restent une façon parfaitement valable de jouer, mais leur utilisation empêche Autonomie, Sans erreur — et donc Maîtrise — sur cet essai.";
 }
 o.hidden=false;o.style.display="flex";pauseGameClock();
}
function closeBadgeMilestone(){
 const o=document.getElementById("badgeUnlockOverlay");if(!o)return;
 if(o.dataset.kind==="speed")lumenProgress.speedBadgeIntroSeen=1;else lumenProgress.fullBadgeIntroSeen=1;
 saveLumenProgress();o.hidden=true;o.style.display="none";resumeGameClock();
}
function maybeShowAutonomy(){
 if(levelIndex!==10||lumenProgress.autonomySeen)return;
 const o=document.getElementById("autonomyOverlay");if(o){o.hidden=false;o.style.display="flex";pauseGameClock()}
}
function prepareQuestStart(){let q=bonusChallengeFor(levelIndex),o=document.getElementById("questStart");questFailed=false;if(!q||lumenProgress.stars[q.id]){questStarted=true;o.hidden=true;resumeGameClock();return}questStarted=false;pauseGameClock();document.getElementById("questStartTitle").textContent=q.title;document.getElementById("questStartRule").textContent=q.copy+" Récompense : +25 XP et +1 ✦ éclat.";o.hidden=false}
document.getElementById("questGo").onclick=()=>{document.getElementById("questStart").hidden=true;questStarted=true;clock();updateAttemptUI()};
function init(){setLearningReplaySuccessMode(false);document.getElementById("successNew").textContent="Quête suivante";updateLearningSuccessCTA();learningTip=null;learningTipSeen=new Set();learningStage="place";learningIntroStep=0;choose();configureLearningMode();applyQuestRestrictions();maybeShowBadgeMilestone();maybeShowAutoCrossUnlock();maybeShowAutonomy();if(lastTrackedPuzzle!==levelIndex){lastTrackedPuzzle=levelIndex;trackLumenEvent("puzzle_start",levelIndex+1,{sector:Math.floor(levelIndex/20)});}let cl=document.getElementById("campaignMapLabel");if(cl)cl.textContent="Quête "+(levelIndex+1);document.getElementById("difficulty").textContent=n===7?"7 × 7 · constellation étendue":n===8?"8 × 8 · constellation étendue":"";state=Array.from({length:n},()=>Array(n).fill(0));hist=[];hi=null;proofs={};halfRewardShown=false;lastPlacedCount=0;hintStage=0;hintFocus=null;hiCells=[];const hintCard=document.getElementById("hintCard");if(hintCard)hintCard.hidden=true;celebrated=false;hintUsesThisGame=0;hintWasGranted=false;mistakesThisGame=0;verifyUsesThisGame=0;verifyPending=null;autoUsedThisGame=!!document.getElementById("autoCross")?.checked;render();if(board.children.length!==n*n){console.error("LUMEN board render invariant failed",{n,cells:board.children.length});render()}updateHintButton();updateVerifyButton();document.getElementById("verifyCard").hidden=true;hideSuccess();start=Date.now();msg.textContent="";drawLevels();clearInterval(timer);timer=setInterval(clock,100);
 const restored=attemptEngine.restore({questId:levelIndex+1,mode:attemptMode()});
 if(restored&&Array.isArray(restored.board)&&restored.board.length===n){state=restored.board.map(row=>row.slice());render()}else {const perf=lumenProgress.performances?.[levelIndex],eligible=performanceEligibility(levelIndex),hasEligible=Object.values(eligible).some(Boolean),qualifying=hasEligible&&perf?.lastQualifiedDay!==localCalendarDay();attemptEngine.create({questId:levelIndex+1,mode:attemptMode(),qualifying:socialChallenge?false:qualifying,challengeId:socialChallenge?.challenge_id||null,board:state});}
 clock();prepareQuestStart();updateAttemptUI();updateScriptedLearning()}
function drawLevels(){let e=document.getElementById("levels");e.innerHTML="";LEVELS.forEach(([name,x])=>{let b=document.createElement("button");b.className="level"+(x===n?" active":"");b.innerHTML=name+"<small>"+x+" × "+x+"</small>";b.onclick=()=>{n=x;init()};e.appendChild(b)})}
function activeGameMs(){return attemptEngine.activeMs()}
function activeGameSeconds(){return Math.max(0,Math.floor(activeGameMs()/1000))}
function clock(){let ms=activeGameMs(),s=Math.max(0,Math.floor(ms/1000));document.getElementById("time").textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0");const cd=document.getElementById("speedCountdown"),fill=document.getElementById("speedCountdownFill"),targetMs=speedTargetSeconds(levelIndex)*1000;if(cd){const remainingMs=targetMs-ms,show=!celebrated&&performanceEligibility(levelIndex).speed&&remainingMs<=10000&&remainingMs>0;cd.hidden=!show;if(show&&fill)fill.style.transform="scaleX("+Math.max(0,Math.min(1,remainingMs/10000))+")";else if(fill)fill.style.transform="scaleX(1)"}let q=bonusChallengeFor(levelIndex);if(q&&questStarted&&!lumenProgress.stars[q.id]){if(q.seconds!==null&&s>q.seconds)questFailed=true;if(q.type===2&&usedHintThisGame)questFailed=true;let b=document.getElementById("challengeCopy");if(b&&questFailed)b.textContent="Défi échoué · termine la quête à ton rythme."}}
function pauseGameClock(){attemptEngine.pause();clock()}
function resumeGameClock(){attemptEngine.resume();clock()}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")pauseGameClock();else loadMyChallenges()});
window.addEventListener("pagehide",pauseGameClock);

function displayedCellState(r,c){
 // 0 empty, 1 manual X, 2 diamond, 3 derived automatic X
 if(state[r][c]===2)return 2;
 if(state[r][c]===1)return 1;
 return isAutoCross(r,c)?3:0;
}

const LUMEN_APP_VERSION="beta-2026.10";
let feedbackKind="bug";
function openBetaFeedback(){const modal=document.getElementById("feedbackModal"),status=document.getElementById("feedbackStatus");if(!modal)return;modal.hidden=false;if(status)status.textContent="";}
function setupBetaFeedback(){
 const modal=document.getElementById("feedbackModal"),status=document.getElementById("feedbackStatus");
 document.getElementById("betaFeedbackBtn").onclick=openBetaFeedback;
 document.getElementById("feedbackCancel").onclick=()=>modal.hidden=true;
 modal.onclick=e=>{if(e.target===modal)modal.hidden=true};
 document.querySelector(".beta-kinds").addEventListener("click",e=>{const b=e.target.closest("button[data-kind]");if(!b)return;e.preventDefault();feedbackKind=b.dataset.kind;document.querySelectorAll(".beta-kinds button").forEach(x=>x.classList.toggle("selected",x===b));const labels={bug:"Bug",rule:"Règle / indice",difficulty:"Trop difficile",other:"Autre"};document.getElementById("feedbackChoice").textContent="Type sélectionné : "+labels[feedbackKind]});
 document.querySelector('.beta-kinds button[data-kind="bug"]').classList.add("selected");
 document.getElementById("feedbackSend").onclick=async()=>{
  const btn=document.getElementById("feedbackSend");btn.disabled=true;status.textContent="Envoi…";
  if(!lumenSupabase){status.textContent="Connexion indisponible.";btn.disabled=false;return}
  const {error}=await lumenSupabase.rpc("lumen_send_feedback",{p_anonymous_id:lumenAnonymousId,p_kind:feedbackKind,p_message:document.getElementById("feedbackText").value,p_puzzle_id:levelIndex+1,p_board_state:{state:state,regions:puz.reg},p_elapsed_seconds:activeGameSeconds(),p_hints_used:usedHintThisGame?1:0,p_app_version:LUMEN_APP_VERSION,p_user_agent:navigator.userAgent});
  if(error){status.textContent="Envoi impossible. Réessaie.";console.warn("LUMEN feedback",error);btn.disabled=false;return}
  status.textContent="Merci, retour envoyé.";document.getElementById("feedbackText").value="";setTimeout(()=>{modal.hidden=true;btn.disabled=false},800);
 };
 document.querySelectorAll(".difficulty-choices button").forEach(b=>b.onclick=()=>{
  // Rating is the final action on the completion card: advance immediately.
  const rating=b.dataset.rating,puzzleId=levelIndex+1;
  advanceToNextPuzzle();
  if(!lumenSupabase)return;
  lumenSupabase.rpc("lumen_rate_difficulty",{p_anonymous_id:lumenAnonymousId,p_puzzle_id:puzzleId,p_rating:rating})
   .then(({error})=>{if(error)console.warn("LUMEN difficulty rating",error)})
   .catch(e=>console.warn("LUMEN difficulty rating",e));
 });
}
function shouldAskDifficulty(i,questPassed){
 if(questPassed)return false;
 const card=i+1;
 return card===3||card===10||card===20||(card>20&&card%10===0);
}
function configureSuccessFeedback(questPassed){
 const box=document.getElementById("difficultyBox"),ask=shouldAskDifficulty(levelIndex,questPassed);
 if(box)box.hidden=!ask;
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

function renderSuccessRewards(stars){let el=document.getElementById("successRewards");if(!el)return;let run=performanceRun(levelIndex),rewards=[];if(stars>0)rewards.push({cls:"star",icon:"★",label:"+"+stars+" étoile"+(stars>1?"s":"")});if(run.qualifying&&run.autonomy)rewards.push({cls:"autonomy",icon:performanceIcon("autonomy"),label:"Autonomie"});if(run.qualifying&&run.speed)rewards.push({cls:"speed",icon:performanceIcon("speed"),label:"Rapidité"});if(run.qualifying&&run.noError)rewards.push({cls:"no-error",icon:performanceIcon("noError"),label:"Sans erreur"});if(run.qualifying&&run.mastery)rewards.push({cls:"mastery",icon:performanceIcon("mastery"),label:"Maîtrise"});el.innerHTML=rewards.map(r=>'<span class="success-reward '+r.cls+'"><span>'+r.icon+'</span><span>'+r.label+'</span></span>').join("")}
function celebrateSuccess(){
 if(celebrated)return;
 if(socialChallenge){celebrateSocialChallengeSuccess();return}
 if(learningReplayActive()){celebrateLearningReplaySuccess();return}
 trackLumenEvent("puzzle_complete",levelIndex+1,{duration_seconds:activeGameSeconds(),hint_used:!!usedHintThisGame});
 celebrated=true;attemptEngine.complete();
 // Progress is tied to the game's real victory event (not overlay visibility).
 const firstCompletion=!lumenProgress.solved[levelIndex];
 const skyEarnedBefore=skyStarsEarned();
 lumenProgress.solved[levelIndex]=1;
 if(firstCompletion)lumenProgress.skyScore=Math.min(SKY_TARGET,skyEarnedBefore+skyStarsForGrid(levelIndex));
 if(firstCompletion)lumenProgress.xp=(lumenProgress.xp||0)+10;
 if(firstCompletion&&!usedHintThisGame)lumenProgress.xp+=5;
 const ch=bonusChallengeFor(levelIndex);let questPassed=false;
 if(ch&&!lumenProgress.stars[ch.id]){
   questPassed=!questFailed&&(ch.seconds!==null?activeGameSeconds()<=ch.seconds:(ch.type===2?!usedHintThisGame:true));
   if(questPassed){lumenProgress.stars[ch.id]=1;lumenProgress.challenges[ch.id]=1;lumenProgress.xp+=25;lumenProgress.shards=(lumenProgress.shards||0)+1}
 }
 const earnedThisRun=starsAwardedForGrid(levelIndex,firstCompletion,questPassed);
 const priorPerformance=lumenProgress.performances[levelIndex]||{},priorBadges=priorPerformance.version===2?{...(priorPerformance.badges||{})}:{};
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
 renderSuccessRewards(earnedThisRun);renderSuccessAchievement();
 if(!usedHintThisGame){
   if(!lumenProgress.noHint)lumenProgress.noHint={};
   lumenProgress.noHint[levelIndex]=1;
   // Autonomy rewards are handled from the shared #30 assistance definition.
 }
 saveLumenProgress();
 if(firstCompletion){cloudSavePuzzle(levelIndex);setTimeout(maybeOfferInstall,1600);setTimeout(maybeOfferPush,5200)}
 refreshJourney();
 pauseGameClock();
 clearInterval(timer);
 clock();
 board.classList.add("win");
 document.getElementById("successTime").textContent=document.getElementById("time").textContent;
 const qr=document.getElementById("questResult");if(ch){qr.hidden=false;qr.className="quest-result "+(questPassed||lumenProgress.stars[ch.id]?"success":"fail");qr.textContent=questPassed?"✦ Défi réussi ! +25 XP et un éclat gagné.":lumenProgress.stars[ch.id]?"✦ Défi déjà accompli":"Défi échoué — la quête est tout de même accomplie."}else qr.hidden=true;
 const m=milestoneFor(levelIndex),sub=document.getElementById("successSub");if(sub)sub.textContent=m?(m.kind==="boss"?"Défi final réussi · constellation complétée":"Défi intermédiaire réussi · +1 ★ bonus"):(questPassed?"Quête réussie · +25 XP et +1 ✦":"Ton ciel progresse");
 if(levelIndex===1&&sub)sub.textContent="Ton ciel progresse. Rapidité arrive à la quête 3 ; Autonomie et Maîtrise à la quête 6.";
 if(levelIndex<=1)try{localStorage.setItem(qaActive?"lumenQaTutorialSeen":"lumenTutorialSeen","1")}catch(_){}
 configureSuccessFeedback(questPassed);
 const skyEarnedAfter=skyStarsEarned(),crossedConstellation=firstCompletion&&(()=>{let total=0;for(const cs of CONSTELLATIONS){total+=cs.count;if(skyEarnedBefore<total&&skyEarnedAfter>=total)return true}return false})();
 const checkpoint=firstCompletion&&!crossedConstellation?constellationCheckpoint(skyEarnedBefore,skyEarnedAfter):null;
 const revealDelay=earnedThisRun>0?2250:0;
 if(firstCompletion&&earnedThisRun>0){document.getElementById("successOverlay").classList.remove("show");setTimeout(()=>showSkyReveal(skyEarnedBefore,checkpoint),revealDelay)}else if(questPassed||crossedConstellation||checkpoint){document.getElementById("successOverlay").classList.remove("show");setTimeout(()=>showSkyReveal(skyEarnedBefore,checkpoint),revealDelay)}else setTimeout(()=>document.getElementById("successOverlay").classList.add("show"),revealDelay);

 // Deliberately varied shapes/positions; purely visual, no game-state effect.
 const palette=["#68e7ff","#5ea7ff","#8b7cff","#67d8c2","#d7f8ff","#87bfff"];
 for(let i=0;i<72;i++){
  let x=document.createElement("i");
  x.className="confetti";
  x.style.left=((i*37)%101)+"vw";
  x.style.background=palette[i%palette.length];
  x.style.setProperty("--dur",(2.2+(i%9)*.16)+"s");
  x.style.setProperty("--rot",((i*47)%360)+"deg");
  x.style.animationDelay=((i%13)*.035)+"s";
  if(i%3===0){x.style.borderRadius="50%";x.style.width="10px";x.style.height="10px"}
  document.body.appendChild(x);
 }
 setTimeout(()=>document.querySelectorAll(".confetti").forEach(x=>x.remove()),4300);
}

const {audioContext,tone,guardianSound,errorSound,halfSound,victorySound,starArrivalSound,constellationSound,updateSoundToggle,setSoundEnabled}=createSound();
let halfRewardShown=false,lastPlacedCount=0,rewardToastTimer=null;
function updateLiveReward(q){
 const m=document.getElementById("masteryLive"),p=document.getElementById("progressLive");if(!m||!p)return;
 const attempt=attemptEngine.snapshot(),eligibility=performanceEligibility(levelIndex),assisted=!!attempt?.assistanceUsed,within=activeGameSeconds()<speedTargetSeconds(levelIndex),noError=eligibility.noError&&!assisted&&!attempt?.mistakeCommitted,mastery=eligibility.mastery&&!assisted&&within&&noError;
 m.textContent=!Object.values(eligibility).some(Boolean)?"Performances bientôt":eligibility.mastery?(mastery?"✦ Maîtrise en cours":"○ Maîtrise à retenter"):"⚡ Rapidité disponible";m.classList.toggle("lost",eligibility.mastery&&!mastery);
 p.textContent="";
}
function showRewardToast(text){
 const t=document.getElementById("rewardToast");if(!t)return;t.textContent=text;t.classList.add("show");clearTimeout(rewardToastTimer);rewardToastTimer=setTimeout(()=>t.classList.remove("show"),1900);
}
function rewardProgressPulse(q){
 if(q>lastPlacedCount){guardianSound(q);requestAnimationFrame(()=>{const cells=[...board.querySelectorAll(".cell")];for(const d of cells){if(d.querySelector(".lumen-orb"))d.classList.add("just-lit")}setTimeout(()=>cells.forEach(d=>d.classList.remove("just-lit")),380)})}
 if(!halfRewardShown&&q>=Math.ceil(n/2)){halfRewardShown=true;halfSound();board.classList.add("board-half");showRewardToast("✦ Mi-chemin");setTimeout(()=>board.classList.remove("board-half"),650)}
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
   paintBoardState();updateScriptedLearning();if(scriptedLearningActive())finishManualLearningMarks();else if(levelIndex===1)showLearningTip("tools","À toi de poursuivre","Glissé acquis ! Poursuis librement. Vérifier examine tes choix ; Indice aide à déduire. Leur premier usage est gratuit.");setTimeout(()=>{dragCrossSuppressClick=false},0);
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
 // The first tap is the intermediate exclusion in the real placement cycle.
 // Validate the Guardian on the second tap so the correct cell stays playable.
 if(guidedErrorsEnabled()&&next===2){
  const guidedError=guidedConflictForAction(r,c,next);
  if(guidedError){
   attemptEngine.markAssistance();
   mistakesThisGame++;
   msg.textContent="";
   errorSound();
   showGuidedConflict(r,c,guidedError);
   updateLiveReward(state.flat().filter(v=>v===2).length);
   return;
  }
 }
 const actionKey=r+","+c,pending=attemptEngine.snapshot()?.wrongGuardianPending,correctingPending=pending===actionKey&&state[r][c]===2&&next===0;
 if(pending){
  if(correctingPending)attemptEngine.clearWrongGuardianPending(actionKey);
  else attemptEngine.commitMistake();
 }
 hist.push(state.map(x=>x.slice()));
 if(shown===3){state[r][c]=2}else{state[r][c]=next}
 if(next===2&&puz.sol[r]!==c)attemptEngine.setWrongGuardianPending(actionKey);
 if(next===2&&document.getElementById("autoCross")?.checked)attemptEngine.markAssistance();
 clearHintDisplay();hintStage=0;hintFocus=null;msg.textContent="";
 paintBoardState();updateScriptedLearning();if(levelIndex===1&&next===2&&!scriptedLearningActive())showLearningTip("tools","Cette quête est à toi","Tu joues librement. Vérifier examine tes choix ; Indice aide à trouver une déduction. Le premier usage de chacun est gratuit. Utilise-les seulement si tu en as besoin.");persistAttemptBoard();
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
  if(d.axis==="row")return {text:`Compte les possibilités encore ouvertes sur la ligne ${d.index+1}.`,cells:[]};
  if(d.axis==="col")return {text:`Compte les possibilités encore ouvertes dans la colonne ${d.index+1}.`,cells:[]};
  if(d.axis==="region")return {text:`Compte les possibilités encore ouvertes dans cette territoire.`,cells:[]};
 }
 return null;
}
function clearHintDisplay(){
 hi=null;hiCells=[];const card=document.getElementById("hintCard");if(card)card.hidden=true;
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

 // 3. Use proof engine for a logical elimination / placement.
 let h=proofEngine(); proofs=h.why||{};

 if(h.kind==="elim"){
  let d=h.detail, id="e:"+h.cell.join(",")+":"+(d?d.rule:"");
  if(hintFocus!==id){hintFocus=id;hintStage=1}else hintStage++;

  if(d&&d.rule==="contradiction"){
   hi=h.cell;
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
    showHintMessage(`Piste : observe ensemble les territoires surlignées. Leurs Gardiens ne peuvent se placer que dans ${d.indices.length} ${word}. Essaie d'identifier lesquelles.`);
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

  hi=h.cell;
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
   hi=h.cell;
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
   hi=h.cell;
   showHintMessage("Indice : "+h.text+" Vérifie toi-même les autres possibilités avant de jouer.");
   render();return;
  }
  // 6. Third press: reveal the forced placement as last resort.
  hi=h.cell;
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
const runHintTests=createHintTestSuite(testModel,{handleSuccessAdvance,getSkyTourSteps:()=>SKY_TOUR_STEPS,maybeShowAutoCrossUnlock,maybeShowBadgeMilestone,saveLumenNickname,maybeOfferInstall,lumenShareUrl,successAchievement,shareLumenResult,captureReferral,enableLumenPush,markLumenSeen,maybeOfferPush,board,key,proofEngine,playerError,guidedConflictForAction,scriptedLearningActive,maybeShowManualCrossTip,showGuidedConflict,configureLearningMode,maybeShowAutonomy,hideSuccess,celebrateSuccess,paintCell,paintBoardState,moveDragCross,render,celebrateConstellationReveal,showSkyReveal,closeAutonomyOverlay,setupOutsideDefaults,openJourneyMap:()=>openJourneyMap,closeMapOverlay:()=>closeMapOverlay,renderMap:()=>renderMap,advanceToNextPuzzle,startReplay});
let runTestsButton=document.getElementById("runTests");
if(runTestsButton)runTestsButton.onclick=runHintTests;

const hintClose=document.getElementById("hintClose");
if(hintClose)hintClose.onclick=()=>{clearHintDisplay();hintStage=0;hintFocus=null;render()};
document.getElementById("undo").onclick=()=>{if(celebrated||scriptedLearningActive())return;if(hist.length){const previous=hist.pop(),pending=attemptEngine.snapshot()?.wrongGuardianPending;if(pending){const [pr,pc]=pending.split(",").map(Number);if(previous?.[pr]?.[pc]!==2)attemptEngine.clearWrongGuardianPending(pending)}state=previous;clearHintDisplay();hintStage=0;hintFocus=null;msg.textContent="";render();persistAttemptBoard()}};
const ac=document.getElementById("autoCross");
const lumenAutoCrossStored=localStorage.getItem("lumenAutoCross");const legacyAutoCrossStored=localStorage.getItem("regaliaAutoCross");ac.checked=(lumenAutoCrossStored??legacyAutoCrossStored)!=="0";if(lumenAutoCrossStored===null&&legacyAutoCrossStored!==null){localStorage.setItem("lumenAutoCross",legacyAutoCrossStored);localStorage.removeItem("regaliaAutoCross")};
ac.onchange=()=>{if(celebrated){ac.checked=!ac.checked;return}if(levelIndex<=4){ac.checked=false;return}if(ac.checked){autoUsedThisGame=true;attemptEngine.markAssistance()}localStorage.setItem("lumenAutoCross",ac.checked?"1":"0");if(!ac.checked)maybeShowManualCrossTip();hi=null;render()};
function advanceToNextPuzzle(){
 if(!lumenProgress.solved[levelIndex])return;
 // "Quête suivante" is relative to the quest just played, including replays.
 // sequentialSolvedCount remains the highest unlocked campaign position.
 const next=levelIndex+1;
 replayMode=false;
 if(next>=100)return;
 document.getElementById("undo").disabled=false;document.getElementById("hint").disabled=false;document.getElementById("autoCross").disabled=false;
 hideSuccess();
 if(next<100)levelIndex=next;
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
document.getElementById("successSky").onclick=()=>{hideSuccess();let learningTour=false;try{learningTour=levelIndex===1&&localStorage.getItem("lumenSkyTourSeen")!=="1"}catch(_){}openJourneyMap(true,{advanceOnClose:true,learningTour})};
function learningSkyDiscoveryRequired(){return levelIndex===1&&!replayMode&&!socialChallenge}
function updateLearningSuccessCTA(){
 const b=document.getElementById("successNew");if(!b)return;
 b.textContent=learningSkyDiscoveryRequired()?"✦ Découvrir Mon ciel":"Quête suivante";
}
function clearSkyTourFocus(){document.querySelectorAll(".sky-tour-focus").forEach(el=>el.classList.remove("sky-tour-focus"))}
function renderSkyTourStep(){
 const tour=document.getElementById("skyTour");if(!tour||tour.hidden)return;
 const step=SKY_TOUR_STEPS[Math.min(skyTourStep,SKY_TOUR_STEPS.length-1)],target=document.getElementById(step.target);
 clearSkyTourFocus();if(target){target.classList.add("sky-tour-focus");target.scrollIntoView({behavior:"smooth",block:"center"})}
 document.getElementById("skyTourTitle").textContent=step.title;
 document.getElementById("skyTourCopy").textContent=step.copy;
 const next=document.getElementById("skyTourNext");next.textContent=skyTourStep===SKY_TOUR_STEPS.length-1?"Jouer la quête 3":"Suivant";
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
if(attemptAbandon)attemptAbandon.onclick=async()=>{const a=attemptEngine.snapshot();if(!a)return;if(!confirm("Abandonner cette tentative ?"))return;attemptEngine.abandon();if(socialChallenge){trackLumenEvent("challenge_abandoned",levelIndex+1);await finishSocialChallenge("abandoned");return}attemptEngine.clear();init()};


let mapConstellation=0,skyTourStep=0;
const SKY_TOUR_STEPS=[
 {target:"sectorTabs",title:"Tes constellations",copy:"Ton ciel est organisé en constellations. Elles se débloquent au fil de ton aventure."},
 {target:"puzzleGrid",title:"Tes quêtes",copy:"Chaque constellation regroupe ses quêtes. Ici tu vois celles qui sont réussies, celle à jouer et celles encore verrouillées."},
 {target:"performanceLegend",title:"Tes performances",copy:"Les badges récompensent ta façon de résoudre une quête : autonomie, rapidité, sans erreur et maîtrise. Tu pourras revenir améliorer une quête réussie."},
 {target:"skyCard",title:"Ta constellation",copy:"Chaque réussite allume des étoiles. À mesure que tu avances, la constellation se dessine dans ton ciel."}
];
function starDisplayName(p,i){return p.stars&&p.stars[i]?p.stars[i]:"Étoile "+(i+1)}

function renderSky(index=mapConstellation){let el=document.getElementById("skyCard");if(!el)return;index=Math.max(0,Math.min(index,CONSTELLATIONS.length-1));let c=CONSTELLATIONS[index],lit=constellationLitAt(index),p={index,...c,lit},active=index===constellationProgress().index,lines=p.edges.map(e=>'<line class="sky-line '+(e[0]<lit&&e[1]<lit?'on':'')+'" x1="'+p.pts[e[0]][0]+'" y1="'+p.pts[e[0]][1]+'" x2="'+p.pts[e[1]][0]+'" y2="'+p.pts[e[1]][1]+'"/>').join(""),stars=p.pts.map((v,i)=>'<g><circle class="sky-star '+(i<lit?'on':'')+'" cx="'+v[0]+'" cy="'+v[1]+'" r="'+(i<lit?4:3)+'"/>'+(i<lit?'<text class="sky-label" x="'+(v[0]+6)+'" y="'+(v[1]-5)+'">'+starDisplayName(p,i)+'</text>':'')+'</g>').join("");el.innerHTML='<div class="sky-head"><span class="sky-name">'+p.name+'</span><span>'+lit+' / '+p.count+' étoiles</span></div><svg class="sky-svg" viewBox="0 0 290 115">'+lines+stars+'</svg><div class="sky-note">'+(active?"Constellation active":lit===p.count?"Constellation complétée":lit===0?"Constellation à découvrir":"Constellation en cours")+'</div>'}

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
 canvas.innerHTML='<svg class="sky-reveal-svg" viewBox="0 0 290 115">'+lines+stars+'</svg><div>'+p.lit+' / '+p.count+' étoiles</div>';o.hidden=false;if(completedIndex>=0)celebrateConstellationReveal();
}
document.getElementById("skyRevealContinue").onclick=()=>{const o=document.getElementById("skyReveal");o.hidden=true;o.classList.remove("complete-celebration");o.querySelectorAll(".sky-bravo").forEach(x=>x.remove());document.querySelectorAll(".sky-spark").forEach(x=>x.remove());document.getElementById("successOverlay").classList.add("show")};
function renderXP(){let q=bonusChallengeFor(levelIndex),m=milestoneFor(levelIndex),ch=m||q,box=document.getElementById("challengeBanner");if(!box)return;box.hidden=!ch;if(ch){let done=q&&lumenProgress.stars[q.id];document.getElementById("challengeTitle").textContent=ch.title+(done?" · ★":"");document.getElementById("challengeCopy").textContent=done?"Bonus obtenu":ch.copy}}

function refreshJourney(){awards();let sky=constellationProgress(),earned=skyStarsEarned(),completed=CONSTELLATIONS.slice(0,sky.index).length;
document.getElementById("progressFill").style.width=(sky.count?Math.round(sky.lit/sky.count*100):0)+"%";
document.getElementById("progressText").textContent=completed+" constellation"+(completed>1?"s":"")+" découverte"+(completed>1?"s":"");
let ss=document.getElementById("skySummary");if(ss)ss.textContent=sky.name.replace(" · Grand Chariot","")+" · "+sky.lit+"/"+sky.count+" ★";
document.getElementById("journeyTitle").textContent=sky.name.replace(" · Grand Chariot","");
document.getElementById("sectorProgress").textContent=sky.lit+"/"+sky.count+" étoiles · "+earned+"/"+SKY_TARGET+" dans le ciel";
updateHintButton();renderXP();
}

function performanceIcon(type){const icons={autonomy:'<span aria-hidden="true">🧠</span>',speed:'<span aria-hidden="true">⚡</span>',noError:'<span aria-hidden="true">✓</span>',mastery:'<span aria-hidden="true">✦</span>'};return icons[type]||""}
function performanceBadges(i){
 const p=lumenProgress.performances?.[i],earned=p?.version>=2?p.badges||{}:{},eligibility=performanceEligibility(i);
 const badges=[{cls:"autonomy",key:"autonomy",label:"Autonomie"},{cls:"speed",key:"speed",label:"Rapidité"},{cls:"no-error",key:"noError",label:"Sans erreur"},{cls:"mastery",key:"mastery",label:"Maîtrise"}];
 return '<span class="performance-grid" aria-label="Performance">'+badges.map(x=>{const locked=!eligibility[x.key],got=!!earned[x.key],state=locked?" verrouillé":got?" obtenu":" disponible";return '<span class="performance-slot '+x.cls+(got?' earned':'')+(locked?' locked':'')+'" title="'+x.label+state+'" aria-label="'+x.label+state+'">'+(locked?'🔒':got?performanceIcon(x.cls):'')+'</span>'}).join("")+'</span>'
}
function startReplay(i){if(!lumenProgress.solved[i])return;levelIndex=i;replayMode=true;document.getElementById("mapModal").hidden=true;document.getElementById("undo").disabled=false;document.getElementById("hint").disabled=false;document.getElementById("autoCross").disabled=false;loadPuzzle();usedHintThisGame=false;refreshJourney()}
function renderMap(){const tabs=document.getElementById("sectorTabs"),puzzleGrid=document.getElementById("puzzleGrid");tabs.innerHTML="";CONSTELLATIONS.forEach((c,i)=>{let b=document.createElement("button"),unlocked=i<=chapterForGrid(Math.min(sequentialSolvedCount,99));b.className="sector-tab"+(i===mapConstellation?" active":"")+(unlocked?"":" locked");b.textContent="✦ "+c.name.replace(" · Grand Chariot","");b.onclick=()=>{if(unlocked){mapConstellation=i;renderMap();renderSky(i)}};tabs.appendChild(b)});puzzleGrid.innerHTML="";let range=constellationGridRange(mapConstellation),start=range.start,end=range.end+1;for(let i=start;i<end;i++){let solved=!!lumenProgress.solved[i],current=i===Math.min(sequentialSolvedCount,99),b=document.createElement("button"),pos=i-start+1,meta=performanceBadges(i);b.className="puzzle-card"+(solved?" done":"")+(current?" current":"")+(!solved&&!current?" locked":"");b.innerHTML=solved?meta:(current?'<span class="puzzle-new-icon">✦</span><span class="puzzle-new-label">Nouvelle</span><span class="puzzle-new-number">Quête '+pos+'</span>':"");b.title=solved?"Rejouer la quête "+pos+" pour améliorer ta performance":current?"Nouvelle quête disponible · quête "+pos:"Quête "+pos+" · verrouillée";b.onclick=()=>{if(solved){startReplay(i);return}if(!current)return;levelIndex=i;replayMode=false;document.getElementById("mapModal").hidden=true;loadPuzzle();refreshJourney()};puzzleGrid.appendChild(b)}renderSky(mapConstellation)}
function openJourneyMap(focusSky=false,{advanceOnClose=false,learningTour=false}={}){mapConstellation=chapterForGrid(levelIndex);renderMap();const modal=document.getElementById("mapModal");modal.hidden=false;const tour=document.getElementById("skyTour");if(tour)tour.hidden=!learningTour;if(learningTour){skyTourStep=0;requestAnimationFrame(renderSkyTourStep)}else clearSkyTourFocus();modal.dataset.advanceOnClose=advanceOnClose&&!!lumenProgress.solved[levelIndex]?"1":"";const attemptMask=document.getElementById("attemptMask");if(attemptMask)attemptMask.hidden=true;if(focusSky){requestAnimationFrame(()=>{const sky=document.getElementById("skyCard");if(sky){sky.scrollIntoView({behavior:"smooth",block:"center"});sky.classList.add("sky-focus");setTimeout(()=>sky.classList.remove("sky-focus"),900)}})}}

const performanceLegend=document.getElementById("performanceLegend"),badgeRulesModal=document.getElementById("badgeRulesModal"),closeBadgeRules=document.getElementById("closeBadgeRules");function openBadgeRules(){if(badgeRulesModal){badgeRulesModal.hidden=false;closeBadgeRules&&closeBadgeRules.focus()}}function hideBadgeRules(){if(badgeRulesModal){badgeRulesModal.hidden=true;performanceLegend&&performanceLegend.focus()}}if(performanceLegend){performanceLegend.onclick=openBadgeRules;performanceLegend.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openBadgeRules()}}}if(closeBadgeRules)closeBadgeRules.onclick=hideBadgeRules;if(badgeRulesModal)badgeRulesModal.onclick=e=>{if(e.target===badgeRulesModal)hideBadgeRules()};document.addEventListener("keydown",e=>{if(e.key==="Escape"&&badgeRulesModal&&!badgeRulesModal.hidden)hideBadgeRules()});
const shardMeter=document.getElementById("shardMeter"),shardRulesModal=document.getElementById("shardRulesModal"),closeShardRules=document.getElementById("closeShardRules");function openShardRules(){if(shardRulesModal){shardRulesModal.hidden=false;closeShardRules&&closeShardRules.focus()}}function hideShardRules(){if(shardRulesModal){shardRulesModal.hidden=true;shardMeter&&shardMeter.focus()}}if(shardMeter){shardMeter.onclick=openShardRules;shardMeter.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openShardRules()}}}if(closeShardRules)closeShardRules.onclick=hideShardRules;if(shardRulesModal)shardRulesModal.onclick=e=>{if(e.target===shardRulesModal)hideShardRules()};document.addEventListener("keydown",e=>{if(e.key==="Escape"&&shardRulesModal&&!shardRulesModal.hidden)hideShardRules()});
function bindOutsideDefault(id,action){
 const o=document.getElementById(id);if(!o)return;
 o.addEventListener("click",e=>{if(e.target!==o)return;e.preventDefault();action()});
}
function dismissInstallLater(){const o=document.getElementById("installOptin");if(!o||o.hidden)return;o.hidden=true;try{localStorage.setItem("lumenInstallLater",String(Date.now()))}catch(_){}trackLumenEvent("pwa_install_later")}
function dismissPushLater(){const o=document.getElementById("pushOptin");if(!o||o.hidden)return;o.hidden=true;try{localStorage.setItem("lumenPushChoice","later")}catch(_){}}
function continueSkyReveal(){document.getElementById("skyRevealContinue")?.click()}
function startQuestFromOverlay(){document.getElementById("questGo")?.click()}
function closeAutonomyOverlay(){finishAutonomyChoice(false);resumeGameClock()}
function closeMapOverlay(){const o=document.getElementById("mapModal");if(!o)return;const advance=o.dataset.advanceOnClose==="1";o.hidden=true;const tour=document.getElementById("skyTour");if(tour)tour.hidden=true;o.dataset.advanceOnClose="";if(advance){advanceToNextPuzzle();return}updateAttemptUI()}
function setupOutsideDefaults(){
 const successOverlay=document.getElementById("successOverlay");
 if(successOverlay)successOverlay.addEventListener("click",e=>{if(e.target!==successOverlay)return;e.preventDefault();if(learningSkyDiscoveryRequired())return;handleSuccessAdvance()});
 bindOutsideDefault("skyReveal",continueSkyReveal);
 bindOutsideDefault("questStart",startQuestFromOverlay);
 bindOutsideDefault("autonomyOverlay",closeAutonomyOverlay);
 bindOutsideDefault("mapModal",closeMapOverlay);
 bindOutsideDefault("installOptin",dismissInstallLater);
 bindOutsideDefault("pushOptin",dismissPushLater);
 // badgeRulesModal, shardRulesModal and feedbackModal already close on their backdrop.
 // Guided explanations and verification corrections deliberately require their explicit action.
 const tutorial=document.getElementById("tutorialOverlay");
 if(tutorial)tutorial.addEventListener("click",e=>{if(e.target!==tutorial)return;let seen=false;try{seen=localStorage.getItem(qaActive?"lumenQaTutorialSeen":"lumenTutorialSeen")==="1"}catch(_){}if(seen)closeTutorial(false)});
}
const skyTourNext=document.getElementById("skyTourNext");if(skyTourNext)skyTourNext.onclick=advanceSkyTour;

const openSky=document.getElementById("openSky");if(openSky)openSky.onclick=()=>openJourneyMap(true);
document.getElementById("closeMap").onclick=closeMapOverlay;document.getElementById("hint").addEventListener("click",()=>{if(!hintWasGranted)return;attemptEngine.markAssistance();hintWasGranted=false;trackLumenEvent("hint_used",levelIndex+1);usedHintThisGame=true;updateHintButton()});

const autoCrossUnlockOk=document.getElementById("autoCrossUnlockOk");if(autoCrossUnlockOk)autoCrossUnlockOk.onclick=closeAutoCrossUnlock;
const badgeUnlockOk=document.getElementById("badgeUnlockOk");if(badgeUnlockOk)badgeUnlockOk.onclick=closeBadgeMilestone;
const autonomyTry=document.getElementById("autonomyTry"),autonomyKeep=document.getElementById("autonomyKeep");
if(autonomyTry)autonomyTry.onclick=()=>{finishAutonomyChoice(false);resumeGameClock()};
if(autonomyKeep)autonomyKeep.onclick=()=>{finishAutonomyChoice(true);resumeGameClock()};
document.getElementById("new").onclick=()=>{
  if(celebrated)return;
  if(!confirm(socialChallenge?"Réinitialiser la grille ? Dans un défi, le chrono, les aides et les erreurs restent comptabilisés.":"Réinitialiser la grille ? Tu repars sur un nouvel essai pour les badges : chrono, aides et erreurs sont remis à zéro."))return;
  hideSuccess();
  state=Array.from({length:n},()=>Array(n).fill(0));hist=[];clearHintDisplay();hintStage=0;hintFocus=null;msg.textContent="";
  attemptEngine.reset(state);render();refreshJourney();
};
document.getElementById("learningCoachDismiss").onclick=()=>{learningTip=null;updateScriptedLearning()};
document.getElementById("learningCoachNext").onclick=advanceLearningIntro;
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
const nicknameSave=document.getElementById("nicknameSave");if(nicknameSave)nicknameSave.onclick=saveLumenNickname;
const guidedErrors=document.getElementById("guidedErrors");if(guidedErrors)guidedErrors.onchange=()=>{if(levelIndex<=4){guidedErrors.checked=true;return}localStorage.setItem("lumenGuidedErrors",guidedErrors.checked?"on":"off")};
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
 navigator.serviceWorker.addEventListener("controllerchange",()=>{if(lumenReloadingForSW)return;lumenReloadingForSW=true;location.reload()});
 window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js?v=8",{updateViaCache:"none"}).then(r=>r.update()).catch(e=>console.warn("LUMEN service worker",e)));
}

// Preserve the public browser testing entry points.
window.runHintTests=runHintTests;
window.lumenDiagnostics=createDiagnostics(testModel,{init,runHintTests,setSoundEnabled,closeTutorial,hideSuccess,render});
}
