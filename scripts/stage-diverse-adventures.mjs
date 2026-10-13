// #340: build replacement overlay from candidate pack, preserving historical quest assignments.
// Run after build-diverse-100.mjs. No destructive write to legacy CAT or saved progress.
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';
import {createGameEngine} from '../src/game/engine.js';
import {signature,countSolutions,connected,replay} from './generate-diverse-grids.mjs';

const pack=JSON.parse(fs.readFileSync(process.argv[2]||'scripts/generated/diverse-100-candidates.json','utf8'));
if(pack.puzzles?.length!==100)throw Error('Expected exactly 100 generated candidates');
const quests=canonicalQuestList();
const targets=quests.filter(q=>['real-adventure-03','real-adventure-04'].includes(q.packId));
if(targets.length!==200)throw Error('Expected 200 slots in Adventures 3 and 4');
const safe=targets.filter(q=>q.legacyIndex===null||q.legacyIndex>=196);
if(safe.length<100)throw Error('Insufficient non-historical slots: '+safe.length);
function existingDifficulty(q){
  const p={reg:q.reg,sol:q.sol};
  if(!connected(p.reg)||countSolutions(p)!==1)return Infinity;
  const proof=replay(p);
  return proof?.proofSteps??Infinity;
}
// Replace the easiest *eligible generated-content* slots only. Historical quests are immutable.
const ranked=[...safe].sort((a,b)=>existingDifficulty(a)-existingDifficulty(b)||a.ordinal-b.ordinal);
const selected=ranked.slice(0,100).sort((a,b)=>a.ordinal-b.ordinal);
const incoming=[...pack.puzzles].sort((a,b)=>a.difficulty.score-b.difficulty.score||a.candidateId.localeCompare(b.candidateId));
const overrides=selected.map((quest,i)=>{
 const candidate=incoming[i],p={reg:candidate.reg,sol:candidate.sol};
 if(!connected(p.reg)||countSolutions(p)!==1||!replay(p))throw Error('Invalid candidate: '+candidate.candidateId);
 return {id:quest.id,ordinal:quest.ordinal,packId:quest.packId,originalSource:quest.legacyIndex===null?'staged':'generated',candidateId:candidate.candidateId,
   size:p.reg.length,reg:p.reg,sol:p.sol,difficulty:candidate.difficulty,family:candidate.family,
   audit:{ok:true,solutions:1,proofSteps:candidate.audit.proofSteps,rules:candidate.audit.rules}};
});
if(new Set(overrides.map(p=>p.id)).size!==100||new Set(overrides.map(p=>signature(p.reg))).size!==100||overrides.some(o=>o.packId!=='real-adventure-03'&&o.packId!=='real-adventure-04'))throw Error('Invalid replacement map');
const totals=Object.fromEntries(['real-adventure-03','real-adventure-04'].map(id=>[id,overrides.filter(o=>o.packId===id).length]));
const output={schema:'lumen-grid-overrides-v1',status:'review-required',totals,puzzles:overrides};
const outputPath=process.argv[3]||'content/generated/diverse-adventures-3-4.json';
fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log('Staged',overrides.length,'replacement grids',JSON.stringify(totals),outputPath);
