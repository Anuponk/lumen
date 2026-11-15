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
console.log('adventure-offer-tests: prices, mastery path, wording and seed parity OK');
