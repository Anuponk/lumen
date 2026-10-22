import {performanceEligibility,badgeCooldownRemaining,PERFORMANCE_UNLOCKS} from './performance.js';

// Explicit teaching milestones, independent of catalogue size/storage keys.
export const QUEST_MILESTONES=Object.freeze({discovery:6,speed:PERFORMANCE_UNLOCKS.speed,fullBadges:PERFORMANCE_UNLOCKS.full,autonomy:11,freeHintsThrough:10,skyTourAfter:2});
export function questLearningRules(ordinal){
 if(!Number.isSafeInteger(ordinal)||ordinal<1)throw Error('Invalid visible quest ordinal');
 return Object.freeze({scripted:ordinal<=QUEST_MILESTONES.skyTourAfter,forcedGuided:ordinal<QUEST_MILESTONES.fullBadges,
  optionalGuided:ordinal<QUEST_MILESTONES.autonomy,autoMarking:ordinal>=QUEST_MILESTONES.fullBadges,
  freeHints:ordinal<=QUEST_MILESTONES.freeHintsThrough,discovery:ordinal<=QUEST_MILESTONES.discovery});
}
// Compatibility only: saved keys never become gameplay ordinals.
export function questPerformanceRecord(quest,progress={}){
 const state=progress.canonicalQuestState?.[quest.id];
 return quest.legacyIndex===null?state?.runPerformance??state?.performance??{}:progress.performances?.[quest.legacyIndex]??{};
}
export function questBadgeQualification(quest,progress,unlockedCount=quest.ordinal,now=Date.now()){
 const eligibility=performanceEligibility(quest.ordinal-1,unlockedCount);
 return Object.values(eligibility).some(Boolean)&&badgeCooldownRemaining(questPerformanceRecord(quest,progress),now)===0;
}
