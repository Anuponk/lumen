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
  const generated={action_link:BASE+'/auth/v1/verify?token='+('a'.repeat(64))+'&type=magiclink',email_otp:'123456',...settings.generated};
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
    ...(method==='POST'?{body:JSON.stringify(settings.input||{type:'magiclink',email:'fake@example.test'})}:{})});
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
    assert.match(r.calls[2].payload.text,/123456/);assert.equal(r.calls[2].payload.from,'Lumen <auth@nopuna.fr>');
  }
  r=await scenario({generated:{email_otp:''}});assert.equal(r.body.reason,'otp_not_generated');assert.equal(r.calls.length,2);
  r=await scenario({generated:{action_link:'https://evil.invalid/auth/v1/verify?token=fake&type=magiclink'}});
  assert.equal(r.body.reason,'confirmation_link_unavailable');assert.equal(r.calls.length,2);
  r=await scenario({providerStatus:403});assert.equal(r.status,502);assert.equal(r.body.reason,'mail_provider_rejected');assert.equal(r.errors[0][1].reason,'mail_provider_rejected');
  r=await scenario({providerBody:{}});assert.equal(r.body.reason,'mail_provider_invalid_response');
  r=await scenario({providerThrow:true});assert.equal(r.body.reason,'mail_provider_unavailable');
  r=await scenario({env:{LUMEN_BRANDED_LINKS_ENABLED:'true'},input:{type:'recovery',email:'fake@example.test'},generated:{action_link:BASE+'/auth/v1/verify?token='+('b'.repeat(64))+'&type=recovery'}});
  assert.equal(r.status,200);assert.match(r.calls[2].payload.html,/https:\/\/lumen\.nopuna\.fr\/\?lumen_confirm=/);
  assert.doesNotMatch(r.calls[2].payload.html,/123456/);
  // Exercise actual edge handler for every supported length and both Admin shapes.
  for(const nested of [false,true])for(const otp of ['012345','0123456','01234567','012345678','0123456789']){
    r=await scenario({nested,generated:{email_otp:otp}});
    assert.equal(r.status,200);assert.equal(r.calls.length,3);
    assert.equal(r.calls[2].payload.text.split(String.fromCharCode(10))[0],'Ton code de connexion Lumen : '+otp);
    assert.equal(r.errors.length,0,'successful OTP must not be logged');
  }
  for(const otp of ['', '12345','12345678901','12345a','１２３４５６',' 123456','123456\\n',123456,null]){
    r=await scenario({generated:{email_otp:otp}});
    assert.equal(r.body.reason,'otp_not_generated');assert.equal(r.calls.length,2,'invalid OTP never reaches provider');
    assert.deepEqual(Object.keys(r.errors[0][1]).sort(),['reason','status'],'diagnostics must not log OTP or email');
  }
  // Execute the production verification boundary with a mocked Supabase client.
  const cloud=fs.readFileSync('src/persistence/cloud.js','utf8');
  const verifySource=cloud.slice(cloud.indexOf('async function verifyEmailOtp('),cloud.indexOf('async function signOut('));
  const verified=[];
  const verify=vm.runInNewContext('('+verifySource.trim()+')',{model:{lumenSupabase:{auth:{verifyOtp:async value=>{verified.push(value);return {error:null}}}}}});
  for(const code of ['012345','0123456','01234567','012345678','0123456789']){
    const result=await verify(' OLD@EXAMPLE.TEST ',code);assert.equal(result.ok,true);
    assert.equal(verified.at(-1).token,code);assert.equal(verified.at(-1).email,'old@example.test');
    assert.equal(verified.at(-1).type,'email');
  }
  for(const code of ['12345','12345678901','12345a','１２３４５６','']){
    const before=verified.length,result=await verify('old@example.test',code);
    assert.equal(result.reason,'otp');assert.equal(verified.length,before);
  }
  const html=fs.readFileSync('index.html','utf8'),ui=fs.readFileSync('src/ui/game-screen.js','utf8');
  const input=html.match(/<input id="accountOtp"[^>]*>/)?.[0];assert.ok(input);
  assert.match(input,/minlength="6"/);assert.match(input,/maxlength="10"/);
  const pattern=new RegExp('^(?:'+input.match(/pattern="([^"]+)"/)[1]+')$');
  for(const code of ['012345','01234567','0123456789'])assert.equal(pattern.test(code),true);
  for(const code of ['12345','12345678901','12345a'])assert.equal(pattern.test(code),false);
  assert.match(input,/autocomplete="one-time-code"/);assert.match(input,/inputmode="numeric"/);
  assert.ok(html.includes('Entre le code reçu par email (6 à 10 chiffres).'));
  assert.ok(ui.includes('Entre le code reçu par email (6 à 10 chiffres).'));
  assert.doesNotMatch(ui,/code à 6 chiffres/);
  console.log('OTP regressions passed: legacy 6 and configurable 7–10 digits, send/input/verify, leading zeroes, invalid values, provider failures, brand isolation; all requests mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
