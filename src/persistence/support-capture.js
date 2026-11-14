// Private support copies are a typed projection, never a raw recovery export.
// Unknown/free-text fields and unowned originals stay on the device.
import {canonicalQuestList} from '../campaign/canonical-quests.js';
import {DIAGNOSTIC_CODES} from './diagnostic-reporter.js';
export const SUPPORT_MAX_BYTES=524288;
const captureHeadroom=2048; // up to 20 fixed incident codes and three queue counts
const factLimit=6000,reservedQueueFacts=3;
// PostgreSQL validates octet_length(jsonb::text), not compact request JSON.
// Its separators contain spaces and numeric exponents expand to decimal.
function supportStoredBytes(payload){
 const encoder=new TextEncoder(),strings=new Map();
 function bytes(value){
  if(value===null)return 4;
  if(typeof value==='string'){
   if(!strings.has(value))strings.set(value,encoder.encode(JSON.stringify(value)).length);
   return strings.get(value);
  }
  if(typeof value==='boolean')return value?4:5;
  if(typeof value==='number'){
   const text=JSON.stringify(value),[mantissa,exponent]=text.split('e');
   if(exponent===undefined)return text.length;
   const negative=mantissa.startsWith('-'),unsigned=negative?mantissa.slice(1):mantissa;
   const digits=unsigned.replace('.',''),point=(unsigned.includes('.')?unsigned.indexOf('.'):unsigned.length)+Number(exponent);
   return Number(negative)+(point<=0?2-point+digits.length:point>=digits.length?point:digits.length+1);
  }
  if(Array.isArray(value))return 2+value.reduce((sum,item)=>sum+bytes(item),0)+Math.max(0,value.length-1)*2;
  const entries=Object.entries(value);
  return 2+entries.reduce((sum,[key,item])=>sum+bytes(key)+2+bytes(item),0)+Math.max(0,entries.length-1)*2;
 }
 return bytes(payload);
}
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
  if(!c||Object.keys(c).sort().join(',')!=='facts,source'||!['local','checkpoint'].includes(c.source)||!Array.isArray(c.facts)||c.facts.length>factLimit)throw Error('SUPPORT_SCHEMA');
  for(const f of c.facts)if(!f||Object.keys(f).sort().join(',')!=='metric,quest,value'||!metrics.includes(f.metric)||
   !Number.isSafeInteger(f.quest)||f.quest<0||f.quest>1e7||!(typeof f.value==='boolean'||typeof f.value==='number'&&Number.isFinite(f.value)&&Math.abs(f.value)<=1e12))throw Error('SUPPORT_SCHEMA');
 }
 if(supportStoredBytes(payload)>SUPPORT_MAX_BYTES)throw Error('SUPPORT_SIZE');
 return payload;
}
export function captureSupportCopy({storage,owner,code='manual',version='unknown',quests}){
 if(!owner||storage.getItem('lumenCloudOwnerId')!==owner)throw Error('SUPPORT_OWNER');
 const raw=storage.getItem('lumenProgressV1'),profile=JSON.parse(raw||'null');
 if(!profile||typeof profile!=='object'||Array.isArray(profile)||!profile.solved||typeof profile.solved!=='object'||Array.isArray(profile.solved))throw Error('SUPPORT_PROFILE');
 const facts=projectSupportProfile(profile,quests),copies=[];
 // A complete growing catalogue may exceed the per-copy fact cap. Preserve
 // every current fact across bounded local chunks in the existing protocol.
 for(let i=0;i<facts.length;){const limit=copies.length===0?factLimit-reservedQueueFacts:factLimit;copies.push({source:'local',facts:facts.slice(i,i+limit)});i+=limit}
 if(!copies.length)copies.push({source:'local',facts:[]});
 const payload={format:1,code,events:[],version:String(version).match(/\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}/)?.[0]||'unknown',copies};
 validateSupportCapture(payload);
 if(supportStoredBytes(payload)>SUPPORT_MAX_BYTES-captureHeadroom)throw Error('SUPPORT_SIZE');
 // V2 checkpoints have explicit ownership. Old unscoped archives are excluded.
 const prefix='lumenUnsyncedCloudBackupV2:'+owner+':';
 const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix)&&!key.endsWith(':latest'))keys.push(key)}
 for(const key of keys.sort().reverse().slice(0,2)){
  if(copies.length>=3)break;
  try{
   const data=JSON.parse(storage.getItem(key));if(!data?.progress)continue;
   const candidate={...payload,copies:[...copies,{source:'checkpoint',facts:projectSupportProfile(data.progress,quests)}]};
   validateSupportCapture(candidate);
   if(supportStoredBytes(candidate)<=SUPPORT_MAX_BYTES-captureHeadroom)copies.push(candidate.copies.at(-1));
  }catch{} // Optional copies stay untouched on the device when they do not fit.
 }
 if(storage.getItem('lumenCloudOwnerId')!==owner||storage.getItem('lumenProgressV1')!==raw)throw Error('SUPPORT_OWNER');
 return validateSupportCapture(payload);
}
