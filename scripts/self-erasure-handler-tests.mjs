import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual Edge handler with a synthetic Auth/RPC boundary. No network,
// service credentials, SQL execution or real user deletion is involved.
const source=fs.readFileSync('supabase/functions/lumen-self-erasure/index.ts','utf8')
 .replace(/^import .* from .*;\r?\n/m,'');
function fixture({user={id:'verified-owner'},authError=null,result={status:'erased',barrier:'active',authDeleted:false},rpcError=null}={}){
 let handler;const calls=[];
 const createClient=(_url,key)=>key==='synthetic-public'
  ?{auth:{getUser:async token=>{calls.push({kind:'verify',token});return {data:{user},error:authError}}}}
  :{rpc:async(name,args)=>{calls.push({kind:'erase',name,args});return {data:result,error:rpcError}}};
 vm.runInNewContext(source,{Request,Response,createClient,console:{error(){}},Deno:{
  serve:fn=>{handler=fn},env:{get:key=>({SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'}[key])}
 }});
 const request=({body={confirmation:'SUPPRIMER'},token='synthetic-token',origin='https://lumen.nopuna.fr',method='POST'}={})=>handler(new Request('https://synthetic.invalid/erase',{
  method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})
 }));
 return {calls,request};
}
test('erasure targets only the verified user, ignoring a forged client target',async()=>{
 const f=fixture();const r=await f.request({body:{confirmation:'SUPPRIMER',p_user_id:'victim',userId:'victim'}});
 assert.equal(r.status,200);assert.equal((await r.json()).status,'erased');
 assert.equal(f.calls[0].kind,'verify');assert.equal(f.calls[1].args.p_user_id,'verified-owner');
 assert.equal(f.calls[1].name,'lumen_self_erase');
 assert.equal(r.headers.get('cache-control'),'no-store');
});
test('unverified identity, invalid confirmation, untrusted origin and wrong method never erase',async()=>{
 for(const [options,request,status] of [
  [{},{token:null},401],[{authError:{message:'invalid'},user:null},{},401],
  [{},{body:{confirmation:'no'}},400],[{},{origin:'https://untrusted.invalid'},403],[{},{method:'GET'},405]
 ]){
  const f=fixture(options);assert.equal((await f.request(request)).status,status);
  assert.equal(f.calls.some(c=>c.kind==='erase'),false);
 }
});
test('only an explicit completed erasure acknowledgement can be reported as success',async()=>{
 for(const result of [null,{},[],{status:'pending'},{status:'erased',barrier:'missing'},{status:'erased',barrier:'active',authDeleted:true}]){
  const f=fixture({result});const r=await f.request();
  assert.equal(r.status,409,JSON.stringify(result));assert.notEqual((await r.json()).status,'erased');
 }
 const f=fixture({rpcError:{code:'42501'}});assert.equal((await f.request()).status,409);
});
