export const ATTEMPT_STATES=Object.freeze({READY:"READY",RUNNING:"RUNNING",PAUSED:"PAUSED",COMPLETED:"COMPLETED",ABANDONED:"ABANDONED"});
import {rankedTime} from '../campaign/ranking.js';
const STORAGE_KEY="lumenActiveAttemptV1";

function newId(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 return "attempt-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
}
function cloneBoard(board){return Array.isArray(board)?board.map(row=>Array.isArray(row)?row.slice():[]):[]}
function safeParse(raw){try{return raw?JSON.parse(raw):null}catch(_){return null}}

// #851: server identity of a run, shared by the victory receipt and the ranking
// capture (ranking_finish reads the receipt by this exact id). Challenges keep
// their historical per-reset identity.
export function attemptOperationId(attempt){
 if(!attempt?.attemptId)return undefined;
 const segment=attempt.mode!=='challenge'&&Number.isSafeInteger(attempt.runSegment)?attempt.runSegment:(attempt.resetCount||0);
 return attempt.attemptId+'-reset-'+segment;
}
export function createAttemptEngine({storage=globalThis.localStorage,now=()=>Date.now(),perfNow=()=>globalThis.performance?.now?.()??Date.now(),onChange=()=>{},onAssistanceUse=()=>{}}={}){
 let attempt=null,activeSince=null,persistReady=true;
 const emit=()=>{persist();onChange(snapshot())};
 const snapshot=()=>attempt?{...attempt,...(attempt.helpUses?{helpUses:{...attempt.helpUses}}:{}),board:cloneBoard(attempt.board),activeDuration:activeMs()}:null;
 function activeMs(){return attempt?attempt.activeDuration+(attempt.state===ATTEMPT_STATES.RUNNING&&activeSince!==null?Math.max(0,perfNow()-activeSince):0):0}
 function officialSeconds(){return rankedTime(Math.max(0,Math.floor(activeMs()/1000)),attempt?.helpUses).score}
 function persist(){
  if(!attempt)return storage?.removeItem?.(STORAGE_KEY);
  // A review selection becomes a resumable attempt after the first real action.
  if(!persistReady&&!attempt.startedAt)return;
  const copy={...attempt,board:cloneBoard(attempt.board),activeDuration:activeMs(),updatedAt:now()};
  storage?.setItem?.(STORAGE_KEY,JSON.stringify(copy));
 }
 function create({questId,mode="campaign",qualifying=false,challengeId=null,board=[],gridRevision=0,questResetRevision=0,persistBeforeStart=true,activeDuration=0}){
  if(mode==='challenge')questResetRevision=0;
  persistReady=persistBeforeStart;
  // #851: one run identity per attempt; a grid reset never opens a new run.
  attempt={attemptId:(questResetRevision?'qr'+questResetRevision+'.':'')+(gridRevision>1?'gv'+gridRevision+'.':'')+newId(),questId,mode,rankingVersion:1,...(gridRevision?{gridRevision}:{}),...(questResetRevision?{questResetRevision}:{}),...(mode==='challenge'?{}:{runSegment:0}),state:ATTEMPT_STATES.READY,startedAt:null,activeDuration:mode==='challenge'?Math.max(0,Number(activeDuration)||0):0,lastActiveAt:null,assistanceUsed:false,mistakeCommitted:false,wrongGuardianPending:null,resetCount:0,qualifying:!!qualifying,challengeId,board:cloneBoard(board),createdAt:now(),updatedAt:now()};activeSince=null;emit();return snapshot()
 }
 // #888: a challenge attempt belongs to exactly one challenge; another one on the
 // same quest never inherits its board or clock.
 function restore({questId,mode,gridRevision,questResetRevision,challengeId}={}){
  const saved=safeParse(storage?.getItem?.(STORAGE_KEY));if(!saved||!saved.attemptId)return null;
  if(challengeId!==undefined&&saved.mode==='challenge'&&saved.challengeId!==challengeId)return null;
  if(questId!=null&&saved.questId!==questId)return null;if(mode&&saved.mode!==mode)return null;
  if((gridRevision!==undefined&&(saved.gridRevision??0)!==gridRevision)||(saved.mode!=='challenge'&&questResetRevision!==undefined&&(saved.questResetRevision??0)!==questResetRevision)){
   // Preserve the exact old attempt before a new grid can overwrite this slot.
   // Failure is blocking; never silently discard an offline attempt.
   const raw=storage.getItem(STORAGE_KEY),key=STORAGE_KEY+':grid-archive:'+saved.attemptId+':'+(saved.gridRevision??0);
   const previous=storage.getItem(key);
   if(previous!==null&&previous!==raw)throw Error('Grid attempt archive conflict');
   storage.setItem(key,raw);
   if(storage.getItem(key)!==raw)throw Error('Grid attempt archive unverified');
   return null;
  }
  persistReady=true;
  attempt={...saved,board:cloneBoard(saved.board),activeDuration:Number(saved.activeDuration)||0,assistanceUsed:!!saved.assistanceUsed,mistakeCommitted:!!saved.mistakeCommitted,wrongGuardianPending:saved.wrongGuardianPending||null};
  // #851: an attempt persisted by an older release keeps the run identity it
  // may already have begun on the server (victory receipt and ranking).
  if(attempt.mode!=='challenge'&&!Number.isSafeInteger(attempt.runSegment))attempt.runSegment=Number.isSafeInteger(attempt.resetCount)?attempt.resetCount:0;
  activeSince=null;
  if(attempt.state===ATTEMPT_STATES.RUNNING)attempt.state=ATTEMPT_STATES.PAUSED;
  emit();return snapshot()
 }
 function start(){
  if(!attempt||attempt.state!==ATTEMPT_STATES.READY)return snapshot();
  attempt.state=ATTEMPT_STATES.RUNNING;attempt.startedAt=attempt.startedAt||now();attempt.lastActiveAt=now();activeSince=perfNow();emit();return snapshot()
 }
 function pause(){
  if(!attempt||attempt.state!==ATTEMPT_STATES.RUNNING)return snapshot();
  attempt.activeDuration=activeMs();activeSince=null;attempt.state=ATTEMPT_STATES.PAUSED;attempt.lastActiveAt=now();emit();return snapshot()
 }
 function resume(){
  if(!attempt||attempt.state!==ATTEMPT_STATES.PAUSED)return snapshot();
  attempt.state=ATTEMPT_STATES.RUNNING;attempt.lastActiveAt=now();activeSince=perfNow();emit();return snapshot()
 }
 function complete(){if(!attempt)return null;if(attempt.state===ATTEMPT_STATES.RUNNING){attempt.activeDuration=activeMs();attempt.lastActiveAt=now()}attempt.state=ATTEMPT_STATES.COMPLETED;activeSince=null;emit();return snapshot()}
 function abandon(){if(!attempt)return null;if(attempt.state===ATTEMPT_STATES.RUNNING)pause();attempt.state=ATTEMPT_STATES.ABANDONED;activeSince=null;emit();return snapshot()}
 // #761: the badge cooldown is evaluated when a run starts, never frozen when the
 // grid was opened. Only a not-yet-started run can change; social challenges never.
 function requalify(qualifying){
  if(!attempt||attempt.mode==='challenge'||attempt.state!==ATTEMPT_STATES.READY||attempt.qualifying===!!qualifying)return snapshot();
  attempt.qualifying=!!qualifying;emit();return snapshot()
 }
 // #908: the server ranking window (another device, a reconnection) can only
 // demote a live run, never promote one; challenges keep their own rules.
 function disqualify(attemptId){
  if(!attempt||attempt.mode==='challenge'||!attempt.qualifying||(attemptId&&attempt.attemptId!==attemptId)||
   ![ATTEMPT_STATES.READY,ATTEMPT_STATES.RUNNING,ATTEMPT_STATES.PAUSED].includes(attempt.state))return snapshot();
  attempt.qualifying=false;emit();return snapshot()
 }
 function reset(board=[],{qualifying}={}){
  if(!attempt)return null;
  attempt.resetCount=(attempt.resetCount||0)+1;attempt.board=cloneBoard(board);
  attempt.wrongGuardianPending=null;
  // #851 / #36: "Réinitialiser la grille" only clears the placements, in every
  // mode. The attempt, its elapsed time, assistance, committed errors, badge
  // qualification and run identity continue: a reset can never restart the
  // official time, clear an aid or bypass the badge/ranking cooldown.
  // A fresh run is only "Rejouer la quête" (a new attempt).
  emit();return snapshot()
 }
 function updateBoard(board){if(!attempt)return;attempt.board=cloneBoard(board);emit()}
 function markAssistance(){if(!attempt||attempt.assistanceUsed)return;attempt.assistanceUsed=true;emit()}
 function recordAssistanceUse(kind,count){
  if(!attempt||!['hint','verify','guided'].includes(kind)||!Number.isSafeInteger(count)||count<0)return;
  const previous=attempt.helpUses?.[kind]||0;if(count<=previous)return;
  attempt.helpUses={...(attempt.helpUses||{}),[kind]:count};emit();onAssistanceUse({kind,count,delta:count-previous});
 }
 function setWrongGuardianPending(cellKey){if(!attempt||attempt.mistakeCommitted)return;attempt.wrongGuardianPending=cellKey||null;emit()}
 function clearWrongGuardianPending(cellKey=null){if(!attempt||!attempt.wrongGuardianPending)return;if(cellKey&&attempt.wrongGuardianPending!==cellKey)return;attempt.wrongGuardianPending=null;emit()}
 function commitMistake(){if(!attempt)return;if(attempt.mistakeCommitted&&attempt.wrongGuardianPending===null)return;attempt.mistakeCommitted=true;attempt.wrongGuardianPending=null;emit()}
 function peek(){return safeParse(storage?.getItem?.(STORAGE_KEY))}
 function clear(){attempt=null;activeSince=null;storage?.removeItem?.(STORAGE_KEY);onChange(null)}
 return {create,restore,peek,requalify,disqualify,start,pause,resume,complete,abandon,reset,updateBoard,markAssistance,recordAssistanceUse,setWrongGuardianPending,clearWrongGuardianPending,commitMistake,clear,snapshot,activeMs,officialSeconds,states:ATTEMPT_STATES,storageKey:STORAGE_KEY};
}
