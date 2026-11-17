// #730: thank-you screen after a server-confirmed purchase (synthetic DOM, no browser).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {purchaseThanksModel,showPurchaseThanks,THANKS_SUPPORT} from '../src/ui/purchase-thanks.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {SKY_PRODUCT_ID} from '../src/campaign/store-catalogue.js';

const locked=CONTENT_PACKS.find(p=>p.access==='locked');
let m=purchaseThanksModel({productId:locked.id,packs:CONTENT_PACKS});
assert.equal(m.title,'Merci pour ton soutien ✨');
assert.equal(m.lead,'« '+locked.displayName+' » est débloquée.','the Adventure name comes from the catalogue');
assert.match(m.account,/tous tes appareils/);assert.equal(m.explore,'Explorer l’aventure');
m=purchaseThanksModel({productId:SKY_PRODUCT_ID,packs:CONTENT_PACKS});
assert.equal(m.lead,'Tout le vrai ciel est débloqué.');assert.equal(m.explore,'Explorer mon ciel');
assert.match(purchaseThanksModel({productId:'unknown',packs:[]}).lead,/Ta nouvelle aventure/);
assert.doesNotMatch(THANKS_SUPPORT,/pas pour gagner|garanti|toujours/i,'an intention, never an absolute promise (#731/#732)');

// Minimal DOM: dialog semantics, focus, explore/later/Escape/backdrop close it once.
function fakeDoc(){
 const listeners={};
 const make=tag=>{const n={tagName:tag,children:[],attrs:{},dataset:{},parent:null,
  append(...c){for(const x of c){x.parent=n;n.children.push(x)}},
  remove(){if(n.parent)n.parent.children=n.parent.children.filter(x=>x!==n);n.parent=null;if(doc.byId[n.id]===n)delete doc.byId[n.id]},
  setAttribute(k,v){n.attrs[k]=v},focus(){doc.focused=n}};return n};
 const doc={byId:{},focused:null,body:make('body'),
  createElement:t=>make(t),getElementById:id=>doc.byId[id]||null,
  addEventListener:(t,f)=>{(listeners[t]??=[]).push(f)},removeEventListener:(t,f)=>{listeners[t]=(listeners[t]||[]).filter(x=>x!==f)},
  key:k=>[...(listeners.keydown||[])].forEach(f=>f({key:k})),listeners};
 const append=doc.body.append.bind(doc.body);doc.body.append=(...c)=>{append(...c);for(const x of c)if(x.id)doc.byId[x.id]=x};
 return doc;
}
const all=n=>[n,...n.children.flatMap(all)];
for(const [action,expect] of [['explore','explore'],['later','close'],['escape','close'],['backdrop','close']]){
 const doc=fakeDoc();const calls=[];
 const root=showPurchaseThanks(doc,purchaseThanksModel({productId:locked.id,packs:CONTENT_PACKS}),{onExplore:()=>calls.push('explore'),onClose:()=>calls.push('close')});
 assert.equal(root.attrs.role,'dialog');assert.equal(root.attrs['aria-modal'],'true');assert.equal(root.attrs['aria-labelledby'],'purchaseThanksTitle');
 assert.ok(all(root).some(n=>n.id==='purchaseThanksTitle'&&n.textContent==='Merci pour ton soutien ✨'));
 assert.equal(doc.focused?.dataset.thanks,'explore','focus on the main action');
 const button=k=>all(root).find(n=>n.dataset.thanks===k);
 if(action==='explore')button('explore').onclick();else if(action==='later')button('later').onclick();
 else if(action==='escape')doc.key('Escape');else root.onclick({target:root});
 assert.deepEqual(calls,[expect],action);assert.equal(doc.body.children.length,0,'closed');
 assert.equal((doc.listeners.keydown||[]).length,0,'no leaked key listener');
 doc.key('Escape');assert.deepEqual(calls,[expect],'closing twice is impossible');
}
const doc=fakeDoc();showPurchaseThanks(doc,m);showPurchaseThanks(doc,m);assert.equal(doc.body.children.length,1,'one dialog at a time');
assert.equal(showPurchaseThanks(null,m),null);

// Wiring: shown only after a server-confirmed purchase and reloaded rights (Play and Stripe).
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.match(screen,/if\(result\.status==='paid'\)\{await loadEntitlements\(\);if\(lumenUser\?\.id!==owner\)return;setStatus\('Achat confirmé ✓ Bonne exploration !'\);skyNavigation\.render\(\);thankForPurchase\(productId\)\}/,'Play');
assert.match(screen,/if\(result\.status==='paid'\)thankForPurchase\(result\.productId\);/,'Stripe');
assert.match(screen,/function thankForPurchase\(productId\)\{\n if\(qaActive\|\|!productId\)return;/);
assert.ok(fs.readFileSync(new URL('../src/ui/styles.css',import.meta.url),'utf8').includes('.purchase-thanks-card{'));
console.log('purchase-thanks-tests: model, dialog behaviour and server-confirmed wiring OK');
