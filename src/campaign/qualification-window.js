// #908 · The 15-minute badge window runs from the START of a qualifying run,
// whether that run ends in victory, abandon, reload or a device switch.
// Victories already record lastQualifiedAt (server-protected for canonical
// quests); this per-owner store remembers qualifying starts that never reached
// a victory, so abandoning and restarting can never open a second qualifying
// run. It only ever delays qualification: it never awards anything.
import {BADGE_COOLDOWN_MS} from './performance.js';

export const QUALIFYING_STARTS_KEY='lumenQualifyingStartsV1';
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function readAll(storage){
 try{const value=JSON.parse(storage?.getItem?.(QUALIFYING_STARTS_KEY)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}
}
function ownerKey(owner){return typeof owner==='string'&&owner?owner:'guest'}

export function qualifyingStartedAt(storage,owner,questId){
 const at=readAll(storage)[ownerKey(owner)]?.[String(questId)];
 return typeof at==='string'&&ISO.test(at)&&Number.isFinite(Date.parse(at))?at:null;
}

// Records the start of a qualifying run. Expired entries are pruned; a later
// start always wins. Returns false (never throws) when storage is unavailable:
// the server ranking window still applies to signed-in players.
export function recordQualifyingStart(storage,owner,questId,startedAt,now=Date.now()){
 const at=new Date(startedAt);if(!Number.isFinite(at.getTime()))return false;
 const all=readAll(storage),key=ownerKey(owner),mine={...(all[key]||{})};
 for(const [id,value] of Object.entries(mine))if(!(now-Date.parse(value)<BADGE_COOLDOWN_MS))delete mine[id];
 const previous=Date.parse(mine[String(questId)]||'');
 if(!(previous>at.getTime()))mine[String(questId)]=at.toISOString();
 all[key]=mine;
 try{storage.setItem(QUALIFYING_STARTS_KEY,JSON.stringify(all));return true}catch{return false}
}

// The record used by every cooldown reader: the latest of the last qualified
// victory and the last qualifying start.
export function withQualifyingStart(record={},startedAt=null){
 const start=Date.parse(startedAt||''),last=Date.parse(record?.lastQualifiedAt||'');
 if(!Number.isFinite(start)||Number.isFinite(last)&&last>=start)return record||{};
 return {...(record||{}),lastQualifiedAt:new Date(start).toISOString()};
}

export function cooldownMinutes(ms){return ms>0?Math.ceil(ms/60000):0}

// Confirmation copy for « Abandonner ». Challenges and the Défi du jour keep
// their one-shot rules (the abandon is recorded, no second official attempt).
export function abandonConfirmModel({mode='campaign',daily=false,qualifying=false,startedAt=null,cooldownMs=0,now=Date.now()}={},t=key=>key){
 if(daily)return {title:t("board.abandonConfirm"),copy:t("board.abandonDailyCopy"),confirm:t("board.abandonConfirmDaily"),cancel:t("board.abandonContinue"),sky:false};
 if(mode==='challenge')return {title:t("board.abandonConfirm"),copy:t("board.abandonChallengeCopy"),confirm:t("board.abandonConfirmChallenge"),cancel:t("board.abandonContinue"),sky:false};
 const start=startedAt==null?NaN:new Date(startedAt).getTime();
 const fromStart=qualifying&&Number.isFinite(start)?Math.max(0,BADGE_COOLDOWN_MS-(now-start)):0;
 const minutes=cooldownMinutes(Math.max(fromStart,Number(cooldownMs)||0));
 return {title:t("board.abandonConfirm"),
  copy:minutes?t("board.abandonCooldownCopy",{minutes}):t("board.abandonFreeCopy"),
  confirm:t("board.abandonConfirmSky"),cancel:t("board.abandonContinue"),sky:true,minutes};
}

// #998 · Stamps a qualifying start on an existing performance record only.
// lastQualified* are the sole performance keys the server legacy guard ignores;
// creating a new entry (even {questIndex}) changes the protected projection and
// every profile save is refused until the victory command lands. A first
// qualifying run is covered by recordQualifyingStart and by the victory itself.
export function markQualifiedStart(progress,index,{day,at}){
 const old=progress?.performances?.[index];
 if(!old||typeof old!=='object'||Array.isArray(old))return false;
 progress.performances[index]={...old,lastQualifiedDay:day,lastQualifiedAt:at};
 return true;
}
