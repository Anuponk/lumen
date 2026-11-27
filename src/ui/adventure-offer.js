import {adventureDisplayName} from './adventure-copy.js';
import {createTranslator} from './i18n.js';
// #731: paid offers, the free path through 100% mastery of the previous Adventure, and why
// Lumen is paid. Purchases stay disabled until a payment provider is connected
// (#729/#730); the server always decides what is granted (#728).
import {adventureMastery} from './mastery-unlock.js';
import {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,SKY_PRODUCT_ID,SKY_UPGRADE_PRODUCT_IDS,formatEuros} from '../campaign/store-catalogue.js';

const french=createTranslator().t;

export const SUPPORT_LINE=french('store.support');
// #732: express request for immediate access and waiver of the 14-day withdrawal right
// (art. L221-28 13° Code de la consommation), never pre-ticked, required before paying.
export const WAIVER_TEXT='Je demande l’accès immédiat à mon achat et je renonce à mon droit de rétractation de 14 jours.';
// #863: shown in red under the box when « Choisir » / « Tout débloquer » is pressed unticked.
export const WAIVER_REQUIRED=french('store.waiverRequired');
export const RESTORE_LABEL=french('store.restore');
export const RESTORE_HINT=french('store.restoreHint');
let waiverIds=0;
export const SALES_TERMS_URL='/cgv.html';
export const SUPPORT_TEXT=french('store.whyCopy');

// Play decides the regional price. After a unit purchase, keep the existing
// eligibility rule for the whole-sky offer independent of the provider's price.
// #865: the whole-sky product is the server's sky_offer once its progress is known:
// real-sky-all (N=0), real-sky-upgrade-N (N=1..4, if active) or none (unlocked/inactive).
export function mainSkyOffer(skyProgress,{boughtSingle=false}={}){
 const known=typeof skyProgress?.unlocked==='boolean'&&Number.isInteger(skyProgress?.purchased);
 if(!known)return {known:false,product:boughtSingle?null:SKY_PRODUCT_ID,priceCents:null,purchased:null};
 const product=!skyProgress.unlocked&&(skyProgress.sky_offer===SKY_PRODUCT_ID||SKY_UPGRADE_PRODUCT_IDS.includes(skyProgress.sky_offer))?skyProgress.sky_offer:null;
 const priceCents=product&&skyProgress.sky_offer_currency==='EUR'&&Number.isInteger(skyProgress.sky_offer_price_cents)&&skyProgress.sky_offer_price_cents>0?skyProgress.sky_offer_price_cents:null;
 return {known:true,product,priceCents,purchased:skyProgress.purchased};
}
// #1030: premium={product,priceCents} replaces every new unit/whole-sky sale with the
// single LUMEN Premium offer (shop_premium switch). Mastery unlocks are unchanged.
export function adventureOfferModel({pack,packs,quests,progress,signedIn=false,accounts=true,purchasesAvailable=false,boughtSingle=false,skyProgress=null,prices={},pricesRequired=false,priceStatus='idle',priceErrors=[],masteryStatus='ready',masteryConfirmed=false,premium=null,t=french}){
 const ordered=[...(packs||[])].sort((a,b)=>a.order-b.order);
 const index=ordered.findIndex(p=>p.id===pack.id),previous=index>0?ordered[index-1]:null;
 const previousQuests=previous?(quests||[]).filter(q=>q.packId===previous.id):[];
 const mastery=previous?{
  previousName:adventureDisplayName(previous,t)||'',
  status:masteryStatus==='ready'&&!previousQuests.length?'unavailable':masteryStatus,
  confirmed:masteryStatus==='ready'&&masteryConfirmed,
  ...(masteryStatus==='ready'&&previousQuests.length
   ?adventureMastery(previousQuests,progress||{})
   :{mastered:false,missingQuests:null,missingBadges:null})
 }:null;
 // Only delivered grids in the real-sky product; ownership opens a sequence,
 // not every quest at once. Already accessible packs add no new content.
 const delivered=[...new Map((quests||[]).filter(q=>q.reg?.length&&q.sol?.length).map(q=>[q.id,q])).values()];
 const ready=ordered.every(p=>!p.accessStatus||p.accessStatus==='ready');
 const newlyAvailable=p=>p.accessible!==true&&p.access!=='included';
 const unitCount=ready?delivered.filter(q=>q.packId===pack.id&&newlyAvailable(ordered.find(p=>p.id===q.packId)||pack)).length:null;
 const skyIds=new Set(ordered.filter(p=>p.skyId==='real-sky'&&newlyAvailable(p)).map(p=>p.id));
 const skyQuests=ready?delivered.filter(q=>skyIds.has(q.packId)):null;
 const skyCount=skyQuests?.length??null;
 const skyConstellationCount=skyQuests?new Set(skyQuests.map(q=>q.constellationId).filter(Boolean)).size:null;
 const skyAdventureCount=skyQuests?new Set(skyQuests.map(q=>q.packId)).size:null;
 const missingPrice=priceStatus==='loading'?t('store.priceLoading'):t('store.priceUnavailable');
 const sky=mainSkyOffer(skyProgress,{boughtSingle});
 const skyProduct=sky.product||SKY_PRODUCT_ID,skyUpgrade=SKY_UPGRADE_PRODUCT_IDS.includes(sky.product);
 // Web price: the server catalogue price of this exact offer (what Stripe will charge).
 const webSkyPrice=sky.known?(sky.priceCents?formatEuros(sky.priceCents):null):formatEuros(SKY_PRICE_CENTS);
 return {id:pack.id,title:adventureDisplayName(pack,t)||t('sky.adventure'),unitCount,skyCount,skyConstellationCount,skyAdventureCount,pricesRequired,priceStatus,priceErrors,unitPriceKnown:!pricesRequired||!!prices[pack.id],skyPriceKnown:pricesRequired?!!prices[skyProduct]:!!webSkyPrice,unitPrice:prices[pack.id]||(pricesRequired?missingPrice:formatEuros(ADVENTURE_PRICE_CENTS)),skyPrice:prices[skyProduct]||(pricesRequired?missingPrice:webSkyPrice||t('store.priceUnavailable')),
  unitProduct:pack.id,skyProduct,showSky:!!sky.product,skyUpgrade,skyPurchased:sky.purchased,
  signedIn:!!signedIn,accounts:!!accounts,purchasesAvailable:!!purchasesAvailable,mastery,
  premium:premium?.product?{product:premium.product,price:prices[premium.product]||(pricesRequired?missingPrice:Number.isInteger(premium.priceCents)?formatEuros(premium.priceCents):t('store.priceUnavailable')),
   priceKnown:pricesRequired?!!prices[premium.product]:Number.isInteger(premium.priceCents)}:null};
}

export function purchaseProgressMessage(progress,t=french){
 if(typeof progress?.unlocked!=='boolean'||!Number.isInteger(progress.remaining)||progress.remaining<0||progress.remaining>5)return '';
 if(progress.unlocked)return t('store.allUnlocked');
 if(progress.remaining===0)return '';
 if(progress.remaining===5)return t('store.buyFive');
 if(progress.remaining===1)return t('store.buyOneMore');
 return t('store.buyMore',{count:progress.remaining});
}
export function masteryLine(model,t=french){
 const m=model.mastery;if(!m)return '';
 if(m.status==='loading')return t('store.progressLoading');
 if(m.status!=='ready')return t('store.progressUnavailable');
 if(m.confirmed)return t('store.freeConfirmed');
 if(m.mastered)return model.signedIn?t('store.masteredVerify')
  :t('store.masteredSignIn');
 const quests=t('store.questCount',{count:m.missingQuests});
 if(!m.missingBadges)return t('store.masteryQuests',{quests});
 const badges=t('store.badgeCount',{count:m.missingBadges});
 return m.missingQuests?t('store.masteryBoth',{quests,badges}):t('store.masteryBadges',{badges});
}

export function updateAdventureOfferMastery(section,model,{onClaim=()=>{},onContinue=()=>{},t=french}={}){
 if(!section||!model.mastery)return;
 const {previousName,confirmed,mastered}=model.mastery;
 const previous=previousName?t('store.previousName',{name:previousName}):'.';
 const line=masteryLine(model,t);
 const action=confirmed?t('sky.back'):mastered&&model.signedIn?t('store.verifyFree'):'';
 const view=JSON.stringify([previous,line,action]);
 if(section.dataset.masteryView===view)return;
 section.dataset.masteryView=view;
 const title=document.createElement('strong');title.textContent=t('store.didYouKnow');
 const condition=document.createElement('p');
 const requirement=document.createElement('b');requirement.textContent=t('store.masteryRequirement');
 condition.append(document.createTextNode(t('store.masteryIntro')),requirement,document.createTextNode(previous));
 const status=document.createElement('p');status.textContent=line;
 status.dataset.offerMasteryStatus='';status.setAttribute('role','status');
 section.replaceChildren(title,condition,status);
 if(action){
  const button=document.createElement('button');button.type='button';button.className='adventure-offer-claim';
  button.dataset.offer=confirmed?'mastery-continue':'mastery-claim';button.textContent=action;
  button.onclick=()=>confirmed?onContinue():onClaim(button);
  section.append(button);
 }
}

// #962: the generic "check your connection" misleads when Chrome lost the app's billing
// service; only closing and reopening the app fixes it.
export function playUnavailableKey(errors=[]){return (errors||[]).some(e=>e?.reason==='client_app_unavailable')?'store.playClientUnavailable':'store.playUnavailable'}
// #1029 (owner target 27/11/2026) + #1030: the compact LUMEN Premium offer. One
// illustration, one title, two benefits, one commercial CTA, one guarantee line,
// a short free path and discreet terms/restore. Sign-in is asked only when the
// purchase is triggered; the legal waiver appears at that moment, before paying.
// Never a disabled purchase button: an unavailable payment says so and the free
// exit (the notice's « Continuer gratuitement ») stays first-class.
export function mountPremiumOffer(host,model,{onBuy=async()=>{},onSignIn=()=>{},onClaim=()=>{},onContinue=()=>{},onRetry=()=>{},onRestorePlay=null,playCheckoutPaused=false,locale='fr',t=french}={}){
 const el=(tag,props={},text)=>{const e=document.createElement(tag);Object.assign(e,props);if(text!==undefined)e.textContent=text;return e};
 const root=el('div',{className:'premium-shop'});root.dataset.premiumOffer='';
 const art=el('div',{className:'premium-shop-art'});art.setAttribute('aria-hidden','true');
 const kicker=el('p',{className:'premium-shop-kicker'},model.title);
 const sub=el('p',{className:'premium-shop-sub'},t('premiumShop.subtitle'));
 const benefits=el('ul',{className:'premium-shop-benefits'});
 for(const key of ['premiumShop.benefitSky','premiumShop.benefitLimit'])benefits.append(el('li',{},t(key)));
 root.append(art,kicker,sub,benefits);
 const status=el('p',{className:'adventure-offer-status',hidden:true});status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.offerStatus='';
 let statusTimer=null,restoreButton=null;
 const setStatus=(text,{transient=false}={})=>{clearTimeout(statusTimer);status.textContent=text||'';status.hidden=!text;
  if(text&&transient){statusTimer=setTimeout(()=>{if(status.textContent===text)setStatus('')},3000);statusTimer?.unref?.()}};
 const price=model.premium.price,available=model.purchasesAvailable&&model.premium.priceKnown&&!playCheckoutPaused;
 const consent=el('div',{className:'premium-shop-consent',hidden:true});consent.dataset.offerConsent='';
 const label=el('label',{className:'adventure-offer-consent'}),waiver=el('input',{type:'checkbox',checked:false});waiver.dataset.offer='waiver';
 const errorId='offerWaiverError'+(++waiverIds),error=el('p',{className:'adventure-offer-waiver-error',id:errorId,hidden:true});error.setAttribute('role','alert');error.dataset.offerWaiverError='';
 waiver.setAttribute('aria-describedby',errorId);label.append(waiver,document.createTextNode(' '+WAIVER_TEXT));
 waiver.onchange=()=>{if(waiver.checked){error.hidden=true;error.textContent='';waiver.setAttribute('aria-invalid','false')}};
 const pay=el('button',{type:'button',className:'premium-shop-cta'},t('premiumShop.pay',{price}));pay.dataset.offer='premium';
 const buttons=[pay];
 const setBusy=busy=>{for(const b of buttons)b.disabled=busy;if(restoreButton)restoreButton.disabled=busy};
 pay.onclick=()=>{if(!waiver.checked){error.textContent=t('store.waiverRequired');error.hidden=false;waiver.setAttribute('aria-invalid','true');waiver.focus();return}
  onBuy(model.premium.product,{setStatus,setBusy,waiver:{accepted:true,text:WAIVER_TEXT,at:new Date().toISOString()}})};
 consent.append(label,error,pay);
 if(available){
  const cta=el('button',{type:'button',className:'premium-shop-cta'},t('premium.buy',{price}));cta.dataset.offer='premium-start';buttons.push(cta);
  cta.onclick=()=>{if(!model.signedIn){onSignIn();return}cta.hidden=true;consent.hidden=false;waiver.focus()};
  root.append(cta,consent);
 }else{
  const reason=model.pricesRequired?(playCheckoutPaused?t('store.playPaused'):model.priceStatus==='loading'?t('store.playLoading'):t(playUnavailableKey(model.priceErrors))):t('premiumShop.unavailable');
  const message=el('p',{className:'premium-shop-unavailable'},reason);message.setAttribute('role','status');message.dataset.playPriceReason=(model.priceErrors||[]).map(e=>e.reason).join(',');
  root.append(message);
  if(model.pricesRequired&&model.priceStatus!=='loading'){const retry=el('button',{type:'button',className:'premium-shop-retry'},t('app.retry'));retry.dataset.offer='retry';retry.onclick=()=>onRetry();root.append(retry)}
 }
 root.append(el('p',{className:'premium-shop-mentions'},t('store.oneTime')),status);
 if(model.mastery){
  const free=el('div',{className:'premium-shop-free'});
  const line=el('p',{},model.mastery.previousName?t('premiumShop.free',{name:model.mastery.previousName}):t('premiumShop.freeGeneric'));
  const details=el('aside',{className:'adventure-offer-mastery',hidden:!(model.mastery.mastered||model.mastery.confirmed)});details.dataset.offerMastery='';
  updateAdventureOfferMastery(details,model,{onClaim,onContinue,t});
  const toggle=el('button',{type:'button',className:'premium-shop-link'},t('premiumShop.progress'));toggle.dataset.offer='progress';
  toggle.setAttribute('aria-expanded',String(!details.hidden));
  toggle.onclick=()=>{details.hidden=!details.hidden;toggle.setAttribute('aria-expanded',String(!details.hidden))};
  free.append(line,toggle,details);root.append(free);
 }
 const terms=el('a',{className:'adventure-offer-terms',href:locale==='es'?'/condiciones-venta.html':locale==='en'?'/terms-of-sale.html':SALES_TERMS_URL,target:'_blank',rel:'noopener'},t('store.terms'));terms.dataset.offer='terms';
 const foot=el('p',{className:'premium-shop-foot'});foot.append(terms);
 if(onRestorePlay){
  restoreButton=el('button',{type:'button',className:'adventure-offer-restore'},t('store.restore'));restoreButton.dataset.offer='restore-play';
  restoreButton.onclick=async()=>{setBusy(true);setStatus(t('store.checkPlay'));try{const result=await onRestorePlay();restoreButton.textContent=t(result?.retry?'app.retry':'store.restore');if(typeof result==='string')setStatus(result);else setStatus(result?.text||'',{transient:!!result?.transient})}finally{setBusy(false)}};
  foot.append(document.createTextNode(' · '),restoreButton);
 }
 root.append(foot);
 host.replaceChildren(root);
 return root;
}
export function mountAdventureOffer(host,model,{onBuy=async()=>{},onSignIn=()=>{},onClaim=()=>{},onContinue=()=>{},onRetry=()=>{},onRestorePlay=null,playCheckoutPaused=false,locale="fr",t=french}={}){
 if(model.premium)return mountPremiumOffer(host,model,{onBuy,onSignIn,onClaim,onContinue,onRetry,onRestorePlay,playCheckoutPaused,locale,t});
 const el=(tag,props={},text)=>{const e=document.createElement(tag);Object.assign(e,props);if(text!==undefined)e.textContent=text;return e};
 const root=el('div',{className:'adventure-offer'});
 root.append(el('p',{className:'adventure-offer-intro'},t('store.exploreMore')));
 const status=el('p',{className:'adventure-offer-status',hidden:true});status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.offerStatus='';
 const buttons=[];let retryButton=null,restoreButton=null,statusTimer=null;
 const setStatus=(text,{transient=false}={})=>{
  clearTimeout(statusTimer);status.textContent=text||'';status.hidden=!text;
  // #863: a successful manual restore is confirmed briefly, inside the shop only.
  if(text&&transient){statusTimer=setTimeout(()=>{if(status.textContent===text)setStatus('')},3000);statusTimer?.unref?.()}
 };
 const setBusy=busy=>{for(const b of buttons)b.disabled=busy||!model.purchasesAvailable;if(retryButton)retryButton.disabled=busy;if(restoreButton)restoreButton.disabled=busy};
 const buy=(kind,label,product)=>{const b=el('button',{type:'button',className:'adventure-offer-buy',disabled:!model.purchasesAvailable},label);b.dataset.offer=kind;buttons.push(b);
  b.onclick=()=>{if(!model.signedIn){onSignIn();return}
  if(!waiver?.checked){showWaiverError();return}
  onBuy(product,{setStatus,setBusy,waiver:{accepted:true,text:WAIVER_TEXT,at:new Date().toISOString()}})};return b};
 const unitAvailable=model.purchasesAvailable&&model.unitCount>0&&model.unitPriceKnown;
 const skyAvailable=model.purchasesAvailable&&model.showSky&&model.skyCount>0&&model.skyPriceKnown;
 const premiumAvailable=model.purchasesAvailable&&!!model.premium?.priceKnown;
 let waiver=null,waiverLabel=null,waiverError=null;
 // #863: no payment, a visible red message under the box, focus on it; cleared once ticked.
 const showWaiverError=()=>{
  if(!waiver)return;
  waiverError.textContent=t('store.waiverRequired');waiverError.hidden=false;
  waiver.setAttribute('aria-invalid','true');waiverLabel.className='adventure-offer-consent is-invalid';
  waiver.focus();waiverLabel.scrollIntoView?.({block:'nearest'});
 };
 if(model.signedIn&&(model.premium?premiumAvailable:(unitAvailable||skyAvailable))){
  // Consent stays before the purchase buttons (express request before ordering).
  waiverLabel=el('label',{className:'adventure-offer-consent'});
  waiver=el('input',{type:'checkbox',checked:false});waiver.dataset.offer='waiver';
  const errorId='offerWaiverError'+(++waiverIds);
  waiverError=el('p',{className:'adventure-offer-waiver-error',id:errorId,hidden:true});waiverError.dataset.offerWaiverError='';
  waiverError.setAttribute('role','alert');
  waiver.setAttribute('aria-describedby',errorId);
  waiver.onchange=()=>{if(waiver.checked){waiverError.textContent='';waiverError.hidden=true;waiver.setAttribute('aria-invalid','false');waiverLabel.className='adventure-offer-consent'}};
  waiverLabel.append(waiver,document.createTextNode(' '+WAIVER_TEXT));root.append(waiverLabel,waiverError);
 }
 const offerCard=(kind,title,price,count,product,note=null)=>{
  const card=el('section',{className:['adventure-offer-card','adventure-offer-card--'+kind].join(' ')});
  const heading=el('h3',{},title),amount=el('strong',{className:'adventure-offer-price'},price);
  const detail=el('p',{},count===null?t('store.checkContent'):count===0?t('store.noContent'):t(kind==='unit'?'store.newQuests':'store.newPuzzles',{count}));
  detail.dataset.offerCount=kind;
  const actionLabel=t(kind==='unit'?'store.unlockAdventure':'store.unlockSky')+' · '+price;
  const button=buy(kind,actionLabel,product);
  button.setAttribute('aria-label',actionLabel);
  button.textContent=kind==='unit'?t('store.choose'):t('store.unlockAll');
  // Also retain the disabled state through the provider's busy callback.
  const allowed=kind==='unit'?unitAvailable:skyAvailable;
  if(!allowed){buttons.splice(buttons.indexOf(button),1);button.disabled=true}
  const copy=el('div',{className:'adventure-offer-card-copy'});
  const action=el('div',{className:'adventure-offer-card-action'});
  copy.append(heading,detail);
  if(kind==='sky'&&count>0){
   const extras=[];
   if(model.skyAdventureCount)extras.push(t('store.adventureCount',{count:model.skyAdventureCount}));
   if(model.skyConstellationCount)extras.push(t('store.constellationCount',{count:model.skyConstellationCount}));
   if(extras.length)copy.append(el('p',{className:'adventure-offer-extent'},extras.join(' \u00b7 ')));
  }
  if(note)copy.append(note);
  action.append(amount,button);
  card.append(copy,action);
  return card;
 };
 const offers=el('div',{className:'adventure-offer-cards'});
 if(model.premium){
  // #1030: one offer, LUMEN Premium, for every locked Adventure.
  const card=el('section',{className:['adventure-offer-card','adventure-offer-card--premium'].join(' ')});
  const copy=el('div',{className:'adventure-offer-card-copy'}),action=el('div',{className:'adventure-offer-card-action'});
  copy.append(el('h3',{},t('premium.plus')),el('p',{},t('premium.offerCopy')),el('p',{className:'adventure-offer-extent'},t('premium.free')));
  const label=t('premium.buy',{price:model.premium.price}),button=buy('premium',label,model.premium.product);
  button.setAttribute('aria-label',label);
  if(!premiumAvailable){buttons.splice(buttons.indexOf(button),1);button.disabled=true}
  action.append(el('strong',{className:'adventure-offer-price'},model.premium.price),button);card.append(copy,action);offers.append(card);
 }else if(model.showSky){
  // #865: one personalised offer only, never the list of tiers.
  let note=null;
  if(model.skyUpgrade){
   const n=model.skyPurchased;
   note=el('p',{className:'adventure-offer-upgrade'},t(n>1?'store.adjustedSeveral':'store.adjustedOne',{count:n}));
   note.dataset.offerUpgrade='';
  }
  offers.append(offerCard('sky',t('store.wholeSky'),model.skyPrice,model.skyCount,model.skyProduct,note));
 }
 if(!model.premium)offers.append(offerCard('unit',t('store.singleAdventure'),model.unitPrice,model.unitCount,model.unitProduct));
 offers.dataset.offerCards='';
 root.append(offers,el('p',{className:'adventure-offer-terms-summary'},t('store.oneTime')));
 const purchaseProgress=el('p',{className:'adventure-offer-cap',hidden:true});
 purchaseProgress.dataset.offerPurchaseProgress='';
 purchaseProgress.setAttribute('aria-live','polite');
 root.append(status,purchaseProgress);
 // #863: restoring is troubleshooting, not an offer: a discreet action in the footer.
 if(onRestorePlay){
  restoreButton=el('button',{type:'button',className:'adventure-offer-restore'},t('store.restore'));
  restoreButton.dataset.offer='restore-play';
  restoreButton.onclick=async()=>{
   setBusy(true);setStatus(t('store.checkPlay'));
   try{
    const result=await onRestorePlay();
    restoreButton.textContent=t(result?.retry?'app.retry':'store.restore');
    if(typeof result==='string')setStatus(result);else setStatus(result?.text||'',{transient:!!result?.transient});
   }finally{setBusy(false)}
  };
 }
 if(model.pricesRequired){
  const unavailable=!model.purchasesAvailable||!model.unitPriceKnown||(model.showSky&&!model.skyPriceKnown);
  const message=el('p',{className:'adventure-offer-soon'},playCheckoutPaused?t('store.playPaused'):
   model.priceStatus==='loading'?t('store.playLoading'):
   unavailable?t(playUnavailableKey(model.priceErrors)):'');
  message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  message.dataset.playPriceReason=(model.priceErrors||[]).map(e=>e.reason).join(',');
  if(message.textContent)root.append(message);
  if(model.priceStatus!=='loading'&&(playCheckoutPaused?model.priceErrors?.length:unavailable)){retryButton=el('button',{type:'button'},t('app.retry'));retryButton.dataset.offer='retry';retryButton.onclick=()=>onRetry();root.append(retryButton)}
 }else if(!model.purchasesAvailable)root.append(el('p',{className:'adventure-offer-soon'},t('store.paymentSoon')));
 if(model.mastery){
  const section=el('aside',{className:'adventure-offer-mastery'});
  section.dataset.offerMastery='';
  updateAdventureOfferMastery(section,model,{onClaim,onContinue,t});
  root.append(section);
 }
 const terms=el('a',{className:'adventure-offer-terms',href:locale==='es'?'/condiciones-venta.html':locale==='en'?'/terms-of-sale.html':SALES_TERMS_URL,target:'_blank',rel:'noopener'},t('store.terms'));terms.dataset.offer='terms';
 const termsLine=el('p',{className:'adventure-offer-terms-line'});termsLine.append(terms);
 if(restoreButton)termsLine.append(document.createTextNode(' · '+t('store.restoreHint')+' '),restoreButton);
 root.append(termsLine);
 if(!model.signedIn&&model.accounts){const s=el('button',{type:'button',className:'adventure-offer-signin'},t('store.createOrSignIn'));s.dataset.offer='signin';s.onclick=()=>onSignIn();root.append(s)}
 const support=el('p',{className:'adventure-offer-support'},t('store.independent')+' ');
 const why=el('button',{type:'button',className:'adventure-offer-why'},t('store.why'));why.dataset.offer='why';why.setAttribute('aria-expanded','false');
 const text=el('p',{className:'adventure-offer-why-text',hidden:true},t('store.whyCopy'));
 why.onclick=()=>{text.hidden=!text.hidden;why.setAttribute('aria-expanded',String(!text.hidden))};
 support.append(why);root.append(support,text);
 host.replaceChildren(root);
 return root;
}
