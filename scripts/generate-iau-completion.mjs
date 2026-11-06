// Seeded offline extension. Never edits existing grids or connects to a server.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import config from '../content/catalogue/remaining-adventures.json' with {type:'json'};
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CAT} from '../src/campaign/catalogue.js';
import {qualifyDifficulty} from '../src/campaign/difficulty.js';
import {verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';
import {generate,rng,signature,countSolutions,connected,replay,features} from './generate-diverse-grids.mjs';

const packs=new Set(config.adventures.map(p=>p.id));
const previous=canonicalQuestList().filter(q=>!packs.has(q.packId));
const baseline={revision:config.baselineRevision,questCount:previous.length,identityAndGridSha256:createHash('sha256').update(JSON.stringify(previous)).digest('hex')};
const baselinePath='content/catalogue/iau-completion-baseline.json';
if(fs.existsSync(baselinePath)&&JSON.stringify(JSON.parse(fs.readFileSync(baselinePath)))!==JSON.stringify(baseline))throw Error('Previously published baseline changed');
const seen=new Set([...Object.values(CAT).flat(),...previous].map(q=>signature(q.reg)));
const required=new Map();
for(const pack of config.adventures){
 if(pack.candidateSizeSchedule.length!==pack.questsPerConstellation)throw Error('Invalid candidate size schedule');
 for(const c of pack.constellations){
  if(verifiedAstronomicalFigure(c)?.iau!==c.iau)throw Error('Unverified figure '+c.iau);
  for(const size of pack.candidateSizeSchedule)required.set(size,(required.get(size)||0)+1);
 }
}
const selected=[],stats=[];
const difficulty=p=>qualifyDifficulty({...p,size:p.reg.length}).score;
const compare=(a,b)=>difficulty(a)-difficulty(b)||a.reg.length-b.reg.length||signature(a.reg).localeCompare(signature(b.reg));
for(const [size,count] of [...required].sort(([a],[b])=>a-b)){
 const pool=[],random=rng(config.seed+size*7907);
 const collect=(family,attempts,target)=>{
  let tried=0,accepted=0;
  for(;tried<attempts&&pool.length<target;tried++){
   const p=generate(size,family,random);if(!p||!connected(p.reg))continue;
   const key=signature(p.reg);if(seen.has(key)||countSolutions(p)!==1)continue;
   const proof=replay(p);if(!proof)continue;
   seen.add(key);accepted++;
   const measured=features(p,proof);
   pool.push({...p,family,features:{regionSpread:measured.regionSpread,boundaryEdges:measured.boundaryEdges,groupSteps:measured.groupSteps,lockedSteps:measured.lockedSteps},audit:{ok:true,solutions:1,solutionCount:1,proofSteps:proof.proofSteps,rules:proof.rules,hardestRule:proof.hardestRule,score:measured.score}});
  }
  stats.push({size,family,tried,accepted});console.log(JSON.stringify(stats.at(-1)));
 };
 const target=count+Math.ceil(count/2);
 collect('classic',size===8?20000:6000,target);
 collect('hybrid',size===8?20000:6000,target);
 collect('mosaic',500000,target);
 if(pool.length<count)throw Error('Insufficient independently audited grids at size '+size);
 // Keep rare valid strategies, then sample the proof-difficulty range evenly.
 const chosen=pool.filter(p=>p.family!=='mosaic').sort(compare).slice(0,count);
 const rest=pool.filter(p=>p.family==='mosaic').sort(compare),need=count-chosen.length;
 for(let i=0;i<need;i++)chosen.push(rest[Math.floor(i*(rest.length-1)/Math.max(1,need-1))]);
 if(chosen.length!==count||new Set(chosen.map(p=>signature(p.reg))).size!==count)throw Error('Selection collision');
 selected.push(...chosen);
}
selected.sort(compare);
const quests=[];let offset=0;
for(const pack of config.adventures){
 const length=pack.constellations.length*pack.questsPerConstellation,pool=selected.slice(offset,offset+length);offset+=length;
 for(const [cIndex,c] of pack.constellations.entries())for(let j=0;j<pack.questsPerConstellation;j++){
  const p=pool[j*pack.constellations.length+cIndex];
  quests.push({id:'pack-'+pack.id+'-q'+String(cIndex*pack.questsPerConstellation+j+1).padStart(3,'0'),packId:pack.id,constellationId:c.id,size:p.reg.length,reg:p.reg,sol:p.sol,audit:p.audit,family:p.family,features:p.features});
 }
}
if(offset!==selected.length)throw Error('Incomplete allocation');
const manifest={schema:'lumen-iau-completion-grids-v1',status:'proof-audited',seed:config.seed,questCount:quests.length,generation:stats,quests};
fs.writeFileSync(baselinePath,JSON.stringify(baseline,null,2)+'\n');
fs.writeFileSync('content/generated/remaining-adventures.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Generated '+quests.length+' distinct, connected, unique-solution, proof-replayed grids; previous '+previous.length+' unchanged.');
