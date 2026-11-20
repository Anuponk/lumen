// #729: client Play Billing module with synthetic Digital Goods and Payment Request.
import assert from 'node:assert/strict';
import {PLAY_CHECKOUT_AVAILABLE,PLAY_TEST_CAPABILITY,playCheckoutOpen,createForegroundRecovery,PLAY_BINDING_PROBE,createPlayPriceLoader,getPlayPurchaseService,verifyPlayPurchase,buyWithPlay,restorePlayPurchases,playPrices,toPlayProductId,PLAY_BILLING_METHOD,findOwnedPlayPurchase,playOwnershipMessage} from '../src/persistence/play-billing.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {adventureOfferModel,mountAdventureOffer,purchaseProgressMessage,updateAdventureOfferMastery,mainSkyOffer} from '../src/ui/adventure-offer.js';
import {SKY_PRODUCT_ID,SKY_UPGRADE_PRODUCT_IDS,isMainSkyProduct} from '../src/campaign/store-catalogue.js';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripeCheckoutAvailable,isPlayDistributedApp} from '../src/persistence/stripe-checkout.js';

assert.equal(toPlayProductId('real-adventure-02'),'real_adventure_02');
assert.equal(toPlayProductId('real-sky-all'),'real_sky_all');
assert.equal(toPlayProductId('base-real-sky'),'base-real-sky');
// Availability: only where the Digital Goods API answers (the Play app).
assert.equal(await getPlayPurchaseService({}),null,'Browsers and iPhone have no Play offer');
assert.equal(await getPlayPurchaseService({getDigitalGoodsService:async()=>{throw Error('unsupported')},PaymentRequest:function(){}}),null);
const service={id:'svc'};
assert.equal(await getPlayPurchaseService({getDigitalGoodsService:async m=>m===PLAY_BILLING_METHOD?service:null,PaymentRequest:function(){}}),service);

// Server verification mapping.
const reply=(status,body)=>async()=>({status,json:async()=>body});
const v=f=>verifyPlayPurchase({fetchImpl:f,endpoint:'https://x/functions/v1/lumen-play-purchase',apiKey:'k',accessToken:'jwt',productId:'real-adventure-02',purchaseToken:'tok'});
assert.deepEqual(await v(reply(200,{status:'paid',adventures:['real-adventure-02'],acknowledged:true})),{status:'paid',adventures:['real-adventure-02'],acknowledged:true});
assert.deepEqual(await v(reply(202,{status:'pending'})),{status:'pending'});
assert.deepEqual(await v(reply(409,{error:'purchase_owned_elsewhere'})),{status:'owned_elsewhere'});
assert.deepEqual(await v(reply(409,{status:'not_paid'})),{status:'not_paid'});
assert.deepEqual(await v(reply(409,{error:'purchase_account_unverified'})),{status:'account_unverified'});
assert.deepEqual(await v(reply(400,{error:'invalid_purchase'})),{status:'not_paid'},'#864: a token Google no longer knows is not a right');
// #864: Play ownership is read per SKU from the device's Google Play account.
assert.deepEqual(await findOwnedPlayPurchase({listPurchases:async()=>[{itemId:'real_adventure_03',purchaseToken:'t3'},{itemId:'real_adventure_02',purchaseToken:''}]},'real_adventure_02'),{status:'not_owned'});
assert.deepEqual(await findOwnedPlayPurchase({listPurchases:async()=>[{itemId:'real_adventure_03',purchaseToken:'t3'}]},'real_adventure_03'),{status:'owned',purchase:{itemId:'real_adventure_03',purchaseToken:'t3'}});
assert.deepEqual(await findOwnedPlayPurchase({listPurchases:async()=>{throw Error('x')}},'real_adventure_03'),{status:'unknown'},'An unreadable list never proves absence');
assert.deepEqual(await findOwnedPlayPurchase(null,'real_adventure_03'),{status:'unknown'});
assert.match(playOwnershipMessage('owned_elsewhere','Horizon lointain'),/« Horizon lointain ».*autre compte Lumen.*Reconnecte-toi.*sans nouveau paiement/);
assert.match(playOwnershipMessage('account_unverified','Horizon lointain'),/aucun compte Lumen vérifiable.*assistance/);
assert.doesNotMatch(playOwnershipMessage('owned_elsewhere','X')+playOwnershipMessage('account_unverified','X'),/transf/i,'Never promise a transfer between Lumen accounts');
assert.deepEqual(await v(reply(409,{error:'offer_not_eligible'})),{status:'offer_not_eligible'});
assert.match(playOwnershipMessage('offer_not_eligible'),/rembourse automatiquement/,'#865: an outdated tier is explained, never granted');
assert.equal(toPlayProductId('real-sky-upgrade-3'),'real_sky_upgrade_3');assert.equal(toPlayProductId('real-sky-upgrade-5'),'real-sky-upgrade-5');
assert.equal((await v(reply(503,{error:'unavailable'}))).status,'error');
assert.equal((await v(async()=>{throw Error('offline')})).status,'error','Network failure is never a success');
assert.equal((await verifyPlayPurchase({fetchImpl:reply(200,{status:'paid'}),endpoint:'e',accessToken:null})).status,'error','No session, no call');
let sent;await verifyPlayPurchase({fetchImpl:async(url,init)=>{sent={url,init};return {status:200,json:async()=>({status:'paid'})}},endpoint:'E',apiKey:'K',accessToken:'J',productId:'p',purchaseToken:'t'});
assert.equal(sent.init.headers.authorization,'Bearer J');assert.deepEqual(JSON.parse(sent.init.body),{mode:'verify',productId:'p',purchaseToken:'t'},'Never sends a price or a user id');

// Purchase flow.
function paymentWindow({show}){const made=[];return {made,PaymentRequest:function(methods,details){made.push({methods,details});this.show=show}}}
let completed=[];const response=token=>({details:token?{purchaseToken:token}:{},complete:async r=>{completed.push(r)}});
let w=paymentWindow({show:async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'})}});
const binding='a'.repeat(64);
assert.deepEqual(await buyWithPlay({win:w,productId:'p'}),{status:'error',reason:'account_binding'});
assert.deepEqual(await buyWithPlay({win:w,productId:'p',obfuscatedAccountId:'wrong'}),{status:'error',reason:'account_binding'});
assert.equal(w.made.length,0);
assert.deepEqual(await buyWithPlay({win:w,productId:'real-adventure-02',obfuscatedAccountId:binding,verify:async()=>{throw Error('must not verify')}}),{status:'cancelled'});
assert.deepEqual(w.made[0].methods,[{supportedMethods:PLAY_BILLING_METHOD,data:{sku:'real-adventure-02',obfuscatedAccountId:binding}}]);
completed=[];w=paymentWindow({show:async()=>response(null)});
assert.equal((await buyWithPlay({win:w,productId:'p',obfuscatedAccountId:binding,verify:async()=>({status:'paid'})})).status,'error');assert.deepEqual(completed,['fail']);
completed=[];let verified=null;w=paymentWindow({show:async()=>response('tok-1')});
assert.equal((await buyWithPlay({win:w,productId:'p',obfuscatedAccountId:binding,verify:async(id,t)=>{verified=[id,t];return {status:'paid'}}})).status,'paid');
assert.deepEqual(verified,['p','tok-1']);assert.deepEqual(completed,['success']);
completed=[];w=paymentWindow({show:async()=>response('tok-2')});
assert.equal((await buyWithPlay({win:w,productId:'p',obfuscatedAccountId:binding,verify:async()=>({status:'error'})})).status,'error');assert.deepEqual(completed,['fail'],'Unverified purchase closes the sheet as failed');

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
model=adventureOfferModel({...base,boughtSingle:true,pricesRequired:true,prices});
assert.equal(model.showSky,false,'After a single purchase the existing eligibility rule still hides the whole-sky offer');
assert.equal(purchaseProgressMessage(null),'','Neither provider price supplies a purchase count');

// Wiring: the Play offer exists only with Play Billing, outside QA; verification goes to the Edge Function.
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
assert.match(screen,/purchasesAvailable:\(inPlay\?playBoundCheckoutAvailable\(\)&&!!playBilling:stripeAvailable\(\)\)&&!qaActive,boughtSingle:lumenEntitlements\.some\(e=>e\?\.source==='purchase'\)/,'Play in the Play app, Stripe (#730) on the web only');
assert.match(screen,/'\/functions\/v1\/lumen-play-purchase'/);
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
assert.deepEqual(await buyWithPlay({win:{PaymentRequest:function(){throw Error('unsupported')}},productId:ids[0],obfuscatedAccountId:binding,verify:()=>{throw Error('must not verify')}}),{status:'error',reason:'payment_unsupported'});
for(const override of [{PaymentRequest:undefined},{PaymentRequest:function(){this.canMakePayment=async()=>false}}]){
 loader=createPlayPriceLoader({win:{...win,...override},ids,playApp:true});await loader.load();
 assert(loader.snapshot().service,'Digital Goods remains available for recovery');
 assert.equal(loader.snapshot().paymentSupported,false);
 assert.equal(loader.snapshot().errors[0].reason,'payment_unsupported');
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
const probeMarker=[{itemId:PLAY_BINDING_PROBE,title:PLAY_BINDING_PROBE,price:{currency:'EUR',value:'0'}}];
for(const [probe,supported,reason] of [
 [[],false,'binding_probe_unsupported'],
 [[{...probeMarker[0],title:'unexpected'}],false,'binding_probe_unsupported'],
 [[...probeMarker,...probeMarker],false,'binding_probe_unsupported'],
 [null,false,'binding_probe_failed'],
 [probeMarker,true,undefined]
]){
 const compatible=createPlayPriceLoader({win:{...win,getDigitalGoodsService:async()=>({
  getDetails:async requested=>requested[0]===PLAY_BINDING_PROBE?(probe??Promise.reject(Error('raw provider error'))):rows
 })},ids,probeBinding:true});
 await compatible.load();
 assert.equal(compatible.snapshot().supportsBinding,supported);
 assert.equal(compatible.snapshot().errors[0]?.reason,reason);
 assert.equal(compatible.snapshot().paymentSupported,true);
 assert.equal(Object.keys(compatible.snapshot().prices).length,ids.length);
}

// Exercise the production screen wiring + real offer DOM with a delayed provider.
class Node{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.textContent='';this.isConnected=true}
 append(...nodes){for(const node of nodes)if(node instanceof Node)node.parentElement=this;this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 get firstElementChild(){return this.children[0]} setAttribute(k,v){this.attributes[k]=v} focus(){} closest(){return null}
 querySelector(selector){
  const keys={'[data-offer-mastery]':'offerMastery','[data-offer-purchase-progress]':'offerPurchaseProgress','[data-offer-cards]':'offerCards'};
  return this.all().find(node=>selector==='[data-offer="waiver"]'?node.dataset.offer==='waiver':Object.hasOwn(node.dataset,keys[selector]));
 }
 all(){return this.children.flatMap(c=>c instanceof Node?[c,...c.all()]:[])}
}
globalThis.document={createElement:tag=>new Node(tag),createTextNode:text=>({text})};
let resolveDetails,failDetails=true,verifications=0,marker=probeMarker;
const delayedWin={...win,document:{referrer:'android-app://com.nopuna.lumen'},getDigitalGoodsService:async()=>({getDetails:requested=>requested[0]===PLAY_BINDING_PROBE
 ?Promise.resolve(marker):new Promise((resolve,reject)=>{resolveDetails=()=>failDetails?reject(Error('offline')):resolve(rows)})})};
const host=new Node('div'),savedProgress={solved:{0:1}},saved=structuredClone(savedProgress);
const context=vm.createContext({PLAY_CHECKOUT_AVAILABLE,playCheckoutOpen,lumenCapabilities:[],window:delayedWin,console,createPlayPriceLoader,isPlayDistributedApp,CONTENT_PACKS,SKY_PRODUCT_ID,SKY_UPGRADE_PRODUCT_IDS,isMainSkyProduct,mainSkyOffer,mainSkyProgress:{owner:null,data:null},
 adventureOfferModel,mountAdventureOffer,purchaseProgressMessage,updateAdventureOfferMastery,canonicalQuestList,contentMapModel:()=>({skies:[{packs}]}),adventureAccessEntitlements:()=>[],adventureEntitlementsState:()=> 'ready',
 attemptEngine:{snapshot:()=>({})},lumenProgress:savedProgress,lumenUser:{id:'synthetic'},lumenEntitlements:[],qaActive:false,mapCatalogueOverride:null,refreshAdventureOffer:null,authSessionPending:false,cloudProfileReady:true,cloudProfileFailure:null,lumenEntitlementsState:'ready',navigator:{onLine:true},
 localStorage:{getItem:key=>key==='lumenCloudOwnerId'?'synthetic':null},
 lumenSupabase:null,
 preparePlayPurchaseAccount:async()=>{},
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
assert.equal(find('waiver').checked,false);
find('unit').onclick();
assert.equal(verifications,0,'No purchase callback before express consent');
assert.match(find('unit').attributes['aria-label'],/1,00\s€/);
assert.equal(verifications,0);assert.equal(shows,0);assert.deepEqual(savedProgress,saved,'Prices cannot grant rights or change progress');
vm.runInContext("lumenEntitlements=[{source:'purchase'}];renderAdventureOffer(host,pack)",context);
assert.equal(find('sky'),undefined,'Single purchase still hides the whole-sky offer');
assert.equal(find('unit').disabled,false);
// During account handoff only the mastery section updates, even with active pricing.
const unitBeforeHydration=find('unit'),waiverBeforeHydration=find('waiver');
waiverBeforeHydration.checked=true;
const masteryStatus=()=>host.all().find(n=>Object.hasOwn(n.dataset,'offerMasteryStatus')).textContent;
vm.runInContext("authSessionPending=true;cloudProfileReady=false;refreshAdventureOffer('mastery')",context);
assert.match(masteryStatus(),/Chargement de ta progression/);
assert.equal(find('mastery-claim'),undefined);
vm.runInContext("authSessionPending=false;cloudProfileFailure={};refreshAdventureOffer('mastery')",context);
assert.match(masteryStatus(),/indisponible/);
vm.runInContext("cloudProfileFailure=null;lumenProgress={solved:{0:1,1:1}};cloudProfileReady=true;refreshAdventureOffer('mastery')",context);
const precedingQuests=canonicalQuestList().filter(q=>q.packId===packs[0].id);
assert(masteryStatus().includes('Il te reste '+(precedingQuests.length-2)+' quêtes et '));
assert.equal(find('unit'),unitBeforeHydration);
assert.equal(find('waiver'),waiverBeforeHydration);
assert.equal(find('waiver').checked,true,'Synchronization does not reset purchase controls');
vm.runInContext("lumenEntitlements=[{source:'mastery',entitlement:pack.id}];refreshAdventureOffer('mastery')",context);
assert.match(masteryStatus(),/Déblocage gratuit confirmé/);
assert(find('mastery-continue'));
vm.runInContext("lumenUser=null;cloudProfileReady=false;refreshAdventureOffer('mastery')",context);
assert.match(masteryStatus(),/indisponible/,'The previous profile cannot supply counters after logout');
assert.equal(find('mastery-continue'),undefined);
// Read the server count for the owner, even when a previous offer is still on screen.
let progressReply;
context.lumenUser={id:'synthetic'};
context.lumenSupabase={rpc:(name,args)=>{
 assert.equal(name,'lumen_get_main_sky_purchase_progress');
 assert.equal(args.p_expected_user_id,'synthetic');
 return new Promise(resolve=>{progressReply=resolve});
}};
vm.runInContext('renderAdventureOffer(host,pack)',context);
const count=()=>host.firstElementChild.querySelector('[data-offer-purchase-progress]');
assert.equal(count().hidden,true);
progressReply({data:{remaining:1,unlocked:false}});
await new Promise(resolve=>setImmediate(resolve));
assert.match(count().textContent,/Plus qu’une aventure/);
vm.runInContext("refreshAdventureOffer('mastery')",context);
context.lumenUser={id:'other'};
progressReply({data:{remaining:0,unlocked:true}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(count().hidden,true,'The prior owner cannot publish a later reply');
// A bad probe or unavailable Payment Request must block the real checkout UI.
const supportedPayment=delayedWin.PaymentRequest;
for(const unavailable of ['binding_probe_unsupported','payment_unsupported']){
 marker=unavailable==='binding_probe_unsupported'?[]:probeMarker;
 delayedWin.PaymentRequest=unavailable==='payment_unsupported'?function(){this.canMakePayment=async()=>false}:supportedPayment;
 const reload=vm.runInContext('playPriceLoader.load()',context);
 await new Promise(resolve=>setImmediate(resolve));resolveDetails();await reload;
 assert.equal(find('unit').disabled,true);
 assert.equal(find('waiver'),undefined);
 assert(host.all().some(n=>n.dataset.playPriceReason===unavailable));
 assert.equal(vm.runInContext('playBoundCheckoutAvailable()',context),false);
}
assert.equal(shows,0);
// Partial prices remain disabled even after a sibling purchase's busy callback.
let controls;
mountAdventureOffer(host,adventureOfferModel({...base,pricesRequired:true,priceStatus:'partial',prices:{[SKY_PRODUCT_ID]:'5,00 €'}}),{onBuy:(_id,ctx)=>{controls=ctx}});
assert.equal(find('unit').disabled,true);find('waiver').checked=true;find('sky').onclick();controls.setBusy(true);assert.equal(find('retry').disabled,true);controls.setBusy(false);
assert.equal(find('unit').disabled,true);assert.equal(find('sky').disabled,false);
// Stalled providers terminate; retry is available rather than an endless spinner.
loader=createPlayPriceLoader({win:{...win,getDigitalGoodsService:()=>new Promise(()=>{})},ids,playApp:true,timeoutMs:5});
await loader.load();assert.equal(loader.snapshot().status,'error');assert.equal(loader.snapshot().errors[0].reason,'service_unavailable');
console.log('play-billing-tests P1: nine SKUs, validation, delayed DOM refresh, retry, CTA, channel isolation and no grants OK');

assert.equal(PLAY_CHECKOUT_AVAILABLE,true,'The approved web release opens Play sales for eligible builds');
const purchaseState={status:503,body:{error:'unavailable'}};
let listings=0,reads=0,renders=0,playAttempts=0,changeDuringList=false,authChecks=0,paymentChecks=0;
const verifyTokens=[],restoreNotices=[];
let storeTokens=['existing-purchase'];
const authClient={auth:{getSession:async()=>{authChecks++;return {data:{session:{user:{id:'owner'},access_token:'synthetic-jwt'}}}}}};
const originalProgress={solved:{0:1},stars:7,performances:{0:{badges:['speed']}},shards:50};
const expectedProgress=structuredClone(originalProgress);
const recoveryWin={
 document:{referrer:'android-app://com.nopuna.lumen'},
 PaymentRequest:function(){this.canMakePayment=async()=>{paymentChecks++;return true}},
 getDigitalGoodsService:async()=>({getDetails:async requested=>requested[0]===PLAY_BINDING_PROBE?probeMarker:rows,listPurchases:async()=>{
  listings++;
  if(changeDuringList)recovery.lumenUser={id:'other'};
  return storeTokens.map(purchaseToken=>({itemId:'real_adventure_02',purchaseToken}));
 }})
};
const restoreHost=new Node('div');
let scheduledRecovery=null;
const recovery=vm.createContext({...context,PLAY_CHECKOUT_AVAILABLE:false,window:recoveryWin,findOwnedPlayPurchase,playOwnershipMessage,
 setTimeout:(callback,delay)=>{scheduledRecovery={callback,delay};return scheduledRecovery},
 clearTimeout:()=>{scheduledRecovery=null},
 getPlayPurchaseService,restorePlayPurchases,verifyPlayPurchase:args=>verifyPlayPurchase({...args,fetchImpl:async(_url,init)=>{
  const {purchaseToken}=JSON.parse(init.body);
  verifyTokens.push([init.headers.authorization,purchaseToken]);
  if(purchaseToken==='another-purchase')return new Response(JSON.stringify({error:'purchase_owned_elsewhere'}),{status:409});
  return new Response(JSON.stringify(purchaseState.body),{status:purchaseState.status});
 }}),buyWithPlay:async()=>{playAttempts++;throw Error('A restoration opened checkout')},
 showPurchaseStatus:message=>restoreNotices.push(message),lumenUser:{id:'owner'},lumenSupabase:authClient,lumenProgress:originalProgress,
 LUMEN_SUPABASE_URL:'https://synthetic.invalid',LUMEN_SUPABASE_KEY:'synthetic',
 loadEntitlements:async()=>{
  reads++;
  recovery.lumenEntitlementsState='ready';
  recovery.lumenEntitlements=[{entitlement:'real-adventure-02',source:'purchase'}];
 },
 refreshAdventureOffer:null,lumenEntitlements:[],lumenEntitlementsState:'ready',
 skyNavigation:{render:()=>renders++},restoreHost,pack
});
vm.runInContext(normalized.slice(normalized.indexOf('let playBilling=null'),normalized.indexOf('// #723: once per launch')),recovery);
vm.runInContext(normalized.slice(normalized.indexOf('function renderAdventureOffer('),normalized.indexOf('// #728: ask the server')),recovery);
await vm.runInContext('playBillingReady',recovery);
vm.runInContext('renderAdventureOffer(restoreHost,pack)',recovery);
assert.equal(paymentChecks,1,'The sale switch must not mask Payment Request readiness');
assert.equal(restoreHost.all().find(n=>n.dataset.offer==='waiver'),undefined,'A paused checkout has no consent control');
assert.match(restoreHost.all().map(n=>n.textContent).join(' '),/temporairement suspendus/);
assert.equal(vm.runInContext('playBoundCheckoutAvailable()',recovery),false,'Both device checks can pass during the operational pause');
const restore=()=>restoreHost.all().find(n=>n.dataset.offer==='restore-play');
const status=()=>restoreHost.all().find(n=>Object.hasOwn(n.dataset,'offerStatus')).textContent;
assert.equal(restoreHost.all().find(n=>n.dataset.offer==='unit').disabled,true);
assert.equal(restore().textContent,'Vérifier mes achats Google Play');
delete recoveryWin.PaymentRequest;
const firstRestore=restore().onclick();
assert.match(status(),/Vérification des achats/);
await firstRestore;
assert.match(status(),/sans nouveau paiement/);
assert.equal(reads,0,'An unavailable RPC must not be presented as confirmed access');
purchaseState.status=200;
purchaseState.body={status:'paid',acknowledged:true,adventures:['real-adventure-02']};
await Promise.all([restore().onclick(),vm.runInContext('restorePlayForCurrentAccount()',recovery)]);
assert.match(status(),/droits sont à jour/);
assert.equal(listings,2,'Automatic and manual calls share the same verification in flight');
assert.equal(reads,1);
assert.equal(renders,1);
assert.equal(recovery.lumenEntitlements[0].entitlement,'real-adventure-02');
assert.deepEqual(originalProgress,expectedProgress);
assert.equal(playAttempts,0,'A second device with no PaymentRequest can restore without initiating payment');
assert.deepEqual(verifyTokens,[['Bearer synthetic-jwt','existing-purchase'],['Bearer synthetic-jwt','existing-purchase']]);
changeDuringList=true;
await restore().onclick();
assert.equal(authChecks,2,'A token read before switching accounts is never verified for the new account');
assert.equal(reads,1);

changeDuringList=false;
recovery.lumenUser={id:'owner'};
recovery.cloudProfileReady=true;
purchaseState.status=202;
purchaseState.body={status:'pending'};
await vm.runInContext('maybeRestorePlayPurchases()',recovery);
assert.equal(scheduledRecovery.delay,15000);
const listingsBeforeRetry=listings;
recovery.lumenUser={id:'other'};
scheduledRecovery.callback();
assert.equal(listings,listingsBeforeRetry,'A pending retry is scoped to the original account');
purchaseState.status=200;
purchaseState.body={status:'paid',acknowledged:true,adventures:['real-adventure-02']};

recovery.lumenUser={id:'owner'};
const readsBeforeUnmatched=reads;
for(const error of ['purchase_account_unverified','purchase_owned_elsewhere']){
 purchaseState.status=409;
 purchaseState.body={error};
 restoreNotices.length=0;
 await vm.runInContext('maybeRestorePlayPurchases()',recovery);
 assert.deepEqual(restoreNotices,[],'Automatic recovery must not suggest that a store purchase belongs to this Lumen account');
 await restore().onclick();
 // #864: the manual restore names the purchase and the account it stays on.
 assert.match(status(),error==='purchase_owned_elsewhere'?/Horizon|« .+ ».*autre compte Lumen.*Reconnecte-toi/:/« .+ ».*aucun compte Lumen vérifiable/);
 assert.doesNotMatch(status(),/Aucun achat Google Play à restaurer/);
 assert.deepEqual(restoreNotices,[],'A manual result stays inside the offer');
}
assert.equal(reads,readsBeforeUnmatched,'Unmatched purchases never read back a newly granted right');
assert.equal(scheduledRecovery,null,'Unmatched purchases do not schedule a retry');
assert.deepEqual(originalProgress,expectedProgress);
storeTokens.push('another-purchase');
purchaseState.status=200;
purchaseState.body={status:'paid',acknowledged:true,adventures:['real-adventure-02']};
await restore().onclick();
assert.match(status(),/droits sont .* jour/,'A separate purchase must not hide a verified right for the current account');
assert.equal(reads,readsBeforeUnmatched+1);
storeTokens.pop();

// A new purchase: the device's Google Play account does not hold this SKU yet.
storeTokens=[];
const checkoutStatuses=[];
const checkoutCtx={setBusy:()=>{},setStatus:message=>checkoutStatuses.push(message),waiver:{accepted:true}};
let thanks=0;
let sheets=0,bindingRequests=0;
recoveryWin.PaymentRequest=function(methods){
 assert.deepEqual(methods,[{supportedMethods:PLAY_BILLING_METHOD,data:{sku:toPlayProductId(pack.id),obfuscatedAccountId:binding}}]);
 this.show=async()=>{sheets++;return response('new-purchase')};
};
authClient.rpc=async(name,args)=>{
 assert.equal(name,'lumen_prepare_play_purchase');
 assert.equal(args.p_expected_user_id,recovery.lumenUser.id);
 bindingRequests++;
 return {data:binding};
};
Object.assign(recovery,{
 PLAY_CHECKOUT_AVAILABLE,lumenUser:{id:'owner'},cloudProfileReady:false,checkoutCtx,toPlayProductId,
 thankForPurchase:()=>thanks++,
 buyWithPlay:args=>buyWithPlay({...args,win:recoveryWin}),
 loadEntitlements:async()=>{recovery.lumenEntitlementsState='error'}
});
const checkout=()=>vm.runInContext("purchaseAdventure('real-adventure-02',checkoutCtx)",recovery);
assert.equal(vm.runInContext('playBoundCheckoutAvailable()',recovery),true);
checkoutCtx.waiver.accepted=false;
await checkout();
assert.equal(sheets,0);
assert.equal(bindingRequests,0);
checkoutCtx.waiver.accepted=true;
await checkout();
assert.equal(sheets,0,'Never open Play until the preparation is registered');
assert.equal(bindingRequests,1);
await checkout();
assert(checkoutStatuses.some(message=>message.startsWith('Vérification de l’achat')));
assert(!checkoutStatuses.some(message=>message.startsWith('Achat confirmé')));
assert.equal(thanks,0);
recovery.loadEntitlements=async()=>{recovery.lumenEntitlementsState='ready';recovery.lumenEntitlements=[]};
await checkout();
assert(!checkoutStatuses.some(message=>message.startsWith('Achat confirmé')),'A successful empty read cannot confirm the requested right');
assert.equal(thanks,0);
recovery.lumenEntitlements=[{entitlement:'real-adventure-02',source:'purchase'}];
recovery.loadEntitlements=async()=>{recovery.lumenEntitlementsState='ready'};
await checkout();
assert.match(checkoutStatuses.at(-1),/^Achat confirmé/);
assert.equal(thanks,1);
recovery.lumenUser={id:'other'};
const sheetsBeforeSwitch=sheets;
await checkout();
assert.equal(sheets,sheetsBeforeSwitch,'The previous account binding cannot open a payment');
assert.deepEqual(verifyTokens.slice(-3),Array.from({length:3},()=>['Bearer synthetic-jwt','new-purchase']));

// #864: Lumen account A bought real-adventure-02 with this Google Play account; Lumen
// account B on the same phone tries the same SKU. Play would answer ITEM_ALREADY_OWNED.
{
 recovery.lumenUser={id:'owner'};
 await vm.runInContext('preparePlayPurchaseAccount()',recovery);
 storeTokens=['held-by-play'];
 const sheetsBefore=sheets,thanksBefore=thanks,readsBefore=reads;
 recovery.loadEntitlements=async()=>{reads++;recovery.lumenEntitlementsState='ready'};
 for(const [error,pattern] of [['purchase_owned_elsewhere',/« .+ ».*autre compte Lumen.*Reconnecte-toi/],['purchase_account_unverified',/aucun compte Lumen vérifiable/]]){
  purchaseState.status=409;purchaseState.body={error};
  await checkout();
  assert.equal(sheets,sheetsBefore,'An SKU already held by Google Play never reopens a payment sheet');
  assert.match(checkoutStatuses.at(-1),pattern);
  assert.equal(verifyTokens.at(-1)[1],'held-by-play','The held token is checked for the signed-in account only');
 }
 assert.equal(reads,readsBefore,'A purchase of another Lumen account is never read back as a right');
 assert.equal(thanks,thanksBefore);
 // Same Lumen account as the purchase: the right is restored without paying again.
 purchaseState.status=200;purchaseState.body={status:'paid',acknowledged:true,adventures:['real-adventure-02']};
 recovery.lumenEntitlements=[{entitlement:'real-adventure-02',source:'purchase'}];
 await checkout();
 assert.equal(sheets,sheetsBefore);
 assert.match(checkoutStatuses.at(-1),/^Achat confirmé/);
 assert.equal(thanks,thanksBefore+1);
 // Stale local list: the sheet fails, then Play lists the SKU. Explained, not a raw error.
 storeTokens=[];
 recoveryWin.PaymentRequest=function(){this.show=async()=>{sheets++;storeTokens=['held-by-play'];throw Object.assign(Error('owned'),{name:'NotSupportedError'})}};
 purchaseState.status=409;purchaseState.body={error:'purchase_owned_elsewhere'};
 await checkout();
 assert.equal(sheets,sheetsBefore+1);
 assert.match(checkoutStatuses.at(-1),/autre compte Lumen/);
 // A cancelled sheet for an SKU Play does not hold stays a silent cancel.
 storeTokens=[];
 recoveryWin.PaymentRequest=function(){this.show=async()=>{sheets++;throw Object.assign(Error('cancel'),{name:'AbortError'})}};
 await checkout();
 assert.equal(checkoutStatuses.at(-1),'');
 assert.deepEqual(originalProgress,expectedProgress,'Ownership checks never change progress');
}
console.log('play-billing-tests #864: Play-held SKU explained per Lumen account, no sheet, no transfer OK');

// #833: licence-tester checkout while public sales stay closed. The capability only opens
// the consented Play sheet for that account; the server still verifies every token.
assert.equal(PLAY_TEST_CAPABILITY,'play_test_checkout');
assert.equal(playCheckoutOpen(),PLAY_CHECKOUT_AVAILABLE,'Without a capability the public switch decides');
for(const capabilities of [[],null,['stripe_test_checkout'],[{capability:'all_adventures_access'}],[{capability:'play_test_checkout_extra'}]])
 assert.equal(playCheckoutOpen({released:false,capabilities}),false,JSON.stringify(capabilities));
assert.equal(playCheckoutOpen({released:false,capabilities:[{capability:'play_test_checkout',source:'manual',expires_at:null}]}),true);
assert.equal(playCheckoutOpen({released:false,capabilities:['play_test_checkout']}),true);
assert.equal(playCheckoutOpen({released:true,capabilities:[]}),true);
Object.assign(recovery,{PLAY_CHECKOUT_AVAILABLE:false,lumenUser:{id:'owner'},lumenCapabilities:[{capability:'stripe_test_checkout'}]});
assert.equal(vm.runInContext('playBoundCheckoutAvailable()',recovery),false,'Another capability never opens Play sales');
recovery.lumenCapabilities=[{capability:'play_test_checkout',source:'manual',expires_at:null}];
assert.equal(vm.runInContext('playBoundCheckoutAvailable()',recovery),true,'The licence tester can reach the bound checkout');
const testerHost=new Node('div');recovery.testerHost=testerHost;
vm.runInContext('renderAdventureOffer(testerHost,pack)',recovery);
const testerText=testerHost.all().map(n=>n.textContent).join(' ');
assert.doesNotMatch(testerText,/temporairement suspendus/,'No pause notice for the tester');
const testerWaiver=testerHost.all().find(n=>n.dataset.offer==='waiver');
assert(testerWaiver,'The withdrawal waiver is shown before any Play sheet');assert.equal(testerWaiver.checked,false,'Never pre-ticked');
recovery.lumenCapabilities=[];
assert.equal(vm.runInContext('playBoundCheckoutAvailable()',recovery),false,'Revoking the capability closes the checkout again');

// #823/#833: purchases finished in the background are checked again on return, throttled.
{
 let runs=0,clock=1000;
 const onVisible=createForegroundRecovery({run:()=>runs++,now:()=>clock,minIntervalMs:60000});
 assert.equal(onVisible(),true);clock+=59999;assert.equal(onVisible(),false);clock+=1;assert.equal(onVisible(),true);
 assert.equal(runs,2,'At most one Google check per minute on foreground');
 assert.match(normalized,/const playForegroundRecovery=createForegroundRecovery\(\{run:\(\)=>void maybeRestorePlayPurchases\(\)\}\);\ndocument\.addEventListener\('visibilitychange',\(\)=>\{\n if\(document\.visibilityState==='visible'&&lumenUser&&!qaActive&&\(isPlayDistributedApp\(window\)\|\|playPriceLoader\.snapshot\(\)\.playApp\)\)playForegroundRecovery\(\);/);
 assert.match(normalized,/playCheckoutPaused:offer\.pricesRequired&&!playCheckoutOpen\(\{released:PLAY_CHECKOUT_AVAILABLE,capabilities:lumenCapabilities\}\)/);
}
console.log('play-billing-tests #833: licence-test capability gate and foreground recovery OK');
