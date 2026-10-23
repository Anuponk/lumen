import {applyLegacyVictory} from './legacy-victory.js';
import {performanceAttempt,mergeEarnedBadges} from './performance.js';
import {questPerformanceRecord} from './quest-rules.js';
import {questRewardDefinition} from './quest-rewards.js';
import {qualifiesDailyActivity,grantAutonomyMilestone} from './daily-engagement.js';

// Pure projection for isolated fixtures/guest play. Authenticated grants must
// be confirmed by the transaction adapter; no caller may install this optimistically.
export function applyQuestVictory(progress,quest,facts){
 if(quest.legacyIndex!==null)return applyLegacyVictory(progress,quest.legacyIndex,facts);
 const definition=questRewardDefinition(quest),state=progress.canonicalQuestState??{},old=state[quest.id]??{};
 const firstCompletion=!old.solved,priorPerformance=structuredClone(questPerformanceRecord(quest,progress));
 const priorBadges={...old.badges},qualifying=!!facts.qualifying;
 const run={...performanceAttempt({questIndex:quest.ordinal-1,seconds:facts.seconds,
  assistanceUsed:!!facts.assistanceUsed,mistakeCommitted:!!facts.mistakeCommitted}),qualifying};
 const badges=qualifying?mergeEarnedBadges(priorBadges,run,run.eligibility):mergeEarnedBadges(priorBadges,{},{});
 const stars=firstCompletion?definition.stars:0,bestTime=Number.isFinite(priorPerformance.bestTime)?Math.min(priorPerformance.bestTime,facts.seconds):facts.seconds;
 const performance={...priorPerformance,version:3,badges,bestTime,time:bestTime,stars:Math.max(priorPerformance.stars||0,stars),
  attempts:(priorPerformance.attempts||0)+1,lastQualifiedDay:qualifying?facts.qualifiedDay:priorPerformance.lastQualifiedDay??null,
  lastQualifiedAt:qualifying?facts.qualifiedAt:priorPerformance.lastQualifiedAt??null};
 progress.canonicalQuestState={...state,[quest.id]:{...old,solved:true,badges,
  ...(firstCompletion?{stars,performance:{bestTime:facts.seconds,seconds:facts.seconds,assisted:!!facts.assistanceUsed}}:{}),runPerformance:performance}};
 if(firstCompletion)progress.xp=(progress.xp||0)+10+(facts.hintUsed?0:5);
 progress.stars??={};progress.challenges??={};
 const bonus=definition.bonus;
 let questPassed=false;
 if(bonus&&!progress.stars[bonus.id]){
  questPassed=!facts.challengeFailed&&(bonus.seconds!==null?facts.seconds<=bonus.seconds:bonus.type===2?!facts.hintUsed:true);
  if(questPassed){progress.stars[bonus.id]=1;progress.challenges[bonus.id]=1;progress.xp=(progress.xp||0)+25;progress.shards=(progress.shards||0)+1}
 }
 const autonomyShard=grantAutonomyMilestone(progress,{firstCompletion,autonomy:run.autonomy});
 return {firstCompletion,questPassed,stars,priorPerformance,priorBadges,savedPerformance:{run,qualifying,badges},autonomyShard,
  dailyQualified:qualifiesDailyActivity({firstCompletion,performanceQualifying:qualifying,priorBadges,earnedBadges:badges}),attempts:performance.attempts};
}
