// #729: client Play Billing module with synthetic Digital Goods and Payment Request.
import assert from 'node:assert/strict';
import {getPlayBilling,verifyPlayPurchase,buyWithPlay,restorePlayPurchases,playPrices,toPlayProductId,PLAY_BILLING_METHOD} from '../src/persistence/play-billing.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {adventureOfferModel} from '../src/ui/adventure-offer.js';
import {SKY_PRODUCT_ID} from '../src/campaign/store-catalogue.js';
import fs from 'node:fs';

assert.equal(toPlayProductId('real-adventure-02'),'real_adventure_02');
assert.equal(toPlayProductId('real-sky-all'),'real_sky_all');
assert.equal(toPlayProductId('base-real-sky'),'base-real-sky');
// Availability: only where the Digital Goods API answers (the Play app).
assert.equal(await getPlayBilling({}),null,'Browsers and iPhone have no Play offer');
assert.equal(await getPlayBilling({getDigitalGoodsService:async()=>{throw Error('unsupported')},PaymentRequest:function(){}}),null);
const service={id:'svc'};
assert.equal(await getPlayBilling({getDigitalGoodsService:async m=>m===PLAY_BILLING_METHOD?service:null,PaymentRequest:function(){}}),service);

// Server verification mapping.
const reply=(status,body)=>async()=>({status,json:async()=>body});
const v=f=>verifyPlayPurchase({fetchImpl:f,endpoint:'https://x/functions/v1/lumen-play-purchase',apiKey:'k',accessToken:'jwt',productId:'real-adventure-02',purchaseToken:'tok'});
assert.deepEqual(await v(reply(200,{status:'paid',adventures:['real-adventure-02'],acknowledged:true})),{status:'paid',adventures:['real-adventure-02'],acknowledged:true});
assert.deepEqual(await v(reply(202,{status:'pending'})),{status:'pending'});
assert.deepEqual(await v(reply(409,{error:'purchase_owned_elsewhere'})),{status:'owned_elsewhere'});
assert.deepEqual(await v(reply(409,{status:'not_paid'})),{status:'not_paid'});
assert.equal((await v(reply(503,{error:'unavailable'}))).status,'error');
assert.equal((await v(async()=>{throw Error('offline')})).status,'error','Network failure is never a success');
assert.equal((await verifyPlayPurchase({fetchImpl:reply(200,{status:'paid'}),endpoint:'e',accessToken:null})).status,'error','No session, no call');
let sent;await verifyPlayPurchase({fetchImpl:async(url,init)=>{sent={url,init};return {status:200,json:async()=>({status:'paid'})}},endpoint:'E',apiKey:'K',accessToken:'J',productId:'p',purchaseToken:'t'});
assert.equal(sent.init.headers.authorization,'Bearer J');assert.deepEqual(JSON.parse(sent.init.body),{mode:'verify',productId:'p',purchaseToken:'t'},'Never sends a price or a user id');

// Purchase flow.
function paymentWindow({show}){const made=[];return {made,PaymentRequest:function(methods,details){made.push({methods,details});this.show=show}}}
let completed=[];const response=token=>({details:token?{purchaseToken:token}:{},complete:async r=>{completed.push(r)}});
let w=paymentWindow({show:async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'})}});
assert.deepEqual(await buyWithPlay({win:w,productId:'real-adventure-02',verify:async()=>{throw Error('must not verify')}}),{status:'cancelled'});
assert.deepEqual(w.made[0].methods,[{supportedMethods:PLAY_BILLING_METHOD,data:{sku:'real-adventure-02'}}]);
completed=[];w=paymentWindow({show:async()=>response(null)});
assert.equal((await buyWithPlay({win:w,productId:'p',verify:async()=>({status:'paid'})})).status,'error');assert.deepEqual(completed,['fail']);
completed=[];let verified=null;w=paymentWindow({show:async()=>response('tok-1')});
assert.equal((await buyWithPlay({win:w,productId:'p',verify:async(id,t)=>{verified=[id,t];return {status:'paid'}}})).status,'paid');
assert.deepEqual(verified,['p','tok-1']);assert.deepEqual(completed,['success']);
completed=[];w=paymentWindow({show:async()=>response('tok-2')});
assert.equal((await buyWithPlay({win:w,productId:'p',verify:async()=>({status:'error'})})).status,'error');assert.deepEqual(completed,['fail'],'Unverified purchase closes the sheet as failed');

// Restore and retried acknowledgement.
const restored=await restorePlayPurchases({service:{listPurchases:async()=>[{itemId:'real-adventure-02',purchaseToken:'a'},{itemId:'x'},null,{itemId:'real-sky-all',purchaseToken:'b'}]},verify:async(id)=>({status:id==='real-sky-all'?'paid':'error'})});
assert.deepEqual(restored.map(r=>[r.itemId,r.status]),[['real-adventure-02','error'],['real-sky-all','paid']]);
assert.deepEqual(await restorePlayPurchases({service:{listPurchases:async()=>{throw Error('x')}},verify:async()=>({})}),[]);
assert.deepEqual(await restorePlayPurchases({service:{listPurchases:async()=>{throw Error('x')}},verify:async()=>({}),reportListFailure:true}),[{itemId:null,status:'error',reason:'list'}],'#731: the manual restore reports an unreadable list as a failure');

// Localised prices and the €5 offer rule on Play.
const prices=await playPrices({getDetails:async ids=>ids.map(id=>({itemId:id,price:{currency:'EUR',value:id===SKY_PRODUCT_ID?'5.00':'1.00'}}))},['real-adventure-02',SKY_PRODUCT_ID]);
assert.match(prices['real-adventure-02'],/1,00\s€/);assert.match(prices[SKY_PRODUCT_ID],/5,00\s€/);
assert.deepEqual(await playPrices({getDetails:async()=>{throw Error('x')}},['a']),{});
const packs=[...CONTENT_PACKS].sort((a,b)=>a.order-b.order).map((p,i)=>({...p,accessible:i===0})),pack=packs[1];
const base={pack,packs,quests:canonicalQuestList(),progress:{},signedIn:true,purchasesAvailable:true};
let model=adventureOfferModel({...base,prices});
assert.equal(model.showSky,true);assert.match(model.unitPrice,/1,00\s€/);assert.equal(model.unitProduct,pack.id);assert.equal(model.skyProduct,SKY_PRODUCT_ID);
model=adventureOfferModel({...base,boughtSingle:true});
assert.equal(model.showSky,false,'After a single purchase the €5 offer is hidden; the €5 cap completes the sky');
assert.equal(model.capPrice,'5 €');

// Wiring: the Play offer exists only with Play Billing, outside QA; verification goes to the Edge Function.
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
assert.match(screen,/purchasesAvailable:\(!!playBilling\|\|stripeAvailable\(\)\)&&!qaActive,boughtSingle:lumenEntitlements\.some\(e=>e\?\.source==='purchase'\)/,'Play in the Play app, Stripe (#730) on the web only');
assert.match(screen,/'\/functions\/v1\/lumen-play-purchase'/);
assert.match(screen,/if\(result\.status==='paid'\)\{await loadEntitlements\(\);if\(lumenUser\?\.id!==owner\)return;setStatus\('Achat confirmé/,'Success only after the server confirmed and entitlements reloaded');
console.log('play-billing-tests: availability, verification, purchase, restore, prices and offer rule OK');
