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
