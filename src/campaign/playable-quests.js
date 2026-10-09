// Bridge from the append-only generated quest manifest to the grid engine.
// The existing 196 puzzles remain sourced from the historical catalogue.
import {STAGED_ADVENTURE} from "./staged-adventure.js";
import {CAMPAIGN_SIZE_SCHEDULE,CAMPAIGN6_ORDER} from "./data.js";
import {CAT} from "./catalogue.js";

const legacyCount=Object.keys(CAMPAIGN_SIZE_SCHEDULE).length;
const newQuests=STAGED_ADVENTURE.quests;
const byIndex=new Map(newQuests.map(q=>[q.legacyIndex,q]));
const byId=new Map(newQuests.map(q=>[q.id,q]));
if(newQuests.length!==100||newQuests[0].legacyIndex!==legacyCount||byIndex.size!==newQuests.length||byId.size!==newQuests.length)throw new Error("Invalid append-only generated quest manifest");

export function playableQuestCount(){return legacyCount+newQuests.length}
export function playableQuest(index){
 const i=Number(index);
 if(!Number.isInteger(i)||i<0||i>=playableQuestCount())return null;
 if(i<legacyCount){
  const entry=CAMPAIGN_SIZE_SCHEDULE[i];
  if(!entry)return null;
  const [size,catalogueIndex]=entry;
  const grid=CAT[size]?.[size==="6"?CAMPAIGN6_ORDER[catalogueIndex]:catalogueIndex];
  return grid?{id:`base-q${String(i+1).padStart(3,"0")}`,index:i,size:Number(size),reg:grid.reg,sol:grid.sol,source:"legacy"}:null;
 }
 const quest=byIndex.get(i);
 return quest?{id:quest.id,index:i,size:quest.size,reg:quest.reg,sol:quest.sol,audit:quest.audit,source:"generated"}:null;
}
export function playableQuestById(id){
 const generated=byId.get(String(id));
 if(generated)return playableQuest(generated.legacyIndex);
 const match=/^base-q(\d+)$/.exec(String(id));
 return match?playableQuest(Number(match[1])-1):null;
}
export function generatedQuestForConstellation(id){
 const c=STAGED_ADVENTURE.constellations.find(c=>c.id===id);
 return c?c.questIndices.map(playableQuest):[];
}
