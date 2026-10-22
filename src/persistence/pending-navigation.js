// An ephemeral navigation view, never a save payload or reward projection.
// It permits the next known quest after a durably captured offline win while
// the normal availability policy still checks Adventure rights and catalogue.
export function pendingNavigationProfile(profile,entries,userId,quests){
 const byId=new Map(quests.map(q=>[q.id,q]));
 const solved={...profile.solved},canonicalQuestState={...profile.canonicalQuestState};
 for(const entry of entries){
  if(entry.userId!==userId)continue;
  const quest=byId.get(entry.questId);if(!quest)continue;
  if(quest.legacyIndex!==null)solved[quest.legacyIndex]=1;
  else canonicalQuestState[quest.id]={...canonicalQuestState[quest.id],solved:true,pending:true};
 }
 return {...profile,solved,canonicalQuestState};
}
