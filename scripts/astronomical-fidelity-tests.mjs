import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAstronomicalFigures,astronomyAuditInputs} from './audit-astronomical-figures.mjs';
import {CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';
import {astronomicalPrimarySvg} from '../src/ui/astronomical-reference-svg.js';

const input=astronomyAuditInputs();
test('every shipped figure exactly preserves pinned Stellarium lines and original HIP projection',()=>{
 const before=JSON.stringify(input),report=auditAstronomicalFigures(input);
 assert.deepEqual(report.errors,[]);
 assert.equal(report.summary.matchingFigures,input.source.constellations.length);
 assert.equal(report.summary.uniqueHipStars,Object.keys(input.coordinates).length);
 assert.equal(JSON.stringify(input),before,'Audit is read-only');
 for(const [iau,stars,segments] of [['Ant',2,1],['Aps',3,2],['Cae',3,2],['Ari',4,3]])
  assert.deepEqual(report.figures.find(f=>f.iau===iau),{iau,stars,segments,ok:true},'Simple figures must be documented rather than embellished');
});
test('audit rejects star/segment loss, shifted coordinates, wrong HIP IDs and false coverage',()=>{
 const cases=[
  x=>{delete x.atlas.figures.Ant;},
  x=>{x.atlas.figures.Aps.edges.pop();},
  x=>{x.atlas.figures.Cae.pts.pop();},
  x=>{x.atlas.figures.Ari.pts[0][0]+=1;},
  x=>{x.atlas.figures.Ant.hipIds[0]='999999';},
  x=>{x.atlas.figures.Aps.pts[0][1]=NaN;},
  x=>{x.atlas.summary.complete--;},
  x=>{x.atlas.coverage[0].missingHip=['1'];},
  x=>{x.coordinates['51172'].raDeg=400;}
 ];
 for(const corrupt of cases){const changed=structuredClone(input);corrupt(changed);const report=auditAstronomicalFigures(changed);assert.equal(report.ok,false);assert(report.errors.length);}
});
test('every playable figure retains every real point and segment at all reward states',()=>{
 for(const entry of CONTENT_CONSTELLATIONS){
  const figure=verifiedAstronomicalFigure(entry);assert(figure,entry.id);
  const total=canonicalQuestList().filter(q=>q.constellationId===entry.id).length;
  for(const earned of [0,Math.floor(total/2),total]){
   const svg=astronomicalPrimarySvg(entry,earned,total);
   assert.equal((svg.match(/class="sky-star /g)||[]).length,figure.count,entry.id);
   assert.equal((svg.match(/class="sky-line /g)||[]).length,figure.edges.length,entry.id);
  }
 }
});
