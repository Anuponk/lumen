// Board selection is separate from completion/rewards and verified cloud writes.
export function preserveAttemptSnapshot(storage,storageKey,{now=Date.now}={}){
 const raw=storage.getItem(storageKey);if(raw===null)return null;
 const key='lumenBeforeAccountSwitchAttempt_'+now();
 const previous=storage.getItem(key);
 if(previous!==null&&previous!==raw)throw Error('Attempt backup collision');
 storage.setItem(key,raw);
 if(storage.getItem(key)!==raw)throw Error('Attempt backup verification failed');
 return key;
}
export function canonicalAttemptToResume(attempt,quests,{ownerId,accountId,qa=false,social=false}={}){
 if(!ownerId||(accountId&&ownerId!==accountId)||qa||social||!attempt?.attemptId||!['campaign','replay'].includes(attempt.mode)||!['READY','RUNNING','PAUSED'].includes(attempt.state))return null;
 const quest=quests.find(q=>q.id===attempt.questId&&q.legacyIndex===null);
 if(!quest||!Array.isArray(attempt.board)||attempt.board.length!==quest.reg.length||!attempt.board.every(row=>Array.isArray(row)&&row.length===quest.reg.length&&row.every(cell=>[0,1,2].includes(cell))))return null;
 return quest;
}
export function nextCanonicalAtLegacyBoundary(quests,progress,{atBoundary=false,afterOrdinal=0,attempt,available=()=>false}={}){
 if(!atBoundary||['RUNNING','PAUSED'].includes(attempt?.state))return null;
 const next=quests.find(q=>q.ordinal>afterOrdinal&&(q.legacyIndex===null?!progress.canonicalQuestState?.[q.id]?.solved:!progress.solved?.[q.legacyIndex]));
 return next?.legacyIndex===null&&available(next)?next:null;
}
