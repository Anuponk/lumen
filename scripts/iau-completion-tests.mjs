import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import baseline from '../content/catalogue/iau-completion-baseline.json' with {type:'json'};
import config from '../content/catalogue/remaining-adventures.json' with {type:'json'};
import history from '../content/catalogue/access-origins.json' with {type:'json'};
import {canonicalQuestList,originalCanonicalQuestList,canonicalCampaignComplete,canonicalCampaignQuestDecision,canonicalNextUnsolved,canonicalAdventureSummary} from '../src/campaign/canonical-quests.js';
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS,contentMapModel} from '../src/campaign/content.js';
import {IAU_CONSTELLATIONS} from '../src/campaign/iau-constellations.js';
import {iauForConstellation,verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {profileStorageBytes,MAX_PROFILE_BYTES} from '../src/persistence/profile-size.js';
import {createDiagnostics} from '../src/testing/diagnostics.js';

const all=canonicalQuestList(),old=all.slice(0,baseline.questCount),tail=all.slice(baseline.questCount);
assert.equal(all.length,880);assert.equal(CONTENT_PACKS.length,9);assert.equal(CONTENT_CONSTELLATIONS.length,88);
assert.equal(createHash('sha256').update(JSON.stringify(originalCanonicalQuestList().slice(0,baseline.questCount))).digest('hex'),baseline.identityAndGridSha256,'All 500 original grid contracts remain verifiable; explicit #640 revisions have a separate audit');
assert.equal(tail.length,380);assert.equal(history.current,4);
assert.deepEqual(CONTENT_CONSTELLATIONS.map(iauForConstellation).sort(),IAU_CONSTELLATIONS.map(c=>c.abbr).sort(),'Exactly one of each official constellation');
for(const c of CONTENT_CONSTELLATIONS)assert.equal(verifiedAstronomicalFigure(c)?.iau,iauForConstellation(c));
for(const p of config.adventures){
 const entries=tail.filter(q=>q.packId===p.id),constellations=CONTENT_CONSTELLATIONS.filter(c=>c.packId===p.id);
 assert.equal(entries.length,p.constellations.length*10);assert.equal(constellations.length,p.constellations.length);
 assert.deepEqual(constellations.map(c=>c.iau),p.constellations.map(c=>c.iau));
 for(const c of constellations){
  const qs=entries.filter(q=>q.constellationId===c.id);assert.equal(qs.length,10);
  for(let i=1;i<qs.length;i++)assert(qs[i].difficulty.score>=qs[i-1].difficulty.score,'Measured difficulty progression '+c.id);
 }
}
const summaries=canonicalAdventureSummary({});assert.equal(summaries.at(-1).quests,80);assert.equal(summaries.at(-1).constellations,8);
const p={catalogueOrigin:3,solved:Object.fromEntries(old.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(old.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{},stars:1}])),performances:{},badges:{},stars:{},challenges:{},xp:1000,shards:7};
const before=structuredClone(p),access={entitlements:config.adventures.map(p=>p.id),cloudReady:true,signedIn:true};
assert.equal(canonicalCampaignComplete(p),false);
assert.equal(canonicalNextUnsolved(p.solved,Object.fromEntries(Object.keys(p.canonicalQuestState).map(id=>[id,true])))?.id,tail[0].id);
assert.notEqual(canonicalCampaignQuestDecision(tail[0],p,{...access,entitlements:[]}).status,'ready','No paid access silently granted');
assert.equal(contentMapModel(access.entitlements,{progress:p}).skies[0].packs.at(-1).constellations.length,8);
const facts={seconds:70,assistanceUsed:false,hintUsed:false,mistakeCommitted:false,qualifying:true,challengeFailed:false,qualifiedDay:'2026-11-06',qualifiedAt:'2026-11-06T12:00:00.000Z'};
for(const q of tail){
 assert.equal(canonicalCampaignQuestDecision(q,p,access).status,'ready','Old complete account continues in order '+q.id);
 applyQuestVictory(p,q,facts);
}
assert(canonicalCampaignComplete(p));assert.deepEqual(p.solved,before.solved);
for(const [id,state] of Object.entries(before.canonicalQuestState))assert.deepEqual(p.canonicalQuestState[id],state);
const xp=p.xp,shards=p.shards;applyQuestVictory(p,tail.at(-1),{...facts,qualifying:false,seconds:60});assert.equal(p.xp,xp);assert.equal(p.shards,shards);
assert(canonicalAdventureSummary(p).every(p=>p.completed===p.quests));
const complete={catalogueOrigin:4,solved:{},canonicalQuestState:{},performances:{},badges:{},stars:{},challenges:{},xp:0,shards:0};
for(const q of all){
 assert.equal(canonicalCampaignQuestDecision(q,complete,{...access,entitlements:CONTENT_PACKS.map(p=>p.id)}).status,'ready','Fresh revision-4 account advances through every adventure: '+q.id);
 applyQuestVictory(complete,q,facts);
}
assert(canonicalCampaignComplete(complete));
const bytes=profileStorageBytes(JSON.stringify(complete));assert(bytes<MAX_PROFILE_BYTES,'A fully played 880-quest projection must fit the existing cloud JSONB limit: '+bytes);
console.log('Complete 880-quest cloud projection: '+bytes+'/'+MAX_PROFILE_BYTES+' bytes');
const embedded=await createDiagnostics({}, {init(){},async runHintTests(){return [{ok:true}]}}).runAllHintTests();
assert.deepEqual(embedded.map(s=>s.size),[...new Set(all.map(q=>q.size))].sort((a,b)=>a-b),'Embedded assistance regressions must exercise every playable board size');
console.log('PASS IAU88: 9 adventures, 88 official figures, 880 quests, exact historical prefix, A6→A9, ownership, eight-constellation finale, replay rewards');
