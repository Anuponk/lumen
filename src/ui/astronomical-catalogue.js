// Display-only astronomical reference for Mon ciel.
// Never overwrite canonical star order: cloud saved star indices are immutable.
import atlas from "../data/astronomy/stellarium-western-figures.json" with {type:"json"};
import {CONTENT_CONSTELLATIONS} from "../campaign/content.js";

const LEGACY_IAU=Object.freeze([
 "UMa","Cas","Cru","Lyr","Cyg","Leo","Sco","Gem","Tau","Aql",
 "And","Ori","Peg","Per","Dra","Cep","Boo","CrB","Sgr","Cap",
 "Aqr","Psc","Vir","CMa"
]);
const GENERATED_IAU=Object.freeze({ant:"Ant",aps:"Aps",ara:"Ara",ari:"Ari",aur:"Aur",cae:"Cae",cam:"Cam",cnc:"Cnc",cvn:"CVn",cmi:"CMi"});
const RESERVED_IAU=Object.freeze({
 "real-adventure-03-new-01":"Del","real-adventure-03-new-02":"Equ",
 "real-adventure-03-new-03":"Her","real-adventure-03-new-04":"Lep",
 "real-adventure-03-new-05":"Mon","real-adventure-03-new-06":"Oph"
});
const byId=new Map(CONTENT_CONSTELLATIONS.map(c=>[c.id,c]));
// Preserve the pinned source spelling and geometry; expose the official IAU code.
const sourceCode=iau=>iau==='TrA'?'Tra':iau;
export function iauForConstellation(entry){
 if(!entry?.id)return null;
 if(RESERVED_IAU[entry.id])return RESERVED_IAU[entry.id];
 const registered=byId.get(entry.id)||entry;
 if(registered.iau&&atlas.figures[sourceCode(registered.iau)])return registered.iau;
 if(registered.id?.startsWith("iau-"))return GENERATED_IAU[registered.id.slice(4)]||null;
 return LEGACY_IAU[registered.legacyIndex]||null;
}
export function verifiedAstronomicalFigure(entry){
 const iau=iauForConstellation(entry);
 const source=sourceCode(iau),figure=iau&&atlas.figures[source];
 if(!figure||figure.iau!==source||!Array.isArray(figure.pts)||!Array.isArray(figure.edges)
  ||figure.pts.length!==figure.count||figure.count===0)return null;
 return iau===source?figure:Object.freeze({...figure,iau,sourceIau:source});
}
// A visual reference, not a conversion of historical star progress. Lumen's
// lit count is displayed independently until explicit legacyIndex->HIP review.
export function astronomyVisualMetadata(){return {source:"Stellarium Western",license:"CC BY-SA",coverage:atlas.summary};}
