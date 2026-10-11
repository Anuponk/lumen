// Canonical campaign view for #222. Stable quest IDs are authoritative here;
// the legacy numeric index remains the key in existing cloud saves.
import staged from "../../content/generated/issue-222-additions.json" with {type:"json"};
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from "./content.js";
import {playableQuest,playableQuestCount} from "./playable-quests.js";

function planSlots(packs,constellations){
 const records=[],ordered=[...packs].sort((a,b)=>a.order-b.order);
 for(const pack of ordered){
  const list=pack.constellationIds.map(id=>{
   const constellation=constellations.find(c=>c.id===id);
   if(!constellation)throw Error("Unknown constellation: "+id);
   return {id,indices:[...constellation.questIndices]};
  });
  while(list.length<10)list.push({id:pack.id+"-new-"+String(list.length-pack.constellationIds.length+1).padStart(2,"0"),indices:[]});
  if(list.length!==10)throw Error("Adventure constellation count differs from 10: "+pack.id);
  const sizes=list.map(x=>x.indices.length);
  let remaining=100-sizes.reduce((a,b)=>a+b,0);
  if(remaining<0)throw Error("Adventure over capacity: "+pack.id);
  while(remaining-->0){
   let smallest=0;
   for(let i=1;i<sizes.length;i++)if(sizes[i]<sizes[smallest])smallest=i;
   sizes[smallest]++;
  }
  for(const [i,c] of list.entries())for(let j=0;j<sizes[i];j++){
   const legacyIndex=c.indices[j]??null;
   const id=legacyIndex===null?`planned-${c.id}-q${String(j+1).padStart(2,"0")}`:playableQuest(legacyIndex)?.id;
   if(!id)throw Error("Missing legacy quest index "+legacyIndex);
   records.push({id,ordinal:records.length+1,legacyIndex,packId:pack.id,constellationId:c.id,position:j+1});
  }
 }
 return records;
}
const slots=planSlots(CONTENT_PACKS,CONTENT_CONSTELLATIONS);
const added=new Map(staged.quests.map(q=>[q.id,q]));
if(staged.status!=="staged-only"||added.size!==staged.quests.length)throw Error("Invalid staged content");
const all=Object.freeze(slots.map(slot=>{
 const original=slot.legacyIndex===null?added.get(slot.id):playableQuest(slot.legacyIndex);
 if(!original||original.id!==slot.id)throw Error("Missing canonical grid "+slot.id);
 if(slot.legacyIndex===null&&(!original.audit?.ok||original.audit.solutions!==1))throw Error("Unaudited grid "+slot.id);
 return Object.freeze({...slot,size:original.size??original.reg.length,reg:original.reg,sol:original.sol,audit:original.audit??null});
}));
if(all.length!==CONTENT_PACKS.length*100||new Set(all.map(q=>q.id)).size!==all.length||all.filter(q=>q.legacyIndex!==null).length!==playableQuestCount())throw Error("Inconsistent canonical catalogue");
const byId=new Map(all.map(q=>[q.id,q]));
const byLegacy=new Map(all.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,q]));
export function canonicalQuestCount(){return all.length}
export function canonicalQuestByOrdinal(number){return all[number-1]??null}
export function canonicalQuestById(id){return byId.get(String(id))??null}
export function canonicalQuestForLegacy(index){return byLegacy.get(Number(index))??null}
export function canonicalQuestList(){return [...all]}
export function canonicalNextUnsolved(solvedLegacy={},solvedIds={}){
 return all.find(q=>!(q.legacyIndex!==null?solvedLegacy[q.legacyIndex]:solvedIds[q.id]))??null;
}
