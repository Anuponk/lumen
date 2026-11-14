// Offline-only deterministic search; no player/network/database writes.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {originalCanonicalQuestList as canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {rateLogicalDifficulty} from '../src/game/logical-difficulty.js';
import {rng,generate,signature,connected,countSolutions,replay,features} from './generate-diverse-grids.mjs';
export const TARGET_PACKS=['real-adventure-05','real-adventure-06','real-adventure-07','real-adventure-08'];
export const gridHash=q=>createHash('sha256').update(JSON.stringify({reg:q.reg,sol:q.sol})).digest('hex');
export function regenerate({attempts=100000,seed=64020261108,out='content/generated/logical-grids-v1.json'}={}){
 const original=canonicalQuestList(),targets=original.filter(q=>TARGET_PACKS.includes(q.packId));
 const random=rng(seed),seen=new Set(original.map(q=>signature(q.reg))),pool=[],stats={attempts,seed,connected:0,unique:0,logical:0,legacyReplay:0};
 const seeds=original.filter(q=>q.size===8);
 for(let attempt=0;attempt<attempts;attempt++){
  let p;
  if(attempt%12===0)p=generate(8,['classic','hybrid','balanced'][Math.floor(attempt/12)%3],random);
  else{
   const sources=pool.length>20&&random()<0.8?pool:seeds;
   const parent=sources[Math.floor(random()*sources.length)];
   p={reg:parent.reg.map(row=>[...row]),sol:[...parent.sol]};
   const edits=1+Math.floor(random()*6);
   for(let i=0;i<edits;i++){
    const r=Math.floor(random()*8),c=Math.floor(random()*8),neighbors=[[r-1,c],[r+1,c],[r,c-1],[r,c+1]].filter(([y,x])=>p.reg[y]?.[x]!==undefined);
    const [y,x]=neighbors[Math.floor(random()*neighbors.length)];
    if(p.sol[r]!==c)p.reg[r][c]=p.reg[y][x];
   }
  }
  if(!p||!connected(p.reg))continue;stats.connected++;
  const sig=signature(p.reg);if(seen.has(sig))continue;seen.add(sig);
  if(countSolutions(p)!==1)continue;stats.unique++;
  const logical=rateLogicalDifficulty(p.reg,{trace:false});
  if(!logical.solved||logical.deductionsBeforeFirst<2||logical.firstPlacementDepth<3)continue;stats.logical++;
  // Reject anything the actual assistance engine cannot explain as well.
  const proof=replay(p);if(!proof)continue;stats.legacyReplay++;
  const measured=features(p,proof);
  pool.push({...p,family:'logical-boundary-search',logical,audit:{ok:true,solutions:1,solutionCount:1,proofSteps:proof.proofSteps,rules:proof.rules,hardestRule:proof.hardestRule,score:measured.score},signature:sig});
  if(pool.length>8000){pool.sort(compare);pool.splice(6000)}
  if(attempt%5000===0)console.log(JSON.stringify({attempt,pool:pool.length,best:Math.max(...pool.map(p=>p.logical.score))}));
 }
 pool.sort(compare);
 if(pool.length<targets.length)throw Error('Candidate shortfall: '+pool.length+' / '+targets.length);
 // Take a broad high-difficulty band, then split non-overlapping tiers.
 const diverse=[];
 for(const p of pool){
  const cells=p.signature.split(',');
  if(diverse.every(q=>cells.reduce((sum,value,i)=>sum+(value!==q.cells[i]),0)>=6))diverse.push({...p,cells});
  if(diverse.length===targets.length+200)break;
 }
 if(diverse.length<targets.length+100)throw Error('Diverse candidate shortfall: '+diverse.length);
 const bands=new Map();let offset=0;
 for(const packId of [...TARGET_PACKS].reverse()){
  const count=targets.filter(q=>q.packId===packId).length;
  const tier=diverse.slice(offset,offset+count);offset+=count;
  if(tier.length!==count)throw Error('Difficulty tier shortfall');
  bands.set(packId,tier.reverse());
  while(offset<diverse.length&&diverse[offset].logical.score>=tier[0].logical.score)offset++;
 }
 const quests=[];
 for(const packId of TARGET_PACKS){
  const members=targets.filter(q=>q.packId===packId),constellations=[...new Set(members.map(q=>q.constellationId))];
  const tier=bands.get(packId);
  for(const [ci,c] of constellations.entries()){
   const qs=members.filter(q=>q.constellationId===c);
   for(const [j,q] of qs.entries()){
    const p=tier[j*constellations.length+ci];
    quests.push({id:q.id,packId,ordinal:q.ordinal,constellationId:c,previousGridHash:gridHash(q),gridHash:gridHash(p),gridRevision:1,logicalTier:TARGET_PACKS.indexOf(packId),size:p.reg.length,reg:p.reg,sol:p.sol,family:p.family,audit:p.audit,logical:p.logical});
   }
  }
 }
 const manifest={schema:'lumen-logical-grid-replacements-v1',version:1,stats,quests};
 fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({...stats,diverse:diverse.length,selected:quests.length,min:Math.min(...quests.map(q=>q.logical.score)),max:Math.max(...quests.map(q=>q.logical.score))}));return manifest;
}
function compare(a,b){return b.logical.score-a.logical.score||a.signature.localeCompare(b.signature)}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)regenerate({attempts:Number(process.argv[2]||100000)});
