// Private support copies are a typed projection, never a raw recovery export.
// Unknown/free-text fields and unowned originals stay on the device.
import {canonicalQuestList} from '../campaign/canonical-quests.js';
import {DIAGNOSTIC_CODES} from './diagnostic-reporter.js';
export const SUPPORT_MAX_BYTES=524288;
const metrics=['solved','stars','noHint','autonomy','speed','noError','mastery','bestTime','time','attempts','version','shards','xp','skyScore','walletRevision','legacyVictoryRevision','pendingCanonical','pendingLegacy','pendingWallet'];
export function projectSupportProfile(profile,quests=canonicalQuestList()){
 const facts=[];
 const add=(quest,metric,value)=>{if(typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e12)facts.push({quest,metric,value})};
 for(const metric of ['shards','xp','skyScore','walletRevision','legacyVictoryRevision'])add(0,metric,profile?.[metric]);
 for(const q of quests){
  const keys=q.legacyIndex===null||q.legacyIndex===undefined?[]:[String(q.legacyIndex)];
  const states=keys.map(k=>{
   const p=profile?.performances?.[k];
   return {solved:profile?.solved?.[k],stars:profile?.stars?.[k],noHint:profile?.noHint?.[k],bestTime:p?.bestTime,time:p?.time,attempts:p?.attempts,version:p?.version,badges:p?.badges};
  });
  const canonical=profile?.canonicalQuestState?.[q.id];if(canonical)states.push(canonical);
  for(const state of states){
   for(const metric of metrics)add(q.ordinal,metric,state?.[metric]);
   for(const metric of ['bestTime','time','attempts'])add(q.ordinal,metric,state?.performance?.[metric]);
   for(const metric of ['autonomy','speed','noError','mastery'])add(q.ordinal,metric,state?.badges?.[metric]);
  }
 }
 return facts;
}
export function validateSupportCapture(payload){
 if(!payload||Object.keys(payload).sort().join(',')!=='code,copies,events,format,version'||payload.format!==1||
  !['manual',...DIAGNOSTIC_CODES].includes(payload.code)||!/^unknown$|^\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}$/.test(payload.version)||
  !Array.isArray(payload.events)||payload.events.length>20||payload.events.some(code=>!DIAGNOSTIC_CODES.includes(code))||
  !Array.isArray(payload.copies)||payload.copies.length<1||payload.copies.length>3)throw Error('SUPPORT_SCHEMA');
 for(const c of payload.copies){
  if(!c||Object.keys(c).sort().join(',')!=='facts,source'||!['local','checkpoint'].includes(c.source)||!Array.isArray(c.facts)||c.facts.length>6000)throw Error('SUPPORT_SCHEMA');
  for(const f of c.facts)if(!f||Object.keys(f).sort().join(',')!=='metric,quest,value'||!metrics.includes(f.metric)||
   !Number.isSafeInteger(f.quest)||f.quest<0||f.quest>1e7||!(typeof f.value==='boolean'||typeof f.value==='number'&&Number.isFinite(f.value)&&Math.abs(f.value)<=1e12))throw Error('SUPPORT_SCHEMA');
 }
 if(new TextEncoder().encode(JSON.stringify(payload)).length>SUPPORT_MAX_BYTES)throw Error('SUPPORT_SIZE');
 return payload;
}
export function captureSupportCopy({storage,owner,code='manual',version='unknown',quests}){
 if(!owner||storage.getItem('lumenCloudOwnerId')!==owner)throw Error('SUPPORT_OWNER');
 const raw=storage.getItem('lumenProgressV1'),profile=JSON.parse(raw||'null');
 if(!profile||typeof profile!=='object'||Array.isArray(profile)||!profile.solved||typeof profile.solved!=='object'||Array.isArray(profile.solved))throw Error('SUPPORT_PROFILE');
 const copies=[{source:'local',facts:projectSupportProfile(profile,quests)}];
 // V2 checkpoints have explicit ownership. Old unscoped archives are excluded.
 const prefix='lumenUnsyncedCloudBackupV2:'+owner+':';
 const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix)&&!key.endsWith(':latest'))keys.push(key)}
 for(const key of keys.sort().reverse().slice(0,2)){
  try{const data=JSON.parse(storage.getItem(key));if(data?.progress)copies.push({source:'checkpoint',facts:projectSupportProfile(data.progress,quests)})}catch{}
 }
 if(storage.getItem('lumenCloudOwnerId')!==owner||storage.getItem('lumenProgressV1')!==raw)throw Error('SUPPORT_OWNER');
 return validateSupportCapture({format:1,code,events:[],version:String(version).match(/\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}/)?.[0]||'unknown',copies});
}
