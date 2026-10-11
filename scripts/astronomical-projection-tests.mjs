import assert from "node:assert/strict";
import {projectAstronomicalFigure} from "../src/ui/astronomical-projection.js";
const stars=[
 {id:1,raDeg:359,decDeg:5},{id:2,raDeg:0,decDeg:5},
 {id:3,raDeg:1,decDeg:5},{id:4,raDeg:0,decDeg:10}
];
const original=structuredClone(stars);
const figure=projectAstronomicalFigure({stars,lines:[[1,2,3],[2,4]]});
assert.equal(figure.count,4);
assert.deepEqual(figure.edges,[[0,1],[1,2],[1,3]]);
assert.equal(figure.pts.length,4);
assert(figure.pts.every(([x,y])=>x>=12&&x<=278&&y>=12&&y<=103));
assert(figure.pts[0][0]<figure.pts[1][0]&&figure.pts[1][0]<figure.pts[2][0],"RA 359/0/1 must not break at meridian");
assert.deepEqual(stars,original,"No mutation of source coordinates");
assert.throws(()=>projectAstronomicalFigure({stars,lines:[[1,999]]}),/missing star/);
assert.throws(()=>projectAstronomicalFigure({stars:[...stars,stars[0]]}),/Duplicate/);
const polar=projectAstronomicalFigure({stars:[{id:"A",raDeg:0,decDeg:89.5},{id:"B",raDeg:90,decDeg:89.5}],lines:[["A","B"]]});
assert(polar.pts.every(p=>p.every(Number.isFinite)));
console.log("Generic astronomical projection OK");
