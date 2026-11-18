// #729: client Play Billing module with synthetic Digital Goods and Payment Request.
import assert from 'node:assert/strict';
import {createPlayPriceLoader,getPlayBilling,verifyPlayPurchase,buyWithPlay,restorePlayPurchases,playPrices,toPlayProductId,PLAY_BILLING_METHOD} from '../src/persistence/play-billing.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {adventureOfferModel,mountAdventureOffer} from '../src/ui/adventure-offer.js';
import {SKY_PRODUCT_ID} from '../src/campaign/store-catalogue.js';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripeCheckoutAvailable,isPlayDistributedApp} from '../src/persistence/stripe-checkout.js';

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
assert.deepEqual(await playPrices({getDetails:async()=>[{itemId:'a',price:{currency:'EUR',value:'bad'}}]},['a']),{},'Malformed Play prices must never enable a purchase');
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

// P1: all nine provider IDs, unordered/partial/empty/malformed responses.
const ids=[...CONTENT_PACKS.filter(p=>p.access==='locked').map(p=>p.id),SKY_PRODUCT_ID];
assert.equal(ids.length,9);
const rows=ids.map(id=>({itemId:toPlayProductId(id),price:{currency:'EUR',value:id===SKY_PRODUCT_ID?'5.00':'1.00'}}));
let events=[];
const read=details=>playPrices({getDetails:async requested=>{assert.deepEqual(requested,ids.map(toPlayProductId));return details}},ids.map(toPlayProductId),{onDiagnostic:e=>events.push(e)});
const full=await read(rows);
assert.equal(Object.keys(full).length,9);
for(const id of ids)assert.match(full[toPlayProductId(id)],id===SKY_PRODUCT_ID?/5,00\s€/:/1,00\s€/);
assert.deepEqual(await read([...rows].reverse()),full);
events=[];assert.equal(Object.keys(await read(rows.slice(1))).length,8);
assert.deepEqual(events,[{reason:'product_not_found',productId:rows[0].itemId}]);
events=[];assert.deepEqual(await read([]),{});assert.equal(events.length,9);
for(const price of [{currency:'EUR',value:'NaN'},{currency:'EUR',value:''},{currency:'EUR',value:'1,00'},{currency:'eur',value:'1'},{currency:'ZZZ',value:'1'},{currency:'EUR',value:'Infinity'},{currency:'EUR',value:'-1'},{currency:'EUR',value:'0'},{currency:'EUR',value:null}]){
 events=[];await read([{...rows[0],price},...rows.slice(1)]);
 assert.equal(events[0].reason,'price_parse_failed');
}
events=[];await read([{...rows[0],available:false},...rows.slice(1)]);assert.equal(events[0].reason,'product_not_available');
events=[];await playPrices({getDetails:async()=>{throw Error('sensitive provider text')}},ids,{onDiagnostic:e=>events.push(e)});
assert.deepEqual(events,[{reason:'details_request_failed'}],'No raw errors/tokens are logged');

// Payment support is probed without ever showing a purchase sheet.
let shows=0,detailsCalls=0;
const win={navigator:{language:'fr-FR'},PaymentRequest:function(){this.canMakePayment=async()=>true;this.show=()=>{shows++;throw Error('No payment during price loading')}},
 getDigitalGoodsService:async()=>({getDetails:async()=>{detailsCalls++;return rows}})};
let loader=createPlayPriceLoader({win,ids,playApp:true});
await loader.load();assert.equal(loader.snapshot().status,'ready');assert.equal(shows,0);
assert.equal(loader.snapshot().prices[ids[0]],full[toPlayProductId(ids[0])]);
assert.deepEqual(await buyWithPlay({win:{PaymentRequest:function(){throw Error('unsupported')}},productId:ids[0],verify:()=>{throw Error('must not verify')}}),{status:'error',reason:'payment_unsupported'});
for(const override of [{PaymentRequest:undefined},{PaymentRequest:function(){this.canMakePayment=async()=>false}}]){
 loader=createPlayPriceLoader({win:{...win,...override},ids,playApp:true});await loader.load();
 assert.equal(loader.snapshot().service,null);assert.equal(loader.snapshot().errors[0].reason,'payment_unsupported');
}
// Initially missing service, then successful retry. A TWA never falls back to Stripe.
let available=false;
loader=createPlayPriceLoader({win:{...win,getDigitalGoodsService:async()=>{if(!available)throw Error('unavailable');return {getDetails:async()=>rows}}},ids,playApp:true});
await loader.load();assert.equal(loader.snapshot().errors[0].reason,'service_unavailable');
assert.equal(stripeCheckoutAvailable({channel:'live',signedIn:true,playApp:loader.snapshot().playApp}),false);
available=true;await loader.load();assert.equal(loader.snapshot().status,'ready');
// Chrome Android may expose the method, but rejects outside the TWA.
const previousDetailsCalls=detailsCalls;
const browser={...win,document:{referrer:''},getDigitalGoodsService:async()=>{throw Error('unsupported context')}};
assert.equal(isPlayDistributedApp(browser),false);
loader=createPlayPriceLoader({win:browser,ids});await loader.load();
assert.equal(loader.snapshot().service,null);assert.equal(loader.snapshot().playApp,false);assert.equal(detailsCalls,previousDetailsCalls);
// A resolved service establishes Play immediately, before a delayed details reply.
const detected=[];let completeDetails;
loader=createPlayPriceLoader({win:{...win,getDigitalGoodsService:async()=>({getDetails:()=>new Promise(resolve=>{completeDetails=resolve})})},ids,onChange:s=>detected.push({playApp:s.playApp,status:s.status})});
const detection=loader.load();await new Promise(resolve=>setImmediate(resolve));
assert.deepEqual(detected.at(-1),{playApp:true,status:'loading'});
completeDetails(rows);await detection;

// Exercise the production screen wiring + real offer DOM with a delayed provider.
class Node{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.textContent='';this.isConnected=true}
 append(...nodes){this.children.push(...nodes)} replaceChildren(...nodes){this.children=nodes}
 get firstElementChild(){return this.children[0]} setAttribute(k,v){this.attributes[k]=v} focus(){}
 all(){return this.children.flatMap(c=>c instanceof Node?[c,...c.all()]:[])}
}
globalThis.document={createElement:tag=>new Node(tag),createTextNode:text=>({text})};
let resolveDetails,failDetails=true,verifications=0;
const delayedWin={...win,document:{referrer:'android-app://com.nopuna.lumen'},getDigitalGoodsService:async()=>({getDetails:()=>new Promise((resolve,reject)=>{resolveDetails=()=>failDetails?reject(Error('offline')):resolve(rows)})})};
const host=new Node('div'),savedProgress={solved:{0:1}},saved=structuredClone(savedProgress);
const context=vm.createContext({window:delayedWin,console,createPlayPriceLoader,isPlayDistributedApp,CONTENT_PACKS,SKY_PRODUCT_ID,
 adventureOfferModel,mountAdventureOffer,canonicalQuestList,contentMapModel:()=>({skies:[{packs}]}),adventureAccessEntitlements:()=>[],adventureEntitlementsState:()=> 'ready',
 attemptEngine:{snapshot:()=>({})},lumenProgress:savedProgress,lumenUser:{id:'synthetic'},lumenEntitlements:[],qaActive:false,mapCatalogueOverride:null,
 stripeAvailable:()=>false,purchaseAdventure:()=>{verifications++},host,pack});
const normalized=screen.replace(/\r\n/g,'\n');
vm.runInContext(normalized.slice(normalized.indexOf('let playBilling=null'),normalized.indexOf('async function playVerify')),context);
vm.runInContext(normalized.slice(normalized.indexOf('function renderAdventureOffer('),normalized.indexOf('// #728: ask the server')),context);
vm.runInContext('renderAdventureOffer(host,pack)',context);
const find=kind=>host.all().find(n=>n.dataset.offer===kind);
assert.equal(find('unit').disabled,true);assert.match(find('unit').attributes['aria-label'],/Chargement du prix/);
await new Promise(resolve=>setImmediate(resolve));resolveDetails();
await vm.runInContext('playBillingReady',context);
assert.equal(find('unit').disabled,true);assert(find('retry'));
failDetails=false;find('retry').onclick();
const retry=vm.runInContext('playPriceLoader.load()',context);
await new Promise(resolve=>setImmediate(resolve));resolveDetails();await retry;
assert.equal(find('unit').disabled,false,'An already-open offer updates after retry');
assert.match(find('unit').attributes['aria-label'],/1,00\s€/);
assert.equal(verifications,0);assert.equal(shows,0);assert.deepEqual(savedProgress,saved,'Prices cannot grant rights or change progress');
vm.runInContext("lumenEntitlements=[{source:'purchase'}];renderAdventureOffer(host,pack)",context);
assert.equal(find('sky'),undefined,'Single purchase still hides the whole-sky offer');
assert.equal(find('unit').disabled,false);
// Partial prices remain disabled even after a sibling purchase's busy callback.
let controls;
mountAdventureOffer(host,adventureOfferModel({...base,pricesRequired:true,priceStatus:'partial',prices:{[SKY_PRODUCT_ID]:'5,00 €'}}),{onBuy:(_id,ctx)=>{controls=ctx}});
assert.equal(find('unit').disabled,true);find('waiver').checked=true;find('sky').onclick();controls.setBusy(true);assert.equal(find('retry').disabled,true);controls.setBusy(false);
assert.equal(find('unit').disabled,true);assert.equal(find('sky').disabled,false);
// Stalled providers terminate; retry is available rather than an endless spinner.
loader=createPlayPriceLoader({win:{...win,getDigitalGoodsService:()=>new Promise(()=>{})},ids,playApp:true,timeoutMs:5});
await loader.load();assert.equal(loader.snapshot().status,'error');assert.equal(loader.snapshot().errors[0].reason,'service_unavailable');
console.log('play-billing-tests P1: nine SKUs, validation, delayed DOM refresh, retry, CTA, channel isolation and no grants OK');
