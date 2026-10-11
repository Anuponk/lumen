// Versioned, lossless VIEW of an existing profile. No write to Supabase and
// no renumbering of historic numeric keys. Rollback = remove this derived view.
import {canonicalQuestById,canonicalQuestForLegacy,canonicalQuestList} from "../campaign/canonical-quests.js";
const FIELDS=["solved","badges","performances","stars"];
function orderedEntries(data){
 if(data==null)return [];
 if(typeof data!=="object"||Array.isArray(data))throw Error("Invalid legacy progress field");
 return Object.entries(data);
}
export function projectCanonicalProfile(profile){
 if(!profile||typeof profile!=="object"||Array.isArray(profile))throw Error("Invalid saved profile");
 const original=structuredClone(profile),byQuestId={};
 for(const field of FIELDS){
  for(const [legacyKey,value] of orderedEntries(profile[field])){
   const index=Number(legacyKey);
   if(!Number.isSafeInteger(index)||String(index)!==legacyKey||index<0)throw Error("Invalid legacy quest key: "+field+"/"+legacyKey);
   const quest=canonicalQuestForLegacy(index);
   if(!quest)throw Error("Unknown historic quest: "+field+"/"+legacyKey);
   (byQuestId[quest.id]??={})[field]=structuredClone(value);
  }
 }
 const completed=new Set(Object.entries(profile.solved||{}).filter(([,value])=>!!value).map(([index])=>canonicalQuestForLegacy(Number(index)).id));
 const ordered=canonicalQuestList();
 const firstUnsolved=ordered.find(q=>!completed.has(q.id))??null;
 return {schemaVersion:2,storageFormat:"legacy-numeric-v1",source:original,
  questStateById:byQuestId,
  completedStableIds:[...completed],
  nextOrdinal:firstUnsolved?.ordinal??null,
  nextStableId:firstUnsolved?.id??null};
}
export function restoreLegacyFromProjection(view){
 if(view?.schemaVersion!==2||view.storageFormat!=="legacy-numeric-v1")throw Error("Unsupported migration view");
 const profile=structuredClone(view.source);
 // The original profile is authoritative for rollback; a derived view cannot
 // replace rewards, entitlements, streaks, unknown fields or currency.
 for(const field of FIELDS){
  for(const [id,value] of Object.entries(view.questStateById||{})){
   if(!Object.hasOwn(value,field))continue;
   if(!canonicalQuestById(id))throw Error("Unknown stable quest in migration view");
  }
 }
 return profile;
}
