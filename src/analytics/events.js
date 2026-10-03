export function createAnalytics(getClient,environment){
const {localStorage,crypto,location,console}=environment;
function lumenId(key){
 try{let v=localStorage.getItem(key);if(!v){v=(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));localStorage.setItem(key,v)}return v}catch(e){return Date.now()+"-"+Math.random().toString(36).slice(2)}
}
const lumenAnonymousId=lumenId("lumenAnonymousIdV1");
const lumenSessionId=(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2));
async function trackLumenEvent(name,puzzleId=null,properties={}){
 const lumenSupabase=getClient();
 if(!lumenSupabase)return;
 try{await lumenSupabase.rpc("lumen_track_event",{p_anonymous_id:lumenAnonymousId,p_event_name:name,p_session_id:lumenSessionId,p_puzzle_id:puzzleId,p_properties:properties})}catch(e){console.warn("LUMEN analytics",e)}
}
function captureReferral(){const ref=new URLSearchParams(location.search).get("ref");if(!ref)return;const clean=ref.replace(/[^a-zA-Z0-9_-]/g,"").slice(0,64);if(!clean)return;try{localStorage.setItem("lumenReferral",clean)}catch(e){}trackLumenEvent("referral_visit",null,{ref:clean})}
return {lumenAnonymousId,lumenSessionId,trackLumenEvent,captureReferral};
}
