// Times come from completed runs. Never infer an unassisted run from badges.
export function validRecordTime(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER}
export function recordMinimum(...values){const times=values.filter(validRecordTime);return times.length?Math.min(...times):undefined}
export function completedRunRecords(previous={},facts={}){
 const bestTime=recordMinimum(previous.bestTime,facts.seconds);
 const bestUnassistedTime=recordMinimum(previous.bestUnassistedTime,
  !facts.assistanceUsed&&!facts.hintUsed?facts.seconds:undefined);
 return {...(bestTime===undefined?{}:{bestTime,time:bestTime}),...(bestUnassistedTime===undefined?{}:{bestUnassistedTime})};
}
export function personalRecordComparison(previous={},confirmed={},facts={}){
 const seconds=facts.seconds;
 if(!validRecordTime(seconds))return {absolute:false,unassisted:false};
 const improved=key=>confirmed[key]===seconds&&(!validRecordTime(previous[key])||seconds<previous[key]);
 return {absolute:improved('bestTime'),unassisted:!facts.assistanceUsed&&!facts.hintUsed&&improved('bestUnassistedTime')};
}
