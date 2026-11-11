import {rankedTime} from './ranking.js';

// Elapsed seconds remain technical facts (badges, rewards, old receipts).
// Never add a penalty to an elapsed counter or to an already official record.
export function attemptTiming(attempt={}){
 return {version:1,gridRevision:attempt.gridRevision??0,helpUses:Object.fromEntries(['hint','verify','guided'].map(k=>[k,attempt.helpUses?.[k]??0]))};
}
export function officialResult(facts={}){return rankedTime(facts.seconds,facts.timing?.helpUses)}
export function mergeOfficialTimes(...maps){
 const result={};
 for(const map of maps)for(const [revision,time] of Object.entries(map??{})){
  if(!/^(0|[1-9][0-9]*)$/.test(revision)||!Number.isSafeInteger(Number(revision))||!Number.isSafeInteger(time)||time<0)throw Error('Invalid official record');
  result[revision]=Math.min(result[revision]??Infinity,time);
 }
 return result;
}
export function officialRecordTime(record={},revision=0){return record?.officialTimes?.[revision]}
export function verifyOfficialProjection(record,facts){
 if(!facts?.timing)return;
 const best=officialRecordTime(record,facts.timing.gridRevision),score=officialResult(facts).score;
 if(!Number.isSafeInteger(best)||best<0||best>score)throw Error('Official time projection unconfirmed');
}
export function completedOfficialRecords(previous={},facts={}){
 if(!facts.timing)return {};
 const {version,gridRevision}=facts.timing;
 if(version!==1||!Number.isSafeInteger(gridRevision)||gridRevision<0)throw Error('Invalid official timing version');
 // Isolated guest/QA projection: original-grid historical times use zero aids.
 // Authenticated projections use the server's audited competitive baseline.
 const historical=!previous.officialTimes&&gridRevision===0&&Number.isSafeInteger(previous.bestTime)&&previous.bestTime>=0?{0:previous.bestTime}:{};
 return {officialTimes:mergeOfficialTimes(historical,previous.officialTimes,{[gridRevision]:officialResult(facts).score})};
}
