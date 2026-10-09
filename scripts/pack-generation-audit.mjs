import {createGameEngine} from "../src/game/engine.js";
import {countSolutions,generateUniqueGrid} from "./pack-grid-generator.mjs";

export function auditGeneratedPuzzle(puzzle,{maxSteps=250}={}){
 const n=puzzle.reg.length;
 const uniqueness=countSolutions(puzzle.reg);
 if(uniqueness.count!==1)return {ok:false,reason:"not-unique",solutions:uniqueness.count};
 const board={n,puz:puzzle,state:Array.from({length:n},()=>Array(n).fill(0))};
 const engine=createGameEngine(()=>board,()=>true);
 const rules={single:0,locked:0,group:0,diamond:0,manual:0};
 let steps=0;
 for(;steps<maxSteps;steps++){
  if(board.state.flat().filter(v=>v===2).length===n)break;
  const hint=engine.proofEngine(),rule=hint.detail?.rule;
  if(hint.kind==="place"&&rule==="single"&&board.state[hint.cell[0]][hint.cell[1]]===0)
   board.state[hint.cell[0]][hint.cell[1]]=2;
  else if(hint.kind==="elim"&&["locked","group","diamond","manual"].includes(rule)&&board.state[hint.cell[0]][hint.cell[1]]===0)
   board.state[hint.cell[0]][hint.cell[1]]=1;
  else return {ok:false,reason:"not-explainable",steps,hint:hint.kind,rule};
  rules[rule]++;
 }
 if(steps>=maxSteps)return {ok:false,reason:"proof-limit",steps};
 const work=Math.max(0,steps-n);
 const score=Math.round((n-5)*5+work*0.5+rules.group*1.4+rules.locked*0.7);
 const tier=score<30?"beginner":score<45?"easy":score<60?"intermediate":score<80?"hard":"expert";
 return {ok:true,steps,rules,score,tier,solutions:1};
}
export function generateAuditedPack({sizes,questCount,seed,maxCandidatesPerQuest=40,targetTiers=null}){
 if(targetTiers!==null&&(!Array.isArray(targetTiers)||targetTiers.length!==questCount))throw Error("Invalid target tier schedule");
 const generated=[],signatures=new Set(),rejections={};
 for(let index=0;index<questCount;index++){
  let accepted=null;
  for(let candidate=0;candidate<maxCandidatesPerQuest;candidate++){
   const size=sizes[index%sizes.length];
   const candidateSeed=seed+index*maxCandidatesPerQuest+candidate;
   if(!Number.isSafeInteger(candidateSeed))throw Error("Seed overflow");
   let puzzle;
   try{puzzle=generateUniqueGrid({size,seed:candidateSeed,maxAttempts:1000})}
   catch(error){rejections.generation=(rejections.generation||0)+1;continue}
   const signature=puzzle.reg.map(row=>row.join(",")).join(";");
   if(signatures.has(signature)){rejections.duplicate=(rejections.duplicate||0)+1;continue}
   const audit=auditGeneratedPuzzle(puzzle);
   if(!audit.ok){rejections[audit.reason]=(rejections[audit.reason]||0)+1;continue}
   if(targetTiers&&audit.tier!==targetTiers[index]){rejections.targetTier=(rejections.targetTier||0)+1;continue}
   signatures.add(signature);
   accepted={size,seed:candidateSeed,reg:puzzle.reg,sol:puzzle.sol,audit};
   break;
  }
  if(!accepted)throw Error("Unable to generate a unique puzzle for target "+(targetTiers?.[index]??"any")+" at index "+index+"; no catalogue modified. Rejections: "+JSON.stringify(rejections));
  generated.push(accepted);
 }
 return {generated,rejections};
}
