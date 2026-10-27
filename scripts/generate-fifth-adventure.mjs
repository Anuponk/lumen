// Staging-only Adventure 5 generator. Never mutates the published catalogue.
import fs from 'node:fs';
import {selectCandidates,signature,countSolutions,connected,replay} from './generate-diverse-grids.mjs';
const config=JSON.parse(fs.readFileSync('content/fifth-adventure-preview.json','utf8'));
const expected=config.constellations.length*config.questsPerConstellation;
if(config.constellations.length!==10||expected!==100||config.sizes.length!==2)throw Error('Unexpected Adventure 5 configuration');
const all=[],seen=new Set();
for(const [i,size] of config.sizes.entries()){
  const count=expected/config.sizes.length;
  const result=selectCandidates({size,family:'hybrid',count,seed:config.seed+i,attempts:60000});
  if(result.shortfall)throw Error('Insufficient unique grids at '+size+': '+result.shortfall);
  for(const puzzle of result.selected){
    const key=signature(puzzle.reg);
    if(seen.has(key)||!connected(puzzle.reg)||countSolutions(puzzle)!==1||!replay(puzzle))throw Error('Grid audit failed');
    seen.add(key);all.push(puzzle);
  }
}
if(all.length!==expected)throw Error('Unexpected quest count');
const quests=[];
for(let c=0;c<config.constellations.length;c++){
  for(let j=0;j<config.questsPerConstellation;j++){
    const puzzle=all[j*config.constellations.length+c];
    quests.push({id:'pack-'+config.id+'-q'+String(quests.length+1).padStart(3,'0'),constellationId:config.constellations[c].id,size:puzzle.reg.length,reg:puzzle.reg,sol:puzzle.sol,audit:puzzle.audit});
  }
}
const manifest={status:'staging-only',generatedAt:new Date().toISOString(),seed:config.seed,pack:{id:config.id,displayName:config.displayName,access:config.access,questCount:quests.length},constellations:config.constellations,quests};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/adventure-05-candidates.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Generated and proof-audited '+quests.length+' staging-only grids. NOT published.');
