// Offline catalogue builder: use only source files with verified reuse rights.
// Never silently omit stars/segments; report coverage before generating assets.
import fs from "node:fs";
import {projectAstronomicalFigure} from "../src/ui/astronomical-projection.js";

export function buildAstronomicalCatalogue(skyCulture,hipCoordinates){
 if(!Array.isArray(skyCulture?.constellations)||!hipCoordinates||typeof hipCoordinates!=="object")throw Error("Invalid source files");
 const figures={},coverage=[];
 const seen=new Set();
 for(const constellation of skyCulture.constellations){
  const id=String(constellation.iau||"");
  if(!/^[A-Z][a-z]{2}$/.test(id)||seen.has(id))throw Error("Invalid or duplicate IAU code "+id);
  seen.add(id);
  const lines=constellation.lines||[];
  const normalizedLines=lines.map(line=>{if(!Array.isArray(line))throw Error("Invalid line for "+id);const ids=line.filter((v,i)=>!(i===0&&(v==="thin"||v==="bold")));if(ids.some(v=>!Number.isInteger(v)||v<=0))throw Error("Non-HIP star reference in "+id);return ids;});
  const unique=[...new Set(normalizedLines.flat().map(String))];
  const absent=unique.filter(hip=>!hipCoordinates[hip]||!Number.isFinite(hipCoordinates[hip].raDeg)||!Number.isFinite(hipCoordinates[hip].decDeg));
  const record={iau:id,requiredStars:unique.length,availableStars:unique.length-absent.length,missingHip:absent,complete:absent.length===0&&unique.length>0};
  coverage.push(record);
  if(!record.complete)continue;
  const stars=unique.map(hip=>({id:hip,raDeg:hipCoordinates[hip].raDeg,decDeg:hipCoordinates[hip].decDeg}));
  const shape=projectAstronomicalFigure({stars,lines:normalizedLines});
  figures[id]={iau:id,hipIds:unique,...shape};
 }
 return {figures,coverage,summary:{total:coverage.length,complete:coverage.filter(c=>c.complete).length,incomplete:coverage.filter(c=>!c.complete).length}};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 const [cultureFile,hipFile,outputFile]=process.argv.slice(2);
 if(!cultureFile||!hipFile||!outputFile)throw Error("Usage: node scripts/build-astronomical-catalogue.mjs <culture.json> <hip-coordinates.json> <report.json>");
 const result=buildAstronomicalCatalogue(JSON.parse(fs.readFileSync(cultureFile)),JSON.parse(fs.readFileSync(hipFile)));
 fs.writeFileSync(outputFile,JSON.stringify(result,null,2)+"\n");
 console.log("IAU catalogue coverage:",result.summary);
 if(result.summary.incomplete)process.exitCode=2; // Never treat incomplete data as a deployable figure library.
}
