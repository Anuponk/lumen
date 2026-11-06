import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import history from '../content/catalogue/access-origins.json' with {type:'json'};
import {canonicalQuestList,canonicalCampaignComplete,canonicalCampaignQuestDecision} from '../src/campaign/canonical-quests.js';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
const all=canonicalQuestList(),old=history.catalogues.find(c=>c.revision===2).quests,tail=all.filter(q=>q.packId==='real-adventure-05');
assert.equal(old.length,400);assert.equal(tail.length,100);assert.equal(all.slice(0,500).length,500);
const hash=q=>createHash('sha256').update(JSON.stringify({reg:q.reg,sol:q.sol})).digest('hex');
assert.deepEqual(all.slice(0,400).map(({id,legacyIndex,packId,constellationId,ordinal,...q})=>({id,legacyIndex,packId,constellationId,ordinal,gridHash:hash(q)})),old,'Every prior identity, order and grid remains exact');
assert.equal(CONTENT_PACKS.find(p=>p.order===4).id,'real-adventure-05');
assert.equal(CONTENT_CONSTELLATIONS.filter(c=>c.packId==='real-adventure-05').length,10);
assert(tail.every((q,i)=>q.ordinal===401+i&&q.legacyIndex===null&&q.packId==='real-adventure-05'));
for(const id of new Set(tail.map(q=>q.constellationId))){
 const quests=tail.filter(q=>q.constellationId===id);
 for(let i=1;i<quests.length;i++)assert(quests[i].size>=quests[i-1].size&&(quests[i].size!==quests[i-1].size||quests[i].audit.score>=quests[i-1].audit.score),'Candidate schedule must not descend at the same size: '+id);
}
const p={catalogueOrigin:2,solved:Object.fromEntries(all.slice(0,400).filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(all.slice(0,400).filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{},stars:1}])),performances:{},badges:{},stars:{},challenges:{},xp:1000,shards:7};
assert.equal(canonicalCampaignComplete(p),false,'A formerly complete account resumes at the appended pack');
const access={entitlements:['real-adventure-05'],cloudReady:true,signedIn:true};
assert.equal(canonicalCampaignQuestDecision(tail[0],p,access).status,'ready');
assert.notEqual(canonicalCampaignQuestDecision(tail[0],p,{...access,entitlements:[]}).status,'ready');
assert.notEqual(canonicalCampaignQuestDecision(tail[1],p,access).status,'ready');
const oldSolved=JSON.stringify(p.solved),oldState=structuredClone(p.canonicalQuestState),facts={seconds:70,assistanceUsed:false,hintUsed:false,mistakeCommitted:false,qualifying:true,challengeFailed:false,qualifiedDay:'2026-11-04',qualifiedAt:'2026-11-04T12:00:00.000Z'};
for(const q of tail){assert.equal(canonicalCampaignQuestDecision(q,p,access).status,'ready');applyQuestVictory(p,q,facts)}
assert.equal(canonicalCampaignComplete(p,all.slice(0,500)),true);assert.equal(canonicalCampaignComplete(p),false,'Catalogue extension remains to play');assert.equal(JSON.stringify(p.solved),oldSolved);
for(const [id,state] of Object.entries(oldState))assert.deepEqual(p.canonicalQuestState[id],state,'Historical rewards remain immutable');
const xp=p.xp,shards=p.shards;applyQuestVictory(p,tail[0],{...facts,qualifying:false,seconds:60});
assert.equal(p.xp,xp);assert.equal(p.shards,shards);assert.equal(p.canonicalQuestState[tail[0].id].runPerformance.bestTime,60);
console.log('PASS Adventure 5 runtime: exact 400-prefix, 100 append-only quests, ownership/sequencing, continuation, rewards and replay');
