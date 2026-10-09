// Astronomical registry foundation. Existing silhouettes are preserved as-is.
// These drawings are legacy game artwork, NOT verified IAU star positions.
import {CONSTELLATIONS} from "./data.js";
import {BASE_CONSTELLATION_IDS} from "./content.js";
const normalizeName=name=>String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("fr").split("·")[0].trim();
export const LEGACY_CONSTELLATION_REGISTRY=Object.freeze(CONSTELLATIONS.map((c,i)=>Object.freeze({
 id:BASE_CONSTELLATION_IDS[i],nameFr:c.name.split("·")[0].trim(),
 aliases:Object.freeze(c.name.split("·").map(x=>x.trim())),
 silhouette:Object.freeze({points:c.pts,edges:c.edges,coordinateSystem:"legacy-280x120"}),
 provenance:"legacy-lumen-artwork",astronomyVerified:false,
 legacyIndex:i
})));
export function validateConstellationRegistry(entries=LEGACY_CONSTELLATION_REGISTRY){
 const errors=[],ids=new Set(),names=new Set();
 for(const c of entries){
  if(!c?.id||ids.has(c.id))errors.push("Duplicate/missing constellation ID: "+c?.id);
  ids.add(c.id);
  const name=normalizeName(c.nameFr);
  if(!name||names.has(name))errors.push("Duplicate/missing constellation name: "+c?.nameFr);
  names.add(name);
  const points=c.silhouette?.points,edges=c.silhouette?.edges;
  if(!Array.isArray(points)||points.length===0||!points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))errors.push("Invalid star points: "+c.id);
  if(!Array.isArray(edges)||!edges.every(e=>Array.isArray(e)&&e.length===2&&e.every(n=>Number.isInteger(n)&&n>=0&&n<(points?.length??0))))errors.push("Invalid segments: "+c.id);
 }
 return {ok:errors.length===0,errors,count:entries.length,verified:entries.filter(x=>x.astronomyVerified).length};
}
export function availableConstellations({registry=LEGACY_CONSTELLATION_REGISTRY,usedIds=[],usedNames=[]}={}){
 const usedIdSet=new Set(usedIds),usedNameSet=new Set(usedNames.map(normalizeName));
 return registry.filter(c=>!usedIdSet.has(c.id)&&![c.nameFr,...(c.aliases||[])].some(n=>usedNameSet.has(normalizeName(n))));
}
