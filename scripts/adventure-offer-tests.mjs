// #731: locked Adventure offer model and copy, against the real catalogue.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {PERFORMANCE_BADGES} from '../src/campaign/performance.js';
import {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,formatEuros} from '../src/campaign/store-catalogue.js';
import {adventureOfferModel,masteryLine,SUPPORT_LINE,SUPPORT_TEXT} from '../src/ui/adventure-offer.js';
import {storeSeed} from './adventure-store-seed.mjs';

const quests=canonicalQuestList(),packs=[...CONTENT_PACKS].sort((a,b)=>a.order-b.order).map((p,i)=>({...p,accessible:i===0}));
const [first,second,third]=packs,firstQuests=quests.filter(q=>q.packId===first.id);
const all=Object.fromEntries(PERFORMANCE_BADGES.map(k=>[k,true]));
function progressFor(list,{badges=all}={}){const p={solved:{},performances:{},canonicalQuestState:{}};
 for(const q of list){if(q.legacyIndex!==null){p.solved[q.legacyIndex]=1;p.performances[q.legacyIndex]={version:3,badges}}else p.canonicalQuestState[q.id]={solved:true,badges}}return p}
const offer=(pack,progress,extra={})=>adventureOfferModel({pack,packs,quests,progress,...extra});

assert.equal(formatEuros(100),'1 €');assert.equal(formatEuros(500),'5 €');assert.equal(formatEuros(250),'2,50 €');
const empty=offer(second,{});
assert.equal(empty.unitPrice,formatEuros(ADVENTURE_PRICE_CENTS));assert.equal(empty.skyPrice,formatEuros(SKY_PRICE_CENTS));
const play=offer(second,{}, {pricesRequired:true,prices:{[second.id]:'¥180','real-sky-all':'¥910'}});
assert.equal(play.unitPrice,'¥180'); assert.equal(play.skyPrice,'¥910');
assert.doesNotMatch(play.capMessage,/5 €|¥910/,'Play never promises a checkout cap from a fixed or current price');
assert.match(empty.capMessage,/5 €/,'Web retains its documented cap');
assert.equal(empty.purchasesAvailable,false,'Purchases are disabled by default');
assert.equal(empty.mastery.missingQuests,firstQuests.length,'Missing quests are derived from the catalogue');
assert.equal(empty.mastery.missingBadges,firstQuests.length*PERFORMANCE_BADGES.length);
assert.match(masteryLine(empty),new RegExp('il te reste '+firstQuests.length+' quêtes et '+firstQuests.length*PERFORMANCE_BADGES.length+' badges'));

const almost=offer(second,progressFor(firstQuests.slice(0,-1)));
assert.equal(almost.mastery.missingQuests,1);assert.match(masteryLine(almost),/il te reste 1 quête et 4 badges/,'Singular forms');
const noBadges=offer(second,progressFor(firstQuests,{badges:{}}));
assert.equal(noBadges.mastery.missingQuests,0);assert.match(masteryLine(noBadges),/il te reste \d+ badges\)/,'Only badges left');

const mastered=offer(second,progressFor(firstQuests),{signedIn:true});
assert.equal(mastered.mastery.mastered,true);assert.match(masteryLine(mastered),/atteinte ✓ : cette aventure se débloque gratuitement/);
assert.match(masteryLine(offer(second,progressFor(firstQuests))),/connecte-toi pour débloquer/,'Guests are told to sign in');
assert.match(masteryLine(offer(third,{})),/une fois débloquée/,'A locked previous Adventure is explained');
assert.equal(adventureOfferModel({pack:first,packs,quests,progress:{}}).mastery,null,'The first Adventure has no previous one');

assert.match(SUPPORT_LINE,/Sans pub/);
assert.match(SUPPORT_TEXT,/petit studio indépendant/);assert.match(SUPPORT_TEXT,/financer/);
assert.doesNotMatch(SUPPORT_TEXT,/pas (pour|à) gagner|aucun bénéfice|sans but lucratif/i,'Intention wording only, never a no-profit promise (#732)');

// The server seed and the display read the same prices.
assert(storeSeed().includes(`'adventure','${second.id}',${ADVENTURE_PRICE_CENTS},'EUR'`));
assert(storeSeed().includes(`'sky',null,${SKY_PRICE_CENTS},'EUR'`));
const nav=fs.readFileSync(new URL('../src/ui/sky-navigation.js',import.meta.url),'utf8');
assert.doesNotMatch(nav,/sera annoncé plus tard/,'The placeholder lock text is gone');
// #730 (owner decision, 17/11/2026, replaces the #731 manual button): no « Restaurer mes
// achats ». Purchases are account rights, re-verified automatically and silently after
// every verified hydration (Play tokens in the Play app, unsettled Stripe sessions on the web).
const offerSource=fs.readFileSync(new URL('../src/ui/adventure-offer.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.doesNotMatch(offerSource,/'Restaurer mes achats'|adventure-offer-restore|onRestore/,'No manual restore button');
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.doesNotMatch(screen,/onRestore|restorePurchasesNow|restoreMessage/);
assert.match(screen,/function afterVerifiedHydration\(\)\{void maybeClaimMasteryUnlocks\(\);void maybeRestorePlayPurchases\(\);void refreshPaymentChannel\(\)\.finally\(\(\)=>handleStripeReturn\(\)\)\.finally\(\(\)=>void maybeRestoreStripePurchases\(\)\)\}/,'Automatic restore after verified hydration');
assert.match(screen,/async function maybeRestoreStripePurchases\(\)\{\n if\(!lumenUser\|\|qaActive\|\|!cloudProfileReady\|\|!stripeAvailable\(\)\)return;/);
assert.match(screen,/results\.some\(r=>r\.status==='paid'\)\)\{await loadEntitlements\(\)/,'Rights reloaded only after a server-confirmed purchase');
console.log('adventure-offer-tests: prices, mastery path, wording and seed parity OK');

// #786: incremental delivered content, not advertised pack sizes or future slots.
const syntheticPacks=[
 {id:'free',order:0,skyId:'real-sky',access:'included',accessible:true},
 {id:'paid',order:1,skyId:'real-sky',access:'locked',accessible:false},
 {id:'owned',order:2,skyId:'real-sky',access:'locked',accessible:true},
 {id:'future',order:3,skyId:'real-sky',access:'locked',accessible:false},
 {id:'other-sky',order:4,skyId:'future-sky',access:'locked',accessible:false}
];
const grid=(id,packId)=>({id,packId,ordinal:1,legacyIndex:null,reg:[[0]],sol:[0]});
const delivered=[grid('free-q','free'),grid('new-a','paid'),grid('new-b','paid'),grid('old','owned'),{id:'future-q',packId:'future'},grid('elsewhere','other-sky')];
const options={pack:syntheticPacks[1],packs:syntheticPacks,quests:delivered,progress:{}};
const saved=structuredClone(options);
assert.equal(adventureOfferModel(options).unitCount,2);
assert.equal(adventureOfferModel(options).skyCount,2,'Owned/free/future/other-sky content excluded');
assert.equal(adventureOfferModel({...options,quests:[...delivered,delivered[1]]}).skyCount,2,'Stable IDs count once');
const acquired=syntheticPacks.map(p=>({...p,accessible:true}));
assert.equal(adventureOfferModel({...options,pack:acquired[1],packs:acquired}).unitCount,0);
assert.equal(adventureOfferModel({...options,packs:acquired}).skyCount,0);
assert.equal(adventureOfferModel({...options,quests:[...delivered,grid('new-c','paid')]}).unitCount,3,'Catalogue growth');
assert.equal(adventureOfferModel({...options,packs:syntheticPacks.map(p=>({...p,accessStatus:'loading'}))}).skyCount,null,'Unknown rights show no invented count');
assert.equal(adventureOfferModel({...options,prices:{paid:'1,49 €','real-sky-all':'6,49 €'}}).unitPrice,'1,49 €','Provider-localised price wins');
assert.equal(adventureOfferModel({...options,boughtSingle:true}).showSky,false,'Existing single-purchase policy retained');
assert.deepEqual(options,saved,'Offer projection never modifies access/progress/catalogue');
console.log('adventure-offer-tests #786: incremental delivered counts and changing rights OK');
const unknownPlay=adventureOfferModel({...options,pricesRequired:true,purchasesAvailable:true});
assert.equal(unknownPlay.unitPrice,'Prix indisponible');assert.equal(unknownPlay.unitPriceKnown,false,'Play prices must be confirmed, not replaced by EUR assumptions');
