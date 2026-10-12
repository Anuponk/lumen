export const PERFORMANCE_BADGES=Object.freeze(["autonomy","speed","noError","mastery"]);

export function performanceEligibility(questIndex,unlockedQuestCount=Number(questIndex)+1){
 const q=Number(questIndex)+1,unlocked=Math.max(0,Number(unlockedQuestCount)||0);
 // Eligibility follows the player's global progression. Early tutorial quests become
 // normal performance quests once the corresponding badge family has been unlocked.
 const speedUnlocked=unlocked>=3,fullUnlocked=unlocked>=6;
 return {
  autonomy:q>=6||fullUnlocked,
  speed:q>=3||speedUnlocked,
  noError:q>=6||fullUnlocked,
  mastery:q>=6||fullUnlocked
 };
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
 // Old daily marker has no reliable timestamp: preserve safety until the next local day.
 return performance?.lastQualifiedDay===localCalendarDay(new Date(now))?BADGE_COOLDOWN_MS:0;
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
