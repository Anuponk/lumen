// #731: what a player sees when touching a locked Adventure: the paid offers (€1 / €5,
// €5 cap), the free path through 100% mastery of the previous Adventure, and why
// Lumen is paid. Purchases stay disabled until a payment provider is connected
// (#729/#730); the server always decides what is granted (#728).
import {celestialScope,celestialMastered} from './celestial-progress.js';
import {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,SKY_PRODUCT_ID,formatEuros} from '../campaign/store-catalogue.js';

export const SUPPORT_LINE='🚀 Tu peux aussi soutenir Lumen en achetant une aventure. Grâce à toi, les étoiles brillent… Sans pub !';
// #732: express request for immediate access and waiver of the 14-day withdrawal right
// (art. L221-28 13° Code de la consommation), never pre-ticked, required before paying.
export const WAIVER_TEXT='Je demande l’accès immédiat à mon achat et je renonce à mon droit de rétractation de 14 jours.';
export const WAIVER_REQUIRED='Coche la case ci-dessus pour confirmer l’accès immédiat avant de payer.';
export const SALES_TERMS_URL='/cgv.html';
export const SUPPORT_TEXT='Lumen est développé par un petit studio indépendant. Pas de publicité, pas de collecte de données pour du ciblage : les achats servent à financer l’hébergement, les serveurs et le développement de nouvelles aventures.';

// #729: on Google Play a product has a fixed price, so once a single Adventure has been
// bought the €5 offer is hidden and the player continues at €1 until the €5 cap
// unlocks everything (owner decision, 15/11/2026). Play's localised prices win when known.
export function adventureOfferModel({pack,packs,quests,progress,signedIn=false,accounts=true,purchasesAvailable=false,boughtSingle=false,prices={},pricesRequired=false}){
 const ordered=[...(packs||[])].sort((a,b)=>a.order-b.order);
 const index=ordered.findIndex(p=>p.id===pack.id),previous=index>0?ordered[index-1]:null;
 let mastery=null;
 if(previous){
  const scope=celestialScope(progress||{},(quests||[]).filter(q=>q.packId===previous.id));
  mastery={previousName:previous.displayName||'l’aventure précédente',previousAccessible:previous.accessible!==false,
   mastered:celestialMastered(scope),missingQuests:Math.max(0,scope.total-scope.completed),missingBadges:Math.max(0,scope.possible-scope.earned)};
 }
 // Only delivered grids in the real-sky product; ownership opens a sequence,
 // not every quest at once. Already accessible packs add no new content.
 const delivered=[...new Map((quests||[]).filter(q=>q.reg?.length&&q.sol?.length).map(q=>[q.id,q])).values()];
 const ready=ordered.every(p=>!p.accessStatus||p.accessStatus==='ready');
 const newlyAvailable=p=>p.accessible!==true&&p.access!=='included';
 const unitCount=ready?delivered.filter(q=>q.packId===pack.id&&newlyAvailable(ordered.find(p=>p.id===q.packId)||pack)).length:null;
 const skyIds=new Set(ordered.filter(p=>p.skyId==='real-sky'&&newlyAvailable(p)).map(p=>p.id));
 const skyCount=ready?delivered.filter(q=>skyIds.has(q.packId)).length:null;
 return {id:pack.id,title:pack.displayName||'Aventure',unitCount,skyCount,unitPriceKnown:!pricesRequired||!!prices[pack.id],skyPriceKnown:!pricesRequired||!!prices[SKY_PRODUCT_ID],unitPrice:prices[pack.id]||(pricesRequired?'Prix indisponible':formatEuros(ADVENTURE_PRICE_CENTS)),skyPrice:prices[SKY_PRODUCT_ID]||(pricesRequired?'Prix indisponible':formatEuros(SKY_PRICE_CENTS)),
  capPrice:formatEuros(SKY_PRICE_CENTS),unitProduct:pack.id,skyProduct:SKY_PRODUCT_ID,showSky:!boughtSingle,
  signedIn:!!signedIn,accounts:!!accounts,purchasesAvailable:!!purchasesAvailable,mastery};
}

// #730 (owner decision, 17/11/2026): no « Restaurer mes achats » button; purchases are
// re-verified automatically after every verified hydration (game-screen.js).

const plural=(n,word)=>n+' '+word+(n>1?'s':'');
export function masteryLine(model){
 const m=model.mastery;if(!m)return '';
 const name='« '+m.previousName+' »';
 if(m.mastered)return model.signedIn?'Maîtrise de '+name+' atteinte ✓ : cette aventure se débloque gratuitement.'
  :'Maîtrise de '+name+' atteinte ✓ : connecte-toi pour débloquer cette aventure gratuitement.';
 if(!m.previousAccessible)return 'Gratuit aussi : maîtrise à 100 % l’aventure précédente '+name+', une fois débloquée.';
 const left=[m.missingQuests?plural(m.missingQuests,'quête'):'',m.missingBadges?plural(m.missingBadges,'badge'):''].filter(Boolean).join(' et ');
 return 'Gratuit : maîtrise '+name+' à 100 %'+(left?' (il te reste '+left+').':'.');
}

export function mountAdventureOffer(host,model,{onBuy=async()=>{},onSignIn=()=>{},onClaim=()=>{}}={}){
 const el=(tag,props={},text)=>{const e=document.createElement(tag);Object.assign(e,props);if(text!==undefined)e.textContent=text;return e};
 const root=el('div',{className:'adventure-offer'});
 const status=el('p',{className:'adventure-offer-status',hidden:true});status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.offerStatus='';
 const buttons=[];
 const setStatus=text=>{status.textContent=text||'';status.hidden=!text};
 const setBusy=busy=>{for(const b of buttons)b.disabled=busy||!model.purchasesAvailable};
 const buy=(kind,label,product)=>{const b=el('button',{type:'button',className:'adventure-offer-buy',disabled:!model.purchasesAvailable},label);b.dataset.offer=kind;buttons.push(b);
  b.onclick=()=>{if(!model.signedIn){onSignIn();return}
  if(!waiver?.checked){setStatus(WAIVER_REQUIRED);waiver?.focus();return}
  onBuy(product,{setStatus,setBusy,waiver:{accepted:true,text:WAIVER_TEXT,at:new Date().toISOString()}})};return b};
 // The consent box is shown only where a purchase can actually start (signed in, provider available).
 let waiver=null;
 if(model.purchasesAvailable&&model.signedIn){
  const label=el('label',{className:'adventure-offer-consent'});
  waiver=el('input',{type:'checkbox',checked:false});waiver.dataset.offer='waiver';
  waiver.onchange=()=>{if(waiver.checked&&status.textContent===WAIVER_REQUIRED)setStatus('')};
  label.append(waiver,document.createTextNode(' '+WAIVER_TEXT));root.append(label);
 }
 const offerCard=(kind,title,price,count,product)=>{
  const card=el('section',{className:'adventure-offer-card'});
  const heading=el('h3',{},title),amount=el('strong',{className:'adventure-offer-price'},price);
  const detail=el('p',{},count===null?'Vérification du contenu accessible…':count===0?'Déjà accessible':`+ ${count} nouvelles ${kind==='unit'?'quêtes à explorer':'grilles à découvrir'}`);
  detail.dataset.offerCount=kind;
  const button=buy(kind,title+' · '+price,product);
  button.setAttribute('aria-label',title+' · '+price);
  button.textContent=kind==='unit'?'Choisir':'Tout débloquer';
  // Also retain the disabled state through the provider's busy callback.
  const allowed=model.purchasesAvailable&&count!==null&&count>0&&(kind==='unit'?model.unitPriceKnown:model.skyPriceKnown);
  if(!allowed){buttons.splice(buttons.indexOf(button),1);button.disabled=true}
  card.append(heading,amount,detail,button);return card;
 };
 const offers=el('div',{className:'adventure-offer-cards'});
 offers.append(offerCard('unit','Débloquer cette aventure',model.unitPrice,model.unitCount,model.unitProduct));
 if(model.showSky)offers.append(offerCard('sky','Débloquer tout le vrai ciel',model.skyPrice,model.skyCount,model.skyProduct));
 root.append(offers);
 root.append(el('p',{className:'adventure-offer-cap'},model.showSky
  ?'Tes achats à l’unité comptent : tu ne paieras jamais plus de '+model.capPrice+' au total.'
  :'Tu continues à l’unité : dès '+model.capPrice+' payés au total, tout le vrai ciel est débloqué.'),status);
 if(!model.purchasesAvailable)root.append(el('p',{className:'adventure-offer-soon'},'Paiement bientôt disponible.'));
 const terms=el('a',{className:'adventure-offer-terms',href:SALES_TERMS_URL,target:'_blank',rel:'noopener'},'Conditions générales de vente');terms.dataset.offer='terms';
 const termsLine=el('p',{className:'adventure-offer-terms-line'});termsLine.append(terms);root.append(termsLine);
 const line=masteryLine(model);
 if(line){const p=el('aside',{className:'adventure-offer-mastery'});p.dataset.offerMastery='';p.append(el('strong',{},'💡 Le savais-tu ?'),el('p',{},line));root.append(p);
  if(model.mastery.mastered&&model.signedIn){const claim=el('button',{type:'button',className:'adventure-offer-claim'},'Débloquer gratuitement');claim.dataset.offer='claim';claim.onclick=()=>onClaim(claim);root.append(claim)}}
 if(!model.signedIn&&model.accounts){const s=el('button',{type:'button',className:'adventure-offer-signin'},'Créer un compte ou se connecter');s.dataset.offer='signin';s.onclick=()=>onSignIn();root.append(s)}
 const support=el('p',{className:'adventure-offer-support'},SUPPORT_LINE+' ');
 const why=el('button',{type:'button',className:'adventure-offer-why'},'Pourquoi ?');why.dataset.offer='why';why.setAttribute('aria-expanded','false');
 const text=el('p',{className:'adventure-offer-why-text',hidden:true},SUPPORT_TEXT);
 why.onclick=()=>{text.hidden=!text.hidden;why.setAttribute('aria-expanded',String(!text.hidden))};
 support.append(why);root.append(support,text);
 host.replaceChildren(root);
 return root;
}
