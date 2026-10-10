// Read-only catalogue of generated adventure content.
// Intentionally NOT wired into gameplay: publication needs a separate migration.
import snapshot from "../../content/generated/first-adventure.json" with {type:"json"};
import {BASE_CONSTELLATIONS,CONTENT_PACKS,baseCampaignQuestCount} from "./content.js";

const manifest=snapshot.manifest;
const questIds=new Set();
const indices=new Set();
const errors=[];
const start=baseCampaignQuestCount();
for(const [offset,quest] of manifest.quests.entries()){
 if(quest.legacyIndex!==start+offset)errors.push("Non-contiguous quest index: "+quest.id);
 if(questIds.has(quest.id))errors.push("Duplicate quest ID: "+quest.id);
 if(indices.has(quest.legacyIndex))errors.push("Duplicate quest index: "+quest.legacyIndex);
 if(quest.audit?.solutions!==1||quest.audit?.ok!==true)errors.push("Quest not audited: "+quest.id);
 questIds.add(quest.id);indices.add(quest.legacyIndex);
}
if(manifest.mode!=="staging-only")errors.push("Manifest must remain staging-only");
if(CONTENT_PACKS.some(p=>p.id===manifest.pack.id&&(p.questCount!==manifest.pack.questCount||p.legacyQuestStart!==manifest.pack.questIndices[0])))errors.push("Pack metadata collision");
if(manifest.constellations.some(c=>BASE_CONSTELLATIONS.some(b=>b.id===c.id)))errors.push("Constellation ID collision");
if(manifest.quests.length!==manifest.pack.questCount||manifest.constellations.length!==manifest.pack.constellationIds.length||manifest.constellations.some(c=>!Array.isArray(c.questIndices)||c.questIndices.length===0)||manifest.constellations.reduce((sum,c)=>sum+c.questIndices.length,0)!==manifest.quests.length)errors.push("Staged adventure size inconsistent with metadata");
if(errors.length)throw new Error("Invalid generated adventure: "+errors.join("; "));

export const STAGED_ADVENTURE=Object.freeze({
 pack:Object.freeze({...manifest.pack}),
 constellations:Object.freeze(manifest.constellations.map(c=>Object.freeze({...c,questIndices:Object.freeze([...c.questIndices])}))),
 quests:Object.freeze(manifest.quests.map(q=>Object.freeze({...q})))
});
export const stagedQuestByIndex=index=>STAGED_ADVENTURE.quests.find(q=>q.legacyIndex===index)||null;
