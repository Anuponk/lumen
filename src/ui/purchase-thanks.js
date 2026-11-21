import {adventureDisplayName} from './adventure-copy.js';
import {createTranslator} from './i18n.js';
// #730: thank-you screen after a purchase CONFIRMED by the server (Stripe read-back or
// Google Play verification), never on a payment provider's return URL alone.
// Wording states an intention, never an absolute promise (#731/#732).
import {isMainSkyProduct} from '../campaign/store-catalogue.js';

const french=createTranslator().t;
export const THANKS_SUPPORT=french('purchase.support');

export function purchaseThanksModel({productId,packs=[],t=french}){
 const sky=isMainSkyProduct(productId);
 const pack=sky?null:packs.find(p=>p.id===productId);
 return {
  sky,productId,
  title:t('purchase.thanks'),
  lead:sky?t('purchase.skyUnlocked'):t('purchase.adventureUnlocked',{name:adventureDisplayName(pack,t)||t('purchase.newAdventure')}),
  account:t('purchase.account'),
  support:t('purchase.support'),
  explore:sky?t('purchase.exploreSky'):t('purchase.exploreAdventure'),
  later:t('app.later'),
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
