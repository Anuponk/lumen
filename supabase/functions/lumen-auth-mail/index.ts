// Lumen-only auth email endpoint. Never configure the project-wide Send Email Hook.
// Requires RESEND, UPSTASH and SUPABASE secrets. Deploy with JWT verification disabled
// only after the dedicated server-side rate limits and end-to-end flows are validated.
const HOST="https://lumen.nopuna.fr";
const headers={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":HOST,"access-control-allow-headers":"content-type,apikey,authorization","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"};
const reply=(status:number,body:Record<string,unknown>={ok:false})=>new Response(JSON.stringify(body),{status,headers});
const accepted=()=>reply(200,{ok:true});
async function digest(s:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(d)].map(n=>n.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{
 if(req.headers.get("origin")!==HOST)return reply(403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405);
 if(Deno.env.get("LUMEN_AUTH_MAIL_ENABLED")!=="true")return reply(503);
 const key=Deno.env.get("LUMEN_RESEND_API_KEY")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const base=Deno.env.get("SUPABASE_URL")||"";
 if(!key||!service||!base)return reply(503);
 const raw=await req.text();if(raw.length>4096)return reply(413);
 let input:Record<string,unknown>;try{input=JSON.parse(raw)}catch{return reply(400)}
 const email=typeof input.email==="string"?input.email.trim().toLowerCase():"";
 const type=input.type;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["signup","recovery","magiclink"].includes(String(type)))return reply(400);
 const password=typeof input.password==="string"?input.password:"";
 if(type==="signup"&&password.length<12)return reply(400);
 // Ignore any caller-provided redirect. It is never used as a trusted brand selector.
 // Atomic server-only RPC: reserved on every attempt, failure always blocks delivery.
 try{
  const emailHash=await digest(email);
  const reserved=await fetch(base.replace(/\/$/,"")+"/rest/v1/rpc/lumen_auth_mail_reserve",{
   method:"POST",headers:{"apikey":service,"authorization":"Bearer "+service,"content-type":"application/json"},
   body:JSON.stringify({p_email_hash:emailHash})
  });
  if(!reserved.ok)return reply(503);
  const permitted=await reserved.json();
  if(permitted!==true)return reply(429);
 }catch{return reply(503)}
 const typeArg=type==="magiclink"?"magiclink":type;
 const payload:Record<string,string>={type:String(typeArg),email,redirect_to:HOST+"/"};
 if(type==="signup")payload.password=password;
 let generated:Record<string,unknown>;
 try{
  const resp=await fetch(base.replace(/\/$/,"")+"/auth/v1/admin/generate_link",{method:"POST",headers:{"apikey":service,"authorization":"Bearer "+service,"content-type":"application/json"},body:JSON.stringify(payload)});
  if(!resp.ok)return accepted(); // indistinguishable response; never leak whether user exists
  generated=await resp.json();
 }catch{return reply(503)}
 const props=generated.properties as Record<string,unknown>|undefined;
 const action=typeof props?.action_link==="string"?props.action_link:"";
 const otp=typeof props?.email_otp==="string"?props.email_otp:"";
 if(type==="magiclink"&&!/^\d{6}$/.test(otp))return reply(503);
 if(!action.startsWith(base.replace(/\/$/,"")+"/auth/v1/verify?"))return reply(503);
 // Recovery links are preferred for password reset; legacy users receive an OTP.
 const label=type==="signup"?"Confirme ton inscription Lumen":type==="recovery"?"Réinitialise ton mot de passe Lumen":"Ton code de connexion Lumen";
 const text=type==="magiclink"&&/^\d{6}$/.test(otp)
  ?"Ton code de connexion Lumen : "+otp+"\n\nSi tu n'as rien demandé, ignore cet email."
  :"Pour continuer sur Lumen, ouvre ce lien : "+action+"\n\nSi tu n'as rien demandé, ignore cet email.";
 try{
  const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({from:"Lumen <auth@nopuna.fr>",to:[email],subject:label,text})});
  if(!sent.ok)return reply(502);
  const result=await sent.json();if(typeof result.id!=="string")return reply(502);
 }catch{return reply(502)}
 return accepted();
});
