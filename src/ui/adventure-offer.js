// #731: paid offers, the free path through 100% mastery of the previous Adventure, and why
// Lumen is paid. Purchases stay disabled until a payment provider is connected
// (#729/#730); the server always decides what is granted (#728).
import {adventureMastery} from './mastery-unlock.js';
import {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,SKY_PRODUCT_ID,formatEuros} from '../campaign/store-catalogue.js';

export const SUPPORT_LINE='🚀 Tu peux aussi soutenir Lumen en achetant une aventure. Grâce à toi, les étoiles brillent… Sans pub !';
// #732: express request for immediate access and waiver of the 14-day withdrawal right
// (art. L221-28 13° Code de la consommation), never pre-ticked, required before paying.
export const WAIVER_TEXT='Je demande l’accès immédiat à mon achat et je renonce à mon droit de rétractation de 14 jours.';
export const WAIVER_REQUIRED='Coche la case ci-dessus pour confirmer l’accès immédiat avant de payer.';
export const SALES_TERMS_URL='/cgv.html';
export const SUPPORT_TEXT='Lumen est développé par un petit studio indépendant. Pas de publicité, pas de collecte de données pour du ciblage : les achats servent à financer l’hébergement, les serveurs et le développement de nouvelles aventures.';

// Play decides the regional price. After a unit purchase, keep the existing
// eligibility rule for the whole-sky offer independent of the provider's price.
export function adventureOfferModel({pack,packs,quests,progress,signedIn=false,accounts=true,purchasesAvailable=false,boughtSingle=false,prices={},pricesRequired=false,priceStatus='idle',priceErrors=[],masteryStatus='ready',masteryConfirmed=false}){
 const ordered=[...(packs||[])].sort((a,b)=>a.order-b.order);
 const index=ordered.findIndex(p=>p.id===pack.id),previous=index>0?ordered[index-1]:null;
 const previousQuests=previous?(quests||[]).filter(q=>q.packId===previous.id):[];
 const mastery=previous?{
  previousName:previous.displayName||'',
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
 const skyCount=ready?delivered.filter(q=>skyIds.has(q.packId)).length:null;
 const missingPrice=priceStatus==='loading'?'Chargement du prix…':'Prix indisponible';
 const capPrice=formatEuros(SKY_PRICE_CENTS);
 const capMessage=pricesRequired
  ? 'Les tarifs Google Play varient selon le pays. Chaque achat confirmé débloque le contenu correspondant.'
  : boughtSingle
   ? 'Le plafond des achats web est de '+capPrice+' pour tout le vrai ciel.'
   : 'Sur le web, tes achats à l’unité comptent dans le plafond de '+capPrice+'.';
 return {id:pack.id,title:pack.displayName||'Aventure',unitCount,skyCount,pricesRequired,priceStatus,priceErrors,unitPriceKnown:!pricesRequired||!!prices[pack.id],skyPriceKnown:!pricesRequired||!!prices[SKY_PRODUCT_ID],unitPrice:prices[pack.id]||(pricesRequired?missingPrice:formatEuros(ADVENTURE_PRICE_CENTS)),skyPrice:prices[SKY_PRODUCT_ID]||(pricesRequired?missingPrice:formatEuros(SKY_PRICE_CENTS)),
  capMessage,unitProduct:pack.id,skyProduct:SKY_PRODUCT_ID,showSky:!boughtSingle,
  signedIn:!!signedIn,accounts:!!accounts,purchasesAvailable:!!purchasesAvailable,mastery};
}

// #730 (owner decision, 17/11/2026): no « Restaurer mes achats » button; purchases are
// re-verified automatically after every verified hydration (game-screen.js).

const plural=(n,word)=>n+' '+word+(n>1?'s':'');
export function masteryLine(model){
 const m=model.mastery;if(!m)return '';
 if(m.status==='loading')return 'Chargement de ta progression…';
 if(m.status!=='ready')return 'Ta progression est indisponible pour le moment.';
 if(m.confirmed)return 'Déblocage gratuit confirmé.';
 if(m.mastered)return model.signedIn?'Tu as atteint les 100 %. Fais vérifier ton déblocage gratuit.'
  :'Tu as atteint les 100 %. Connecte-toi pour débloquer cette aventure gratuitement.';
 if(!m.missingBadges)return 'Il te reste '+plural(m.missingQuests,'quête')+' à terminer pour la débloquer gratuitement.';
 const quests=m.missingQuests?plural(m.missingQuests,'quête')+' et ':'';
 return 'Il te reste '+quests+plural(m.missingBadges,'badge')+' à acquérir pour la débloquer gratuitement.';
}

export function updateAdventureOfferMastery(section,model,{onClaim=()=>{},onContinue=()=>{}}={}){
 if(!section||!model.mastery)return;
 const {previousName,confirmed,mastered}=model.mastery;
 const previous=previousName?' (« '+previousName+' »).':'.';
 const line=masteryLine(model);
 const action=confirmed?'Retour à Mon ciel':mastered&&model.signedIn?'Vérifier le déblocage gratuit':'';
 const view=JSON.stringify([previous,line,action]);
 if(section.dataset.masteryView===view)return;
 section.dataset.masteryView=view;
 const title=document.createElement('strong');title.textContent='💡 Le savais-tu ?';
 const condition=document.createElement('p');
 const requirement=document.createElement('b');requirement.textContent='100 % l’aventure précédente';
 condition.append(document.createTextNode('Tu peux débloquer gratuitement cette aventure en maîtrisant à '),requirement,document.createTextNode(previous));
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

export function mountAdventureOffer(host,model,{onBuy=async()=>{},onSignIn=()=>{},onClaim=()=>{},onContinue=()=>{},onRetry=()=>{}}={}){
 const el=(tag,props={},text)=>{const e=document.createElement(tag);Object.assign(e,props);if(text!==undefined)e.textContent=text;return e};
 const root=el('div',{className:'adventure-offer'});
 const status=el('p',{className:'adventure-offer-status',hidden:true});status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.offerStatus='';
 const buttons=[];let retryButton=null;
 const setStatus=text=>{status.textContent=text||'';status.hidden=!text};
 const setBusy=busy=>{for(const b of buttons)b.disabled=busy||!model.purchasesAvailable;if(retryButton)retryButton.disabled=busy};
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
  const detail=el('p',{},count===null?'Vérification du contenu accessible…':count===0?'Aucun nouveau contenu disponible':`+ ${count} nouvelles ${kind==='unit'?'quêtes à explorer':'grilles à découvrir'}`);
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
 root.append(el('p',{className:'adventure-offer-cap'},model.capMessage),status);
 if(model.pricesRequired){
  const message=el('p',{className:'adventure-offer-soon'},model.priceStatus==='loading'?'Chargement des tarifs Google Play…':
   !model.purchasesAvailable||!model.unitPriceKnown||(model.showSky&&!model.skyPriceKnown)?'Google Play ne permet pas cet achat pour le moment. Vérifie ta connexion et réessaie.':'');
  message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  message.dataset.playPriceReason=(model.priceErrors||[]).map(e=>e.reason).join(',');
  if(message.textContent)root.append(message);
  if(model.priceStatus!=='loading'&&message.textContent){retryButton=el('button',{type:'button'},'Réessayer');retryButton.dataset.offer='retry';retryButton.onclick=()=>onRetry();root.append(retryButton)}
 }else if(!model.purchasesAvailable)root.append(el('p',{className:'adventure-offer-soon'},'Paiement bientôt disponible.'));
 const terms=el('a',{className:'adventure-offer-terms',href:SALES_TERMS_URL,target:'_blank',rel:'noopener'},'Conditions générales de vente');terms.dataset.offer='terms';
 const termsLine=el('p',{className:'adventure-offer-terms-line'});termsLine.append(terms);root.append(termsLine);
 if(model.mastery){
  const section=el('aside',{className:'adventure-offer-mastery'});
  section.dataset.offerMastery='';
  updateAdventureOfferMastery(section,model,{onClaim,onContinue});
  root.append(section);
 }
 if(!model.signedIn&&model.accounts){const s=el('button',{type:'button',className:'adventure-offer-signin'},'Créer un compte ou se connecter');s.dataset.offer='signin';s.onclick=()=>onSignIn();root.append(s)}
 const support=el('p',{className:'adventure-offer-support'},SUPPORT_LINE+' ');
 const why=el('button',{type:'button',className:'adventure-offer-why'},'Pourquoi ?');why.dataset.offer='why';why.setAttribute('aria-expanded','false');
 const text=el('p',{className:'adventure-offer-why-text',hidden:true},SUPPORT_TEXT);
 why.onclick=()=>{text.hidden=!text.hidden;why.setAttribute('aria-expanded',String(!text.hidden))};
 support.append(why);root.append(support,text);
 host.replaceChildren(root);
 return root;
}
