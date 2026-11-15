// #731: what a player sees when touching a locked Adventure: the paid offers (€1 / €5,
// €5 cap), the free path through 100% mastery of the previous Adventure, and why
// Lumen is paid. Purchases stay disabled until a payment provider is connected
// (#729/#730); the server always decides what is granted (#728).
import {celestialScope,celestialMastered} from './celestial-progress.js';
import {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,SKY_PRODUCT_ID,formatEuros} from '../campaign/store-catalogue.js';

export const SUPPORT_LINE='Sans pub, financé par les joueurs ✨';
export const SUPPORT_TEXT='Lumen est développé par un petit studio indépendant. Pas de publicité, pas de collecte de données pour du ciblage : les achats servent à financer l’hébergement, les serveurs et le développement de nouvelles aventures.';

// #729: on Google Play a product has a fixed price, so once a single Adventure has been
// bought the €5 offer is hidden and the player continues at €1 until the €5 cap
// unlocks everything (owner decision, 15/11/2026). Play's localised prices win when known.
export function adventureOfferModel({pack,packs,quests,progress,signedIn=false,accounts=true,purchasesAvailable=false,boughtSingle=false,prices={}}){
 const ordered=[...(packs||[])].sort((a,b)=>a.order-b.order);
 const index=ordered.findIndex(p=>p.id===pack.id),previous=index>0?ordered[index-1]:null;
 let mastery=null;
 if(previous){
  const scope=celestialScope(progress||{},(quests||[]).filter(q=>q.packId===previous.id));
  mastery={previousName:previous.displayName||'l’aventure précédente',previousAccessible:previous.accessible!==false,
   mastered:celestialMastered(scope),missingQuests:Math.max(0,scope.total-scope.completed),missingBadges:Math.max(0,scope.possible-scope.earned)};
 }
 return {id:pack.id,title:pack.displayName||'Aventure',unitPrice:prices[pack.id]||formatEuros(ADVENTURE_PRICE_CENTS),skyPrice:prices[SKY_PRODUCT_ID]||formatEuros(SKY_PRICE_CENTS),
  capPrice:formatEuros(SKY_PRICE_CENTS),unitProduct:pack.id,skyProduct:SKY_PRODUCT_ID,showSky:!boughtSingle,
  signedIn:!!signedIn,accounts:!!accounts,purchasesAvailable:!!purchasesAvailable,mastery};
}

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
  b.onclick=()=>{if(!model.signedIn){onSignIn();return}onBuy(product,{setStatus,setBusy})};return b};
 root.append(buy('unit','Débloquer cette aventure · '+model.unitPrice,model.unitProduct));
 if(model.showSky)root.append(buy('sky','Tout le vrai ciel · '+model.skyPrice,model.skyProduct));
 root.append(el('p',{className:'adventure-offer-cap'},model.showSky
  ?'Tes achats à l’unité comptent : tu ne paieras jamais plus de '+model.capPrice+' au total.'
  :'Tu continues à l’unité : dès '+model.capPrice+' payés au total, tout le vrai ciel est débloqué.'),status);
 if(!model.purchasesAvailable)root.append(el('p',{className:'adventure-offer-soon'},'Paiement bientôt disponible.'));
 const line=masteryLine(model);
 if(line){const p=el('p',{className:'adventure-offer-mastery'},line);p.dataset.offerMastery='';root.append(p);
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
