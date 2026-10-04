export const PERFORMANCE_BADGES=Object.freeze(["autonomy","speed","noError","mastery"]);

export function performanceEligibility(questIndex){
 const q=Number(questIndex)+1;
 if(q<=2)return {autonomy:false,speed:false,noError:false,mastery:false};
 if(q<=5)return {autonomy:false,speed:true,noError:false,mastery:false};
 return {autonomy:true,speed:true,noError:true,mastery:true};
}

export function speedTargetSeconds(questIndex){
 const q=Number(questIndex)+1;
 if(q<=20)return 90;
 if(q<=40)return 120;
 if(q<=60)return 150;
 if(q<=80)return 180;
 return 210;
}

export function localCalendarDay(now=new Date()){
 const d=now instanceof Date?now:new Date(now);
 return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}

export function performanceAttempt({questIndex,seconds,assistanceUsed=false,mistakeCommitted=false}){
 const eligibility=performanceEligibility(questIndex),speed=eligibility.speed&&seconds<speedTargetSeconds(questIndex);
 const autonomy=eligibility.autonomy&&!assistanceUsed;
 const noError=eligibility.noError&&!assistanceUsed&&!mistakeCommitted;
 return {eligibility,autonomy,speed,noError,mastery:eligibility.mastery&&autonomy&&speed&&noError,targetSeconds:speedTargetSeconds(questIndex)};
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
