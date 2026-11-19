// #729: Google Play Billing inside the Play-distributed app (TWA), through the
// Digital Goods API and Payment Request. The purchase token is verified and recorded
// by the server (Edge Function lumen-play-purchase → #728); this module never grants.
// Outside the Play app (browser, iPhone) getDigitalGoodsService is absent: no Play offer.
// The shipped Android Browser Helper does not forward a Play account binding.
export const PLAY_CHECKOUT_AVAILABLE=false;
export const PLAY_BILLING_METHOD='https://play.google.com/billing';
// Play Console disallows hyphens in product IDs. Internal pack IDs remain unchanged.
export function toPlayProductId(id){return /^real-adventure-0[2-9]$/.test(id)||id==='real-sky-all'?id.replaceAll('-','_'):id}


export async function getPlayBilling(win=globalThis,onDiagnostic=()=>{}){
 if(typeof win?.PaymentRequest!=='function'){onDiagnostic({reason:'payment_unsupported'});return null}
 return getPlayPurchaseService(win,onDiagnostic);
}

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
  if(response.status===409&&body.status==='not_paid')return body.revoked===true?{status:'not_paid',revoked:true}:{status:'not_paid'};
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
  if(!item?.itemId||!item?.purchaseToken)continue;
  results.push({itemId:item.itemId,...await verify(item.itemId,item.purchaseToken)});
 }
 return results;
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
export function createPlayPriceLoader({win=globalThis,ids,playApp=false,checkPayment=true,onChange=()=>{},onDiagnostic=()=>{},timeoutMs=12000}={}){
 let state={status:'idle',playApp,service:null,prices:{},errors:[]},pending=null;
 const publish=next=>{state={...state,...next};onChange(state)};
 const deadline=promise=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('timeout')),timeoutMs);
  Promise.resolve(promise).then(resolve,reject).finally(()=>clearTimeout(timer));
 });
 function load(){
  if(pending)return pending;
  publish({status:'loading',prices:{},errors:[]});
  pending=(async()=>{
   const errors=[],diagnostic=event=>errors.push(event);
   let service=null,prices={},stage='service_unavailable';
   try{
    service=await deadline((checkPayment?getPlayBilling:getPlayPurchaseService)(win,diagnostic));
    if(service){
     publish({playApp:true});
     stage='details_request_failed';
     const labels=await deadline(playPrices(service,ids.map(toPlayProductId),{onDiagnostic:diagnostic,locale:win.navigator?.language||'fr-FR'}));
     prices=Object.fromEntries(ids.filter(id=>labels[toPlayProductId(id)]).map(id=>[id,labels[toPlayProductId(id)]]));
     if(checkPayment&&Object.keys(prices).length){
      stage='payment_unsupported';
      const request=new win.PaymentRequest([{supportedMethods:PLAY_BILLING_METHOD,data:{sku:toPlayProductId(Object.keys(prices)[0])}}],{total:{label:'Lumen',amount:{currency:'EUR',value:'0'}}});
      if(typeof request.canMakePayment==='function'&&!await deadline(request.canMakePayment()))throw Error('unsupported');
     }
    }
   }catch(_){diagnostic({reason:stage});if(stage==='payment_unsupported')service=null}
   for(const event of errors)onDiagnostic(event);
   publish({status:Object.keys(prices).length&&service?(errors.length?'partial':'ready'):'error',service,prices,errors:[...errors]});
   return service;
  })().finally(()=>{pending=null});
  return pending;
 }
 return {load,snapshot:()=>state};
}
