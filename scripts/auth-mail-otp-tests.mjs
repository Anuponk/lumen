// Deployment smoke checks; all Auth, throttle and email-provider requests are simulated.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/lumen-auth-mail/index.ts','utf8'));
const HOST='https://lumen.nopuna.fr', BASE='https://project.supabase.co';
async function scenario(settings={}) {
  let handler;const calls=[],errors=[];
  const env={LUMEN_AUTH_MAIL_ENABLED:'true',LUMEN_RESEND_API_KEY:'fake-only',SUPABASE_SERVICE_ROLE_KEY:'fake-only',SUPABASE_URL:BASE,...settings.env};
  const generated={action_link:BASE+'/auth/v1/verify?token='+('a'.repeat(64))+'&type='+(settings.input?.type||'recovery'),email_otp:'123456',...settings.generated};
  vm.runInNewContext(source,{
    Deno:{env:{get:key=>env[key]},serve:fn=>handler=fn},crypto:webcrypto,TextEncoder,URL,Response,
    console:{error:(...args)=>errors.push(args)},
    fetch:async(url,options)=>{
      calls.push({url,payload:JSON.parse(options.body)});
      if(url.includes('/rpc/'))return new Response(JSON.stringify(settings.permitted??true),{status:settings.throttleStatus||200});
      if(url.includes('/generate_link'))return new Response(JSON.stringify(settings.nested?{properties:generated}:generated),{status:settings.authStatus||200});
      assert.equal(url,'https://api.resend.com/emails');
      if(settings.providerThrow)throw Error('simulated network error');
      return new Response(JSON.stringify(settings.providerBody??{id:'fake-message-id'}),{status:settings.providerStatus||200});
    }
  },{filename:'lumen-auth-mail/index.ts'});
  const method=settings.method||'POST';
  const request=new Request(BASE+'/functions/v1/lumen-auth-mail',{method,
    headers:{origin:settings.origin||HOST,'content-type':'application/json'},
    ...(method==='POST'?{body:JSON.stringify(settings.input||{type:'recovery',email:'fake@example.test'})}:{})});
  const response=await handler(request);
  return {status:response.status,body:response.status===204?null:await response.json(),calls,errors};
}
(async()=>{
  let r=await scenario({method:'OPTIONS'});assert.equal(r.status,204);assert.equal(r.calls.length,0);
  r=await scenario({origin:'https://other.invalid'});assert.equal(r.status,403);assert.equal(r.calls.length,0);
  r=await scenario({env:{LUMEN_AUTH_MAIL_ENABLED:'false'}});assert.equal(r.body.reason,'mail_disabled');assert.equal(r.calls.length,0);
  r=await scenario({env:{LUMEN_RESEND_API_KEY:''}});assert.equal(r.body.reason,'server_configuration');assert.equal(r.calls.length,0);
  r=await scenario({input:{type:'magiclink',email:'invalid'}});assert.equal(r.status,400);assert.equal(r.calls.length,0);
  r=await scenario({input:{type:'signup',email:'fake@example.test',password:'short'}});assert.equal(r.body.reason,'invalid_password');assert.equal(r.calls.length,0);
  r=await scenario({permitted:false});assert.equal(r.status,429);assert.equal(r.calls.length,1);
  r=await scenario({throttleStatus:500});assert.equal(r.body.reason,'throttle_backend');assert.equal(r.calls.length,1);
  for(const nested of [false,true]){
    r=await scenario({nested});assert.equal(r.status,200);assert.equal(r.calls.length,3);
    assert.match(r.calls[2].payload.text,/https:/);assert.equal(r.calls[2].payload.from,'Lumen <auth@nopuna.fr>');
  }
  r=await scenario({input:{type:'magiclink',email:'fake@example.test'}});assert.equal(r.body.reason,'invalid_type');assert.equal(r.calls.length,0);
  r=await scenario({generated:{action_link:'https://evil.invalid/auth/v1/verify?token=fake&type=magiclink'}});
  assert.equal(r.body.reason,'confirmation_link_unavailable');assert.equal(r.calls.length,2);
  r=await scenario({providerStatus:403});assert.equal(r.status,502);assert.equal(r.body.reason,'mail_provider_rejected');assert.equal(r.errors[0][1].reason,'mail_provider_rejected');
  r=await scenario({providerBody:{}});assert.equal(r.body.reason,'mail_provider_invalid_response');
  r=await scenario({providerThrow:true});assert.equal(r.body.reason,'mail_provider_unavailable');
  r=await scenario({env:{LUMEN_BRANDED_LINKS_ENABLED:'true'},input:{type:'recovery',email:'fake@example.test'},generated:{action_link:BASE+'/auth/v1/verify?token='+('b'.repeat(64))+'&type=recovery'}});
  assert.equal(r.status,200);assert.match(r.calls[2].payload.html,/https:\/\/lumen\.nopuna\.fr\/\?lumen_confirm=/);
  assert.doesNotMatch(r.calls[2].payload.html,/123456/);
  r=await scenario({input:{type:'signup',email:'fake@example.test',password:'a-valid-password'}});assert.equal(r.status,200);assert.equal(r.calls[1].payload.password,'a-valid-password');
  console.log('Lumen mail regressions passed: signup/recovery, blocked passwordless login, rate limits, provider failures and brand isolation; all requests mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
