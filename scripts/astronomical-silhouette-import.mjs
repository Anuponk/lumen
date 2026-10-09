// Source-agnostic astronomy importer. Input coordinates must come from a
// documented, license-reviewed star catalogue, not hand-drawn guesses.
// RA in degrees [0,360), declination in degrees [-90,90].
export function projectConstellationStars(stars,{width=280,height=120,padding=12}={}){
 if(!Array.isArray(stars)||stars.length<2)throw Error("At least two stars required");
 const ids=new Set();
 for(const star of stars){
  if(!star?.id||ids.has(star.id))throw Error("Missing/duplicate star ID");
  ids.add(star.id);
  if(!Number.isFinite(star.raDeg)||star.raDeg<0||star.raDeg>=360||!Number.isFinite(star.decDeg)||Math.abs(star.decDeg)>90)throw Error("Invalid sky coordinates: "+star.id);
 }
 if(!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(padding)||width<=2*padding||height<=2*padding)throw Error("Invalid canvas");
 // Find the minimal RA arc to avoid tearing constellations across 0/360.
 const sorted=stars.map(s=>s.raDeg).sort((a,b)=>a-b);
 let gap=-1,cut=0;
 for(let i=0;i<sorted.length;i++){
  const next=i===sorted.length-1?sorted[0]+360:sorted[i+1];
  if(next-sorted[i]>gap){gap=next-sorted[i];cut=next%360;}
 }
 const coords=stars.map(s=>({id:s.id,x:(s.raDeg-cut+360)%360,y:s.decDeg}));
 const minX=Math.min(...coords.map(s=>s.x)),maxX=Math.max(...coords.map(s=>s.x));
 const minY=Math.min(...coords.map(s=>s.y)),maxY=Math.max(...coords.map(s=>s.y));
 const dx=maxX-minX,dy=maxY-minY;
 const scale=Math.min((width-2*padding)/(dx||1),(height-2*padding)/(dy||1));
 const ox=(width-dx*scale)/2,oy=(height-dy*scale)/2;
 // Increasing RA points left in a sky chart; declination increases upwards.
 return coords.map(s=>[Number((width-ox-(s.x-minX)*scale).toFixed(2)),Number((height-oy-(s.y-minY)*scale).toFixed(2))]);
}
export function importAstronomicalSilhouette(record){
 if(!record?.iauAbbr||!record?.source?.url||!record?.source?.license||!record?.source?.attribution)throw Error("Astronomical provenance and license are required");
 if(!Array.isArray(record.stars)||!Array.isArray(record.edges))throw Error("Stars and edges required");
 const points=projectConstellationStars(record.stars);
 const index=new Map(record.stars.map((s,i)=>[s.id,i]));
 const edges=record.edges.map(pair=>{
  if(!Array.isArray(pair)||pair.length!==2||pair[0]===pair[1]||!index.has(pair[0])||!index.has(pair[1]))throw Error("Invalid star connection");
  return pair.map(id=>index.get(id));
 });
 if(!edges.length)throw Error("At least one documented star connection required");
 return {iauAbbr:record.iauAbbr,silhouette:{points,edges,coordinateSystem:"legacy-280x120"},provenance:record.source,astronomyVerified:true};
}
