// #730: thank-you screen after a purchase CONFIRMED by the server (Stripe read-back or
// Google Play verification), never on a payment provider's return URL alone.
// Wording states an intention, never an absolute promise (#731/#732).
import {SKY_PRODUCT_ID} from '../campaign/store-catalogue.js';

export const THANKS_SUPPORT='Lumen est développé par un petit studio indépendant, sans publicité : ton achat aide à financer l’hébergement et les prochaines aventures.';

export function purchaseThanksModel({productId,packs=[]}){
 const sky=productId===SKY_PRODUCT_ID;
 const pack=sky?null:packs.find(p=>p.id===productId);
 const name=sky?'Tout le vrai ciel':(pack?.displayName||'Ta nouvelle aventure');
 return {
  sky,productId,
  title:'Merci pour ton soutien ✨',
  lead:sky?'Tout le vrai ciel est débloqué.':'« '+name+' » est débloquée.',
  account:'Ton achat est lié à ton compte : tu le retrouves automatiquement sur tous tes appareils connectés.',
  support:THANKS_SUPPORT,
  explore:sky?'Explorer mon ciel':'Explorer l’aventure',
  later:'Plus tard',
 };
}

// One dialog at a time; returns the root, or null without a document.
export function showPurchaseThanks(doc,model,{onExplore=()=>{},onClose=()=>{}}={}){
 if(!doc?.body||!model)return null;
 doc.getElementById('purchaseThanks')?.remove();
 const el=(tag,props={},text)=>{const e=doc.createElement(tag);Object.assign(e,props);if(text!==undefined)e.textContent=text;return e};
 const root=el('div',{id:'purchaseThanks',className:'purchase-thanks'});
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','purchaseThanksTitle');
 const card=el('div',{className:'purchase-thanks-card'});
 const glow=el('div',{className:'purchase-thanks-glow'},'✦');glow.setAttribute('aria-hidden','true');
 const title=el('h2',{id:'purchaseThanksTitle'},model.title);
 const explore=el('button',{type:'button',className:'purchase-thanks-explore'},model.explore);explore.dataset.thanks='explore';
 const later=el('button',{type:'button',className:'purchase-thanks-later'},model.later);later.dataset.thanks='later';
 const close=action=>{doc.removeEventListener('keydown',onKey);root.remove();action()};
 const onKey=e=>{if(e.key==='Escape')close(onClose)};
 explore.onclick=()=>close(onExplore);later.onclick=()=>close(onClose);
 root.onclick=e=>{if(e.target===root)close(onClose)};
 doc.addEventListener('keydown',onKey);
 card.append(glow,title,el('p',{className:'purchase-thanks-lead'},model.lead),el('p',{},model.account),
  el('p',{className:'purchase-thanks-support'},model.support),explore,later);
 root.append(card);doc.body.append(root);
 explore.focus?.();
 return root;
}
