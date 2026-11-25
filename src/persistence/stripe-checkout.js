// #730: Stripe Checkout on the web/PWA only (TEST phase). The Edge Function
// lumen-stripe-checkout creates the session from the server catalogue; the server
// (webhook or the post-return read-back) records the payment through #728. This module
// never grants: a Stripe return URL is only a cue to ask the server.
export const STRIPE_TEST_CAPABILITY='stripe_test_checkout';
const PLAY_APP_KEY='lumenPlayAppLaunch';

// The Play app (TWA) opens Lumen with an android-app:// referrer on its first page;
// remember it for the whole tab session. Stripe is never offered inside the Play app.
export function rememberPlayAppLaunch(win=globalThis){
 try{if(String(win.document?.referrer||'').startsWith('android-app://'))win.sessionStorage?.setItem(PLAY_APP_KEY,'1')}catch(_){}
}
// Chrome Android exposes getDigitalGoodsService outside the Play app too (it then rejects):
// its presence is not a signal. A Play service that resolved is passed as playBilling.
export function isPlayDistributedApp(win=globalThis){
 if(win.LUMEN_NATIVE_APP===true)return true;
 if(String(win.document?.referrer||'').startsWith('android-app://'))return true;
 try{return win.sessionStorage?.getItem(PLAY_APP_KEY)==='1'}catch(_){return false}
}
// Test phase: only accounts holding the server capability see the Stripe button.
// channel comes from the server (lumen_payment_channel): 'live' once real sales are switched
// on, 'test' for a test account, 'off' otherwise. The test capability stays a fallback.
export function stripeCheckoutAvailable({channel='off',capabilities=[],playApp=false,playBilling=null,qaActive=false,signedIn=false}={}){
 if(qaActive||playApp||playBilling||!signedIn)return false;
 if(channel==='live'||channel==='test')return true;
 return capabilities.some(c=>(typeof c==='string'?c:c?.capability)===STRIPE_TEST_CAPABILITY);
}

async function call({fetchImpl=fetch,endpoint,apiKey,accessToken,body}){
 if(!accessToken)return {http:401,body:{error:'session'}};
 try{
  const response=await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+accessToken,apikey:apiKey},body:JSON.stringify(body)});
  return {http:response.status,body:await response.json().catch(()=>({}))};
 }catch(_){return {http:0,body:{error:'network'}}}
}

// Start a checkout with the product id, waiver and display language. The server owns the price.
// Returns {status:'redirecting'|'busy'|'already_owned'|'sky_after_single'|'offer_changed'|'not_eligible'|'rate_limited'|'session'|'error'}.
export async function startStripeCheckout({productId,waiver,navigate,locale,...transport}){
 if(waiver?.accepted!==true)return {status:'waiver'};
 const {http,body}=await call({...transport,body:{mode:'checkout',productId,waiver:true,locale}});
 if(http===200&&typeof body.url==='string'&&body.url.startsWith('https://checkout.stripe.com/')){navigate(body.url);return {status:'redirecting'}}
 if(http===409&&body.error==='checkout_in_progress')return {status:'busy'};
 if(http===409&&(body.error==='already_owned'||body.error==='sky_after_single'||body.error==='offer_changed'))return {status:body.error};
 if(http===403)return {status:'not_eligible'};
 if(http===429)return {status:'rate_limited'};
 if(http===401)return {status:'session'};
 return {status:'error'};
}

// Server status of one session (read back from Stripe by the server).
export async function stripeSessionStatus({sessionId,...transport}){
 const {http,body}=await call({...transport,body:{mode:'status',sessionId}});
 if(http===200&&typeof body.status==='string')return {status:body.status,productId:typeof body.productId==='string'?body.productId:null,adventures:body.adventures||[]};
 if(http===404)return {status:'unknown'};
 return {status:'error'};
}
export async function restoreStripePurchases(transport){
 const {http,body}=await call({...transport,body:{mode:'restore'}});
 if(http===200&&Array.isArray(body.results))return body.results;
 return [{status:'error'}];
}

// Read the Stripe return parameters once, then remove them from the address bar so a
// reload or a shared link never replays them.
export function consumeCheckoutReturn(win=globalThis){
 try{
  const url=new URL(win.location.href),kind=url.searchParams.get('lumen_checkout');
  if(kind!=='success'&&kind!=='cancel')return null;
  const sessionId=url.searchParams.get('session_id');
  url.searchParams.delete('lumen_checkout');url.searchParams.delete('session_id');
  win.history?.replaceState?.(null,'',url.pathname+(url.search||'')+url.hash);
  return {kind,sessionId:kind==='success'&&/^cs_(test|live)_[A-Za-z0-9]{1,190}$/.test(sessionId||'')?sessionId:null};
 }catch(_){return null}
}

// Ask the server until the payment is settled. Webhooks may arrive a few seconds late.
const SETTLED=['paid','failed','expired','refunded','disputed','unknown'];
export async function waitForStripeConfirmation({check,attempts=8,delayMs=2500,sleep=ms=>new Promise(r=>setTimeout(r,ms)),onProgress=()=>{}}){
 let last={status:'error'};
 for(let i=0;i<attempts;i++){
  last=await check();
  if(SETTLED.includes(last.status))return last;
  onProgress(last);
  if(i<attempts-1)await sleep(delayMs);
 }
 return last;
}

export const STRIPE_MESSAGES={
 redirecting:'Ouverture du paiement sécurisé Stripe…',
 checking:'Paiement en cours de confirmation par le serveur…',
 paid:'Achat confirmé ✓ Bonne exploration !',
 pending:'Paiement en cours de confirmation : l’aventure se débloquera dès que Stripe l’aura validé.',
 open:'Paiement non finalisé : aucun achat n’a été enregistré. Tu peux réessayer depuis l’aventure.',
 cancel:'Paiement annulé : aucun achat n’a été enregistré.',
 failed:'Paiement refusé ou échoué : aucun achat n’a été enregistré.',
 expired:'Session de paiement expirée : aucun achat n’a été enregistré.',
 refunded:'Ce paiement a été remboursé : il ne débloque plus d’aventure. Ta progression est conservée.',
 disputed:'Ce paiement fait l’objet d’une contestation : l’accès qu’il donnait est suspendu pendant son examen.',
 busy:'Un paiement est déjà en cours d’ouverture : patiente quelques secondes.',
 already_owned:'Tu possèdes déjà cette aventure.',
 sky_after_single:'Tu as déjà acheté une aventure : l’offre « Tout débloquer » est désormais ajustée à tes achats. Rouvre la boutique pour la voir.',
 offer_changed:'Ton offre « Tout débloquer » a changé (nouvel achat ou remboursement). Rouvre la boutique pour voir le prix à jour.',
 not_eligible:'Le paiement par carte n’est pas encore ouvert pour ce compte.',
 rate_limited:'Trop de tentatives de paiement : réessaie dans une heure.',
 session:'Reconnecte-toi pour acheter cette aventure.',
 unknown:'Paiement introuvable pour ce compte : aucun achat n’a été enregistré.',
 error:'Confirmation impossible pour le moment. Si tu as payé, ton achat sera retrouvé automatiquement à ta prochaine connexion.',
};
export function stripeMessage(status){return STRIPE_MESSAGES[status]||STRIPE_MESSAGES.error}
