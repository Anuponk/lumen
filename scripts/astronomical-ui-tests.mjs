import assert from "node:assert/strict";
import {astronomyVisualMetadata,verifiedAstronomicalFigure,iauForConstellation} from "../src/ui/astronomical-catalogue.js";
import {astronomicalIdentityAudit} from "./astronomical-identity-audit.mjs";
const audit=astronomicalIdentityAudit();
assert.equal(audit.mapped.length,40);
for(const identity of audit.mapped){
 assert.equal(iauForConstellation(identity),identity.iau,identity.id);
 const figure=verifiedAstronomicalFigure(identity);
 assert(figure,"Missing real sky figure for "+identity.id);
 assert(figure.edges.length>0,"Missing atlas lines for "+identity.id);
 assert(figure.pts.every(pt=>pt.length===2&&pt.every(Number.isFinite)),"Invalid projected sky positions for "+identity.id);
}
assert.equal(verifiedAstronomicalFigure({id:"unknown"}),null);
assert.deepEqual(astronomyVisualMetadata().coverage,{total:88,complete:88,incomplete:0});
assert.equal(verifiedAstronomicalFigure(audit.mapped.find(x=>x.iau==="Ori")).count,19);
console.log("All 40 playable constellation cards use verified Western atlas shapes");
