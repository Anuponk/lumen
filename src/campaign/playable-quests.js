// Bridge from the append-only generated quest manifest to the grid engine.
// The existing 196 puzzles remain sourced from the historical catalogue.
import {STAGED_ADVENTURE} from "./staged-adventure.js";
import diverse from "../../content/generated/diverse-adventures-3-4.json" with {type:"json"};
const diverseById=new Map(diverse.puzzles.map(q=>[q.id,q]));
import {CAMPAIGN_SIZE_SCHEDULE,CAMPAIGN6_ORDER} from "./data.js";
import {CONTENT_PACKS,baseCampaignQuestCount} from "./content.js";
import {CAT} from "./catalogue.js";

const legacyCount=baseCampaignQuestCount();
const newQuests=STAGED_ADVENTURE.quests;
const byIndex=new Map(newQuests.map(q=>[q.legacyIndex,q]));
const byId=new Map(newQuests.map(q=>[q.id,q]));
if(newQuests.length!==CONTENT_PACKS.filter(p=>p.questIndices?.[0]>=legacyCount).reduce((n,p)=>n+p.questCount,0)||newQuests[0]?.legacyIndex!==legacyCount||newQuests.some((q,i)=>q.legacyIndex!==legacyCount+i)||byIndex.size!==newQuests.length||byId.size!==newQuests.length)throw new Error("Invalid append-only generated quest manifest");

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
 if(!quest)return null;
 const override=diverseById.get(quest.id);
 if(override&&(override.ordinal!==i+1||override.originalSource!=="generated")){
  // The canonical ordinal differs from the legacy index: check its stable identity instead.
  if(override.originalSource!=="generated"||override.packId!=="real-adventure-04")throw Error("Invalid generated diversity override "+quest.id);
 }
 const grid=override||quest;
 return {id:quest.id,index:i,size:grid.size??grid.reg.length,reg:grid.reg,sol:grid.sol,audit:grid.audit,difficulty:grid.difficulty??null,source:"generated"};
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
