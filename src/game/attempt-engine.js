export const ATTEMPT_STATES=Object.freeze({READY:"READY",RUNNING:"RUNNING",PAUSED:"PAUSED",COMPLETED:"COMPLETED",ABANDONED:"ABANDONED"});
const STORAGE_KEY="lumenActiveAttemptV1";

function newId(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 return "attempt-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
}
function cloneBoard(board){return Array.isArray(board)?board.map(row=>Array.isArray(row)?row.slice():[]):[]}
function safeParse(raw){try{return raw?JSON.parse(raw):null}catch(_){return null}}

export function createAttemptEngine({storage=globalThis.localStorage,now=()=>Date.now(),perfNow=()=>globalThis.performance?.now?.()??Date.now(),onChange=()=>{}}={}){
 let attempt=null,activeSince=null;
 const emit=()=>{persist();onChange(snapshot())};
 const snapshot=()=>attempt?{...attempt,board:cloneBoard(attempt.board),activeDuration:activeMs()}:null;
 function activeMs(){return attempt?attempt.activeDuration+(attempt.state===ATTEMPT_STATES.RUNNING&&activeSince!==null?Math.max(0,perfNow()-activeSince):0):0}
 function persist(){if(!attempt)return storage?.removeItem?.(STORAGE_KEY);const copy={...attempt,board:cloneBoard(attempt.board),activeDuration:activeMs(),updatedAt:now()};storage?.setItem?.(STORAGE_KEY,JSON.stringify(copy))}
 function create({questId,mode="campaign",qualifying=false,challengeId=null,board=[]}){
  attempt={attemptId:newId(),questId,mode,state:ATTEMPT_STATES.READY,startedAt:null,activeDuration:0,lastActiveAt:null,assistanceUsed:false,resetCount:0,qualifying:!!qualifying,challengeId,board:cloneBoard(board),createdAt:now(),updatedAt:now()};activeSince=null;emit();return snapshot()
 }
 function restore({questId,mode}={}){
  const saved=safeParse(storage?.getItem?.(STORAGE_KEY));if(!saved||!saved.attemptId)return null;
  if(questId!=null&&saved.questId!==questId)return null;if(mode&&saved.mode!==mode)return null;
  attempt={...saved,board:cloneBoard(saved.board),activeDuration:Number(saved.activeDuration)||0};
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
 function complete(){if(!attempt)return null;if(attempt.state===ATTEMPT_STATES.RUNNING)pause();attempt.state=ATTEMPT_STATES.COMPLETED;activeSince=null;emit();return snapshot()}
 function abandon(){if(!attempt)return null;if(attempt.state===ATTEMPT_STATES.RUNNING)pause();attempt.state=ATTEMPT_STATES.ABANDONED;activeSince=null;emit();return snapshot()}
 function reset(board=[]){if(!attempt)return null;attempt.resetCount=(attempt.resetCount||0)+1;attempt.board=cloneBoard(board);emit();return snapshot()}
 function updateBoard(board){if(!attempt)return;attempt.board=cloneBoard(board);emit()}
 function markAssistance(){if(!attempt||attempt.assistanceUsed)return;attempt.assistanceUsed=true;emit()}
 function clear(){attempt=null;activeSince=null;storage?.removeItem?.(STORAGE_KEY);onChange(null)}
 return {create,restore,start,pause,resume,complete,abandon,reset,updateBoard,markAssistance,clear,snapshot,activeMs,states:ATTEMPT_STATES,storageKey:STORAGE_KEY};
}
