// Défi du jour (#882, EPIC #881 Lot 3). Pure helpers shared by the schedule
// generator, the tests and the client. The server owns the authoritative day,
// the single official attempt and the rankings (docs/DAILY_CHALLENGE.md).
import {canonicalQuestAtGridRevision} from './canonical-quests.js';

export const DAILY_TIME_ZONE='Europe/Paris';
export const DAILY_SCHEDULE_START='2026-11-23';
export const DAILY_POOL=Object.freeze({labels:Object.freeze(['Intermédiaire','Avancé']),minOrdinal:12});
export const DAILY_FINISH_WINDOW_HOURS=6;

const DAY_RE=/^\d{4}-\d{2}-\d{2}$/;
function parts(day){
 if(!DAY_RE.test(String(day)))throw Error('Invalid daily date '+day);
 const [y,m,d]=day.split('-').map(Number),check=new Date(Date.UTC(y,m-1,d));
 if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d)throw Error('Invalid daily date '+day);
 return [y,m,d];
}
function iso([y,m,d]){return String(y).padStart(4,'0')+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
export function addDays(day,count){const [y,m,d]=parts(day),t=new Date(Date.UTC(y,m-1,d+count));return iso([t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate()])}

// Civil date in Europe/Paris for an instant.
export function parisDay(instant=new Date()){
 const f=new Intl.DateTimeFormat('en-CA',{timeZone:DAILY_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
 return f.format(instant instanceof Date?instant:new Date(instant));
}
function parisOffsetMs(instant){
 const f=new Intl.DateTimeFormat('en-US',{timeZone:DAILY_TIME_ZONE,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 const p=Object.fromEntries(f.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
 return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-Math.floor(instant/1000)*1000;
}
// Local midnight of a civil day as a UTC instant (DST-aware, 23 h / 25 h days).
export function parisMidnight(day){
 const [y,m,d]=parts(day),guess=Date.UTC(y,m-1,d);
 let instant=guess-parisOffsetMs(guess);
 instant=guess-parisOffsetMs(instant);
 return instant;
}
export function dailyBounds(day){
 const opensAt=parisMidnight(day),closesAt=parisMidnight(addDays(day,1));
 return {day,opensAt:new Date(opensAt).toISOString(),closesAt:new Date(closesAt).toISOString(),hours:(closesAt-opensAt)/3600000};
}
// ISO week Monday → Sunday containing the day.
export function dailyWeek(day){
 const [y,m,d]=parts(day),weekday=(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7,monday=addDays(day,-weekday);
 return Array.from({length:7},(_,i)=>addDays(monday,i));
}

export function dailyPool(quests){
 return quests.filter(q=>DAILY_POOL.labels.includes(q.difficulty?.label)&&q.ordinal>=DAILY_POOL.minOrdinal)
  .map(q=>({questId:q.id,gridRevision:q.gridRevision??0,constellationId:q.constellationId}))
  .sort((a,b)=>a.questId<b.questId?-1:a.questId>b.questId?1:0);
}

// Append-only deterministic schedule: existing days are kept verbatim; new days
// continue the same cycle (no repeat until the pool is exhausted, never the
// same constellation two days running). hash(cycle,id) orders each cycle.
export function planDailySchedule({pool,start=DAILY_SCHEDULE_START,days,existing=[],hash}){
 if(!pool.length)throw Error('Empty daily pool');
 const out=[],byDay=new Map(existing.map(e=>[e.day,e]));
 let cycle=0,used=new Set(),order=null,previous=null;
 const cycleOrder=c=>[...pool].sort((a,b)=>{const x=hash(c+':'+a.questId),y=hash(c+':'+b.questId);return x<y?-1:x>y?1:a.questId<b.questId?-1:1});
 for(let i=0;i<days;i++){
  const day=addDays(start,i),kept=byDay.get(day);
  if(!order)order=cycleOrder(cycle);
  if(used.size>=pool.length){cycle+=1;used=new Set();order=cycleOrder(cycle)}
  let entry=kept;
  if(!entry){
   let pick=order.find(q=>!used.has(q.questId)&&q.constellationId!==previous);
   if(!pick){cycle+=1;used=new Set();order=cycleOrder(cycle);pick=order.find(q=>q.constellationId!==previous)}
   entry={day,questId:pick.questId,gridRevision:pick.gridRevision,constellationId:pick.constellationId};
  }
  used.add(entry.questId);previous=entry.constellationId;out.push(entry);
 }
 return out;
}

export function dailyEntry(schedule,day){return schedule.days.find(e=>e.day===day)||null}
// The exact pinned board, even after later catalogue revisions.
export function dailyQuest(entry){
 if(!entry)return null;
 let quest=null;
 try{quest=canonicalQuestAtGridRevision(entry.questId,entry.gridRevision)}catch{quest=null}
 if(!quest)throw Error('Unresolvable daily grid '+entry.questId+'@'+entry.gridRevision);
 return quest;
}

// Thin client over the server contracts (docs/DAILY_CHALLENGE.md §3).
export function createDailyClient(supabase){
 async function rpc(name,args={}){
  if(!supabase)throw new Error('cloud_unavailable');
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw new Error(error.message||'unavailable');
  return data;
 }
 const today=()=>rpc('lumen_daily_today');
 return {
  today,
  // #1003: the server flag (daily_challenge) or the preview capability decides;
  // callers memoise the answer for the day (see refreshDailyEntry).
  discover:()=>today(),
  begin:operationId=>rpc('lumen_daily_begin',{p_operation_id:operationId}),
  finish:({day,operationId,status,seconds,hint=0,verify=0,guided=0})=>rpc('lumen_daily_finish',{p_day:day,p_operation_id:operationId,p_status:status,p_seconds:seconds,p_hint:hint,p_verify:verify,p_guided:guided}),
  board:day=>rpc('lumen_daily_board',{p_day:day??null}),
  week:day=>rpc('lumen_daily_week',{p_day:day??null})
 };
}
