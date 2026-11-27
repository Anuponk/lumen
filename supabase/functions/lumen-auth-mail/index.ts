// Lumen-only auth email endpoint. Never configure the project-wide Send Email Hook.
// Requires Resend and Supabase service-role secrets; throttle uses private Postgres RPC. Deploy with JWT verification disabled
// only after the dedicated server-side rate limits and end-to-end flows are validated.
const HOST="https://lumen.nopuna.fr";
const headers={"content-type":"application/json","cache-control":"no-store","access-control-allow-origin":HOST,"access-control-allow-headers":"content-type,apikey,authorization","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"};
const reply=(status:number,body:Record<string,unknown>={ok:false})=>{if(status>=500)console.error("[lumen-auth-mail] failure",{status,reason:typeof body.reason==="string"?body.reason:"upstream_mail_failure"});return new Response(JSON.stringify(body),{status,headers})};
const accepted=()=>reply(200,{ok:true});
async function digest(s:string){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return [...new Uint8Array(d)].map(n=>n.toString(16).padStart(2,"0")).join("")}
const mailCopy = {
 fr: {
  signup: ["Confirme ton adresse email ✨", "Confirme ton email pour sauvegarder tes étoiles et retrouver ta progression.", "Confirmer mon email", "Confirme ton inscription Lumen"],
  recovery: ["Retrouve ton accès à Lumen", "Pour retrouver ton accès, utilise le bouton ci-dessous.", "Réinitialiser mon mot de passe", "Réinitialise ton mot de passe Lumen"],
  ignore: "Si tu n'as rien demandé, ignore cet email.", open: "Pour continuer sur Lumen, ouvre ce lien :",
 },
 en: {
  signup: ["Confirm your email address ✨", "Confirm your email to save your stars and keep your progress.", "Confirm my email", "Confirm your Lumen sign-up"],
  recovery: ["Get back into Lumen", "Use the button below to reset your password.", "Reset my password", "Reset your Lumen password"],
  ignore: "If you didn't request this, ignore this email.", open: "To continue in Lumen, open this link:",
 },
 es: {
  signup: ["Confirma tu correo electrónico ✨", "Confirma tu correo para guardar tus estrellas y recuperar tu progreso.", "Confirmar mi correo", "Confirma tu registro en Lumen"],
  recovery: ["Recupera tu acceso a Lumen", "Usa el botón de abajo para restablecer tu contraseña.", "Restablecer mi contraseña", "Restablece tu contraseña de Lumen"],
  ignore: "Si no has solicitado nada, ignora este correo.", open: "Para continuar en Lumen, abre este enlace:",
 },
} as const;

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
 if(!["signup","recovery"].includes(String(type)))return reply(400,{ok:false,reason:"invalid_type"});
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
 const typeArg=type;
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
 let validAction=false;
 try{
  const link=new URL(action),project=new URL(base);
  validAction=link.protocol==="https:" && link.origin===project.origin
   && link.pathname==="/auth/v1/verify" && Boolean(link.searchParams.get("token"))
   && link.searchParams.get("type")===type;
 }catch{}
 if(!validAction)return reply(503,{ok:false,reason:"confirmation_link_unavailable"});
 // Use Lumen's own HTTPS origin for verification, retaining Supabase as the verifier.
 // Only a hashed token is accepted; never put the email OTP in the URL.
 const parsed=new URL(action);
 const hashedToken=parsed.searchParams.get("token")||"";
 const confirmationType=parsed.searchParams.get("type")||"";
 const useBrandedLink=Deno.env.get("LUMEN_BRANDED_LINKS_ENABLED")==="true" && /^[a-f0-9]{64}$/i.test(hashedToken)&&
  ["signup","recovery"].includes(confirmationType);
 let dailySignupDay="";
 const guest=input.dailyGuest&&typeof input.dailyGuest==="object"?input.dailyGuest as Record<string,unknown>:null;
 const createdUser=generated.user&&typeof generated.user==="object"?generated.user as Record<string,unknown>:generated;
 if(type==="signup"&&useBrandedLink&&guest&&typeof guest.day==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(guest.day)&&
    typeof guest.key==="string"&&/^[a-f0-9]{64}$/.test(guest.key)&&
    typeof createdUser.id==="string"&&/^[a-f0-9-]{36}$/.test(createdUser.id)){
  try{
   const binding=await fetch(base.replace(/\/$/,"")+"/rest/v1/rpc/lumen_daily_guest_bind_signup",{
    method:"POST",headers:{"apikey":service,"authorization":"Bearer "+service,"content-type":"application/json"},
    body:JSON.stringify({p_day:guest.day,p_key:guest.key,p_owner:createdUser.id})
   });
   if(binding.ok&&(await binding.json())===true)dailySignupDay=guest.day;
  }catch{
   // Email confirmation still works, and the original browser keeps the receipt.
  }
 }
 const brandedLink=useBrandedLink
  ? HOST+"/?lumen_confirm="+encodeURIComponent(hashedToken)+"&type="+encodeURIComponent(confirmationType)+
    (dailySignupDay?"&daily_signup="+encodeURIComponent(dailySignupDay):"")
  : action;
 const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
 const locale=input.locale==="en"||input.locale==="es"?input.locale:"fr";
 const copy=mailCopy[locale];
 const [title,instruction,button,label]=type==="signup"?copy.signup:copy.recovery;
 const html=`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"></head><body style="margin:0;padding:32px 16px;background:#07111d;font-family:Arial,Helvetica,sans-serif;color:#eef8ff"><table role="presentation" cellspacing="0" cellpadding="0" style="max-width:520px;margin:auto;background:#102237;border-radius:16px;padding:32px;width:100%"><tr><td><p style="font-size:14px;letter-spacing:3px;color:#92dfff">✦ LUMEN</p><h1 style="font-size:25px;line-height:1.3;color:#ffffff">${escapeHtml(title)}</h1><p style="line-height:1.7;color:#daeaf7">${escapeHtml(instruction)}</p><p style="padding:20px 0"><a href="${escapeHtml(brandedLink)}" style="display:inline-block;padding:14px 24px;background:#f6d67a;color:#142236;font-weight:bold;text-decoration:none;border-radius:8px">${escapeHtml(button)}</a></p><p style="font-size:13px;color:#a8becd">${escapeHtml(copy.ignore)}</p><p style="font-size:12px;color:#8da9bc">Lumen • lumen.nopuna.fr</p></td></tr></table></body></html>`;
 const text=copy.open+" "+brandedLink+"\n\n"+copy.ignore;
 try{
  const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"authorization":"Bearer "+key,"content-type":"application/json"},body:JSON.stringify({from:"Lumen <auth@nopuna.fr>",to:[email],subject:label,text,...(html?{html}:{})})});
  if(!sent.ok)return reply(502,{ok:false,reason:"mail_provider_rejected"});
  const result=await sent.json();if(typeof result.id!=="string")return reply(502,{ok:false,reason:"mail_provider_invalid_response"});
 }catch{return reply(502,{ok:false,reason:"mail_provider_unavailable"})}
 return accepted();
});
