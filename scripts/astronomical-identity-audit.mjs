import {CONTENT_CONSTELLATIONS,CONTENT_PACKS} from "../src/campaign/content.js";
import {canonicalQuestList} from "../src/campaign/canonical-quests.js";

// Explicit reference identities; never infer IAU IDs from translated display names.
export const IAU_BY_LEGACY_INDEX=Object.freeze([
 "UMa","Cas","Cru","Lyr","Cyg","Leo","Sco","Gem","Tau","Aql",
 "And","Ori","Peg","Per","Dra","Cep","Boo","CrB","Sgr","Cap",
 "Aqr","Psc","Vir","CMa"
]);
const IAU_GENERATED=Object.freeze({ant:"Ant",aps:"Aps",ara:"Ara",ari:"Ari",aur:"Aur",cae:"Cae",cam:"Cam",cnc:"Cnc",cvn:"CVn",cmi:"CMi"});
export function astronomicalIdentityAudit({constellations=CONTENT_CONSTELLATIONS,packs=CONTENT_PACKS,quests=canonicalQuestList()}={}){
 const mapped=constellations.map(c=>{
  const iau=c.id.startsWith("iau-")?IAU_GENERATED[c.id.slice(4)]??null:IAU_BY_LEGACY_INDEX[c.legacyIndex]||null;
  return {id:c.id,label:c.label,iau,packId:c.packId,questCount:quests.filter(q=>q.constellationId===c.id).length};
 });
 const knownIds=new Set(mapped.map(c=>c.id));
 const unregistered=[...new Set(quests.filter(q=>!knownIds.has(q.constellationId)).map(q=>q.constellationId))];
 const unknown=mapped.filter(c=>!c.iau);
 const repeated=mapped.filter((c,i)=>mapped.findIndex(other=>other.iau===c.iau)!==i);
 return {adventures:packs.length,quests:quests.length,registeredConstellations:mapped.length,
  canonicalConstellations:new Set(quests.map(q=>q.constellationId)).size,
  mapped,unregistered,unknown,repeated};
}
