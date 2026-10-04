import {CONSTELLATIONS,CONSTELLATION_GRID_COUNTS,SKY_TARGET} from "./data.js";
import {baseCampaignQuestCount} from "./content.js";
import {performanceAttempt,performanceEligibility,localCalendarDay,mergeEarnedBadges} from "./performance.js";
export function campaignQuestCount(){return baseCampaignQuestCount()}
export function sequentialCount(source){let count=0,total=campaignQuestCount();while(count<total&&source&&source[count])count++;return count}
export function isCampaignFinalQuest(index){return Number(index)===campaignQuestCount()-1}
export function isCampaignComplete(source){return sequentialCount(source||{})>=campaignQuestCount()}

export function constellationGridRange(index){let start=0;for(let j=0;j<index;j++)start+=CONSTELLATION_GRID_COUNTS[j];return {start,end:start+CONSTELLATION_GRID_COUNTS[index]-1,count:CONSTELLATION_GRID_COUNTS[index]}}

export function chapterForGrid(i){let start=0;for(let j=0;j<CONSTELLATION_GRID_COUNTS.length;j++){let end=start+CONSTELLATION_GRID_COUNTS[j];if(i<end)return j;start=end}return CONSTELLATIONS.length-1}

export function milestoneFor(i){const ci=chapterForGrid(i),r=constellationGridRange(ci),pos=i-r.start,mid=Math.floor((r.count-1)/2);if(i===r.end)return {kind:"boss",title:"✹ Défi final · "+CONSTELLATIONS[ci].name.replace(" · Grand Chariot",""),bonus:2,copy:"Dernière quête de la constellation · +2 ★ et constellation complétée."};if(pos===mid)return {kind:"mid",title:"✦ Défi de constellation",bonus:1,copy:"Étape intermédiaire · +1 ★ pour ton ciel."};return null}

export function skyStarsForGrid(i){
 const ci=chapterForGrid(i),r=constellationGridRange(ci),target=CONSTELLATIONS[ci].count,extra=target-r.count,pos=i-r.start;
 const legacyAward=p=>{if(p===r.count-1)return 1+Math.min(2,extra);const remaining=Math.max(0,extra-2),mid=Math.floor((r.count-1)/2);if(p===mid)return 1+Math.min(1,remaining);return p<Math.max(0,remaining-1)?2:1};
 // Preserve historical rewards and distribute any remaining stars of short
 // extension constellations across their quests, including the final quest.
 const allocated=Array.from({length:r.count},(_,p)=>legacyAward(p)).reduce((sum,value)=>sum+value,0),remaining=Math.max(0,target-allocated);
 return legacyAward(pos)+Math.floor(remaining/r.count)+(pos<remaining%r.count?1:0);
}

export function bonusChallengeFor(i){if((i+1)%6!==0)return null;let num=(i+1)/6,type=((num-1)%3)+1,seconds=type===1?55+Math.floor((num-1)/4)*10:null,noAuto=type===1;return {id:"sky2-"+num,num,type,noAuto,title:type===1?"⚡ Défi Éclair":type===2?"🧠 Défi Esprit clair":"✦ Défi céleste",seconds,copy:type===1?"Accomplis cette quête en moins de "+seconds+" s. · Marquage auto interdite.":type===2?"Accomplis cette quête sans indice.":"Accomplis cette quête et gagne le bonus céleste."}}

export function challengeFor(i){return milestoneFor(i)||bonusChallengeFor(i)}

export function constellationCheckpoint(beforeEarned,afterEarned){
 let base=0;
 for(let i=0;i<CONSTELLATIONS.length;i++){
  const count=CONSTELLATIONS[i].count,start=base,end=base+count;
  if(afterEarned>start&&afterEarned<end){
   const before=Math.max(0,beforeEarned-start),after=Math.max(0,afterEarned-start);
   const checkpoints=[Math.ceil(count/3),Math.ceil(count*2/3)];
   const hit=checkpoints.find(x=>before<x&&after>=x);
   if(hit)return {index:i,lit:after,count,stage:hit===checkpoints[0]?1:2};
  }
  base=end;
 }
 return null;
}

export function constellationStateForEarned(earned){let total=0;for(let i=0;i<CONSTELLATIONS.length;i++){const c=CONSTELLATIONS[i];if(earned<=total+c.count)return {index:i,...c,lit:Math.max(0,Math.min(c.count,earned-total)),complete:earned===total+c.count};total+=c.count}const c=CONSTELLATIONS[CONSTELLATIONS.length-1];return {index:CONSTELLATIONS.length-1,...c,lit:c.count,complete:true}}

export function starsAwardedForGrid(i,firstCompletion,questPassed){if(!firstCompletion)return 0;return skyStarsForGrid(i)}

export function createCampaign(getProgress,saveLumenProgress,getAttempt){
function normalizeSequentialProgress(){
 const lumenProgress=getProgress();
 if(!lumenProgress.historyBackup&&lumenProgress.solved)lumenProgress.historyBackup={...lumenProgress.solved};
 return sequentialCount(lumenProgress.solved||{});
}

function solvedCount(){
 const lumenProgress=getProgress();return Object.keys(lumenProgress.solved||{}).filter(k=>lumenProgress.solved[k]).length}

function exactSkyScoreForSolvedPrefix(){
 const lumenProgress=getProgress();let total=0;for(let i=0;i<campaignQuestCount()&&lumenProgress.solved&&lumenProgress.solved[i];i++)total+=skyStarsForGrid(i);return Math.min(SKY_TARGET,total)}

function ensureSkyScore(){
 const lumenProgress=getProgress(),exact=exactSkyScoreForSolvedPrefix(),stored=Number.isFinite(lumenProgress.skyScore)?lumenProgress.skyScore:0;
 const score=lumenProgress.skyHistoryVersion===4?Math.min(SKY_TARGET,Math.max(stored,exact)):exact;
 if(lumenProgress.skyHistoryVersion===4&&lumenProgress.skyScore===score)return;
 lumenProgress.skyScore=score;lumenProgress.skyHistoryVersion=4;saveLumenProgress()}

function skyStarsEarned(){
 const lumenProgress=getProgress();ensureSkyScore();return Math.max(0,Math.min(SKY_TARGET,lumenProgress.skyScore||0))}

function challengeRewardKeys(){
 const lumenProgress=getProgress();return Object.keys(lumenProgress.stars||{}).filter(k=>k.startsWith("sky2-"))}

function constellationProgress(){
 const lumenProgress=getProgress();let earned=skyStarsEarned(),total=0;for(let i=0;i<CONSTELLATIONS.length;i++){let c=CONSTELLATIONS[i];if(earned<total+c.count)return {index:i,...c,lit:Math.max(0,earned-total)};total+=c.count}let c=CONSTELLATIONS[CONSTELLATIONS.length-1];return {index:CONSTELLATIONS.length-1,...c,lit:c.count}}

function constellationLitAt(index){
 const lumenProgress=getProgress();let earned=skyStarsEarned(),before=0;for(let i=0;i<index;i++)before+=CONSTELLATIONS[i].count;return Math.max(0,Math.min(CONSTELLATIONS[index].count,earned-before))}

function awards(){
 const lumenProgress=getProgress();let t=Object.keys(lumenProgress.solved).length;if(t>=1)lumenProgress.badges.first=1;if(t>=20)lumenProgress.badges.explorer=1;if(t>=50)lumenProgress.badges.beacon=1;if(t>=campaignQuestCount())lumenProgress.badges.master=1;if(challengeRewardKeys().length>=1)lumenProgress.badges.challenge1=1;if(challengeRewardKeys().length>=16)lumenProgress.badges.challengeAll=1;saveLumenProgress()}

function performanceRun(i){
 const attempt=getAttempt(),seconds=attempt.activeGameSeconds(),run=performanceAttempt({questIndex:i,seconds,assistanceUsed:!!attempt.assistanceUsed,mistakeCommitted:!!attempt.mistakeCommitted});
 return {...run,qualifying:!!attempt.qualifying};
}

function savePerformance(i,stars){
 const attempt=getAttempt(),seconds=attempt.activeGameSeconds(),run=performanceRun(i),day=localCalendarDay(),old=getProgress().performances[i]||{};
 const eligible=performanceEligibility(i),qualifying=!!attempt.qualifying,priorBadges=old.version>=2?old.badges:{};
 const badges=qualifying?mergeEarnedBadges(priorBadges,run,eligible):mergeEarnedBadges(priorBadges,{},{});
 const bestTime=!Number.isFinite(old.bestTime)||seconds<old.bestTime?seconds:old.bestTime;
 getProgress().performances[i]={...old,version:3,questIndex:i,badges,bestTime,time:bestTime,stars:Math.max(old.stars||0,stars),quest:!!bonusChallengeFor(i),milestone:milestoneFor(i)?.kind||null,attempts:(old.attempts||0)+1,lastQualifiedDay:qualifying?day:old.lastQualifiedDay||null};
 return {run,qualifying,badges};
}

return {normalizeSequentialProgress,solvedCount,exactSkyScoreForSolvedPrefix,ensureSkyScore,skyStarsEarned,challengeRewardKeys,constellationProgress,constellationLitAt,awards,performanceRun,savePerformance};
}
