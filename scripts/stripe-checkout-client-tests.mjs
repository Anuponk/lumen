// #730: client Stripe Checkout module with synthetic windows and server answers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STRIPE_TEST_CAPABILITY,rememberPlayAppLaunch,isPlayDistributedApp,stripeCheckoutAvailable,startStripeCheckout,stripeSessionStatus,
 restoreStripePurchases,consumeCheckoutReturn,waitForStripeConfirmation,stripeMessage,STRIPE_MESSAGES} from '../src/persistence/stripe-checkout.js';

// Web/PWA versus the Google Play app (TWA): Stripe is never offered in the Play app.
const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))}};
const browser={document:{referrer:'https://www.google.com/'},sessionStorage:storage()};
assert.equal(isPlayDistributedApp(browser),false);
const twa={document:{referrer:'android-app://fr.nopuna.lumen/'},sessionStorage:storage()};
rememberPlayAppLaunch(twa);assert.equal(isPlayDistributedApp(twa),true);
twa.document.referrer='https://lumen.nopuna.fr/';assert.equal(isPlayDistributedApp(twa),true,'the Play launch is remembered after in-app navigation');
// Regression (17/11/2026, Chrome Android, Lumen 646): Chrome exposes getDigitalGoodsService
// outside the Play app, where it only rejects. Its presence alone is not the Play app;
// a Play service that actually resolved is (stripeCheckoutAvailable: playBilling).
const chromeAndroid={document:{referrer:''},sessionStorage:storage(),getDigitalGoodsService:async()=>{throw Error('unsupported context')}};
assert.equal(isPlayDistributedApp(chromeAndroid),false,'Chrome Android outside the Play app is the web');
assert.equal(stripeCheckoutAvailable({capabilities:[STRIPE_TEST_CAPABILITY],signedIn:true,playApp:isPlayDistributedApp(chromeAndroid),playBilling:null}),true,'Stripe offered in Chrome Android');
assert.equal(isPlayDistributedApp({document:{referrer:''},sessionStorage:storage(),LUMEN_NATIVE_APP:true}),true);
const caps=[{capability:STRIPE_TEST_CAPABILITY}];
assert.equal(stripeCheckoutAvailable({capabilities:caps,signedIn:true}),true,'test account on the web');
assert.equal(stripeCheckoutAvailable({capabilities:[STRIPE_TEST_CAPABILITY],signedIn:true}),true);
assert.equal(stripeCheckoutAvailable({capabilities:[],signedIn:true}),false,'real players never see the TEST checkout');
assert.equal(stripeCheckoutAvailable({capabilities:caps,signedIn:true,playApp:true}),false,'never in the Play app');
assert.equal(stripeCheckoutAvailable({capabilities:caps,signedIn:true,playBilling:{}}),false,'Play Billing wins');
assert.equal(stripeCheckoutAvailable({capabilities:caps,signedIn:true,qaActive:true}),false);
assert.equal(stripeCheckoutAvailable({capabilities:caps,signedIn:false}),false,'account required');

// Checkout start: only the product id and the waiver are sent, never a price.
const transport=(status,body,seen=[])=>({endpoint:'https://x/functions/v1/lumen-stripe-checkout',apiKey:'k',accessToken:'jwt',
 fetchImpl:async(url,init)=>{seen.push({url,init});return new Response(JSON.stringify(body),{status})}});
const seen=[];let navigated=null;const waiver={accepted:true};
let r=await startStripeCheckout({...transport(200,{url:'https://checkout.stripe.com/c/pay/cs_test_1'},seen),productId:'real-adventure-02',waiver,navigate:u=>{navigated=u}});
assert.equal(r.status,'redirecting');assert.equal(navigated,'https://checkout.stripe.com/c/pay/cs_test_1');
assert.deepEqual(JSON.parse(seen[0].init.body),{mode:'checkout',productId:'real-adventure-02',waiver:true});
assert.equal(seen[0].init.headers.authorization,'Bearer jwt');
navigated=null;
r=await startStripeCheckout({...transport(200,{url:'https://evil.example/pay'}),productId:'real-adventure-02',waiver,navigate:u=>{navigated=u}});
assert.equal(r.status,'error');assert.equal(navigated,null,'only a Stripe Checkout URL is opened');
assert.equal((await startStripeCheckout({...transport(200,{}),productId:'p',waiver:{accepted:false},navigate(){}})).status,'waiver','#732 waiver required');
for(const [status,body,expected] of [[409,{error:'checkout_in_progress'},'busy'],[409,{error:'already_owned'},'already_owned'],[409,{error:'sky_after_single'},'sky_after_single'],
 [403,{error:'not_eligible'},'not_eligible'],[429,{},'rate_limited'],[401,{},'session'],[503,{},'error'],[502,{},'error']])
 assert.equal((await startStripeCheckout({...transport(status,body),productId:'p',waiver,navigate(){}})).status,expected);
assert.equal((await startStripeCheckout({fetchImpl:async()=>{throw Error('offline')},endpoint:'e',apiKey:'k',accessToken:'jwt',productId:'p',waiver,navigate(){}})).status,'error');

// Return from Stripe: parameters are read once and removed from the address bar.
const win=(href)=>{const w={location:{href},history:{replaceState:(_s,_t,u)=>{w.replaced=u}}};return w};
let w=win('https://lumen.nopuna.fr/?lumen_checkout=success&session_id=cs_test_abc123#sky');
assert.deepEqual(consumeCheckoutReturn(w),{kind:'success',sessionId:'cs_test_abc123'});assert.equal(w.replaced,'/#sky');
w=win('https://lumen.nopuna.fr/?lumen_checkout=success&session_id=%7BCHECKOUT_SESSION_ID%7D');assert.deepEqual(consumeCheckoutReturn(w),{kind:'success',sessionId:null});
w=win('https://lumen.nopuna.fr/?lumen_checkout=cancel&qa=new');assert.deepEqual(consumeCheckoutReturn(w),{kind:'cancel',sessionId:null});assert.equal(w.replaced,'/?qa=new');
assert.equal(consumeCheckoutReturn(win('https://lumen.nopuna.fr/?x=1')),null);

// Server confirmation: polling stops on a settled state; never « confirmed » before "paid".
let n=0;const answers=['open','pending','paid'];const progress=[];
let final=await waitForStripeConfirmation({check:async()=>({status:answers[Math.min(n++,2)]}),sleep:async()=>{},onProgress:x=>progress.push(x.status)});
assert.equal(final.status,'paid');assert.deepEqual(progress,['open','pending']);
final=await waitForStripeConfirmation({check:async()=>({status:'pending'}),attempts:3,sleep:async()=>{}});assert.equal(final.status,'pending','still pending: never success');
final=await waitForStripeConfirmation({check:async()=>({status:'failed'}),sleep:async()=>{throw Error('no wait expected')}});assert.equal(final.status,'failed');
assert.deepEqual(await stripeSessionStatus({...transport(200,{productId:'real-adventure-02',status:'paid',adventures:['real-adventure-02']}),sessionId:'cs_test_1'}),{status:'paid',productId:'real-adventure-02',adventures:['real-adventure-02']},'the product is known for the thank-you screen');
assert.deepEqual(await stripeSessionStatus({...transport(404,{error:'unknown_session'}),sessionId:'cs_test_1'}),{status:'unknown'});
assert.deepEqual(await stripeSessionStatus({...transport(503,{}),sessionId:'cs_test_1'}),{status:'error'});

// Messages: one clear message per state; only "paid" says confirmed.
for(const s of ['checking','pending','open','cancel','failed','expired','refunded','disputed','error','unknown'])
 assert.doesNotMatch(stripeMessage(s),/confirmé ✓|restaurés/,s+' is never a success');
assert.match(stripeMessage('paid'),/Achat confirmé ✓/);assert.equal(stripeMessage('whatever'),STRIPE_MESSAGES.error);
assert.match(stripeMessage('refunded'),/progression est conservée/);
assert.doesNotMatch(stripeMessage('error'),/Restaurer/,'no manual restore any more: automatic at the next sign-in');
assert.match(stripeMessage('error'),/automatiquement/);
assert.deepEqual(await restoreStripePurchases(transport(503,{})),[{status:'error'}]);
assert.deepEqual(await restoreStripePurchases(transport(200,{results:[{status:'paid'}]})),[{status:'paid'}]);

// Wiring in the game screen.
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
assert.match(screen,/'\/functions\/v1\/lumen-stripe-checkout'/);
assert.match(screen,/stripeCheckoutAvailable\(\{capabilities:lumenCapabilities,playApp:isPlayDistributedApp\(window\),playBilling,qaActive,signedIn:!!lumenUser\}\)/);
assert.match(screen,/if\(!playBilling&&stripeAvailable\(\)\)return purchaseWithStripe\(productId,\{setStatus,setBusy,waiver\}\);/);
assert.match(screen,/showPurchaseStatus\(stripeMessage\(result\.status==='open'\?'pending':result\.status\)\);\r?\n *if\(result\.status==='paid'\)thankForPurchase\(result\.productId\);/,'thank-you only after server "paid"');
assert.match(screen,/if\(!lumenUser\|\|qaActive\|\|!waiver\?\.accepted\)return;/,'#732 waiver checked before any Stripe call');
assert.match(screen,/if\(result\.status==='paid'\)\{await loadEntitlements\(\);if\(lumenUser\?\.id!==owner\)return;skyNavigation\.render\(\)\}\n?\r?\n? *showPurchaseStatus/,'confirmed only after server "paid" and reloaded entitlements');
assert.match(screen,/rememberPlayAppLaunch\(window\);\r?\nlet stripeCheckoutReturn=consumeCheckoutReturn\(window\);/);
assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/<p id="purchaseStatus" class="purchase-status" role="status" aria-live="polite" hidden><\/p>/);
console.log('stripe-checkout-client-tests: web-only availability, Play isolation, checkout start, return, confirmation, messages and wiring OK');
