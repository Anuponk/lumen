// #732: ready-to-sell legal surface. The purchase cannot start without the express
// immediate-access request and withdrawal waiver; the sales terms, legal notice and
// privacy page state the owner decisions; Play publication stays blocked without a mediator.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,formatEuros} from '../src/campaign/store-catalogue.js';
import {mountAdventureOffer,WAIVER_TEXT,WAIVER_REQUIRED,SALES_TERMS_URL} from '../src/ui/adventure-offer.js';
import {evaluatePlayReadiness} from './play-readiness.mjs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');

// Minimal DOM, enough for mountAdventureOffer.
class Node{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.hidden=false;this.textContent=''}
 append(...nodes){for(const n of nodes)this.children.push(typeof n==='string'?{text:n}:n)}
 replaceChildren(...nodes){this.children=nodes}
 setAttribute(k,v){this.attributes[k]=v}
 focus(){globalThis.document.activeElement=this}
 all(){return this.children.flatMap(c=>c instanceof Node?[c,...c.all()]:[])}}
globalThis.document={createElement:tag=>new Node(tag),createTextNode:text=>({text}),activeElement:null};
const model={id:'real-adventure-02',title:'Aventure',unitPrice:'1 €',skyPrice:'5 €',capPrice:'5 €',unitProduct:'real-adventure-02',skyProduct:'real-sky-all',
 showSky:true,signedIn:true,accounts:true,purchasesAvailable:true,mastery:null};
const host=new Node('div'),calls=[];
const root=mountAdventureOffer(host,model,{onBuy:async(product,ctx)=>calls.push({product,waiver:ctx.waiver})});
const nodes=root.all(),find=kind=>nodes.find(n=>n.dataset.offer===kind);
const waiver=find('waiver'),unit=find('unit'),status=nodes.find(n=>n.dataset.offerStatus!==undefined);
assert(waiver&&waiver.type==='checkbox'&&waiver.checked===false,'The waiver box exists and is never pre-ticked');
assert(nodes.indexOf(waiver)<nodes.indexOf(unit),'The waiver comes before the purchase buttons');
assert(nodes.some(n=>n.tagName==='label'&&n.children.some(c=>c.text===' '+WAIVER_TEXT)),'The waiver text is shown with the box');
unit.onclick();
assert.equal(calls.length,0,'No payment without the waiver');assert.equal(status.textContent,WAIVER_REQUIRED);assert.equal(document.activeElement,waiver);
waiver.checked=true;waiver.onchange();assert.equal(status.textContent,'','Ticking clears the reminder');
unit.onclick();
assert.equal(calls.length,1);assert.equal(calls[0].product,'real-adventure-02');
assert.equal(calls[0].waiver.accepted,true);assert.equal(calls[0].waiver.text,WAIVER_TEXT);assert(!Number.isNaN(Date.parse(calls[0].waiver.at)));
const terms=find('terms');assert.equal(terms.href,SALES_TERMS_URL);assert.equal(terms.target,'_blank');
// No waiver box where no purchase can start; the terms link stays visible.
for(const variant of [{signedIn:false},{purchasesAvailable:false}]){
 const other=mountAdventureOffer(new Node('div'),{...model,...variant}).all();
 assert(!other.some(n=>n.dataset.offer==='waiver'),'No waiver box: '+JSON.stringify(variant));
 assert(other.some(n=>n.dataset.offer==='terms'),'Terms link: '+JSON.stringify(variant));
}
assert.match(WAIVER_TEXT,/accès immédiat/);assert.match(WAIVER_TEXT,/renonce à mon droit de rétractation/);
const screen=read('src/ui/game-screen.js');
assert.match(screen,/async function purchaseAdventure\(productId,\{setStatus,setBusy,waiver\}\)\{\n if\(!lumenUser\|\|qaActive\)return;\n[^\n]*\n if\(!waiver\?\.accepted\)return;\n if\(!playBilling&&stripeAvailable\(\)\)return purchaseWithStripe/,'The payment entry point refuses a missing waiver before any provider (Play or Stripe, #730)');

// Sales terms page.
const cgv=read('cgv.html');
assert.match(cgv,/<h1>Conditions générales de vente<\/h1>/);
assert(cgv.includes(formatEuros(ADVENTURE_PRICE_CENTS))&&cgv.includes(formatEuros(SKY_PRICE_CENTS)),'Prices from the store catalogue');
assert.match(cgv,/TVA non applicable, art\. 293 B du CGI/);
assert.match(cgv,/L221-28, 13°/);assert.match(cgv,/Sans cette case cochée, le paiement ne s’ouvre pas/);
assert.match(cgv,/Family Link/);assert.match(cgv,/médiateur de la consommation/);
assert.match(cgv,/médiateur de la consommation auquel tu pourras recourir gratuitement est en cours de désignation/,'Honest mediator status');
assert.doesNotMatch(cgv,/<script\b/);
// Legal notice and privacy page.
const mentions=read('mentions-legales.html'),privacy=read('confidentialite.html');
assert.match(mentions,/TVA non applicable, art\. 293 B du CGI/);assert(mentions.includes('href="/cgv.html"'));
assert.match(privacy,/<h2>Achats<\/h2>/);assert.doesNotMatch(privacy,/sans publicité ni achats/);
assert.match(privacy,/sans identifiant de compte, email, pseudo ni progression/);assert.match(privacy,/L123-22/);
// Published versions (owner, 17/11/2026): no candidate banner; Stripe web payments disclosed (#730).
for(const [name,page] of [['cgv',cgv],['mentions',mentions],['privacy',privacy]]){
 assert.doesNotMatch(page,/Version candidate|à valider avant publication|politique de confidentialité candidate/,name+' is published, not a candidate');
 assert.match(page,/Version du \d{1,2} \S+ \d{4}/,name+' is dated');
 assert.match(page,/Stripe/,name+' names the web payment processor');
}
assert.match(cgv,/version web[^<]*Stripe/);assert.doesNotMatch(cgv,/paiement sur la version web n’est pas encore disponible/);
assert.match(cgv,/confirmation de ta commande[^<]*accès immédiat[^<]*renonciation/,'durable confirmation of the waiver (L221-13)');
assert.match(privacy,/Lumen ne reçoit jamais tes données de carte/);assert.match(privacy,/stripe\.com\/fr\/privacy/);
// Published by both release paths.
assert.match(read('scripts/o2switch-cron-publish.sh'),/PUBLIC_PAGES=\([^)]*cgv\.html/);
assert.match(read('scripts/o2switch-safe-release.sh'),/for page in [^;]*cgv\.html/);
assert.match(read('scripts/o2switch-deploy-tests.py'),/PUBLIC_PAGES = \([^)]*"cgv\.html"/);
// The mediator is tracked in its own issue, not a publication blocker (owner decision, 17/11/2026).
const publisher=JSON.parse(read('content/legal/publisher.json'));
assert.equal(publisher.consumerMediatorOwnerDeclaration.plannedProvider,'CM2C');
assert(!evaluatePlayReadiness(publisher).blockers.includes('consumer.mediator'));
assert(!evaluatePlayReadiness(publisher).blockers.includes('monetization.review'),'Paid Adventures without ads is a reviewed model');
console.log('sales-terms-tests: waiver gate, sales terms, legal notice, privacy, release lists and readiness OK');
