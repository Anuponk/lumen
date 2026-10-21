import {verifiedAstronomicalFigure} from "./astronomical-catalogue.js";
// Draw source-backed astronomical geometry as a subdued reference, never
// pretending historical earned stars map to HIP ids until certified.
export function astronomicalReferenceSvg(entry){
 const figure=verifiedAstronomicalFigure(entry);
 if(!figure)return "";
 const lines=figure.edges.map(([a,b])=>'<line x1="'+figure.pts[a][0]+'" y1="'+figure.pts[a][1]+'" x2="'+figure.pts[b][0]+'" y2="'+figure.pts[b][1]+'"/>').join("");
 const stars=figure.pts.map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="1.65"/>').join("");
 return '<g class="astronomical-reference" fill="none" stroke="currentColor" stroke-opacity=".36" stroke-width="1.25">'+lines+'</g><g class="astronomical-reference-stars" fill="currentColor" opacity=".42">'+stars+'</g>';
}

// Standalone real-sky rendering for details and reveal: unlike a subdued overlay,
// this is the sole constellation silhouette. Player progress remains numerical;
// no historical index is falsely assigned to a HIP star.
// Deterministic display mapping: each existing earned-star slot illuminates
// one distinct real HIP star, ordered by reference line traversal. This keeps
// cloud progress untouched, and ensures stable results across sessions.
export function astronomicalIllumination(entry,earned,total){
 const figure=verifiedAstronomicalFigure(entry);
 if(!figure)return null;
 const slots=Math.max(0,Math.floor(Number(total)||0));
 const lit=Math.min(slots,Math.max(0,Math.floor(Number(earned)||0)));
 const ordered=[],seen=new Set();
 for(const [a,b] of figure.edges){
  for(const i of [a,b])if(Number.isInteger(i)&&i>=0&&i<figure.pts.length&&!seen.has(i)){seen.add(i);ordered.push(i)}
 }
 for(let i=0;i<figure.pts.length;i++)if(!seen.has(i))ordered.push(i);
 // If historical reward slots outnumber atlas stars, do not generate fake HIP.
 const litIndices=new Set(ordered.slice(0,Math.floor(lit*ordered.length/Math.max(slots,1))));
 return {figure,litIndices,displayCount:lit,slotCount:slots};
}
export function astronomicalPrimarySvg(entry,earned=0,total=0,beforeEarned=null){
 const data=astronomicalIllumination(entry,earned,total);
 if(!data)return "";
 const {figure,litIndices}=data;
 const before=beforeEarned===null?litIndices:astronomicalIllumination(entry,beforeEarned,total).litIndices;
 const arrived=i=>litIndices.has(i)&&!before.has(i);
 const lines=figure.edges.map(([a,b])=>'<line class="sky-line '+(litIndices.has(a)&&litIndices.has(b)?'on'+(arrived(a)||arrived(b)?' new-line':''):'')+'" x1="'+figure.pts[a][0]+'" y1="'+figure.pts[a][1]+'" x2="'+figure.pts[b][0]+'" y2="'+figure.pts[b][1]+'"/>').join("");
 const stars=figure.pts.map(([x,y],i)=>'<circle class="sky-star '+(litIndices.has(i)?'on'+(arrived(i)?' new-star':''):'')+'" cx="'+x+'" cy="'+y+'" r="'+(litIndices.has(i)?4:3)+'"/>').join("");
 return lines+stars+questRewardOrbitSvg(entry,earned,total,beforeEarned);
}

// A decorative reward counter, not astronomical stars or additional HIP data.
// Keep the source figure untouched; every quest has its own visible gold mark.
export function questRewardOrbitSvg(entry,earned,total,beforeEarned=null){
 const data=astronomicalIllumination(entry,earned,total);
 if(!data||!data.slotCount)return '';
 const {figure,slotCount,displayCount}=data;
 const xs=figure.pts.map(p=>p[0]),ys=figure.pts.map(p=>p[1]);
 const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 const rx=(Math.max(...xs)-Math.min(...xs))/2+6,ry=(Math.max(...ys)-Math.min(...ys))/2+6;
 const before=beforeEarned===null?displayCount:Math.max(0,Math.min(slotCount,Math.floor(Number(beforeEarned)||0)));
 const radius=Math.min(2.8,Math.PI*Math.min(rx,ry)/slotCount*.65);
 const marks=Array.from({length:slotCount},(_,i)=>{
  const angle=-Math.PI/2+2*Math.PI*i/slotCount,on=i<displayCount,arrived=on&&i>=before;
  return '<circle class="quest-reward'+(on?' on':'')+(arrived?' new-reward':'')+'" data-reward-index="'+i+'" cx="'+(cx+rx*Math.cos(angle)).toFixed(3)+'" cy="'+(cy+ry*Math.sin(angle)).toFixed(3)+'" r="'+radius.toFixed(3)+'"/>';
 }).join('');
 return '<g class="quest-reward-orbit" aria-label="Étoiles de quêtes : '+displayCount+' sur '+slotCount+'">'+marks+'</g>';
}
