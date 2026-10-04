import fs from "node:fs";
import {createGameEngine} from "../src/game/engine.js";
import {CAT} from "../src/campaign/catalogue.js";
import {CAMPAIGN6_ORDER,CAMPAIGN_SIZE_SCHEDULE} from "../src/campaign/data.js";

function campaignPuzzle(questIndex){
 const [size,slot]=CAMPAIGN_SIZE_SCHEDULE[questIndex];
 const catalogueIndex=size==="6"?CAMPAIGN6_ORDER[slot]:slot;
 return {size:Number(size),catalogueIndex,puzzle:CAT[size][catalogueIndex]};
}
function replayDifficulty(questIndex){
 const {size,catalogueIndex,puzzle}=campaignPuzzle(questIndex);
 let board={n:size,puz:puzzle,state:Array.from({length:size},()=>Array(size).fill(0))};
 const engine=createGameEngine(()=>board,()=>true);
 const rules={single:0,locked:0,group:0,diamond:0,manual:0};
 let steps=0;
 for(;steps<250;steps++){
  if(board.state.flat().filter(v=>v===2).length===size)break;
  const hint=engine.proofEngine(),rule=hint.detail?.rule;
  if(hint.kind==="place"&&rule==="single")board.state[hint.cell[0]][hint.cell[1]]=2;
  else if(hint.kind==="elim"&&["locked","group","diamond","manual"].includes(rule))board.state[hint.cell[0]][hint.cell[1]]=1;
  else throw Error("Quest "+(questIndex+1)+" is not fully explainable at step "+steps+" ("+hint.kind+"/"+rule+")");
  rules[rule]=(rules[rule]||0)+1;
 }
 if(steps>=250)throw Error("Quest "+(questIndex+1)+" exceeded difficulty replay limit");
 const work=Math.max(0,steps-size);
 // Human-oriented deterministic score: logical workload dominates board size.
 const score=Math.round((size-5)*5+work*0.5+rules.group*1.4+rules.locked*0.7);
 return {
  quest:questIndex+1,size,catalogueIndex,steps,rules,
  groupShare:steps?Math.round(rules.group/steps*1000)/10:0,
  complexSteps:rules.group+rules.locked,
  score
 };
}
function tier(score){
 if(score<30)return "beginner";
 if(score<45)return "easy";
 if(score<60)return "intermediate";
 if(score<80)return "hard";
 return "expert";
}
const quests=Array.from({length:Object.keys(CAMPAIGN_SIZE_SCHEDULE).length},(_,i)=>replayDifficulty(i)).map(x=>({...x,tier:tier(x.score)}));
function segment(start,end){
 const xs=quests.slice(start-1,end),scores=xs.map(x=>x.score).sort((a,b)=>a-b);
 const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
 const median=scores[Math.floor(scores.length/2)];
 return {range:start+"-"+end,average:Math.round(avg*10)/10,median,min:scores[0],max:scores.at(-1),expert:xs.filter(x=>x.tier==="expert").length};
}
const segments=[[1,20],[21,40],[41,60],[61,80],[81,100]].map(([a,b])=>segment(a,b));
const last20=quests.slice(80,100);
const peaks=[...quests].sort((a,b)=>b.score-a.score).slice(0,15).map(({quest,size,score,tier,steps,rules})=>({quest,size,score,tier,steps,rules}));
const segmentAverages=segments.map(x=>x.average);
const lateExpert=last20.filter(x=>["expert","expert+"].includes(x.tier)).length;
const lateExpertPlus=last20.filter(x=>x.tier==="expert").length;
const lateBreathers=last20.filter(x=>x.score<55).length;
// The established rising curve and expert+ Orion finale cover quests 1–100.
// Wave 2 appends a new segment; every appended puzzle is still proof-audited above.
const finalQuest=quests[99];
const curveChecks={
 ascendingSegments:segmentAverages.every((value,index)=>index===0||value>segmentAverages[index-1]),
 meaningfulLift:segmentAverages.at(-1)>=segmentAverages[0]+18,
 lateExpertDensity:lateExpert>=7,
 lateExpertPlusPeaks:lateExpertPlus>=4,
 lateBreathers:lateBreathers>=5,
 expertFinale:finalQuest?.tier==="expert"
};
if(Object.values(curveChecks).some(value=>!value))throw Error("Difficulty curve regression: "+JSON.stringify({segments,curveChecks,finalQuest}));
const report={
 version:2,
 metric:{
  formula:"round((size-5)*5 + max(0,steps-size)*0.5 + group*1.4 + locked*0.7)",
  tiers:{beginner:"<30",easy:"30-44",intermediate:"45-59",hard:"60-79",expert:"80+"},
  note:"Fixed score for comparison across current and future content; no player-behaviour data is included."
 },
 segments,
 lateGame:{
  average:Math.round(last20.reduce((a,b)=>a+b.score,0)/last20.length*10)/10,
  experts:lateExpert,
  expertPlus:lateExpertPlus,
  breathers:lateBreathers,
  peakCount:last20.filter(x=>x.score>=90).length
 },
 curveChecks,
 peaks,
 quests
};
const output=process.argv[2];
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({segments,lateGame:report.lateGame,curveChecks,peaks},null,2));
