// Offline deterministic revision. Keep the original catalogue and v1 manifest
// immutable; exchange only slots whose measured band needs to change.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import first from '../content/generated/logical-grids-v1.json' with {type:'json'};
import {originalCanonicalQuestList} from '../src/campaign/canonical-quests.js';
import {rateLogicalDifficulty} from '../src/game/logical-difficulty.js';
import {logicalDifficultyTier} from '../src/campaign/logical-difficulty-bands.js';
import {MIXED_TARGETS,mixedTierSchedule,pacingIntensity} from './mixed-difficulty-policy.mjs';
import {rng,generate,signature,connected,countSolutions,replay,features} from './generate-diverse-grids.mjs';
const hash=q=>createHash('sha256').update(JSON.stringify({reg:q.reg,sol:q.sol})).digest('hex');
const compare=(a,b)=>a.logical.score-b.logical.score||a.signature.localeCompare(b.signature);
export function regenerateMixed({attempts=30000,seed=2026110809,out='content/generated/logical-grids-v2.json'}={}){
 const original=originalCanonicalQuestList(),v1=new Map(first.quests.map(q=>[q.id,q]));
 const baseline=original.map(q=>v1.has(q.id)?{...q,...v1.get(q.id)}:q);
 const targets=baseline.filter(q=>MIXED_TARGETS.some(p=>p.packId===q.packId));
 const protectedQuests=baseline.filter(q=>!MIXED_TARGETS.some(p=>p.packId===q.packId));
 const desired=new Map(),orders=new Map();
 for(const policy of MIXED_TARGETS){
  const members=targets.filter(q=>q.packId===policy.packId);
  for(const cid of new Set(members.map(q=>q.constellationId))){
   const group=members.filter(q=>q.constellationId===cid),tiers=mixedTierSchedule(group.length,policy.weights);
   group.forEach((q,i)=>{desired.set(q.id,tiers[i]);orders.set(q.id,pacingIntensity(i,group.length))});
  }
 }
 const assignments=new Map(),available=[[],[],[],[]];
 for(const q of targets.filter(q=>v1.has(q.id))){
  const tier=logicalDifficultyTier(q.logical.score);
  if(tier===desired.get(q.id))assignments.set(q.id,q);
  else available[tier].push({...q,signature:signature(q.reg)});
 }
 const exchanges=targets.filter(q=>v1.has(q.id)&&!assignments.has(q.id));
 for(let tier=0;tier<available.length;tier++){
  available[tier].sort(compare);
  const slots=exchanges.filter(q=>desired.get(q.id)===tier).sort((a,b)=>MIXED_TARGETS.findIndex(p=>p.packId===a.packId)-MIXED_TARGETS.findIndex(p=>p.packId===b.packId)||orders.get(a.id)-orders.get(b.id)||a.ordinal-b.ordinal);
  if(slots.length!==available[tier].length)throw Error('Unbalanced measured exchange pool');
  slots.forEach((q,i)=>assignments.set(q.id,available[tier][i]));
 }
 const finale=targets.filter(q=>!v1.has(q.id)),random=rng(seed);
 const masterScores=first.quests.filter(q=>logicalDifficultyTier(q.logical.score)===3).map(q=>q.logical.score).sort((a,b)=>a-b);
 const floor=masterScores[Math.floor(masterScores.length*.75)];
 const seeds=first.quests.filter(q=>q.logical.score>=floor),pool=[];
 const allHistorical=[...original,...first.quests],seen=new Set(allHistorical.map(q=>signature(q.reg)));
 const fixed=[...protectedQuests,...targets.filter(q=>v1.has(q.id))].filter(q=>q.reg.length===seeds[0].size).map(q=>signature(q.reg).split(','));
 const stats={attempts,seed,floor,connected:0,unique:0,logical:0,replay:0};
 for(let i=0;i<attempts;i++){
  if(i&&i%2000===0)console.log(JSON.stringify({attempt:i,pool:pool.length,best:pool.length?Math.max(...pool.map(q=>q.logical.score)):null}));
  let p;
  if(i%20===0)p=generate(seeds[0].size,['classic','hybrid','balanced'][Math.floor(i/20)%3],random);
  else{
   const parents=pool.length>20&&random()<.8?pool:seeds,parent=parents[Math.floor(random()*parents.length)],n=parent.reg.length;
   p={reg:parent.reg.map(row=>[...row]),sol:[...parent.sol]};
   for(let edit=0,edits=3+Math.floor(random()*10);edit<edits;edit++){
    const r=Math.floor(random()*n),c=Math.floor(random()*n),neighbors=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([y,x])=>p.reg[y]?.[x]!==undefined);
    const [y,x]=neighbors[Math.floor(random()*neighbors.length)];if(p.sol[r]!==c)p.reg[r][c]=p.reg[y][x];
   }
  }
  if(!p||!connected(p.reg))continue;stats.connected++;
  const sig=signature(p.reg);if(seen.has(sig))continue;seen.add(sig);
  if(countSolutions(p)!==1)continue;stats.unique++;
  const logical=rateLogicalDifficulty(p.reg,{trace:false});
  if(!logical.solved||logical.score<floor||logical.firstPlacementDepth<5||logical.deductionsBeforeFirst<3)continue;stats.logical++;
  const proof=replay(p);if(!proof)continue;stats.replay++;
  const measured=features(p,proof);
  pool.push({...p,size:p.reg.length,logical,signature:sig,family:'master-boundary-search',audit:{ok:true,solutions:1,solutionCount:1,proofSteps:proof.proofSteps,rules:proof.rules,hardestRule:proof.hardestRule,score:measured.score}});
  if(pool.length>3000){pool.sort((a,b)=>compare(b,a));pool.splice(2200)}
 }
 pool.sort((a,b)=>compare(b,a));
 const selected=[],distance=(a,b)=>a.reduce((s,v,i)=>s+(v!==b[i]),0);
 for(const candidate of pool){
  const cells=candidate.signature.split(',');
  if(fixed.some(other=>distance(cells,other)<6)||selected.some(other=>distance(cells,other.cells)<6))continue;
  selected.push({...candidate,cells});if(selected.length===finale.length)break;
 }
 if(selected.length!==finale.length)throw Error('Diverse Master shortfall: '+selected.length+'/'+finale.length+'; pool '+pool.length);
 selected.sort(compare);
 const slots=[...finale].sort((a,b)=>orders.get(a.id)-orders.get(b.id)||a.ordinal-b.ordinal);
 slots.forEach((q,i)=>assignments.set(q.id,selected[i]));
 const quests=targets.map(q=>{
  const grid=assignments.get(q.id),oldHash=hash(q),newHash=hash(grid),previousRevision=v1.has(q.id)?1:0;
  if(logicalDifficultyTier(grid.logical.score)!==desired.get(q.id))throw Error('Wrong measured band');
  return {id:q.id,packId:q.packId,ordinal:q.ordinal,constellationId:q.constellationId,previousGridHash:oldHash,gridHash:newHash,
   previousGridRevision:previousRevision,gridRevision:newHash===oldHash?previousRevision:2,logicalTier:logicalDifficultyTier(grid.logical.score),
   sourceQuestId:grid.id??null,size:grid.reg.length,reg:grid.reg,sol:grid.sol,family:grid.family,audit:grid.audit,logical:grid.logical};
 });
 const manifest={schema:'lumen-logical-grid-replacements-v2',version:2,baseline:'03279a436d2244a50ccbab6d68ea4f14b0eb6c07',stats:{...stats,selectedMasters:selected.length,changed:quests.filter(q=>q.gridHash!==q.previousGridHash).length,preserved:quests.filter(q=>q.gridHash===q.previousGridHash).length},pacing:MIXED_TARGETS,quests};
 fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify(manifest.stats));return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)regenerateMixed({attempts:Number(process.argv[2]||30000)});
