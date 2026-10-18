import {canonicalQuestList} from './canonical-quests.js';
import {createCampaign,campaignQuestCount,skyStarsForGrid,bonusChallengeFor,milestoneFor} from './progression.js';
import {generatedQuestReward} from './generated-rewards.js';
import {SKY_TARGET} from './data.js';
import {grantAutonomyMilestone,qualifiesDailyActivity} from './daily-engagement.js';

// Catalogue-derived RPC allowlist and SQL parity fixtures share the actual rules.
export function legacyVictoryRules(){
 return canonicalQuestList().filter(q=>q.legacyIndex!==null).map(q=>{
  const i=q.legacyIndex,campaign=i<campaignQuestCount();
  return {questId:q.id,index:i,campaign,stars:campaign?skyStarsForGrid(i):generatedQuestReward(i).stars,
   challenge:campaign?bonusChallengeFor(i):null,performanceQuest:!!bonusChallengeFor(i),milestone:milestoneFor(i)?.kind||null,
   campaignCount:campaignQuestCount(),skyTarget:SKY_TARGET};
 });
}
// Existing guest/old-server victory semantics; network commands use immutable
// facts and apply these same effects on the locked SERVER profile instead.
export function applyLegacyVictory(progress,index,facts){
 const campaign=createCampaign(()=>progress,()=>{},()=>({activeGameSeconds:()=>facts.seconds,...facts}));
 const generated=index>=campaignQuestCount(),firstCompletion=!progress.solved[index],skyEarnedBefore=campaign.skyStarsEarned();
 const priorPerformance=structuredClone(progress.performances[index]||{}),priorBadges=priorPerformance.version>=2?{...(priorPerformance.badges||{})}:{};
 progress.solved[index]=1;
 if(firstCompletion&&!generated)progress.skyScore=Math.min(SKY_TARGET,skyEarnedBefore+skyStarsForGrid(index));
 if(firstCompletion)progress.xp=(progress.xp||0)+10+(facts.hintUsed?0:5);
 const ch=generated?null:bonusChallengeFor(index);
 let questPassed=false;
 if(ch&&!progress.stars[ch.id]){
  questPassed=!facts.challengeFailed&&(ch.seconds!==null?facts.seconds<=ch.seconds:ch.type===2?!facts.hintUsed:true);
  if(questPassed){progress.stars[ch.id]=1;progress.challenges[ch.id]=1;progress.xp+=25;progress.shards=(progress.shards||0)+1}
 }
 const stars=firstCompletion?(generated?generatedQuestReward(index).stars:skyStarsForGrid(index)):0;
 const savedPerformance=campaign.savePerformance(index,stars,{day:facts.qualifiedDay,at:facts.qualifiedAt});
 const autonomyShard=grantAutonomyMilestone(progress,{firstCompletion,autonomy:!!savedPerformance.run.autonomy});
 const dailyQualified=qualifiesDailyActivity({firstCompletion,performanceQualifying:savedPerformance.qualifying,priorBadges,earnedBadges:savedPerformance.badges});
 if(!facts.hintUsed){progress.noHint=progress.noHint||{};progress.noHint[index]=1}
 return {firstCompletion,questPassed,stars,skyEarnedBefore,priorPerformance,priorBadges,savedPerformance,autonomyShard,dailyQualified,attempts:progress.performances[index].attempts};
}
