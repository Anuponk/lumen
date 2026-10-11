// Generic projection for sky figures. No puzzle IDs, reward indexes or saves are touched.
// Coordinates are ICRS/J2000 right ascension and declination in degrees.
// The caller owns reference catalogue selection, license and star-ID mapping.
const rad=Math.PI/180;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=v=>{const m=Math.hypot(...v);if(m<1e-12)throw Error("Degenerate sky figure");return v.map(x=>x/m)};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vector=(ra,dec)=>{const a=ra*rad,d=dec*rad;return [Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)]};
export function projectAstronomicalFigure({stars,lines=[],width=290,height=115,padding=12}){
 if(!Array.isArray(stars)||stars.length===0||!Array.isArray(lines))throw Error("Invalid sky figure");
 if(!(width>padding*2&&height>padding*2))throw Error("Invalid projection bounds");
 const vectors=stars.map(star=>{
  if(!Number.isFinite(star.raDeg)||!Number.isFinite(star.decDeg)||Math.abs(star.decDeg)>90)throw Error("Invalid star coordinates");
  return vector(star.raDeg,star.decDeg);
 });
 const ids=new Map(stars.map((star,i)=>[String(star.id),i]));
 if(ids.size!==stars.length||stars.some(star=>star.id===null||star.id===undefined))throw Error("Duplicate or missing star IDs");
 const centre=norm(vectors.reduce((sum,v)=>sum.map((x,i)=>x+v[i]),[0,0,0]));
 // East and north are local directions on the tangent plane. Use an alternate
 // axis at the poles, where celestial north becomes degenerate.
 const axis=Math.abs(centre[2])>0.99?[0,1,0]:[0,0,1];
 const east=norm(cross(axis,centre)),north=norm(cross(centre,east));
 const flat=vectors.map(v=>[dot(v,east),-dot(v,north)]);
 const xs=flat.map(p=>p[0]),ys=flat.map(p=>p[1]);
 const loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys);
 const dx=Math.max(hiX-loX,1e-12),dy=Math.max(hiY-loY,1e-12);
 const scale=Math.min((width-2*padding)/dx,(height-2*padding)/dy);
 const left=(width-dx*scale)/2,top=(height-dy*scale)/2;
 const pts=flat.map(([x,y])=>[Number((left+(x-loX)*scale).toFixed(3)),Number((top+(y-loY)*scale).toFixed(3))]);
 const edges=[];
 for(const line of lines){
  if(!Array.isArray(line)||line.length<2)throw Error("Invalid line");
  for(let j=1;j<line.length;j++){
   const a=ids.get(String(line[j-1])),b=ids.get(String(line[j]));
   if(a===undefined||b===undefined)throw Error("Line references missing star");
   if(a!==b)edges.push([a,b]);
  }
 }
 return {count:stars.length,pts,edges};
}
