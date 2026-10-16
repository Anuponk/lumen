// Lumen-only auth email endpoint. Never configure the project-wide Send Email Hook.
// Requires Resend and Supabase service-role secrets; throttle uses private Postgres RPC. Deploy with JWT verification disabled
// only after the dedicated server-side rate limits and end-to-end flows are validated.
const HOST="https://lumen.nopuna.fr";
const headers={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":HOST,"access-control-allow-headers":"content-type,apikey,authorization","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"};
const reply=(status:number,body:Record<string,unknown>={ok:false})=>{if(status>=500)console.error("[lumen-auth-mail] failure",{status,reason:typeof body.reason==="string"?body.reason:"upstream_mail_failure"});return new Response(JSON.stringify(body),{status,headers})};
const accepted=()=>reply(200,{ok:true});
async function digest(s:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(d)].map(n=>n.toString(16).padStart(2,"0")).join("")}
Deno.serve(async req=>{
 if(req.headers.get("origin")!==HOST)return reply(403);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply(405);
 if(Deno.env.get("LUMEN_AUTH_MAIL_ENABLED")!=="true")return reply(503,{ok:false,reason:"mail_disabled"});
 const key=Deno.env.get("LUMEN_RESEND_API_KEY")||"";
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const base=Deno.env.get("SUPABASE_URL")||"";
 if(!key||!service||!base)return reply(503,{ok:false,reason:"server_configuration"});
 const raw=await req.text();if(raw.length>4096)return reply(413);
 let input:Record<string,unknown>;try{input=JSON.parse(raw)}catch{return reply(400,{ok:false,reason:"invalid_json"})}
 const email=typeof input.email==="string"?input.email.trim().toLowerCase():"";
 const type=input.type;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(400,{ok:false,reason:"invalid_email"});
 if(!["signup","recovery","magiclink"].includes(String(type)))return reply(400,{ok:false,reason:"invalid_type"});
 // Public Lumen mail requests are guarded by the dedicated atomic per-email and global throttle.
 // The original test-mailbox secret is deliberately ignored during public rollout.
 const password=typeof input.password==="string"?input.password:"";
 if(type==="signup"&&password.length<12)return reply(400,{ok:false,reason:"invalid_password"});
 // Ignore any caller-provided redirect. It is never used as a trusted brand selector.
 // Atomic server-only RPC: reserved on every attempt, failure always blocks delivery.
 try{
  const emailHash=await digest(email);
  const reserved=await fetch(base.replace(/\/$/,"")+"/rest/v1/rpc/lumen_auth_mail_reserve",{
   method:"POST",headers:{"apikey":service,"authorization":"Bearer "+service,"content-type":"application/json"},
   body:JSON.stringify({p_email_hash:emailHash})
  });
  if(!reserved.ok)return reply(503,{ok:false,reason:"throttle_backend"});
  const permitted=await reserved.json();
  if(permitted!==true)return reply(429,{ok:false,reason:"rate_limited"});
 }catch{return reply(503,{ok:false,reason:"throttle_unavailable"})}
 const typeArg=type==="magiclink"?"magiclink":type;
 const payload:Record<string,string>={type:String(typeArg),email,redirect_to:HOST+"/"};
 if(type==="signup")payload.password=password;
 let generated:Record<string,unknown>;
 try{
  const resp=await fetch(base.replace(/\/$/,"")+"/auth/v1/admin/generate_link",{method:"POST",headers:{"apikey":service,"authorization":"Bearer "+service,"content-type":"application/json"},body:JSON.stringify(payload)});
  if(!resp.ok)return type==="signup"?reply(409,{ok:false,reason:"signup_not_available"}):accepted(); // do not falsely confirm signup; keep recovery/legacy enumeration-resistant
  generated=await resp.json();
 }catch{return reply(503,{ok:false,reason:"auth_backend_unavailable"})}
 // GoTrue's REST generate_link response exposes these fields at the top level.
 // The supabase-js admin wrapper instead nests them inside "properties".
 const nested=generated.properties && typeof generated.properties==="object"
  ? generated.properties as Record<string,unknown> : {};
 const action=typeof generated.action_link==="string"?generated.action_link:
  typeof nested.action_link==="string"?nested.action_link:"";
 const otp=typeof generated.email_otp==="string"?generated.email_otp:
  typeof nested.email_otp==="string"?nested.email_otp:"";
 // OTP length is configured by Supabase Auth; retain legacy six-digit codes too.
 if(type==="magiclink"&&!/^\d{6,10}$/.test(otp))return reply(503,{ok:false,reason:"otp_not_generated"});
 let validAction=false;
 try{
  const link=new URL(action),project=new URL(base);
  validAction=link.protocol==="https:" && link.origin===project.origin
   && link.pathname==="/auth/v1/verify" && Boolean(link.searchParams.get("token"))
   && Boolean(link.searchParams.get("type"));
 }catch{}
 if(!validAction)return reply(503,{ok:false,reason:"confirmation_link_unavailable"});
 // Use Lumen's own HTTPS origin for verification, retaining Supabase as the verifier.
 // Only a hashed token is accepted; never put the email OTP in the URL.
 const parsed=new URL(action);
 const hashedToken=parsed.searchParams.get("token")||"";
 const confirmationType=parsed.searchParams.get("type")||"";
 const brandedLink=Deno.env.get("LUMEN_BRANDED_LINKS_ENABLED")==="true" && /^[a-f0-9]{64}$/i.test(hashedToken)&&
  ["signup","recovery","magiclink"].includes(confirmationType)
  ? HOST+"/?lumen_confirm="+encodeURIComponent(hashedToken)+"&type="+encodeURIComponent(confirmationType)
  : action;
 const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
 const title=type==="signup"?"Confirme ton adresse email ✨":type==="recovery"?"Retrouve ton accès à Lumen":"Ton code Lumen";
 const instruction=type==="signup"?"Confirme ton email pour sauvegarder tes étoiles et retrouver ta progression.":
  "Pour retrouver ton accès, utilise le bouton ci-dessous.";
 const button=type==="signup"?"Confirmer mon email":type==="recovery"?"Réinitialiser mon mot de passe":"Continuer sur Lumen";
 const html=type==="magiclink"?undefined:`<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body style="margin:0;padding:32px 16px;background:#07111d;font-family:Arial,Helvetica,sans-serif;color:#eef8ff"><table role="presentation" cellspacing="0" cellpadding="0" style="max-width:520px;margin:auto;background:#102237;border-radius:16px;padding:32px;width:100%"><tr><td><p style="font-size:14px;letter-spacing:3px;color:#92dfff">✦ LUMEN</p><h1 style="font-size:25px;line-height:1.3;color:#ffffff">${escapeHtml(title)}</h1><p style="line-height:1.7;color:#daeaf7">${escapeHtml(instruction)}</p><p style="padding:20px 0"><a href="${escapeHtml(brandedLink)}" style="display:inline-block;padding:14px 24px;background:#f6d67a;color:#142236;font-weight:bold;text-decoration:none;border-radius:8px">${escapeHtml(button)}</a></p><p style="font-size:13px;color:#a8becd">Si tu n'as rien demandé, ignore cet email.</p><p style="font-size:12px;color:#8da9bc">Lumen • lumen.nopuna.fr</p></td></tr></table></body></html>`;
 // Recovery links are preferred for password reset; legacy users receive an OTP.
 const label=type==="signup"?"Confirme ton inscription Lumen":type==="recovery"?"Réinitialise ton mot de passe Lumen":"Ton code de connexion Lumen";
 const text=type==="magiclink"&&/^\d{6,10}$/.test(otp)
  ?"Ton code de connexion Lumen : "+otp+"\n\nSi tu n'as rien demandé, ignore cet email."
  :"Pour continuer sur Lumen, ouvre ce lien : "+brandedLink+"\n\nSi tu n'as rien demandé, ignore cet email.";
 try{
  const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({from:"Lumen <auth@nopuna.fr>",to:[email],subject:label,text,...(html?{html}:{})})});
  if(!sent.ok)return reply(502,{ok:false,reason:"mail_provider_rejected"});
  const result=await sent.json();if(typeof result.id!=="string")return reply(502,{ok:false,reason:"mail_provider_invalid_response"});
 }catch{return reply(502,{ok:false,reason:"mail_provider_unavailable"})}
 return accepted();
});
