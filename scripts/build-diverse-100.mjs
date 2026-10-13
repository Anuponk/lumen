// #340: deterministic offline batch of 100 NEW, audited, unscheduled puzzles.
// Usage: node scripts/build-diverse-100.mjs [output.json]
// Never edits CAT, campaign mapping, player progress or rewards.
import fs from 'node:fs';
import {selectCandidates,signature,connected,countSolutions,replay} from './generate-diverse-grids.mjs';
import {CAT} from '../src/campaign/catalogue.js';

const PLAN=[
  {size:7,family:'classic',want:15},
  {size:7,family:'classic',want:15},
  {size:7,family:'serpentine',want:10},
  {size:8,family:'mosaic',want:20},
  {size:8,family:'hybrid',want:20},
  {size:8,family:'serpentine',want:20}
];
const existing=new Set(Object.values(CAT).flat().map(p=>signature(p.reg)));
const chosen=[],seen=new Set(existing),attemptReports=[];
for(let i=0;i<PLAN.length;i++){
  const config=PLAN[i],candidates=[];
  for(let round=0;round<10&&candidates.length<config.want;round++){
    const result=selectCandidates({size:config.size,family:config.family,count:100,seed:340000+i*101+round,attempts:16000});
    attemptReports.push({family:config.family,size:config.size,round,attempts:16000,valid:result.validCandidates});
    for(const p of result.selected){
      const sig=signature(p.reg);
      if(seen.has(sig))continue;
      if(!connected(p.reg)||countSolutions(p)!==1||!replay(p))throw Error('Rejected puzzle passed generator verification');
      seen.add(sig);candidates.push(p);
      if(candidates.length===config.want)break;
    }
  }
  // Fill any shortfall with other validated families at the same board size.
  // Do not weaken uniqueness, replay or connectivity constraints.
  if(candidates.length<config.want){
    for(const fallback of ['hybrid','mosaic','classic','serpentine']){
      if(fallback===config.family)continue;
      for(let round=0;round<10&&candidates.length<config.want;round++){
        const result=selectCandidates({size:config.size,family:fallback,count:100,seed:940000+i*503+round*17+fallback.length,attempts:16000});
        attemptReports.push({family:fallback,requestedFamily:config.family,size:config.size,round,attempts:16000,valid:result.validCandidates,fallback:true});
        for(const p of result.selected){
          const sig=signature(p.reg);
          if(seen.has(sig))continue;
          if(!connected(p.reg)||countSolutions(p)!==1||!replay(p))throw Error('Rejected fallback puzzle passed verification');
          seen.add(sig);candidates.push({...p,actualFamily:fallback});
          if(candidates.length===config.want)break;
        }
      }
      if(candidates.length===config.want)break;
    }
  }
  if(candidates.length!==config.want)throw Error('Insufficient validated candidates for '+config.family+': '+candidates.length+'/'+config.want);
  for(const p of candidates)chosen.push({...p,family:p.actualFamily||config.family});
}
if(chosen.length!==100||new Set(chosen.map(p=>signature(p.reg))).size!==100)throw Error('Batch size/uniqueness failure');
const byScore=[...chosen].sort((a,b)=>a.audit.score-b.audit.score||a.features.signature.localeCompare(b.features.signature));
const levelBySignature=new Map(byScore.map((p,i)=>[p.features.signature,i<20?'facile':i<55?'intermediaire':i<85?'difficile':'expert']));
const rankBySignature=new Map(byScore.map((p,i)=>[p.features.signature,i+1]));
const puzzles=chosen.map((p,i)=>({
  candidateId:'lumen-diverse-'+String(i+1).padStart(3,'0'),
  family:p.family,
  difficulty:{label:levelBySignature.get(p.features.signature),score:p.audit.score,rank:rankBySignature.get(p.features.signature),version:'heuristic-v1',calibrated:false},
  reg:p.reg,sol:p.sol,audit:p.audit,
  geometry:{regionSpread:p.features.regionSpread,boundaryEdges:p.features.boundaryEdges},
  signature:p.features.signature
}));
const output={
  schema:'lumen-candidate-pack-v1',
  status:'unscheduled-not-published',
  generator:'scripts/build-diverse-100.mjs',
  difficultyNote:'Quartile-based heuristic allocation, NOT validated player difficulty. Recalibrate before public display.',
  counts:{total:puzzles.length,facile:20,intermediaire:35,difficile:30,expert:15},
  attempts:attemptReports,
  puzzles
};
const path=process.argv[2]||'scripts/generated/diverse-100-candidates.json';
fs.mkdirSync(new URL('./generated/',import.meta.url),{recursive:true});
fs.writeFileSync(path,JSON.stringify(output,null,2)+'\n');
console.log('Created 100 new unique, explainable puzzle candidates at '+path);
console.log('Difficulty distribution: '+JSON.stringify(output.counts));
