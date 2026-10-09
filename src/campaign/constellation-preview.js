import {LEGACY_CONSTELLATION_REGISTRY} from "./astronomy-registry.js";
import {IAU_CONSTELLATIONS} from "./iau-constellations.js";
import {UNPUBLISHED_IAU_SILHOUETTES} from "./iau-unpublished-silhouettes.js";

// Read-only preview for all 88 constellations. Do not inject this catalogue into
// the published quest/progression arrays until pack publication is implemented.
export const CONSTELLATION_PREVIEW_CATALOGUE=Object.freeze([
 ...LEGACY_CONSTELLATION_REGISTRY.map(c=>Object.freeze({
  id:c.id,name:c.nameFr,source:"legacy-lumen-artwork",
  published:true,points:c.silhouette.points,edges:c.silhouette.edges
 })),
 ...IAU_CONSTELLATIONS.filter(c=>UNPUBLISHED_IAU_SILHOUETTES[c.abbr]).map(c=>{
  const shape=UNPUBLISHED_IAU_SILHOUETTES[c.abbr];
  return Object.freeze({
   id:c.id,name:c.latin,source:"ofrohn/d3-celestial",
   published:false,requiresSourceReview:true,
   points:shape.pts,edges:shape.edges
  });
 })
]);
export function getConstellationPreview(id){
 return CONSTELLATION_PREVIEW_CATALOGUE.find(c=>c.id===id)||null;
}
