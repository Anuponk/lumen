// PREPARATION ONLY. Do not deploy or activate on the shared Auth project without two-app E2E.
import {Webhook} from "https://esm.sh/standardwebhooks@1.0.0";
import {planAuthEmails} from "../../../src/auth/email-delivery-plan.js";
const json=(status)=>new Response(JSON.stringify({}),{status,headers:{"content-type":"application/json"}});
const secret=Deno.env.get("SEND_EMAIL_HOOK_SECRET")||"";
const apiKey=Deno.env.get("RESEND_API_KEY")||"";
const senders={lumen:Deno.env.get("LUMEN_AUTH_SENDER"),soldezen:Deno.env.get("SOLDEZEN_AUTH_SENDER")};
const verifiedSecret=secret.startsWith("v1,whsec_")?secret.slice("v1,whsec_".length):"";
function message(brand,action,code){
 const label=brand==="lumen"?"Lumen":"SoldeZen";
 const purpose={signup:"confirmer ton inscription",magiclink:"te connecter",email:"te connecter",recovery:"récupérer ton compte",invite:"accepter ton invitation",email_change:"confirmer ton changement d’adresse",reauthentication:"confirmer ton identité"}[action];
 return {subject:label+" — "+purpose,text:"Ton code pour "+label+" : "+code+"\nSi tu n'as rien demandé, ignore ce message."};
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return json(405);
 if(!verifiedSecret||!apiKey||!senders.lumen||!senders.soldezen)return json(503);
 const length=Number(req.headers.get("content-length")||0);
 if(length>250000)return json(413);
 let payload;try{
  const raw=await req.text();if(raw.length>250000)return json(413);
  payload=new Webhook(verifiedSecret).verify(raw,Object.fromEntries(req.headers));
 }catch{return json(401)}
 const plan=planAuthEmails(payload);
 if(!plan.ok)return json(422); // Fail closed: never route to a guessed brand.
 const sender=senders[plan.brand];
 for(const delivery of plan.deliveries){
  const content=message(plan.brand,plan.action,delivery.token);
  try{
   const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":"Bearer "+apiKey,"content-type":"application/json"},body:JSON.stringify({from:sender,to:[delivery.email],...content})});
   if(!result.ok)return json(502);
  }catch{return json(502)}
 }
 return json(200);
});
