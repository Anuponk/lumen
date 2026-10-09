import {LEGACY_CONSTELLATION_REGISTRY,availableConstellations} from "../src/campaign/astronomy-registry.js";
import {BASE_CONSTELLATIONS} from "../src/campaign/content.js";

// Only use verified silhouettes for *new* real-sky content.
// Legacy silhouettes remain available for compatibility, never as invented astronomy.
export function proposeConstellations({count,registry=LEGACY_CONSTELLATION_REGISTRY,published=BASE_CONSTELLATIONS,requireAstronomyVerified=true}={}){
 if(!Number.isSafeInteger(count)||count<1)throw Error("count must be a positive integer");
 const candidates=availableConstellations({registry,usedIds:published.map(c=>c.id),usedNames:published.map(c=>c.label)});
 const eligible=requireAstronomyVerified?candidates.filter(c=>c.astronomyVerified===true):candidates;
 if(eligible.length<count)throw Error("Only "+eligible.length+" eligible unused constellations; requested "+count+". Import verified astronomical silhouettes first.");
 return eligible.slice(0,count).map(c=>({id:c.id,name:c.nameFr,silhouette:c.silhouette,provenance:c.provenance}));
}
export function validatePackConstellations(constellations,{registry=LEGACY_CONSTELLATION_REGISTRY,published=BASE_CONSTELLATIONS,requireAstronomyVerified=true}={}){
 const errors=[],used=new Set(),publishedIds=new Set(published.map(c=>c.id));
 const registryById=new Map(registry.map(c=>[c.id,c]));
 for(const [i,c] of (constellations||[]).entries()){
  const entry=registryById.get(c.id);
  if(!entry)errors.push("Unknown constellation: "+c.id);
  if(publishedIds.has(c.id))errors.push("Already published: "+c.id);
  if(used.has(c.id))errors.push("Duplicate constellation: "+c.id);
  if(entry&&c.name!==entry.nameFr)errors.push("Name mismatch: "+c.id);
  if(entry&&requireAstronomyVerified&&!entry.astronomyVerified)errors.push("Astronomy not verified: "+c.id);
  used.add(c.id);
 }
 return {ok:errors.length===0,errors};
}
