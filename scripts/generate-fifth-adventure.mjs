// Staging-only Adventure 5 generator. Never mutates the published catalogue.
import fs from 'node:fs';
import {selectCandidates,signature,countSolutions,connected,replay} from './generate-diverse-grids.mjs';
const config=JSON.parse(fs.readFileSync('content/fifth-adventure-preview.json','utf8'));
const expected=config.constellations.length*config.questsPerConstellation;
if(config.constellations.length!==10||expected!==100||config.sizes.length!==2)throw Error('Unexpected Adventure 5 configuration');
const all=[],seen=new Set();
for(const [i,size] of config.sizes.entries()){
  const count=expected/config.sizes.length;
  const selected=[];
  for(const [j,family] of ['hybrid','serpentine','balanced','mosaic','classic'].entries()){
    if(selected.length>=count)break;
    const result=selectCandidates({size,family,count,seed:config.seed+i*100+j,attempts:60000});
    for(const puzzle of result.selected){
      const key=signature(puzzle.reg);
      if(seen.has(key))continue;
      if(!connected(puzzle.reg)||countSolutions(puzzle)!==1||!replay(puzzle))throw Error('Grid audit failed');
      seen.add(key);selected.push(puzzle);
      if(selected.length===count)break;
    }
  }
  if(selected.length!==count)throw Error('Insufficient unique proof-audited grids at '+size+': '+selected.length+'/'+count);
  for(const puzzle of selected){
    const key=signature(puzzle.reg);
    if(!seen.has(key)||!connected(puzzle.reg)||countSolutions(puzzle)!==1||!replay(puzzle))throw Error('Grid audit failed');
    all.push(puzzle);
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
const manifest={status:'staging-proof-audited',seed:config.seed,questCount:quests.length,validation:{uniqueSolution:true,distinctDihedralSignatures:true,proofEngine:'validated',existingCatalogueCollision:'validated',astronomical:'not-yet-validated'},quests};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/adventure-05-candidates.json',JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync('content/generated/fifth-adventure-candidates.json',JSON.stringify(manifest,null,2)+'\n');
console.log('Generated and proof-audited '+quests.length+' staging-only grids. NOT published.');
