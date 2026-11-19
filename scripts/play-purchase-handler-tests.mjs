import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {generateKeyPairSync,createHash,createVerify} from 'node:crypto';

// #729: execute the real Edge handler with synthetic Auth, RPC and Google boundaries.
// No network, no real credentials, no SQL. A generated RSA key proves the Google
// service-account assertion is really signed.
const source=fs.readFileSync('supabase/functions/lumen-play-purchase/index.ts','utf8').replace(/^import .* from .*;\r?\n/gm,'');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const account={client_email:'verifier@synthetic.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'})};
const sha=t=>createHash('sha256').update(t).digest('hex');

function fixture({user={id:'verified-player'},product={product_id:'real-adventure-02',kind:'adventure',price_cents:100,currency:'EUR',active:true},
 purchase={purchaseState:0,acknowledgementState:0,purchaseTimeMillis:'1763200000000',regionCode:'FR',orderId:'GPA.1'},googleStatus=200,bound=true,
 order={orderId:'GPA.1',purchaseToken:'play-token-1',state:'PROCESSED',lineItems:[{productId:'real_adventure_02',total:{currencyCode:'EUR',units:'1',nanos:190000000}}]},orderStatus=200,
 recordError=null,ackOk=true,ackJobs=[],voided=[[]],known={},bindings={},claims={},env={},secretsMissing=false}={}){
 let handler;const calls=[];
 const createClient=(_url,key)=>key==='synthetic-public'
  ?{auth:{getUser:async token=>{calls.push({kind:'auth',token});return {data:{user},error:user?null:{message:'invalid'}}}}}
  :{rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});
    if(name==='lumen_record_play_purchase' || name==='lumen_record_play_purchase_with_ack'){
     const original=known[args.p_provider_ref];
     if(recordError)return {data:null,error:recordError};
     if(!original&&!product?.active)return {data:null,error:{message:'unknown product'}};
     return {data:{status:original?.status??'paid',adventures:['real-adventure-02'],purchase_id:'synthetic-purchase'},error:null};
    }
    if(name==='lumen_claim_play_acknowledgements')return {data:args.p_purchase_id?
      [{purchase_id:args.p_purchase_id,product_id:'real-adventure-02',purchase_token:'play-token-1',attempt:1}]:ackJobs,error:null};
    if(name==='lumen_complete_play_acknowledgement' || name==='lumen_prune_play_acknowledgements')return {data:null,error:null};
    if(name==='lumen_purchase_by_ref')return {data:known[args.p_provider_ref]||null,error:null};
    if(name==='lumen_play_account_by_binding')return {data:bindings[args.p_account_binding]??null,error:null};
    if(name==='lumen_record_purchase')return recordError?{data:null,error:recordError}:{data:{adventures:['real-adventure-02']},error:null};
    throw Error('unexpected rpc '+name)}};
 let page=0;
 const fetch=async(url,init={})=>{
  if(url==='https://oauth2.googleapis.com/token'){
   const assertion=new URLSearchParams(init.body).get('assertion'),[h,p,s]=assertion.split('.');
   const ok=createVerify('RSA-SHA256').update(h+'.'+p).verify(publicKey,Buffer.from(s,'base64url'));
   const claims=JSON.parse(Buffer.from(p,'base64url'));
   calls.push({kind:'oauth',ok,scope:claims.scope,iss:claims.iss});
   return new Response(JSON.stringify(ok?{access_token:'google-access'}:{}),{status:ok?200:401});
  }
  calls.push({kind:'google',url,method:init.method||'GET',auth:init.headers?.authorization});
  if(url.includes('/orders/'))return new Response(JSON.stringify(order),{status:orderStatus});
  if(url.includes(':acknowledge'))return new Response('{}',{status:ackOk?200:500});
  if(url.includes('/voidedpurchases')){const body=voided[page]||[];const next=page+1<voided.length?String(page+1):'';page++;
   return new Response(JSON.stringify({voidedPurchases:body,...(next?{tokenPagination:{nextPageToken:next}}:{})}),{status:200})}
  return new Response(JSON.stringify(bound?{obfuscatedExternalAccountId:sha('lumen-play:verified-player'),...purchase}:purchase),{status:googleStatus});
 };
 const values={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',
  LUMEN_PLAY_SERVICE_ACCOUNT:secretsMissing?'':JSON.stringify(account),LUMEN_PLAY_CRON_SECRET:'cron-secret',...env};
 vm.runInNewContext(source,{Request,Response,AbortSignal,URL,URLSearchParams,TextDecoder,TextEncoder,crypto:globalThis.crypto,atob,btoa,Uint8Array,JSON,Number,String,Date,Math,Error,
  createRemoteJWKSet:()=>({}),jwtVerify:async(token,keys,options)=>{
   if(token!=='provider-token')throw Error('invalid signature');
   calls.push({kind:'oidc',options});
   return {payload:{email:'play-push@synthetic.iam.gserviceaccount.com',email_verified:true,...claims}};
  },createClient,fetch,console:{error(){},warn(){},info(){}},Deno:{serve:fn=>{handler=fn},env:{get:k=>values[k]}}});
 const request=({body={mode:'verify',productId:'real_adventure_02',purchaseToken:'play-token-1'},token='player-token',origin='https://lumen.nopuna.fr',method='POST',headers={},path='/play'}={})=>
  handler(new Request('https://synthetic.invalid'+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{}),...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
 return {calls,request};
}
const receiptRpc='lumen_record_play_purchase_with_ack';
const records=(calls,name=receiptRpc)=>JSON.parse(JSON.stringify(calls.filter(c=>c.kind==='rpc'&&c.name===name).map(c=>c.args))); // vm realm

const rtdnConfig={
 LUMEN_PLAY_RTDN_AUDIENCE:'https://synthetic.invalid/lumen-play-purchase/rtdn',
 LUMEN_PLAY_RTDN_EMAIL:'play-push@synthetic.iam.gserviceaccount.com',
 LUMEN_PLAY_RTDN_SUBSCRIPTION:'projects/synthetic/subscriptions/lumen-play'
};
const event={packageName:'com.nopuna.lumen',oneTimeProductNotification:{notificationType:1,sku:'real_adventure_02',purchaseToken:'play-token-1'}};
const push=(f,notification=event,overrides={})=>f.request({
 path:'/functions/v1/lumen-play-purchase/rtdn',origin:null,token:'provider-token',
 body:{subscription:rtdnConfig.LUMEN_PLAY_RTDN_SUBSCRIPTION,message:{messageId:'42',data:Buffer.from(JSON.stringify(notification)).toString('base64')}},
 ...overrides
});
test('an authenticated Play notification verifies and records a bound purchase without a client session',async()=>{
 const opts={env:rtdnConfig,bindings:{[sha('lumen-play:verified-player')]:'verified-player'}};
 const f=fixture(opts);
 assert.equal((await push(f)).status,204);
 assert.equal(records(f.calls)[0]?.p_user_id,'verified-player');
 assert(!f.calls.some(c=>c.kind==='auth'));
 const options=f.calls.find(c=>c.kind==='oidc')?.options;
 assert.equal(options.audience,rtdnConfig.LUMEN_PLAY_RTDN_AUDIENCE);
 assert.equal(options.algorithms[0],'RS256');
 assert.equal((await push(f,event,{token:'attacker'})).status,401);
 const wrongEmail=fixture({...opts,claims:{email:'other@synthetic.iam.gserviceaccount.com'}});
 assert.equal((await push(wrongEmail)).status,403);
 assert.deepEqual(records(wrongEmail.calls),[]);
});
test('unowned Play purchases never create rights; temporary Google errors leave RTDN retryable',async()=>{
 const denied=fixture({env:rtdnConfig,bound:false});
 assert.equal((await push(denied)).status,204);
 assert.deepEqual(records(denied.calls),[]);
 const failed=fixture({env:rtdnConfig,googleStatus:500});
 assert.equal((await push(failed)).status,503);
 assert.deepEqual(records(failed.calls),[]);
});
test('RTDN refunds reread the current order and never acknowledge a stale or mismatched notification',async()=>{
 const original={user_id:'verified-player',product_id:'real-adventure-02',amount_cents:100,currency:'EUR',status:'paid'};
 const known={[sha('play-token-1')]:original};
 const notification={packageName:event.packageName,
  voidedPurchaseNotification:{productType:2,refundType:1,orderId:'GPA.1',purchaseToken:'play-token-1'}};
 const order={state:'REFUNDED',orderId:'GPA.1',purchaseToken:'play-token-1',lineItems:[{productId:'real_adventure_02'}]};
 const paid=fixture({env:rtdnConfig,known});
 assert.equal((await push(paid,notification)).status,503);
 assert.deepEqual(records(paid.calls,'lumen_record_purchase'),[]);
 assert.deepEqual(records(paid.calls),[]);
 assert(!paid.calls.some(c=>c.url?.endsWith(':acknowledge')));
 const refunded=fixture({env:rtdnConfig,known,order});
 assert.equal((await push(refunded,notification)).status,204);
 assert.equal(records(refunded.calls,'lumen_record_purchase')[0]?.p_status,'refunded');
 const replay=fixture({env:rtdnConfig,known:{[sha('play-token-1')]:{...original,status:'refunded'}},order});
 assert.equal((await push(replay,notification)).status,204);
 assert.deepEqual(records(replay.calls,'lumen_record_purchase'),[]);
 const unmatched=fixture({env:rtdnConfig});
 assert.equal((await push(unmatched,notification)).status,503,'a refund can be delivered before the receipt');
 const mismatch=fixture({env:rtdnConfig,known,order:{...order,purchaseToken:'other'}});
 assert.equal((await push(mismatch,notification)).status,503);
 assert.deepEqual(records(mismatch.calls,'lumen_record_purchase'),[]);
});
test('pending, cancelled, test and foreign RTDN messages cannot create rights',async()=>{
 const pending=fixture({env:rtdnConfig,purchase:{purchaseState:2}});
 assert.equal((await push(pending)).status,503);
 assert.deepEqual(records(pending.calls),[]);
 const cancelled=fixture({env:rtdnConfig,purchase:{purchaseState:1}});
 const cancellation={...event,oneTimeProductNotification:{...event.oneTimeProductNotification,notificationType:2}};
 assert.equal((await push(cancelled,cancellation)).status,204);
 assert.deepEqual(records(cancelled.calls),[]);
 const neutral=fixture({env:rtdnConfig});
 assert.equal((await push(neutral,{packageName:event.packageName,testNotification:{version:'1.0'}})).status,204);
 assert.equal((await push(neutral,{...event,packageName:'com.example.other'})).status,204);
 assert.equal((await push(neutral,event,{body:{subscription:'projects/other/subscriptions/other'}})).status,403);
 assert.equal((await push(neutral,event,{token:null})).status,401);
 assert(!neutral.calls.some(c=>c.kind==='rpc'||c.kind==='google'));
});

test('a paid Play purchase is verified with Google, recorded for the verified player, then acknowledged',async()=>{
 const f=fixture();const r=await f.request({body:{mode:'verify',productId:'real_adventure_02',purchaseToken:'play-token-1',userId:'someone-else'}});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'paid',acknowledged:true,adventures:['real-adventure-02']});
 assert.deepEqual(records(f.calls),[{p_provider_ref:sha('play-token-1'),p_user_id:'verified-player',p_product_id:'real-adventure-02',
  p_settled_amount:'1.190000000',p_settled_currency:'EUR',p_counts_toward_cap:true,p_test_purchase:false,
  p_purchased_at:new Date(1763200000000).toISOString(),p_purchase_token:'play-token-1',p_acknowledged:false}],'Identity from Auth and settlement from Google');
 const oauth=f.calls.find(c=>c.kind==='oauth');assert.equal(oauth.ok,true,'Assertion is RS256-signed with the service account');assert.match(oauth.scope,/androidpublisher/);
 const google=f.calls.filter(c=>c.kind==='google');
 assert.match(google[0].url,/applications\/com\.nopuna\.lumen\/purchases\/products\/real_adventure_02\/tokens\/play-token-1$/);assert.equal(google[0].auth,'Bearer google-access');
 assert.match(google[1].url,/\/orders\/GPA\.1$/);
 assert(f.calls.indexOf(google[1])<f.calls.findIndex(c=>c.name===receiptRpc));
 assert(f.calls.findIndex(c=>c.name===receiptRpc)<f.calls.findIndex(c=>c.url?.endsWith(':acknowledge')));
});
test('the Play receipt owns its currency and exact amount, independently of the web price',async()=>{
 for(const [money,amount] of [[{currencyCode:'JPY',units:'180'},'180.000000000'],[{currencyCode:'KWD',units:'2',nanos:125000000},'2.125000000']]){
  const f=fixture({product:{active:true,price_cents:999,currency:'EUR'},order:{orderId:'GPA.1',purchaseToken:'play-token-1',state:'PROCESSED',lineItems:[{productId:'real_adventure_02',total:money}]}});
  assert.equal((await f.request()).status,200);
  const receipt=f.calls.find(c=>c.name===receiptRpc);
  assert.equal(receipt?.args.p_settled_amount,amount);
  assert.equal(receipt?.args.p_settled_currency,money.currencyCode);
 }
});
test('already acknowledged purchases are not acknowledged twice; failed acknowledgement is reported, not hidden',async()=>{
 let f=fixture({purchase:{purchaseState:0,acknowledgementState:1,orderId:'GPA.1'}});assert.equal((await f.request()).status,200);
 assert(!f.calls.some(c=>c.kind==='google'&&c.url.endsWith(':acknowledge')));
 f=fixture({ackOk:false});const r=await f.request();assert.equal((await r.json()).acknowledged,false);
});
test('an unacknowledged payment is recorded with a durable retry before contacting acknowledge',async()=>{
 const f=fixture({ackOk:false});
 assert.equal((await (await f.request()).json()).acknowledged,false);
 const record=f.calls.find(c=>c.name==='lumen_record_play_purchase_with_ack');
 assert.equal(record?.args.p_purchase_token,'play-token-1');
 assert.equal(record?.args.p_acknowledged,false);
 assert(f.calls.indexOf(record)<f.calls.findIndex(c=>c.url?.endsWith(':acknowledge')));
 assert.deepEqual(records(f.calls,'lumen_complete_play_acknowledgement'),[]);
});
test('the scheduler can acknowledge after a restart and does not do so for pending purchases',async()=>{
 const job={purchase_id:'synthetic-purchase',product_id:'real-adventure-02',purchase_token:'play-token-1',attempt:2};
 const request={body:{mode:'acknowledge'},token:null,headers:{'x-lumen-cron':'cron-secret'}};
 const f=fixture({ackJobs:[job]});
 assert.equal((await f.request({...request,headers:{'x-lumen-cron':'wrong'}})).status,401);
 assert.deepEqual(await (await f.request(request)).json(),{status:'synced',acknowledged:1,retry:0});
 assert.deepEqual(records(f.calls,'lumen_complete_play_acknowledgement'),[{p_purchase_id:job.purchase_id,p_attempt:2}]);
 const pending=fixture({ackJobs:[job],purchase:{purchaseState:2}});
 assert.deepEqual(await (await pending.request(request)).json(),{status:'synced',acknowledged:0,retry:1});
 assert(!pending.calls.some(c=>c.url?.endsWith(':acknowledge')));
});
test('pending, cancelled, unknown and unavailable purchases record nothing',async()=>{
 for(const [opts,status,body] of [[{purchase:{purchaseState:2}},202,{status:'pending'}],[{purchase:{purchaseState:1}},409,{status:'not_paid'}],
  [{googleStatus:404},400,{error:'invalid_purchase'}],[{googleStatus:500},502,{error:'google_unavailable'}]]){
  const f=fixture(opts);const r=await f.request();assert.equal(r.status,status);assert.deepEqual(await r.json(),body);assert.deepEqual(records(f.calls),[]);
 }
});
test('a token already recorded for another account is refused and not acknowledged',async()=>{
 const f=fixture({recordError:{code:'22023',message:'purchase identity conflict'}});const r=await f.request();
 assert.equal(r.status,409);assert.deepEqual(await r.json(),{error:'purchase_owned_elsewhere'});
 assert(!f.calls.some(c=>c.kind==='google'&&c.url.endsWith(':acknowledge')));
});
test('a purchase outside the EUR region grants its product but never counts towards the EUR cap',async()=>{
 const f=fixture({purchase:{purchaseState:0,acknowledgementState:1,regionCode:'BE',orderId:'GPA.1'}});
 assert.equal((await f.request()).status,200);
 assert.equal(records(f.calls)[0].p_counts_toward_cap,false);
 assert.equal(records(f.calls)[0].p_settled_amount,'1.190000000');
 assert.equal(records(f.calls)[0].p_settled_currency,'EUR');
});
test('boundary refusals: method, origin, session, request shape, product and missing secrets',async()=>{
 let f=fixture();assert.equal((await f.request({method:'OPTIONS'})).status,204);
 assert.equal((await f.request({method:'GET'})).status,405);
 assert.equal((await f.request({origin:'https://evil.example'})).status,403);
 assert.equal((await f.request({token:null})).status,401);
 f=fixture({user:null});assert.equal((await f.request()).status,401);
 for(const body of [{mode:'verify',productId:'Real Adventure',purchaseToken:'t'},{mode:'verify',productId:'real_adventure_02',purchaseToken:''},{mode:'verify',productId:'real_adventure_02'}]){
  f=fixture();assert.equal((await f.request({body})).status,400);assert.deepEqual(records(f.calls),[]);
 }
 f=fixture({product:null});assert.deepEqual(await (await f.request()).json(),{error:'unknown_product'});
 f=fixture({product:{product_id:'real-adventure-02',active:false,price_cents:100,currency:'EUR'}});assert.equal((await f.request()).status,400);
 f=fixture({secretsMissing:true});assert.equal((await f.request()).status,503);
});
test('missing or unverified order data never grants or acknowledges a real purchase',async()=>{
 for(const [options,status] of [[{orderStatus:404},202],[{orderStatus:403},502],
   [{order:{state:'REFUNDED',orderId:'GPA.1',purchaseToken:'play-token-1',lineItems:[{productId:'real_adventure_02',total:{currencyCode:'EUR',units:'1'}}]}},409],[{order:{state:'PROCESSED',orderId:'GPA.1',purchaseToken:'other',lineItems:[]}},502],
   [{purchase:{purchaseState:0,quantity:2,orderId:'GPA.1'}},409]]){
  const f=fixture(options);
  assert.equal((await f.request()).status,status);
  assert.deepEqual(records(f.calls),[]);
  assert(!f.calls.some(c=>c.url?.endsWith(':acknowledge')));
 }
});
test('historical and license-test purchases do not invent a settlement',async()=>{
 const known={[sha('play-token-1')]:{user_id:'verified-player',product_id:'real-adventure-02',status:'paid'}};
 for(const options of [{known,purchase:{purchaseState:0},orderStatus:403},{purchase:{purchaseState:0,purchaseType:0}}]){
  const f=fixture(options);
  assert.equal((await f.request()).status,200);
  assert.equal(records(f.calls)[0].p_settled_amount,null);
  assert.equal(records(f.calls)[0].p_settled_currency,null);
  assert(!f.calls.some(c=>c.url?.includes('/orders/')));
 }
 const f=fixture({known:{[sha('play-token-1')]:{...Object.values(known)[0],status:'refunded'}}});
 assert.equal((await f.request()).status,409);
 assert(!f.calls.some(c=>c.url?.endsWith(':acknowledge')));
});
test('voided purchases are replayed as refunds with their original identity, behind the operator secret',async()=>{
 const refT='voided-1',unknownT='voided-unknown',doneT='voided-done';
 const known={[sha(refT)]:{user_id:'u1',product_id:'real-adventure-03',amount_cents:100,currency:'EUR',status:'paid',purchased_at:'2026-11-15T10:00:00Z'},
  [sha(doneT)]:{user_id:'u2',product_id:'real-adventure-04',amount_cents:100,currency:'EUR',status:'refunded',purchased_at:'2026-11-15T10:00:00Z'}};
 let f=fixture({voided:[[{purchaseToken:refT},{purchaseToken:unknownT}],[{purchaseToken:doneT}]],known});
 assert.equal((await f.request({body:{mode:'voided'},token:null,headers:{'x-lumen-cron':'wrong'}})).status,401);
 const r=await f.request({body:{mode:'voided'},token:null,headers:{'x-lumen-cron':'cron-secret'}});
 assert.deepEqual(await r.json(),{status:'synced',seen:3,refunded:1,unknown:1},'Pagination followed; unknown and already refunded skipped');
 assert.deepEqual(records(f.calls,'lumen_record_purchase'),[{p_provider:'play',p_provider_ref:sha(refT),p_user_id:'u1',p_product_id:'real-adventure-03',p_amount_cents:100,p_currency:'EUR',p_status:'refunded',p_purchased_at:'2026-11-15T10:00:00Z'}]);
});

test('an unbound Play token cannot create an entitlement for the first caller',async()=>{
 const f=fixture({bound:false,purchase:{purchaseState:0,orderId:'GPA.1'}});
 const r=await f.request();
 assert.equal(r.status,409);
 assert.deepEqual(await r.json(),{error:'purchase_account_unverified'});
 assert.deepEqual(records(f.calls),[]);
 assert(!f.calls.some(c=>c.url?.endsWith(':acknowledge')));
});

test('an already recorded Play purchase cancelled by Google expires its purchase right',async()=>{
 const known={[sha('play-token-1')]:{user_id:'verified-player',product_id:'real-adventure-02',amount_cents:100,currency:'EUR',status:'paid'}};
 const f=fixture({known,purchase:{purchaseState:1}});
 const r=await f.request();
 assert.equal(r.status,409);
 assert.deepEqual(await r.json(),{status:'not_paid',revoked:true});
 assert.equal(records(f.calls,'lumen_record_purchase')[0]?.p_status,'refunded');
});

test('only the independently reconciled account can restore a legacy order',async()=>{
 const env={LUMEN_PLAY_RECOVERY_ORDERS:JSON.stringify({'GPA.1':'verified-player'})};
 const f=fixture({bound:false,env});
 assert.equal((await f.request()).status,200);
 assert.equal(records(f.calls)[0].p_user_id,'verified-player');
 for(const bound of [true,false]){
  const other=fixture({bound,env,user:{id:'other-player'}});
  assert.deepEqual(await (await other.request()).json(),{error:'purchase_owned_elsewhere'});
  assert.deepEqual(records(other.calls),[]);
  assert(!other.calls.some(c=>c.url?.endsWith(':acknowledge')));
 }
});

test('a missing Play RPC never acknowledges or confirms and the owned order can be retried',async()=>{
 const failed=fixture({recordError:{code:'PGRST202',message:'synthetic missing RPC'}});
 assert.deepEqual(await (await failed.request()).json(),{error:'unavailable'});
 assert(!failed.calls.some(c=>c.url?.endsWith(':acknowledge')));
 assert.equal((await fixture().request()).status,200);
});

test('an already recorded order refunded by Google expires its purchase right on restore',async()=>{
 const known={[sha('play-token-1')]:{user_id:'verified-player',product_id:'real-adventure-02',amount_cents:100,currency:'EUR',status:'paid'}};
 const order={state:'REFUNDED',orderId:'GPA.1',purchaseToken:'play-token-1',lineItems:[{productId:'real_adventure_02'}]};
 const f=fixture({known,order});
 assert.deepEqual(await (await f.request()).json(),{status:'not_paid',revoked:true});
 assert.equal(records(f.calls,'lumen_record_purchase')[0]?.p_status,'refunded');
 assert.deepEqual(records(f.calls),[]);
 const mismatched=fixture({known,order:{...order,purchaseToken:'another'}});
 assert.equal((await mismatched.request()).status,502);
 assert.deepEqual(records(mismatched.calls,'lumen_record_purchase'),[]);
});
