import {campaignQuestCount,skyStarsForGrid,bonusChallengeFor} from './progression.js';
import {generatedQuestReward} from './generated-rewards.js';
import {QUEST_MILESTONES} from './quest-rules.js';

// Frozen numeric reward assignments are compatibility data. Consumers use
// explicit properties; storage keys never choose an assistance or badge rule.
export function questRewardDefinition(quest,{total}={}){
 if(quest.rewards)return quest.rewards;
 const numeric=quest.legacyIndex!==null;
 const index=numeric?quest.legacyIndex:quest.ordinal-1;
 let bonus=numeric?(index<campaignQuestCount()?bonusChallengeFor(index):null):bonusChallengeFor(index);
 // The unlock lesson must offer the real comfort choice it just introduced.
 // Its timed bonus keeps the same condition/award; auto marking still counts
 // as assistance for performance badges. Other explicit bonus restrictions stay.
 if(bonus?.noAuto&&quest.ordinal===QUEST_MILESTONES.fullBadges)bonus={...bonus,noAuto:false,copy:`Accomplis cette quête en moins de ${bonus.seconds} s.`};
 const positionedStars=total&&quest.position?(quest.position===total?3:quest.position===Math.ceil(total/2)?2:1):1;
 return Object.freeze({stars:numeric?(index<campaignQuestCount()?skyStarsForGrid(index):generatedQuestReward(index).stars):positionedStars,
  bonus:bonus?Object.freeze({...bonus,id:numeric?bonus.id:'quest-bonus:'+quest.id}):null});
}
