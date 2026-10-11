// PREPARATION ONLY. Resend idempotency keys are time-bound, not a permanent delivery ledger. Do not deploy or activate on the shared Auth project without two-app E2E.
import {Webhook} from "https://esm.sh/standardwebhooks@1.0.0";
import {planAuthEmails} from "../../../src/auth/email-delivery-plan.js";
const json=(status)=>new Response(JSON.stringify({}),{status,headers:{"content-type":"application/json"}});
const secret=Deno.env.get("SEND_EMAIL_HOOK_SECRET")||"";
const apiKey=Deno.env.get("RESEND_API_KEY")||"";
const senders={lumen:Deno.env.get("LUMEN_AUTH_SENDER"),soldezen:Deno.env.get("SOLDEZEN_AUTH_SENDER")};
const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const verifiedSecret=secret.startsWith("v1,whsec_")?secret.slice("v1,whsec_".length):"";
async function ledgerCall(name,payload){
 const response=await fetch(supabaseUrl.replace(/\/$/,"")+"/rest/v1/rpc/"+name,{
  method:"POST",headers:{"apikey":serviceKey,"authorization":"Bearer "+serviceKey,"content-type":"application/json"},
  body:JSON.stringify(payload)
 });
 if(!response.ok)throw new Error("ledger_unavailable");
 return response.json();
}
async function fingerprint(delivery,plan){
 const input=[plan.brand,plan.action,delivery.role,delivery.email,delivery.token].join("\n");
 const bytes=new TextEncoder().encode(input);
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 return [...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function message(brand,action,code){
 const label=brand==="lumen"?"Lumen":"SoldeZen";
 const purpose={signup:"confirmer ton inscription",magiclink:"te connecter",email:"te connecter",recovery:"récupérer ton compte",invite:"accepter ton invitation",email_change:"confirmer ton changement d’adresse",reauthentication:"confirmer ton identité"}[action];
 return {subject:label+" — "+purpose,text:"Ton code pour "+label+" : "+code+"\nSi tu n'as rien demandé, ignore ce message."};
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return json(405);
 if(!verifiedSecret||!apiKey||!supabaseUrl||!serviceKey||!senders.lumen||!senders.soldezen)return json(503);
 const length=Number(req.headers.get("content-length")||0);
 if(length>250000)return json(413);
 let payload;try{
  const raw=await req.text();if(raw.length>250000)return json(413);
  payload=new Webhook(verifiedSecret).verify(raw,Object.fromEntries(req.headers));
 }catch{return json(401)}
 const plan=planAuthEmails(payload);
 if(!plan.ok)return json(422); // Fail closed: never route to a guessed brand.
 const sender=senders[plan.brand];
 const webhookId=req.headers.get("webhook-id");
 if(!webhookId||!/^[a-zA-Z0-9_\\-]{8,128}$/.test(webhookId))return json(401);
 for(const delivery of plan.deliveries){
  const key=webhookId+"-"+delivery.role;
  const hash=await fingerprint(delivery,plan);
  let claim;
  try{claim=await ledgerCall("lumen_auth_mail_claim",{p_key:key,p_fingerprint:hash})}
  catch{return json(503)}
  if(claim==="sent")continue;
  if(claim==="pending")return json(503); // uncertain delivery: manual resolution, never auto-send
  if(claim!=="claimed")return json(409);
  const content=message(plan.brand,plan.action,delivery.token);
  let providerId="";
  try{
   const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":"Bearer "+apiKey,"content-type":"application/json","Idempotency-Key":key},body:JSON.stringify({from:sender,to:[delivery.email],...content})});
   if(!result.ok)return json(502); // pending claim retained for investigation
   const response=await result.json();providerId=typeof response.id==="string"?response.id:"";
  }catch{return json(502)}
  try{
   const recorded=await ledgerCall("lumen_auth_mail_mark_sent",{p_key:key,p_fingerprint:hash,p_provider_id:providerId});
   if(recorded!==true)return json(503);
  }catch{return json(503)}
 }
 return json(200);
});
