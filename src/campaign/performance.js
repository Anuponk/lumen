export const PERFORMANCE_BADGES=Object.freeze(["autonomy","speed","noError","mastery"]);
export const PERFORMANCE_UNLOCKS=Object.freeze({speed:3,full:6});

export function performanceEligibility(questIndex,unlockedQuestCount=Number(questIndex)+1){
 // Badges are performance goals on every quest, never progression unlocks (#529).
 // Keep both arguments for existing callers; assistance and cooldown still apply.
 void questIndex;void unlockedQuestCount;
 return {autonomy:true,speed:true,noError:true,mastery:true};
}

export function speedTargetSeconds(questIndex){
 // Rapidité is intentionally a single, demanding rule across the whole campaign.
 // Keep the parameter for the shared API used by the UI and performance engine.
 void questIndex;
 return 60;
}

export function localCalendarDay(now=new Date()){
 const d=now instanceof Date?now:new Date(now);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}

export function performanceAttempt({questIndex,seconds,assistanceUsed=false,mistakeCommitted=false,unlockedQuestCount=Number(questIndex)+1}){
 const eligibility=performanceEligibility(questIndex,unlockedQuestCount),speed=eligibility.speed&&seconds<speedTargetSeconds(questIndex);
 const autonomy=eligibility.autonomy&&!assistanceUsed;
 const noError=eligibility.noError&&!assistanceUsed&&!mistakeCommitted;
 return {eligibility,autonomy,speed,noError,mastery:eligibility.mastery&&autonomy&&speed&&noError,targetSeconds:speedTargetSeconds(questIndex)};
}

export const BADGE_COOLDOWN_MS=15*60*1000;
export function badgeCooldownRemaining(performance,now=Date.now()){
 const last=Date.parse(performance?.lastQualifiedAt||'');
 if(Number.isFinite(last))return Math.max(0,BADGE_COOLDOWN_MS-(now-last));
 // Legacy day-only records cannot establish a 15-minute window; do not lock them all day.
 return 0;
}
export function badgeCooldownLabel(ms){return ms>0?`Réessaie dans ${Math.ceil(ms/60000)} min`:''}

export function isQualifyingDay(performance,day=localCalendarDay()){
 return !!Object.values(performanceEligibility(performance?.questIndex??0)).some(Boolean)&&badgeCooldownRemaining(performance)===0;
}

export function mergeEarnedBadges(prior={},run={},eligibility={}){
 return {
  autonomy:!!prior.autonomy||!!eligibility.autonomy&&!!run.autonomy,
  speed:!!prior.speed||!!eligibility.speed&&!!run.speed,
  noError:!!prior.noError||!!eligibility.noError&&!!run.noError,
  mastery:!!prior.mastery||!!eligibility.mastery&&!!run.mastery
 };
}
