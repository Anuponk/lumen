// Offline source-to-runtime audit. No player data or production network access.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {buildAstronomicalCatalogue} from './build-astronomical-catalogue.mjs';

const read=relative=>JSON.parse(fs.readFileSync(new URL(relative,import.meta.url),'utf8'));
export function astronomyAuditInputs(){
 return {
  atlas:read('../src/data/astronomy/stellarium-western-figures.json'),
  source:read('./fixtures/astronomy/western-lines.json'),
  coordinates:read('./fixtures/astronomy/hipparcos-line-coordinates.json')
 };
}

export function auditAstronomicalFigures({atlas,source,coordinates}){
 const errors=[],rows=[];
 for(const [hip,{raDeg,decDeg}] of Object.entries(coordinates)){
  if(!/^[1-9][0-9]*$/.test(hip)||!Number.isFinite(raDeg)||raDeg<0||raDeg>=360||!Number.isFinite(decDeg)||Math.abs(decDeg)>90)
   errors.push('Invalid Hipparcos degree coordinates: '+hip);
 }
 if(errors.length)return {ok:false,errors,figures:rows};
 const expected=buildAstronomicalCatalogue(source,coordinates);
 if(expected.summary.incomplete)errors.push('Reference coordinates do not cover every source figure');
 const ids=Object.keys(expected.figures).sort();
 if(!isDeepStrictEqual(Object.keys(atlas.figures).sort(),ids))errors.push('Runtime figure identities differ from source');
 if(!isDeepStrictEqual(atlas.summary,expected.summary))errors.push('Runtime coverage summary differs from source');
 if(!isDeepStrictEqual(atlas.coverage,expected.coverage))errors.push('Runtime coverage records differ from source');
 for(const iau of ids){
  const figure=atlas.figures[iau],reference=expected.figures[iau],start=errors.length;
  if(!figure){errors.push(iau+': missing runtime figure');continue;}
  if(figure.iau!==iau||figure.count!==reference.count||figure.pts?.length!==reference.count||figure.hipIds?.length!==reference.count)
   errors.push(iau+': truncated or inconsistent star count');
  if(!isDeepStrictEqual(figure.hipIds,reference.hipIds))errors.push(iau+': HIP identity/order differs from source');
  if(!Array.isArray(figure.pts)||figure.pts.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))||p[0]<0||p[0]>290||p[1]<0||p[1]>115))
   errors.push(iau+': invalid projected coordinates');
  if(!isDeepStrictEqual(figure.pts,reference.pts))errors.push(iau+': projection differs from original Hipparcos coordinates');
  if(!isDeepStrictEqual(figure.edges,reference.edges))errors.push(iau+': source segments lost, added or reordered');
  rows.push({iau,stars:reference.count,segments:reference.edges.length,ok:errors.length===start});
 }
 return {ok:errors.length===0,source:source.sourceUrl,coordinateSource:'VizieR I/311/hip2, ICRS J1991.25; original import artifact 11701895503',summary:{figures:ids.length,uniqueHipStars:new Set(Object.values(expected.figures).flatMap(f=>f.hipIds)).size,matchingFigures:rows.filter(r=>r.ok).length},figures:rows,errors};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=auditAstronomicalFigures(astronomyAuditInputs());
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({ok:report.ok,summary:report.summary,suspects:report.figures.filter(f=>['Ant','Aps','Cae','Ari'].includes(f.iau)),errors:report.errors}));
 if(!report.ok)process.exitCode=1;
}
