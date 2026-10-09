import {IAU_CONSTELLATIONS} from "../src/campaign/iau-constellations.js";
import {UNPUBLISHED_IAU_SILHOUETTES} from "../src/campaign/iau-unpublished-silhouettes.js";
import {unpublishedIauConstellations} from "./iau-catalogue-audit.mjs";
export function previewImportedConstellations(){
 const unused=unpublishedIauConstellations();
 const missing=[],entries=[];
 for(const c of unused){
  const art=UNPUBLISHED_IAU_SILHOUETTES[c.abbr];
  if(!art){missing.push(c.abbr);continue}
  if(!art.pts?.length||!art.edges?.length||!art.pts.every(p=>p.length===2&&p.every(Number.isFinite))||!art.edges.every(e=>e.length===2&&e.every(i=>Number.isInteger(i)&&i>=0&&i<art.pts.length)))throw Error("Invalid geometry: "+c.abbr);
  entries.push({id:c.id,abbr:c.abbr,name:c.latin,points:art.pts,edges:art.edges,source:"ofrohn/d3-celestial",licenseReviewRequired:true,readyForPublication:false});
 }
 if(missing.length)throw Error("Missing silhouettes: "+missing.join(", "));
 return {count:entries.length,entries,publicationBlocked:"Source license and scientific line convention must be reviewed"};
}
