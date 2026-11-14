import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual Edge handler with a synthetic Auth/RPC boundary. No network,
// service credentials, SQL execution or real user deletion is involved.
const source=fs.readFileSync('supabase/functions/lumen-self-erasure/index.ts','utf8')
 .replace(/^import .* from .*;\r?\n/m,'');
function fixture({user={id:'verified-owner'},authError=null,result={status:'erased',barrier:'active',authDeleted:false},rpcError=null,deletable=false,deletableError=null,deleteError=null}={}){
 let handler;const calls=[];
 const createClient=(_url,key)=>key==='synthetic-public'
  ?{auth:{getUser:async token=>{calls.push({kind:'verify',token});return {data:{user},error:authError}}}}
  :{rpc:async(name,args)=>{
    if(name==='lumen_account_deletable'){calls.push({kind:'check',name,args});return {data:deletable,error:deletableError}}
    calls.push({kind:'erase',name,args});return {data:result,error:rpcError}},
   auth:{admin:{deleteUser:async id=>{calls.push({kind:'deleteUser',id});return {data:null,error:deleteError}}}}};
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

test('sign-in account is deleted only when the server reports it safe after erasure',async()=>{
 const f=fixture({deletable:true});const r=await f.request({body:{confirmation:'SUPPRIMER',p_user_id:'victim'}});
 assert.equal(r.status,200);const body=await r.json();
 assert.deepEqual([body.status,body.scope,body.details,body.accountDeleted],['erased','lumen','erased',true]);
 assert.deepEqual(f.calls.map(c=>c.kind),['verify','erase','check','deleteUser'],'deletion follows the completed erasure and the safety check');
 assert.equal(f.calls[2].args.p_user_id,'verified-owner');assert.equal(f.calls[3].id,'verified-owner');
});
test('account shared with another app, failed check or failed deletion keeps the sign-in account',async()=>{
 for(const options of [{deletable:false},{deletable:null},{deletable:'true'},{deletable:true,deletableError:{code:'42501'}},{deletable:true,deleteError:{status:500}}]){
  const f=fixture(options);const r=await f.request();
  assert.equal(r.status,200,JSON.stringify(options));const body=await r.json();
  assert.equal(body.status,'erased');assert.equal(body.accountDeleted,false,JSON.stringify(options));
  if(!(options.deletable===true&&!options.deletableError))assert.equal(f.calls.some(c=>c.kind==='deleteUser'),false,JSON.stringify(options));
 }
});
test('no account check or deletion happens unless the Lumen erasure is acknowledged',async()=>{
 for(const options of [{result:{status:'pending'},deletable:true},{rpcError:{code:'42501'},deletable:true},{authError:{message:'invalid'},user:null,deletable:true}]){
  const f=fixture(options);await f.request();
  assert.equal(f.calls.some(c=>c.kind==='check'||c.kind==='deleteUser'),false,JSON.stringify(options));
 }
});
