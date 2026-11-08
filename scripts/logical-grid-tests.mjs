// Independent acceptance gate: never trust generation claims or cached scores.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalQuestList,originalCanonicalQuestList} from '../src/campaign/canonical-quests.js';
import {rateLogicalDifficulty} from '../src/game/logical-difficulty.js';
import {connected,countSolutions,replay,signature} from './generate-diverse-grids.mjs';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {cloudSafelyCoversLocal,reconcileCloudAchievements} from '../src/persistence/cloud-profile.js';
import manifest from '../content/generated/logical-grids-v1.json' with {type:'json'};
const hash=q=>createHash('sha256').update(JSON.stringify({reg:q.reg,sol:q.sol})).digest('hex');
const original=originalCanonicalQuestList(),all=canonicalQuestList(),ids=new Set(manifest.quests.map(q=>q.id));
const packs=['real-adventure-05','real-adventure-06','real-adventure-07','real-adventure-08'];
assert.equal(manifest.quests.length,original.filter(q=>packs.includes(q.packId)).length);
assert.equal(ids.size,manifest.quests.length);
const seen=new Set(original.map(q=>signature(q.reg))),layout=[],ratings=new Map();
const start=performance.now();
for(const q of manifest.quests){
 const old=original.find(x=>x.id===q.id),current=all.find(x=>x.id===q.id);
 assert(packs.includes(q.packId));assert.equal(q.previousGridHash,hash(old));assert.equal(q.gridHash,hash(q));assert.notEqual(q.gridHash,q.previousGridHash);
 for(const key of ['id','ordinal','legacyIndex','packId','constellationId','position','rewards'])assert.deepEqual(current[key],old[key]);
 assert.equal(q.gridRevision,1);assert.deepEqual(current.reg,q.reg);assert.deepEqual(current.sol,q.sol);
 assert(connected(q.reg));assert.equal(countSolutions(q),1,q.id);
 const key=signature(q.reg);assert(!seen.has(key),q.id+' D4 duplicate');seen.add(key);
 const cells=key.split(',');assert(layout.every(other=>cells.filter((v,i)=>v!==other[i]).length>=6),'Near-duplicate layout '+q.id);layout.push(cells);
 const logic=rateLogicalDifficulty(q.reg,{trace:false});assert.deepEqual(logic,q.logical);assert.deepEqual(logic.solution,q.sol);assert(logic.solved);assert(logic.firstPlacementDepth>=3);assert(logic.deductionsBeforeFirst>=2);
 const proof=replay(q);assert(proof,q.id+' actual hint engine');assert.equal(proof.proofSteps,q.audit.proofSteps);assert.deepEqual(proof.rules,q.audit.rules);
 ratings.set(q.id,{before:rateLogicalDifficulty(old.reg),after:rateLogicalDifficulty(q.reg)});
}
for(const q of all.filter(q=>!ids.has(q.id)))assert.deepEqual(q,original.find(x=>x.id===q.id),'Unchanged adventure '+q.id);
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const quantiles=a=>{a=[...a].sort((x,y)=>x-y);return [a[0],a[Math.floor(a.length*.25)],a[Math.floor(a.length*.5)],a[Math.floor(a.length*.75)],a.at(-1)]};
const easy=r=>r.trace.filter(f=>f.rule==='single'&&f.depth<=3).length;
const rows=[];let previousMax=-Infinity;
for(const [index,pack] of packs.entries()){
 const qs=manifest.quests.filter(q=>q.packId===pack),before=qs.map(q=>ratings.get(q.id).before),after=qs.map(q=>ratings.get(q.id).after);
 const scores=after.map(r=>r.score);assert(Math.min(...scores)>previousMax,'Strict adventure bands');previousMax=Math.max(...scores);
 for(const id of new Set(qs.map(q=>q.constellationId))){const a=qs.filter(q=>q.constellationId===id);for(let i=1;i<a.length;i++)assert(a[i].logical.score>=a[i-1].logical.score,'Within-constellation progression');assert(a.at(-1).logical.score>a[0].logical.score)}
 assert(mean(after.map(easy))<mean(before.map(easy)),'Reduce shallow/evident guardian deductions');
 assert(mean(after.map(r=>r.firstPlacementDepth))>mean(before.map(r=>r.firstPlacementDepth)),'Delay first obvious guardian');
 assert(mean(scores)>mean(before.map(r=>r.score)),'Harder without raw cell counting');
 const sameSize=qs.filter(q=>original.find(x=>x.id===q.id).size===q.size);
 if(sameSize.length)assert(mean(sameSize.map(q=>ratings.get(q.id).after.score))>mean(sameSize.map(q=>ratings.get(q.id).before.score)),'Matched-size improvement');
 rows.push({adventure:index+5,count:qs.length,label:all.find(q=>q.id===qs[0].id).difficulty.label,before:quantiles(before.map(r=>r.score)),after:quantiles(scores),meanBefore:mean(before.map(r=>r.score)),meanAfter:mean(scores),firstDepthBefore:mean(before.map(r=>r.firstPlacementDepth)),firstDepthAfter:mean(after.map(r=>r.firstPlacementDepth)),easyBefore:mean(before.map(easy)),easyAfter:mean(after.map(easy)),sizeBefore:mean(qs.map(q=>original.find(x=>x.id===q.id).size)),sizeAfter:mean(qs.map(q=>q.size)),sameSize:sameSize.length,sampleIds:[qs[0].id,qs.at(-1).id]});
}
// Preserve cloud/local earned facts instead of deleting one side and allowing
// the other device to resurrect it. Grid revisions affect active boards only.
for(const id of [manifest.quests[0].id,manifest.quests.at(-1).id]){
 const badges={autonomy:true,speed:false,noError:false,mastery:false};
 const q=all.find(q=>q.id===id),profile={catalogueOrigin:4,solved:{},badges:{},performances:{},stars:{},challenges:{},xp:15,shards:7,canonicalQuestState:{[id]:{solved:true,stars:1,badges:{...badges},runPerformance:{version:3,bestTime:10,badges:{...badges}}}}};
 const before=structuredClone(profile);applyQuestVictory(profile,q,{seconds:100,assistanceUsed:false,hintUsed:false,mistakeCommitted:false,qualifying:false,challengeFailed:true});
 assert.equal(profile.xp,before.xp);assert.equal(profile.shards,before.shards);assert.deepEqual(profile.canonicalQuestState[id].badges,before.canonicalQuestState[id].badges);
 const store=new Map([['lumenProgressV1',JSON.stringify(before)]]),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 assert(cloudSafelyCoversLocal(before,before));reconcileCloudAchievements(storage,before);assert.deepEqual(JSON.parse(store.get('lumenProgressV1')),before,'No migration rewrite or cloud/local split');
}
const seconds=(performance.now()-start)/1000;
const report={schema:1,method:'lumen-logic-v1',generation:manifest.stats,validated:ids.size,rows};
if(process.argv.includes('--write'))fs.writeFileSync('docs/validation/logical-difficulty-640.json',JSON.stringify(report,null,2)+'\n');
else assert.deepEqual(JSON.parse(fs.readFileSync('docs/validation/logical-difficulty-640.json','utf8')),report,'Recompute committed report');
console.log(JSON.stringify({validated:ids.size,seconds,rows}));
