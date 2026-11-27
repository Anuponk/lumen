// #1030 LUMEN Premium — daily quota engine, independent of rendering.
// Contract: docs/PREMIUM_1030.md. Pure rules + a small per-owner local ledger.
// * Counted once, at the first gesture of an attempt identity (attemptId): a grid
//   reset keeps the identity, a resumed attempt is already started, so neither
//   consumes anything again.
// * Kind: a quest never won is a "new" attempt (also after an abandon); once it was
//   won, any later attempt is a "replay".
// * Imputed to the local day of its start; a run started before midnight stays on
//   its start day.
// * Day key: local calendar day in the current IANA time zone, guarded against a
//   double reset: the key never goes back, and a new key is only reached once the
//   time zone of the latest used day has also reached it.
// * Exempt: Défi du jour and its events, duels, tutorial; and every quest while the
//   account has not reached the threshold constellation (durable once reached).
// * Premium: no daily quota. The 15-minute cooldown is separate and unchanged.
export const QUOTA_STORAGE_PREFIX='lumenQuotaV1:';
export const QUOTA_KEEP_DAYS=8;
export const COMMERCE_DEFAULTS=Object.freeze({premiumEnabled:false,shopPremium:false,quotasEnabled:false,thresholdConstellation:4,
 newDaily:null,replayDaily:5,stats:false,archives:false,circles:false,cosmetics:false,premiumPriceCents:499,premiumProductActive:false});
const BOOLEAN_KEYS=['premiumEnabled','shopPremium','quotasEnabled','stats','archives','circles','cosmetics','premiumProductActive'];
const intIn=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;

// Unknown or malformed values fall back to the safe (off) defaults.
export function normalizeCommerceConfig(raw){
 const out={...COMMERCE_DEFAULTS};
 if(!raw||typeof raw!=='object')return Object.freeze(out);
 for(const k of BOOLEAN_KEYS)if(typeof raw[k]==='boolean')out[k]=raw[k];
 if(intIn(raw.thresholdConstellation,1,88))out.thresholdConstellation=raw.thresholdConstellation;
 if(raw.newDaily===null||intIn(raw.newDaily,1,500))out.newDaily=raw.newDaily;
 if(intIn(raw.replayDaily,0,500))out.replayDaily=raw.replayDaily;
 if(intIn(raw.premiumPriceCents,1,100000))out.premiumPriceCents=raw.premiumPriceCents;
 return Object.freeze(out);
}

export function currentTimeZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch{return 'UTC'}}
export function validTimeZone(tz){try{if(typeof tz!=='string'||!tz||tz.length>64)return false;new Intl.DateTimeFormat('en-CA',{timeZone:tz});return true}catch{return false}}
// YYYY-MM-DD of an instant in an IANA zone (DST is handled by the zone rules).
export function localDay(instant,timeZone){
 const tz=validTimeZone(timeZone)?timeZone:'UTC';
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));
 const get=type=>parts.find(p=>p.type===type)?.value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
const maxDay=(a,b)=>a>b?a:b, minDay=(a,b)=>a<b?a:b;
// Anti double reset (travel, manual zone changes, DST): never earlier than the
// latest used day, never later than that day's own zone allows.
export function effectiveDay(latest,instant,timeZone){
 const current=localDay(instant,timeZone);
 if(!latest?.day)return current;
 const guard=localDay(instant,validTimeZone(latest.tz)?latest.tz:timeZone);
 return maxDay(latest.day,minDay(current,guard));
}

// 1-based order of each constellation in the catalogue order (catalogue owns it).
export function constellationOrdinals(quests=[]){
 const order=new Map(),byQuest=new Map();
 for(const q of quests){if(!order.has(q.constellationId))order.set(q.constellationId,order.size+1);byQuest.set(q.id,order.get(q.constellationId))}
 return byQuest;
}
export function discoveryQuestIds(quests=[],threshold=COMMERCE_DEFAULTS.thresholdConstellation){
 const ord=constellationOrdinals(quests);return quests.filter(q=>ord.get(q.id)<threshold).map(q=>q.id);
}
// Players already advanced at launch are activated by their own progress.
export function activationReached({quests=[],threshold=COMMERCE_DEFAULTS.thresholdConstellation,isCompleted=()=>false}={}){
 const ord=constellationOrdinals(quests);
 return quests.some(q=>ord.get(q.id)>=threshold&&isCompleted(q));
}
export function attemptQuotaKind({wonBefore=false}={}){return wonBefore?'replay':'new'}

// Whether daily quotas apply to this account right now (public launch or QA preview).
export function quotasApply({config=COMMERCE_DEFAULTS,premium=false,preview=false}={}){
 if(premium)return false;
 return !!(preview||(config.premiumEnabled&&config.quotasEnabled));
}
// Decision at the first gesture of a NEW attempt identity only.
export function quotaDecision({config=COMMERCE_DEFAULTS,premium=false,preview=false,activated=false,thresholdQuest=false,exempt=false,kind='new',used={new:0,replay:0}}={}){
 if(exempt)return {counted:false,allowed:true,reason:'exempt'};
 if(!quotasApply({config,premium,preview}))return {counted:false,allowed:true,reason:premium?'premium':'off'};
 const nowActive=activated||thresholdQuest;
 if(!nowActive)return {counted:false,allowed:true,reason:'discovery'};
 const limit=kind==='replay'?config.replayDaily:config.newDaily;
 const count=Math.max(0,Number(used?.[kind])||0);
 // An undecided new-quest value never blocks (owner decision #1044).
 if(limit===null||limit===undefined)return {counted:true,allowed:true,reason:'unlimited',kind,limit:null,used:count,activate:!activated};
 if(count>=limit)return {counted:false,allowed:false,reason:kind==='replay'?'replay_limit':'new_limit',kind,limit,used:count};
 return {counted:true,allowed:true,reason:'quota',kind,limit,used:count,remaining:limit-count-1,activate:!activated};
}

function emptyState(){return {v:1,latest:null,activatedAt:null,activationQuest:null,days:{},server:{},premium:null,config:null,configAt:0,preview:false}}
function parse(raw){try{const s=raw?JSON.parse(raw):null;return s&&s.v===1&&typeof s.days==='object'?{...emptyState(),...s}:emptyState()}catch{return emptyState()}}

export function createQuotaLedger({storage=globalThis.localStorage,owner='guest',now=()=>Date.now(),timeZone=currentTimeZone}={}){
 const key=QUOTA_STORAGE_PREFIX+owner;
 const read=()=>{try{return parse(storage?.getItem?.(key))}catch{return emptyState()}};
 const write=s=>{
  // Bounded: only the most recent days are kept (local attempts and server counts).
  for(const bucket of [s.days,s.server]){const days=Object.keys(bucket).sort();for(const d of days.slice(0,Math.max(0,days.length-QUOTA_KEEP_DAYS)))delete bucket[d]}
  try{storage?.setItem?.(key,JSON.stringify(s))}catch{}return s;
 };
 const tz=()=>{const z=typeof timeZone==='function'?timeZone():timeZone;return validTimeZone(z)?z:'UTC'};
 function day(at=now()){return effectiveDay(read().latest,at,tz())}
 function used(d=day()){
  const s=read(),local=Object.values(s.days[d]?.attempts||{});
  const pending=k=>local.filter(a=>a.kind===k&&!a.synced).length, all=k=>local.filter(a=>a.kind===k).length;
  const server=s.server[d]||{};
  return {new:Math.max(all('new'),(Number(server.new)||0)+pending('new')),replay:Math.max(all('replay'),(Number(server.replay)||0)+pending('replay'))};
 }
 // Idempotent per attempt identity; returns the imputed day.
 function record({attemptId,questId,kind,startedAt=now()}){
  if(!attemptId||!questId||!['new','replay'].includes(kind))return null;
  const s=read();
  for(const [d,entry] of Object.entries(s.days))if(entry.attempts?.[attemptId])return d;
  const zone=tz(),d=effectiveDay(s.latest,startedAt,zone);
  s.days[d]=s.days[d]||{tz:zone,attempts:{}};
  s.days[d].attempts[attemptId]={questId:String(questId),kind,startedAt:new Date(startedAt).toISOString(),synced:false};
  if(!s.latest||d>s.latest.day)s.latest={day:d,tz:zone};
  write(s);return d;
 }
 function activate({at=now(),questId}={}){
  const s=read(),iso=new Date(at).toISOString();
  if(s.activatedAt&&s.activatedAt<=iso)return false;
  s.activatedAt=iso;s.activationQuest=questId?String(questId):s.activationQuest;s.activationSynced=false;write(s);return true;
 }
 function pending(limit=40){
  const s=read(),out=[];
  for(const [d,entry] of Object.entries(s.days))for(const [attemptId,a] of Object.entries(entry.attempts||{}))
   if(!a.synced)out.push({attemptId,questId:a.questId,kind:a.kind,day:d,timeZone:entry.tz,startedAt:a.startedAt});
  return out.sort((a,b)=>a.startedAt<b.startedAt?-1:1).slice(0,limit);
 }
 function pendingActivation(){const s=read();return s.activatedAt&&!s.activationSynced?{at:s.activatedAt,questId:s.activationQuest||'unknown'}:null}
 // Server acknowledgement: mark the sent identities, adopt authoritative counts and
 // the earliest durable activation (monotonic on both sides).
 function acknowledge({attemptIds=[],counts=null,activatedAt=null,activationSent=false}={}){
  const s=read();
  for(const entry of Object.values(s.days))for(const id of attemptIds)if(entry.attempts?.[id])entry.attempts[id].synced=true;
  if(counts?.day)s.server[counts.day]={new:Number(counts.new)||0,replay:Number(counts.replay)||0};
  if(activatedAt&&(!s.activatedAt||activatedAt<s.activatedAt))s.activatedAt=new Date(activatedAt).toISOString();
  if(activationSent)s.activationSynced=true;
  write(s);
 }
 function cacheCommerce({config,premium,preview,at=now()}={}){const s=read();if(config)s.config=config;if(premium!==undefined)s.premium=premium;if(preview!==undefined)s.preview=!!preview;s.configAt=at;write(s)}
 function clearDays(){const s=read();s.days={};s.server={};s.latest=null;write(s)}
 return {key,day,used,record,activate,pending,pendingActivation,acknowledge,cacheCommerce,snapshot:read,clearDays,timeZone:tz};
}
