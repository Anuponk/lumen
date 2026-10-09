import {IAU_CONSTELLATIONS} from "../src/campaign/iau-constellations.js";
import {unpublishedIauConstellations} from "./iau-catalogue-audit.mjs";
import {importAstronomicalSilhouette} from "./astronomical-silhouette-import.mjs";

const official=new Map(IAU_CONSTELLATIONS.map(c=>[c.abbr,c]));
const supportedLicenses=new Set(["CC0-1.0","CC-BY-4.0","CC-BY-SA-4.0"]);

// Validate the entire source before it can be considered for the game.
// License allow-list is only a screening step; human attribution/license review
// is still required before publishing imported artwork.
export function prepareAstronomicalBatch(records,{allowPublished=false}={}){
 if(!Array.isArray(records)||!records.length)throw Error("Non-empty astronomical source records required");
 const allowed=new Set(unpublishedIauConstellations().map(c=>c.abbr));
 const seen=new Set(),result=[];
 for(const record of records){
  const abbr=record?.iauAbbr;
  if(!official.has(abbr))throw Error("Unknown IAU constellation: "+abbr);
  if(seen.has(abbr))throw Error("Duplicate IAU constellation: "+abbr);
  if(!allowPublished&&!allowed.has(abbr))throw Error("Already published in Lumen: "+abbr);
  if(!supportedLicenses.has(record?.source?.license))throw Error("Unsupported or missing source license: "+abbr);
  if(!/^https:\/\//.test(record?.source?.url||""))throw Error("HTTPS source URL required: "+abbr);
  seen.add(abbr);
  const imported=importAstronomicalSilhouette(record);
  result.push({
   id:official.get(abbr).id,abbr,nameLatin:official.get(abbr).latin,
   ...imported,
   // Source strings alone are not proof of astronomical correctness.
   sourceReviewRequired:true,readyForPublication:false
  });
 }
 return {schemaVersion:1,mode:"astronomy-review",entries:result,summary:{
  total:result.length,sourceReviewRequired:result.length,publishable:0
 }};
}
