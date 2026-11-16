// #729: Google Play Billing inside the Play-distributed app (TWA), through the
// Digital Goods API and Payment Request. The purchase token is verified and recorded
// by the server (Edge Function lumen-play-purchase → #728); this module never grants.
// Outside the Play app (browser, iPhone) getDigitalGoodsService is absent: no Play offer.
export const PLAY_BILLING_METHOD='https://play.google.com/billing';

export async function getPlayBilling(win=globalThis){
 if(typeof win?.getDigitalGoodsService!=='function'||typeof win?.PaymentRequest!=='function')return null;
 try{return await win.getDigitalGoodsService(PLAY_BILLING_METHOD)||null}catch(_){return null}
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
  if(response.status===409)return {status:'not_paid'};
  return {status:'error',reason:body.error||String(response.status)};
 }catch(_){return {status:'error',reason:'network'}}
}

// One purchase. The Play sheet collects payment; the server decides what it grants.
export async function buyWithPlay({win=globalThis,productId,verify}){
 let response;
 try{
  const request=new win.PaymentRequest([{supportedMethods:PLAY_BILLING_METHOD,data:{sku:productId}}],
   {total:{label:'Lumen',amount:{currency:'EUR',value:'0'}}}); // Play shows its own price; total is required by the API.
  response=await request.show();
 }catch(_){return {status:'cancelled'}}
 const token=response?.details?.purchaseToken;
 if(!token){try{await response.complete('fail')}catch(_){}return {status:'error',reason:'token'}}
 const result=await verify(productId,token);
 try{await response.complete(result.status==='paid'||result.status==='pending'?'success':'fail')}catch(_){}
 return result;
}

// Restore after reinstall/new device, and retry acknowledgements: the server call is idempotent.
// #731: the manual « Restaurer mes achats » asks for reportListFailure so that an unreadable
// Play purchase list is shown as a failure, never as « nothing to restore ».
export async function restorePlayPurchases({service,verify,reportListFailure=false}){
 let items=[];
 try{items=await service.listPurchases()}catch(_){return reportListFailure?[{itemId:null,status:'error',reason:'list'}]:[]}
 const results=[];
 for(const item of items||[]){
  if(!item?.itemId||!item?.purchaseToken)continue;
  results.push({itemId:item.itemId,...await verify(item.itemId,item.purchaseToken)});
 }
 return results;
}

// Localised Play prices for display (falls back to catalogue prices when unavailable).
export async function playPrices(service,ids){
 try{
  const details=await service.getDetails(ids);
  return Object.fromEntries((details||[]).map(d=>{
   const v=d?.price;let label=null;
   try{label=new Intl.NumberFormat('fr-FR',{style:'currency',currency:v.currency}).format(Number(v.value))}catch(_){}
   return [d.itemId,label];
  }).filter(([,label])=>label));
 }catch(_){return {}}
}
