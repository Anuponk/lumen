// Release gate: the source atlas must completely cover every canonical Lumen
// constellation before any real-astronomy rendering is enabled.
import fs from "node:fs";
import {astronomicalIdentityAudit} from "./astronomical-identity-audit.mjs";

export function validatePlayableAstronomy(report, identities=astronomicalIdentityAudit().mapped){
 if(!report||!Array.isArray(report.coverage)||!report.figures)throw Error("Missing astronomical source report");
 const targets=new Map(identities.map(c=>[c.iau,c.id]));
 if(targets.size!==identities.length||targets.has(null))throw Error("Invalid or duplicated Lumen IAU identities");
 const coverage=new Map(report.coverage.map(c=>[c.iau,c]));
 const absent=[],incomplete=[],mismatched=[];
 for(const [iau,id] of targets){
  const record=coverage.get(iau);
  if(!record){absent.push({iau,id});continue}
  if(!record.complete||!report.figures[iau]){incomplete.push({iau,id,missingHip:record.missingHip||[]});continue}
  const figure=report.figures[iau];
  if(figure.iau!==iau||figure.count!==record.requiredStars||figure.hipIds?.length!==figure.count||figure.pts?.length!==figure.count||!Array.isArray(figure.edges))
   mismatched.push({iau,id});
 }
 return {targetCount:targets.size,coveredCount:targets.size-absent.length-incomplete.length-mismatched.length,absent,incomplete,mismatched,ready:absent.length===0&&incomplete.length===0&&mismatched.length===0};
}
if(process.argv[1]&&import.meta.url===new URL("file://"+process.argv[1]).href){
 const file=process.argv[2];if(!file)throw Error("Usage: node scripts/validate-playable-astronomy.mjs <astronomical-report.json>");
 const result=validatePlayableAstronomy(JSON.parse(fs.readFileSync(file)));
 console.log(JSON.stringify(result,null,2));
 if(!result.ready)process.exitCode=2;
}
