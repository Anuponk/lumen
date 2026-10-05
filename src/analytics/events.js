export function attemptAnalyticsProperties({
 attempt=null,questIndex=0,gridSize=null,constellationIndex=null,constellationName=null,
 solvedCount=0,questAttemptNumber=1,guidedEnabled=false,autoMarkingEnabled=false
}={},extra={}){
 const activeMs=Number(attempt?.activeDuration);
 return {
  attempt_id:attempt?.attemptId||null,
  attempt_mode:attempt?.mode||"campaign",
  run_index:Math.max(1,(Number(attempt?.resetCount)||0)+1),
  active_seconds:Number.isFinite(activeMs)?Math.round(activeMs/100)/10:null,
  reset_count:Number(attempt?.resetCount)||0,
  assistance_used:!!attempt?.assistanceUsed,
  mistake_committed:!!attempt?.mistakeCommitted,
  qualifying:!!attempt?.qualifying,
  quest_index:Number(questIndex)||0,
  grid_size:Number.isFinite(Number(gridSize))?Number(gridSize):null,
  constellation_index:Number.isFinite(Number(constellationIndex))?Number(constellationIndex):null,
  constellation_name:constellationName||null,
  progress_solved:Number(solvedCount)||0,
  quest_attempt_number:Math.max(1,Number(questAttemptNumber)||1),
  guided_enabled:!!guidedEnabled,
  auto_marking_enabled:!!autoMarkingEnabled,
  ...extra
 };
}

export function createAnalytics(getClient,environment){
const {localStorage,crypto,location,console}=environment;
const analyticsDisabled=environment.disableTracking===true||['localhost','127.0.0.1','::1'].includes(location?.hostname);
function lumenId(key){
 try{let v=localStorage.getItem(key);if(!v){v=(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));localStorage.setItem(key,v)}return v}catch(e){return Date.now()+"-"+Math.random().toString(36).slice(2)}
}
const lumenAnonymousId=lumenId("lumenAnonymousIdV1");
const sessionKey="lumenAnalyticsSessionV2",now=Date.now(),timeoutMs=30*60*1000;
let lumenSessionId;
try{
 const previous=JSON.parse(localStorage.getItem(sessionKey)||"null");
 lumenSessionId=previous&&previous.id&&now-Number(previous.lastSeen||0)<timeoutMs?previous.id:null;
 if(!lumenSessionId)lumenSessionId=(crypto.randomUUID?crypto.randomUUID():now+"-"+Math.random().toString(36).slice(2));
 localStorage.setItem(sessionKey,JSON.stringify({id:lumenSessionId,lastSeen:now}));
}catch(e){lumenSessionId=(crypto.randomUUID?crypto.randomUUID():now+"-"+Math.random().toString(36).slice(2))}
function touchSession(){try{localStorage.setItem(sessionKey,JSON.stringify({id:lumenSessionId,lastSeen:Date.now()}))}catch(e){}}
async function trackLumenEvent(name,puzzleId=null,properties={}){
 touchSession();
 const lumenSupabase=getClient();
 if(analyticsDisabled)return;
 if(environment.qaMode)properties={...properties,qa_mode:environment.qaMode};
 if(!lumenSupabase)return;
 try{await lumenSupabase.rpc("lumen_track_event",{p_anonymous_id:lumenAnonymousId,p_event_name:name,p_session_id:lumenSessionId,p_puzzle_id:puzzleId,p_properties:properties})}catch(e){console.warn("LUMEN analytics",e)}
}
function captureReferral(){const ref=new URLSearchParams(location.search).get("ref");if(!ref)return;const clean=ref.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);if(!clean)return;try{localStorage.setItem("lumenReferral",clean)}catch(e){}trackLumenEvent("referral_visit",null,{ref:clean})}
return {lumenAnonymousId,lumenSessionId,trackLumenEvent,captureReferral};
}
