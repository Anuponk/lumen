// Lumen-only auth mail sender. PREPARATION ONLY: not deployed and disabled by default.
// Never enable without server-side abuse controls and isolated E2E validation.
const json=(status,body={ok:false})=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const origin="https://lumen.nopuna.fr";
Deno.serve(async req=>{
 if(req.method!=="POST")return json(405);
 if(Deno.env.get("LUMEN_AUTH_MAIL_ENABLED")!=="true")return json(503);
 // No public endpoint until rate limiting and a human-verification gate are configured.
 const captchaSecret=Deno.env.get("LUMEN_TURNSTILE_SECRET")||"";
 const resendKey=Deno.env.get("LUMEN_RESEND_API_KEY")||"";
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
 if(!captchaSecret||!resendKey||!serviceKey||!supabaseUrl)return json(503);
 if(req.headers.get("origin")!==origin)return json(403);
 const len=Number(req.headers.get("content-length")||0);if(len>8192)return json(413);
 let body;try{body=await req.json()}catch{return json(400)}
 const email=typeof body.email==="string"?body.email.trim().toLowerCase():"";
 const type=body.type;
 const captcha=body.captchaToken;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["recovery","magiclink"].includes(type)||typeof captcha!=="string"||captcha.length<10)return json(400);
 // Cloudflare verification does not replace IP/email limits; deployment must add a durable limiter.
 const form=new FormData();form.set("secret",captchaSecret);form.set("response",captcha);
 const ip=req.headers.get("cf-connecting-ip");if(ip)form.set("remoteip",ip);
 let verified;try{const resp=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:form});verified=await resp.json()}catch{return json(503)}
 if(!verified?.success)return json(403);
 // fail closed: rate limiter is not implemented yet. Do not generate sensitive links.
 return json(503,{ok:false,reason:"rate_limiter_not_configured"});
});
