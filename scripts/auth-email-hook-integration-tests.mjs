import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {webcrypto} from "node:crypto";
import {planAuthEmails} from "../src/auth/email-delivery-plan.js";

const edgeSource=fs.readFileSync("supabase/functions/lumen-soldezen-auth-email/index.ts","utf8")
  .replace(/^import .*;\n/gm,"");
function payload(action="signup",redirect_to="https://lumen.nopuna.fr/"){
 return {user:{email:"old@example.com",new_email:"new@example.com"},email_data:{email_action_type:action,redirect_to,token:"123456",token_new:"654321",token_hash:"hash",token_hash_new:action==="email_change"?"hash2":""}};
}
async function runScenario({mode="ok",event=payload(),signed=true,repeat=false}={}){
 const ledger=new Map(),sent=[],calls=[];
 let handler;
 const env={SEND_EMAIL_HOOK_SECRET:"v1,whsec_test",RESEND_API_KEY:"fake",LUMEN_AUTH_SENDER:"auth@lumen.nopuna.fr",SOLDEZEN_AUTH_SENDER:"auth@soldezen.fr",SUPABASE_URL:"https://mock.supabase.invalid",SUPABASE_SERVICE_ROLE_KEY:"fake"};
 const sandbox={
  Deno:{env:{get:(key)=>env[key]},serve:(fn)=>{handler=fn}},
  Webhook:class{verify(raw,headers){if(headers["webhook-signature"]!=="valid")throw Error("bad signature");return JSON.parse(raw)}},
  planAuthEmails,
  fetch:async(url,options)=>{
   if(url.includes("/rest/v1/rpc/")){
    const name=url.split("/").at(-1),v=JSON.parse(options.body),key=v.p_key;
    if(name==="lumen_auth_mail_claim"){
     if(ledger.has(key)){const row=ledger.get(key);return new Response(JSON.stringify(row.fingerprint!==v.p_fingerprint?"conflict":row.state),{status:200})}
     ledger.set(key,{state:"pending",fingerprint:v.p_fingerprint});return new Response(JSON.stringify("claimed"),{status:200});
    }
    if(name==="lumen_auth_mail_mark_sent"){const row=ledger.get(key);if(row?.fingerprint!==v.p_fingerprint)return new Response("false");row.state="sent";return new Response("true")}
   }
   const message=JSON.parse(options.body);
   calls.push(message);
   if(mode==="fail_first"&&calls.length===1)return new Response("unavailable",{status:500});
   if(mode==="fail_second"&&calls.length===2)return new Response("unavailable",{status:500});
   sent.push(message);
   return new Response(JSON.stringify({id:"provider-"+sent.length}),{status:200});
  },
  crypto:webcrypto,TextEncoder,Response,console
 };
 vm.runInNewContext(edgeSource,sandbox,{filename:"lumen-soldezen-auth-email/index.ts"});
 const invoke=()=>handler(new Request("https://hook.invalid/",{method:"POST",headers:{"webhook-id":"evt_123456789","webhook-signature":signed?"valid":"bad"},body:JSON.stringify(event)}));
 const initial=await invoke(),next=repeat?await invoke():null;
 return {statuses:[initial.status,next?.status],sent,calls,ledger};
}
let x=await runScenario({repeat:true});assert.deepEqual(x.statuses,[200,200]);assert.equal(x.sent.length,1);
x=await runScenario({signed:false});assert.deepEqual(x.statuses,[401,undefined]);assert.equal(x.calls.length,0);
x=await runScenario({event:payload("signup","https://evil.invalid/")});assert.equal(x.statuses[0],422);assert.equal(x.calls.length,0);
x=await runScenario({mode:"fail_first",repeat:true});assert.deepEqual(x.statuses,[502,503]);assert.equal(x.calls.length,1);
x=await runScenario({mode:"fail_second",event:payload("email_change"),repeat:true});assert.deepEqual(x.statuses,[502,503]);assert.equal(x.sent.length,1);assert.equal(x.calls.length,2);
x=await runScenario({event:payload("signup","https://soldezen.fr/")});assert.equal(x.statuses[0],200);assert.equal(x.sent[0].from,"auth@soldezen.fr");
console.log("Auth hook mocked integration: signature rejection, brand isolation, duplicate replay, provider failure, partial dual-send all passed");
