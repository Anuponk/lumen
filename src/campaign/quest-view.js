import {questCompleted} from './catalogue-access.js';

// Ephemeral read projection over the existing save formats; never a new store.
export function readQuestView(quest,progress,quests,constellations){
 if(!quest)throw Error('Missing active quest');
 const members=quests.filter(q=>q.constellationId===quest.constellationId);
 const position=members.findIndex(q=>q.id===quest.id)+1;
 const constellationIndex=constellations.findIndex(c=>c.id===quest.constellationId);
 const constellation=constellations[constellationIndex];
 if(!position||!constellation)throw Error('Missing quest membership: '+quest.id);
 const numeric=quest.legacyIndex!==null;
 const record=numeric?progress.performances?.[quest.legacyIndex]:progress.canonicalQuestState?.[quest.id];
 const badges=numeric&&!(record?.version>=2)?{}:record?.badges??{};
 const attemptNumber=numeric?(Number(record?.attempts)||0)+1:null;
 return Object.freeze({id:quest.id,ordinal:quest.ordinal,legacyIndex:quest.legacyIndex,
  constellationId:quest.constellationId,packId:quest.packId,constellationIndex,
  constellationName:constellation.label,position,total:members.length,
  label:`Quête ${quest.ordinal} - ${constellation.label} (${position}/${members.length})`,
  solved:questCompleted(quest,progress),badges:Object.freeze({...badges}),attemptNumber});
}
