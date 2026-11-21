import {createTranslator} from '../ui/i18n.js';
// #729: Google Play Billing inside the Play-distributed app (TWA), through the
// Digital Goods API and Payment Request. The purchase token is verified and recorded
// by the server (Edge Function lumen-play-purchase → #728); this module never grants.
// Outside the Play app (browser, iPhone) getDigitalGoodsService is absent: no Play offer.
// Release switch. See android/PLAY.md for the server and Android acceptance checks.
export const PLAY_CHECKOUT_AVAILABLE=true;
export const PLAY_BILLING_METHOD='https://play.google.com/billing';
export const PLAY_BINDING_PROBE='lumen_internal_bound_checkout_v1';
// #833: the licence-tester acceptance needs a real Play sheet while public sales stay
// closed. Only accounts holding this server capability (lumen.internal_capabilities,
// granted by the owner, optionally with an expiry) see the checkout. It never grants a
// right: the server still verifies and records every token like any other purchase.
export const PLAY_TEST_CAPABILITY='play_test_checkout';
export function playCheckoutOpen({released=PLAY_CHECKOUT_AVAILABLE,capabilities=[]}={}){
 if(released===true)return true;
 return Array.isArray(capabilities)&&capabilities.some(c=>(typeof c==='string'?c:c?.capability)===PLAY_TEST_CAPABILITY);
}
// #823/#833: check Play purchases again when the app returns to the foreground,
// at most once per interval (each check reads Google through the server).
export function createForegroundRecovery({run,now=()=>Date.now(),minIntervalMs=60000}={}){
 let last=-Infinity;
 return function onVisible(){
  const t=now();
  if(t-last<minIntervalMs)return false;
  last=t;run();return true;
 };
}
// Play Console disallows hyphens in product IDs. Internal pack IDs remain unchanged.
export function toPlayProductId(id){return /^(real-adventure-0[2-9]|real-sky-all|real-sky-upgrade-[1-4])$/.test(id)?id.replaceAll('-','_'):id}


export async function getPlayPurchaseService(win=globalThis,onDiagnostic=()=>{}){
 if(typeof win?.getDigitalGoodsService!=='function'){onDiagnostic({reason:'service_unavailable'});return null}
 try{
  const service=await win.getDigitalGoodsService(PLAY_BILLING_METHOD)||null;
  if(!service)onDiagnostic({reason:'service_unavailable'});
  return service;
 }catch(_){onDiagnostic({reason:'service_unavailable'});return null}
}

// Server verification. Returns {status:'paid'|'pending'|'not_paid'|'owned_elsewhere'|'error', adventures?, acknowledged?}.
export async function verifyPlayPurchase({fetchImpl=fetch,endpoint,apiKey,accessToken,productId,purchaseToken}){
 if(!accessToken)return {status:'error',reason:'session'};
 try{
  const response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+accessToken,apikey:apiKey},
   body:JSON.stringify({mode:'verify',productId,purchaseToken})});
  const body=await response.json().catch(()=>({}));
  if(response.status===200&&body.status==='paid')return {status:'paid',adventures:body.adventures||[],acknowledged:!!body.acknowledged};
  if(response.status===202)return {status:'pending'};
  if(response.status===409&&body.error==='purchase_owned_elsewhere')return {status:'owned_elsewhere'};
  if(response.status===409&&body.error==='purchase_account_unverified')return {status:'account_unverified'};
  if(response.status===409&&body.error==='offer_not_eligible')return {status:'offer_not_eligible'}; // #865
  if(response.status===409&&body.status==='not_paid')return body.revoked===true?{status:'not_paid',revoked:true}:{status:'not_paid'};
  if(response.status===400&&body.error==='invalid_purchase')return {status:'not_paid',reason:'invalid_purchase'}; // #864: Google no longer knows this token.
  return {status:'error',reason:body.error||String(response.status)};
 }catch(_){return {status:'error',reason:'network'}}
}

// One purchase. The Play sheet collects payment; the server decides what it grants.
export async function buyWithPlay({win=globalThis,productId,obfuscatedAccountId,verify}){
 if(typeof obfuscatedAccountId!=='string'||!/^[0-9a-f]{64}$/.test(obfuscatedAccountId))return {status:'error',reason:'account_binding'};
 let response;
 try{
  const request=new win.PaymentRequest([{supportedMethods:PLAY_BILLING_METHOD,data:{sku:productId,obfuscatedAccountId}}],
   {total:{label:'Lumen',amount:{currency:'EUR',value:'0'}}}); // Play shows its own price; total is required by the API.
  response=await request.show();
 }catch(error){return error?.name==='AbortError'?{status:'cancelled'}:{status:'error',reason:'payment_unsupported'}}
 const token=response?.details?.purchaseToken;
 if(!token){try{await response.complete('fail')}catch(_){}return {status:'error',reason:'token'}}
 const result=await verify(productId,token);
 try{await response.complete(result.status==='paid'||result.status==='pending'?'success':'fail')}catch(_){}
 return result;
}

// Restore after reinstall/new device, and retry acknowledgements: the server call is idempotent.
// #823: manual recovery asks for reportListFailure so that an unreadable
// Play purchase list is shown as a failure, never as « nothing to restore ».
export async function restorePlayPurchases({service,verify,reportListFailure=false}){
 let items;
 try{items=await service.listPurchases()}catch(_){/* An unavailable list cannot establish ownership. */}
 if(!Array.isArray(items))return reportListFailure?[{itemId:null,status:'error',reason:'list'}]:[];
 const results=[];
 for(const item of items){
  if(!item?.itemId||!item?.purchaseToken){
   if(reportListFailure)results.push({itemId:null,status:'error',reason:'invalid_inventory_item'});
   continue;
  }
  results.push({itemId:item.itemId,...await verify(item.itemId,item.purchaseToken)});
 }
 return results;
}

// #864: a non-consumable belongs to the device's Google Play account, not to the
// signed-in Lumen account. Before opening (and after a failed) Play sheet, read Play's
// local list for this SKU so that ITEM_ALREADY_OWNED becomes an explained state.
// 'unknown' never proves absence: the caller may still let Play decide (no double charge).
export async function findOwnedPlayPurchase(service,sku){
 let items;
 try{items=await service?.listPurchases?.()}catch(_){/* An unreadable list proves nothing. */}
 if(!Array.isArray(items))return {status:'unknown'};
 const item=items.find(i=>i?.itemId===sku&&typeof i.purchaseToken==='string'&&i.purchaseToken);
 return item?{status:'owned',purchase:{itemId:item.itemId,purchaseToken:item.purchaseToken}}:{status:'not_owned'};
}

// #864: what a server verification of a purchase already held by Google Play means for
// the signed-in Lumen account. Never suggests a transfer between Lumen accounts.
const playFrench=createTranslator().t;
export function playOwnershipMessage(status,title,t=playFrench){
 const name=title?t('store.playNamedItem',{title}):t('store.playThisItem');
 if(status==='owned_elsewhere')return t('store.playOwnedElsewhere',{name});
 if(status==='account_unverified')return t('store.playUnbound',{name});
 if(status==='not_paid')return t('store.playOwnedRevoked',{name});
 if(status==='pending')return t('store.playOwnedPending',{name});
 if(status==='offer_not_eligible')return t('store.playOfferChanged');
 return t('store.playOwnedUnavailable',{name});
}

// Group once per state and keep the open offer first (#878).
const SUMMARY_STATES=['owned_elsewhere','account_unverified','not_paid'];
const SUMMARY_KEYS={owned_elsewhere:'Elsewhere',account_unverified:'Unbound',not_paid:'Revoked'};
export function playOwnershipSummary(results,titleOf=()=>'',{focus=null,t=playFrench,locale='fr'}={}){
 const groups=new Map(SUMMARY_STATES.map(state=>[state,[]]));
 const ordered=[...(Array.isArray(results)?results:[])].sort((a,b)=>(b?.itemId===focus)-(a?.itemId===focus));
 for(const r of ordered){
  const group=groups.get(r?.status);
  if(!group||(r.status==='not_paid'&&!r.revoked))continue;
  const title=titleOf(r.itemId)||'';
  if(!group.includes(title))group.push(title);
 }
 if(!groups.get('owned_elsewhere').length&&!groups.get('account_unverified').length)return '';
 const total=[...groups.values()].reduce((n,g)=>n+g.length,0);
 if(total===1){const [state,[title]]=[...groups].find(([,g])=>g.length);return playOwnershipMessage(state,title,t)}
 const list=new Intl.ListFormat(locale);
 const focusTitle=focus?titleOf(focus)||null:null,leads=state=>focusTitle!==null&&groups.get(state).includes(focusTitle);
 const states=SUMMARY_STATES.filter(state=>groups.get(state).length).sort((a,b)=>leads(b)-leads(a));
 const details=states.map(state=>{
  const titles=groups.get(state);
  const items=list.format(titles.map(title=>title?t('store.playNamedItem',{title}):t('store.playAnItem')));
  return t('store.playSummary'+SUMMARY_KEYS[state]+(titles.length>1?'Many':'One'),{items});
 }).join(' ');
 return t('store.playSummaryIntro',{details});
}

// Only validated provider prices. Never substitute catalogue prices in the Play app.
export async function playPrices(service,ids,{onDiagnostic=()=>{},locale='fr-FR'}={}){
 try{
  const details=await service.getDetails(ids);
  if(!Array.isArray(details))throw Error('Invalid details response');
  const prices={};
  for(const id of ids){
   const matches=details.filter(d=>d?.itemId===id),d=matches[0],v=d?.price;
   let reason=!d?'product_not_found':d.available===false?'product_not_available':null;
   if(!reason){
    try{
     if(matches.length!==1||typeof v?.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency)||
      !Intl.supportedValuesOf('currency').includes(v.currency)||typeof v.value!=='string'||
      !/^\d+(?:\.\d+)?$/.test(v.value)||!Number.isFinite(Number(v.value))||Number(v.value)<=0)throw Error('Invalid price');
     prices[id]=new Intl.NumberFormat(locale,{style:'currency',currency:v.currency}).format(Number(v.value));
    }catch(_){reason='price_parse_failed'}
   }
   if(reason)onDiagnostic({reason,productId:id});
  }
  return prices;
 }catch(_){onDiagnostic({reason:'details_request_failed'});return {}}
}

// Ephemeral price lifecycle: no tokens, user data, purchases or entitlements.
// Coalesce retries, time out stalled providers, and notify an already-open offer.
// #865: optionalIds (upgrade SKUs) are priced when Play Console offers them; their absence
// is expected before activation and is never a checkout error.
export function createPlayPriceLoader({win=globalThis,ids,optionalIds=[],playApp=false,probeBinding=false,onChange=()=>{},onDiagnostic=()=>{},timeoutMs=12000}={}){
 let state={status:'idle',playApp,service:null,prices:{},errors:[],supportsBinding:false,paymentSupported:false},pending=null;
 const publish=next=>{state={...state,...next};onChange(state)};
 const deadline=promise=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('timeout')),timeoutMs);
  Promise.resolve(promise).then(resolve,reject).finally(()=>clearTimeout(timer));
 });
 function load(){
  if(pending)return pending;
  publish({status:'loading',prices:{},errors:[],supportsBinding:false,paymentSupported:false});
  pending=(async()=>{
   const errors=[],diagnostic=event=>errors.push(event);
   let service=null,prices={},supportsBinding=false,paymentSupported=false;
   try{service=await deadline(getPlayPurchaseService(win,diagnostic))}
   catch{diagnostic({reason:'service_unavailable'})}
   if(service){
    publish({playApp:true});
    try{
     const optional=new Set(optionalIds.map(toPlayProductId)),all=[...ids,...optionalIds];
     const labels=await deadline(playPrices(service,all.map(toPlayProductId),{onDiagnostic:event=>{if(!optional.has(event?.productId))diagnostic(event)},locale:win.navigator?.language||'fr-FR'}));
     prices=Object.fromEntries(all.filter(id=>labels[toPlayProductId(id)]).map(id=>[id,labels[toPlayProductId(id)]]));
    }catch{diagnostic({reason:'details_request_failed'})}
    if(probeBinding){
     try{
      const marker=await deadline(service.getDetails([PLAY_BINDING_PROBE]));
      supportsBinding=Array.isArray(marker)&&marker.length===1
       &&marker[0]?.itemId===PLAY_BINDING_PROBE&&marker[0].title===PLAY_BINDING_PROBE;
      if(!supportsBinding)diagnostic({reason:'binding_probe_unsupported'});
     }catch{diagnostic({reason:'binding_probe_failed'})}
    }
    if(typeof win.PaymentRequest!=='function')diagnostic({reason:'payment_unsupported'});
    else if(Object.keys(prices).length){
     try{
      const request=new win.PaymentRequest([{supportedMethods:PLAY_BILLING_METHOD,data:{sku:toPlayProductId(Object.keys(prices)[0])}}],{total:{label:'Lumen',amount:{currency:'EUR',value:'0'}}});
      paymentSupported=typeof request.canMakePayment==='function'&&await deadline(request.canMakePayment())===true;
     }catch{/* The provider could not establish payment readiness. */}
     if(!paymentSupported)diagnostic({reason:'payment_unsupported'});
    }
   }
   for(const event of errors)onDiagnostic(event);
   publish({status:Object.keys(prices).length&&service?(errors.length?'partial':'ready'):'error',service,prices,errors:[...errors],supportsBinding,paymentSupported});
   return service;
  })().finally(()=>{pending=null});
  return pending;
 }
 return {load,snapshot:()=>state};
}
