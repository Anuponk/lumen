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

export const PERFORMANCE_QUALIFICATION_COOLDOWN_MS=15*60*1000;

// Pure, testable duration calculation. Do not switch production awarding to this
// rule until an authoritative server-side per-user, per-quest claim is available.
// Legacy saves with a day-only marker keep the previous same-day lock; badges
// cannot be manufactured from historical attempts or clock migration.
export function performanceCooldownRemainingMs(performance={},now=Date.now()){
 const current=now instanceof Date?now.getTime():Number(now);
 if(!Number.isFinite(current))return PERFORMANCE_QUALIFICATION_COOLDOWN_MS;
 const stamp=Date.parse(String(performance?.lastQualifiedAt||""));
 if(Number.isFinite(stamp))return Math.min(PERFORMANCE_QUALIFICATION_COOLDOWN_MS,Math.max(0,PERFORMANCE_QUALIFICATION_COOLDOWN_MS-(current-stamp)));
 const oldDay=performance?.lastQualifiedDay;
 if(oldDay===localCalendarDay(new Date(current)))return PERFORMANCE_QUALIFICATION_COOLDOWN_MS;
 return 0;
}

export function performanceCooldownMessage(remainingMs){
 if(!(remainingMs>0))return "";
 const minutes=Math.ceil(remainingMs/60000);
 return minutes===15?"Tu pourras retenter de gagner des badges dans 15 minutes.":`Réessaie dans ${minutes} min`;
}

export function isQualifyingDay(performance,day=localCalendarDay()){
 return !!Object.values(performanceEligibility(performance?.questIndex??0)).some(Boolean)&&performance?.lastQualifiedDay!==day;
}

export function mergeEarnedBadges(prior={},run={},eligibility={}){
 return {
  autonomy:!!prior.autonomy||!!eligibility.autonomy&&!!run.autonomy,
  speed:!!prior.speed||!!eligibility.speed&&!!run.speed,
  noError:!!prior.noError||!!eligibility.noError&&!!run.noError,
  mastery:!!prior.mastery||!!eligibility.mastery&&!!run.mastery
 };
}
