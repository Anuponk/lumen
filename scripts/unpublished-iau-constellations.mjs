import {IAU_CONSTELLATIONS} from "../src/campaign/iau-constellations.js";
import {BASE_CONSTELLATIONS} from "../src/campaign/content.js";

// Explicit French-to-IAU mapping for the 24 published Lumen constellations.
// Never guess identity from a substring or reuse a published constellation.
export const PUBLISHED_IAU_ABBREVIATIONS=Object.freeze([
 "UMa","Cas","Cru","Lyr","Cyg","Leo","Sco","Gem","Tau","Aql","And","Ori",
 "Peg","Per","Dra","Cep","Boo","CrB","Sgr","Cap","Aqr","Psc","Vir","CMa"
]);
export function unpublishedIauConstellations({catalogue=IAU_CONSTELLATIONS,existing=BASE_CONSTELLATIONS}={}){
 if(existing.length!==PUBLISHED_IAU_ABBREVIATIONS.length)throw Error("Published constellation mapping needs review: catalogue length changed");
 const used=new Set(PUBLISHED_IAU_ABBREVIATIONS);
 return catalogue.filter(c=>!used.has(c.abbr));
}
