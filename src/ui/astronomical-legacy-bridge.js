// Astronomical figure adapter: bridge a fully verified HIP star figure to legacy
// player star slots without changing any stored index or reward.
// No missing star, duplicate mapping, or extra point may be silently inferred.
export function mapAstronomicalFigureToLegacy(legacy,astronomical,hipByLegacyIndex){
 if(!legacy||!astronomical||!Array.isArray(hipByLegacyIndex))throw Error("Astronomical mapping required");
 const count=legacy.count;
 if(!Number.isInteger(count)||count<=0||legacy.pts?.length!==count)throw Error("Invalid legacy star slots");
 if(hipByLegacyIndex.length!==count||!Array.isArray(astronomical.hipIds)||!Array.isArray(astronomical.pts))
  throw Error("Star mapping count mismatch");
 if(astronomical.hipIds.length!==astronomical.pts.length||astronomical.count!==astronomical.pts.length)
  throw Error("Invalid astronomical figure");
 const lookup=new Map(astronomical.hipIds.map((hip,i)=>[String(hip),i]));
 if(lookup.size!==astronomical.hipIds.length)throw Error("Duplicate HIP ID in reference");
 const mapped=hipByLegacyIndex.map(hip=>lookup.get(String(hip)));
 if(mapped.some(i=>i===undefined)||new Set(mapped).size!==count)
  throw Error("Legacy star slots must map one-to-one to real HIP stars");
 const pts=mapped.map(i=>[...astronomical.pts[i]]);
 const fromHipIndex=new Map(mapped.map((sourceIndex,legacyIndex)=>[sourceIndex,legacyIndex]));
 const edges=[];
 for(const pair of astronomical.edges||[]){
  if(!Array.isArray(pair)||pair.length!==2)throw Error("Invalid astronomical edge");
  const [a,b]=pair.map(sourceIndex=>fromHipIndex.get(sourceIndex));
  // Other atlas stars may exist between the 17 historical slots. Do not
  // invent a direct connection where reference star endpoints are absent.
  if(a!==undefined&&b!==undefined&&a!==b)edges.push([a,b]);
 }
 return {...legacy,pts,edges,astronomicalSource:true};
}
export function resolveVerifiedAstronomicalShape(legacy,{figure=null,hipByLegacyIndex=null}={}){
 if(!figure)return legacy;
 // Fail closed: an invalid mapping must not corrupt the player-facing sky.
 try{return mapAstronomicalFigureToLegacy(legacy,figure,hipByLegacyIndex)}
 catch(error){console.warn("Incomplete astronomical drawing mapping:",error.message);return legacy}
}
