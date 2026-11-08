// A reset epoch is supplied only by an authenticated, verified server profile.
// It revokes obsolete achievements, never changes balances or other quests.
export function questResetRevision(entry){
 const revision=entry?.resetRevision??0;
 if(!Number.isSafeInteger(revision)||revision<0||(revision>0&&!Number.isFinite(Date.parse(entry.resetAt))))throw Error('Invalid quest reset revision');
 return revision;
}
export function alignQuestResets(local,remote){
 const aligned=structuredClone(local);let changed=false;
 for(const id of new Set([...Object.keys(local.canonicalQuestState||{}),...Object.keys(remote.canonicalQuestState||{})])){
  const current=questResetRevision(local.canonicalQuestState?.[id]),incoming=questResetRevision(remote.canonicalQuestState?.[id]);
  if(current>incoming)throw Error('Cloud quest reset revision is stale');
  if(incoming>current){aligned.canonicalQuestState??={};aligned.canonicalQuestState[id]=structuredClone(remote.canonicalQuestState[id]);changed=true}
 }
 return {profile:aligned,changed};
}
export function installVerifiedQuestResets(storage,remote,{userId,sessionValid=()=>true}={}){
 if(!userId||!sessionValid())throw Error('Quest reset session changed');
 const key='lumenProgressV1',raw=storage.getItem(key);if(raw===null)return false;
 const result=alignQuestResets(JSON.parse(raw),remote);if(!result.changed)return false;
 const archive='lumenQuestResetArchiveV1:'+userId+':'+Date.now();
 const prior=storage.getItem(archive);if(prior!==null&&prior!==raw)throw Error('Quest reset archive conflict');
 storage.setItem(archive,raw);if(storage.getItem(archive)!==raw)throw Error('Quest reset archive unverified');
 if(!sessionValid()||storage.getItem(key)!==raw)throw Error('Quest reset cache changed');
 const next=JSON.stringify(result.profile);storage.setItem(key,next);
 if(storage.getItem(key)!==next)throw Error('Quest reset cache unverified');
 return true;
}
export function obsoleteQuestIntent(entry,profile){
 const state=profile.canonicalQuestState?.[entry.questId],revision=questResetRevision(state);
 const prefix='qr'+revision+'.'+(state?.gridRevision>1?'gv'+state.gridRevision+'.':'');
 return revision>0&&!entry.operationId?.startsWith(prefix);
}
