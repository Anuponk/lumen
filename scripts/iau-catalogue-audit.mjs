import {IAU_CONSTELLATIONS} from "../src/campaign/iau-constellations.js";
import {BASE_CONSTELLATIONS} from "../src/campaign/content.js";

// Explicit matching prevents a future reorder of Lumen's catalogue from
// silently treating an already-published constellation as new.
export const LUMEN_IAU_MAPPING=Object.freeze([
 ["Grande Ourse","UMa"],["Cassiopée","Cas"],["Croix du Sud","Cru"],
 ["Lyre","Lyr"],["Cygne","Cyg"],["Lion","Leo"],["Scorpion","Sco"],
 ["Gémeaux","Gem"],["Taureau","Tau"],["Aigle","Aql"],["Andromède","And"],
 ["Orion","Ori"],["Pégase","Peg"],["Persée","Per"],["Dragon","Dra"],
 ["Céphée","Cep"],["Bouvier","Boo"],["Couronne boréale","CrB"],
 ["Sagittaire","Sgr"],["Capricorne","Cap"],["Verseau","Aqr"],
 ["Poissons","Psc"],["Vierge","Vir"],["Grand Chien","CMa"]
].map(([name,abbr])=>Object.freeze({name,abbr})));
const normalize=s=>String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split("·")[0].trim();
export function auditPublishedIauMapping({published=BASE_CONSTELLATIONS,catalogue=IAU_CONSTELLATIONS}={}){
 const errors=[],lookup=new Map(LUMEN_IAU_MAPPING.map(m=>[normalize(m.name),m.abbr]));
 const official=new Set(catalogue.map(c=>c.abbr)),used=new Set();
 for(const c of published){
  const abbr=lookup.get(normalize(c.label));
  if(!abbr)errors.push("Missing IAU mapping: "+c.label);
  else if(!official.has(abbr))errors.push("Unknown IAU abbreviation: "+abbr);
  else if(used.has(abbr))errors.push("Duplicate published IAU constellation: "+abbr);
  else used.add(abbr);
 }
 if(used.size!==LUMEN_IAU_MAPPING.length)errors.push("Published constellation mapping count mismatch");
 return {ok:errors.length===0,errors,publishedAbbreviations:[...used]};
}
export function unpublishedIauConstellations({catalogue=IAU_CONSTELLATIONS,existing=BASE_CONSTELLATIONS}={}){
 const audit=auditPublishedIauMapping({published:existing,catalogue});
 if(!audit.ok)throw Error("Published IAU mapping invalid: "+audit.errors.join("; "));
 const used=new Set(audit.publishedAbbreviations);
 return catalogue.filter(c=>!used.has(c.abbr));
}
export function previewUnusedIauConstellations({count,catalogue=IAU_CONSTELLATIONS,existing=BASE_CONSTELLATIONS}={}){
 if(!Number.isSafeInteger(count)||count<1)throw Error("count must be a positive integer");
 const candidates=unpublishedIauConstellations({catalogue,existing});
 if(candidates.length<count)throw Error("Not enough unused constellations");
 return candidates.slice(0,count).map(c=>({
  id:c.id,name:c.latin,abbr:c.abbr,
  astronomyVerified:c.astronomyVerified===true,
  readyForPublication:c.astronomyVerified===true&&!!c.silhouette,
  silhouette:c.silhouette
 }));
}
