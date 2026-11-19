// #731: locked Adventure offer model and copy, against the real catalogue.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {PERFORMANCE_BADGES} from '../src/campaign/performance.js';
import {ADVENTURE_PRICE_CENTS,SKY_PRICE_CENTS,formatEuros} from '../src/campaign/store-catalogue.js';
import {adventureOfferModel,masteryLine,purchaseProgressMessage,SUPPORT_LINE,SUPPORT_TEXT} from '../src/ui/adventure-offer.js';
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
assert.equal(purchaseProgressMessage(null),'','An unverified purchase count remains hidden');
assert.match(purchaseProgressMessage({remaining:5,unlocked:false}),/Achète 5 aventures/);
for(const remaining of [4,3,2])assert.match(purchaseProgressMessage({remaining,unlocked:false}),new RegExp('Encore '+remaining+' aventures'));
assert.match(purchaseProgressMessage({remaining:1,unlocked:false}),/Plus qu’une aventure/);
assert.match(purchaseProgressMessage({remaining:0,unlocked:true}),/Tout le ciel principal est débloqué/);
assert.match(purchaseProgressMessage({remaining:4,unlocked:true}),/Tout le ciel principal est débloqué/,'The bundle unlocks directly');
assert.equal(purchaseProgressMessage({remaining:0,unlocked:false}),'','Reject an inconsistent response');
assert.equal(empty.purchasesAvailable,false,'Purchases are disabled by default');
assert.equal(empty.mastery.missingQuests,firstQuests.length,'Missing quests are derived from the catalogue');
assert.equal(empty.mastery.missingBadges,firstQuests.length*PERFORMANCE_BADGES.length);
assert.equal(masteryLine(empty),
 'Il te reste '+firstQuests.length+' quêtes et '+firstQuests.length*PERFORMANCE_BADGES.length+' badges à acquérir pour la débloquer gratuitement.');
const loading=offer(second,progressFor(firstQuests),{signedIn:true,masteryStatus:'loading'});
assert.equal(loading.mastery.missingQuests,null,'An unverified session must not show the previous account’s counts');
assert.equal(loading.mastery.mastered,false,'A provisional profile must not give a claim action');
assert.match(masteryLine(loading),/Chargement de ta progression/);

const almost=offer(second,progressFor(firstQuests.slice(0,-1)));
assert.equal(almost.mastery.missingQuests,1);assert.match(masteryLine(almost),/Il te reste 1 quête et 4 badges/,'Singular forms');
const noBadges=offer(second,progressFor(firstQuests,{badges:{}}));
assert.equal(noBadges.mastery.missingQuests,0);assert.match(masteryLine(noBadges),/^Il te reste \d+ badges à acquérir/,'Only badges left');

const mastered=offer(second,progressFor(firstQuests),{signedIn:true});
assert.equal(mastered.mastery.mastered,true);assert.match(masteryLine(mastered),/100 %.*vérifier ton déblocage gratuit/);
assert.match(masteryLine(offer(second,progressFor(firstQuests))),/Connecte-toi pour débloquer/,'Guests are told to sign in');
assert.equal(offer(third,{}).mastery.previousName,second.displayName,'The previous Adventure follows catalogue order');
const firstOnly=firstQuests[0];
const questsOnly=progressFor(firstQuests);
delete questsOnly.solved[firstOnly.legacyIndex];
assert.equal(masteryLine(offer(second,questsOnly)),'Il te reste 1 quête à terminer pour la débloquer gratuitement.');
const unavailable=offer(second,questsOnly,{signedIn:true,masteryStatus:'unavailable'});
assert.equal(unavailable.mastery.missingBadges,null);
assert.match(masteryLine(unavailable),/indisponible/);
assert.match(masteryLine(offer(second,progressFor(firstQuests),{signedIn:true,masteryConfirmed:true})),/Déblocage gratuit confirmé/);
const oldQuest={id:'historical-run-only',legacyIndex:null,packId:first.id};
const historical={canonicalQuestState:{[oldQuest.id]:{runPerformance:{},badges:{...all}}}};
const historicalOffer=adventureOfferModel({pack:second,packs,quests:[oldQuest],progress:historical});
assert.equal(historicalOffer.mastery.mastered,true,'Historical wins and all server-counted badges complete the predecessor');
historical.canonicalQuestState[oldQuest.id].badges.speed=1;
assert.equal(adventureOfferModel({pack:second,packs,quests:[oldQuest],progress:historical}).mastery.missingBadges,1,'Badge values use the server’s strict boolean rule');
assert.equal(adventureOfferModel({pack:first,packs,quests,progress:{}}).mastery,null,'The first Adventure has no previous one');

assert.match(SUPPORT_LINE,/Sans pub/);
assert.match(SUPPORT_TEXT,/petit studio indépendant/);assert.match(SUPPORT_TEXT,/financer/);
assert.doesNotMatch(SUPPORT_TEXT,/pas (pour|à) gagner|aucun bénéfice|sans but lucratif/i,'Intention wording only, never a no-profit promise (#732)');

// The server seed and the display read the same prices.
assert(storeSeed().includes(`'adventure','${second.id}',${ADVENTURE_PRICE_CENTS},'EUR'`));
assert(storeSeed().includes(`'sky',null,${SKY_PRICE_CENTS},'EUR'`));
const nav=fs.readFileSync(new URL('../src/ui/sky-navigation.js',import.meta.url),'utf8');
assert.doesNotMatch(nav,/sera annoncé plus tard/,'The placeholder lock text is gone');
// #823: Play-only manual recovery alongside the original hydration path.
const offerSource=fs.readFileSync(new URL('../src/ui/adventure-offer.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.match(offerSource,/'Vérifier mes achats Google Play'/);
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.match(screen,/onRestorePlay:offer\.pricesRequired&&offer\.signedIn/);
assert.match(screen,/function afterVerifiedHydration\(\)\{refreshAdventureOffer\?\.\('mastery'\);void maybeClaimMasteryUnlocks\(\);void maybeRestorePlayPurchases\(\);void preparePlayPurchaseAccount\(\);void refreshPaymentChannel\(\)\.finally\(\(\)=>handleStripeReturn\(\)\)\.finally\(\(\)=>void maybeRestoreStripePurchases\(\)\)\}/,'Automatic restore and checkout preparation after verified hydration');
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
