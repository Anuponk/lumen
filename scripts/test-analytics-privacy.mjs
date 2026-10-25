import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/analytics/events.js",import.meta.url),"utf8");
const moduleUrl="data:text/javascript;base64,"+Buffer.from(source).toString("base64");
const {createAnalytics}=await import(moduleUrl);
function scenario(consent){
 const data=new Map(consent?[["lumenAnalyticsConsentV1","yes"]]:[]);
 const calls=[];
 const localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
 const client={rpc:async(...args)=>{calls.push(args);return {}}};
 const a=createAnalytics(()=>client,{localStorage,crypto:{randomUUID:()=>"random-id"},location:{hostname:"lumen.example",search:""},console,qaMode:false});
 return {a,data,calls};
}
const disabled=scenario(false);
await disabled.a.trackLumenEvent("quest_start",1);
assert.equal(disabled.calls.length,0);
assert.equal(disabled.data.has("lumenAnonymousIdV1"),false);
assert.equal(disabled.data.has("lumenAnalyticsSessionV2"),false);
const enabled=scenario(true);
await enabled.a.trackLumenEvent("quest_start",1);
assert.equal(enabled.calls.length,1);
assert.equal(enabled.calls[0][0],"lumen_track_event");
assert.equal(enabled.data.has("lumenAnonymousIdV1"),true);
console.log("analytics privacy checks passed");
