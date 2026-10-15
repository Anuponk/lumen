// Canonical campaign view for #222. Stable quest IDs are authoritative here;
// the legacy numeric index remains the key in existing cloud saves.
import staged from "../../content/generated/issue-222-additions.json" with {type:"json"};
import diverse from "../../content/generated/diverse-adventures-3-4.json" with {type:"json"};
const diverseById=new Map(diverse.puzzles.map(q=>[q.id,q]));
if(diverse.schema!=="lumen-grid-overrides-v1"||diverseById.size!==100)throw Error("Invalid diversity override manifest");
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS,hasPackAccess} from "./content.js";
import {playableQuest,playableQuestCount} from "./playable-quests.js";
import {qualifyDifficulty} from "./difficulty.js";

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
  // The historical 11th quest of real-12 moves to real-13 without changing its save key.
  // Its former generated counterpart keeps its stable ID when moved to real-12.
  if(pack.id==="real-adventure-02"){
   const from=list.find(c=>c.id==="real-12"),to=list.find(c=>c.id==="real-13");
   if(from?.indices.length===11&&to?.indices.length===8)to.indices.push(from.indices.pop());
  }
  const sizes=list.map(()=>10);
  if(list.some(c=>c.indices.length>10))throw Error("Constellation exceeds ten historical quests");
  for(const [i,c] of list.entries())for(let j=0;j<sizes[i];j++){
   const legacyIndex=c.indices[j]??null;
   const id=legacyIndex===null?(c.id==="real-13"&&j===9?"planned-real-13-q09":c.id==="real-20"&&j===9?"planned-real-13-q10":`planned-${c.id}-q${String(j+1).padStart(2,"0")}`):playableQuest(legacyIndex)?.id;
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
 const replacement=diverseById.get(slot.id);
 if(replacement&&(replacement.packId!==slot.packId||replacement.ordinal!==slot.ordinal||!["real-adventure-03","real-adventure-04"].includes(slot.packId)))throw Error("Invalid diversity override target "+slot.id);
 const grid=replacement||original;
 return Object.freeze({...slot,size:grid.size??grid.reg.length,reg:grid.reg,sol:grid.sol,audit:grid.audit??null,difficulty:qualifyDifficulty(grid),family:grid.family??null});
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

// A player who already finished a constellation's original quests may catch up
// on newly inserted quests there without being held behind additions elsewhere.
// Never grant a completion: each inserted quest still requires earlier quests
// within its own constellation, including earlier inserted ones.
export function canonicalConstellationCatchupAvailable(quest,progress={},quests=all){
 if(!quest||quest.legacyIndex!==null)return false;
 const group=quests.filter(q=>q.constellationId===quest.constellationId&&q.packId===quest.packId);
 const historical=group.filter(q=>q.legacyIndex!==null);
 if(!historical.length||!historical.every(q=>!!progress.solved?.[q.legacyIndex]))return false;
 return group.filter(q=>q.ordinal<quest.ordinal).every(q=>
  q.legacyIndex!==null?!!progress.solved?.[q.legacyIndex]:!!progress.canonicalQuestState?.[q.id]?.solved);
}

// User-facing catalogue numbering is deliberately separate from legacy save keys.
// This view is safe for preview/admin surfaces before a gameplay cutover.
export function canonicalDisplayForLegacy(index){
 const quest=canonicalQuestForLegacy(index);
 return quest?Object.freeze({number:quest.ordinal,total:all.length,id:quest.id,
  constellationId:quest.constellationId,adventureId:quest.packId,legacyNumber:quest.legacyIndex+1}):null;
}
export function canonicalAdventureSummary(progress={}){
 const solved=progress.solved||{},newState=progress.canonicalQuestState||{};
 return CONTENT_PACKS.map(pack=>{
  const quests=all.filter(q=>q.packId===pack.id);
  const completed=quests.filter(q=>q.legacyIndex!==null?!!solved[q.legacyIndex]:!!newState[q.id]?.solved).length;
  return Object.freeze({id:pack.id,title:pack.displayName,firstQuest:quests[0]?.ordinal??null,
   lastQuest:quests.at(-1)?.ordinal??null,quests:quests.length,completed,
   constellations:new Set(quests.map(q=>q.constellationId)).size});
 });
}

/** Visible campaign progress: count distinct completed canonical quests only in accessible adventures. */
export function unlockedAdventureProgress(progress={},entitlements=[],attempt=null,packs=CONTENT_PACKS,quests=all){
 const unlocked=new Set(packs.filter(pack=>hasPackAccess(pack,entitlements,progress,attempt)).map(pack=>pack.id));
 const solved=progress.solved||{},canonical=progress.canonicalQuestState||{};
 const accessible=quests.filter(quest=>unlocked.has(quest.packId));
 return Object.freeze({completed:accessible.filter(quest=>quest.legacyIndex!==null?!!solved[quest.legacyIndex]:!!canonical[quest.id]?.solved).length,total:accessible.length});
}
