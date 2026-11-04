import {questCompleted} from '../campaign/catalogue-access.js';
import {PERFORMANCE_BADGES,performanceEligibility} from '../campaign/performance.js';

// Read-only display projection. Historical awards stay earned; only current
// catalogue membership/eligibility contributes to the current denominator.
export function celestialScope(progress,quests){
 const badges=Object.fromEntries(PERFORMANCE_BADGES.map(key=>[key,0]));
 let possible=0,earned=0,completed=0;
 for(const q of quests){
  if(questCompleted(q,progress))completed++;
  const record=q.legacyIndex!==null?progress.performances?.[q.legacyIndex]:progress.canonicalQuestState?.[q.id];
  const held=q.legacyIndex!==null&&!(record?.version>=2)?{}:record?.badges??{};
  const eligible=performanceEligibility(q.ordinal-1);
  for(const key of PERFORMANCE_BADGES){
   if(held[key])badges[key]++;
   if(eligible[key]){possible++;if(held[key])earned++}
  }
 }
 return {total:quests.length,completed,complete:quests.length>0&&completed===quests.length,
  stars:completed,badges,earned,possible,ratio:possible?earned/possible:0,
  signature:quests.map(q=>q.id+':'+PERFORMANCE_BADGES.filter(k=>performanceEligibility(q.ordinal-1)[k]).join(',')).sort().join('|')};
}
export function captureCelestialProgress(progress,quest,quests){
 if(!quest)return null;
 return {questId:quest.id,solved:questCompleted(quest,progress),
  questState:celestialScope(progress,[quest]),
  constellation:celestialScope(progress,quests.filter(q=>q.constellationId===quest.constellationId)),
  adventure:celestialScope(progress,quests.filter(q=>q.packId===quest.packId)),
  campaign:celestialScope(progress,quests)};
}
export function celestialTransition(before,progress,quest,quests,{firstCompletion=false,recovered=false}={}){
 const after=captureCelestialProgress(progress,quest,quests);
 if(recovered||!before||!after||before.questId!==quest.id)return {kind:null,pulse:null,after};
 const sameScope=key=>before[key].signature===after[key].signature;
 const crossing=key=>sameScope(key)&&before[key].completed===before[key].total-1&&after[key].complete;
 const kind=firstCompletion&&!before.solved&&after.solved
  ?crossing('campaign')?'campaign':crossing('adventure')?'adventure':crossing('constellation')?'constellation':null:null;
 const a=after.constellation,b=before.constellation;
 const gained=after.questState.earned-before.questState.earned;
 const pulse=sameScope('constellation')&&gained>0&&a.earned-b.earned===gained&&a.ratio>b.ratio
  ?{constellationId:quest.constellationId,signature:a.signature,ratio:a.ratio,full:b.ratio<1&&a.ratio===1}:null;
 return {kind,pulse,after};
}
