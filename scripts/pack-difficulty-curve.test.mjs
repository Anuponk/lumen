import test from "node:test";
import assert from "node:assert/strict";
import {balanceDifficultyCurve,compareDifficultyCurves} from "./pack-difficulty-curve.mjs";
const q=(score,id)=>({id,audit:{score,tier:"easy"}});
test("sorts difficulty within constellation without mixing groups",()=>{
 const original=[q(40,"a"),q(10,"b"),q(30,"c"),q(80,"d"),q(60,"e"),q(70,"f")];
 const ordered=balanceDifficultyCurve(original,3);
 assert.deepEqual(ordered.map(x=>x.id),["b","c","a","e","f","d"]);
 assert.deepEqual(original.map(x=>x.id),["a","b","c","d","e","f"]);
 assert.equal(compareDifficultyCurves(original,ordered).after.jumpsOver20,0);
});
test("keeps stable ties and rejects incomplete groups",()=>{
 assert.deepEqual(balanceDifficultyCurve([q(20,"a"),q(20,"b")],2).map(x=>x.id),["a","b"]);
 assert.throws(()=>balanceDifficultyCurve([q(10,"a")],2),/Incomplete/);
 assert.throws(()=>balanceDifficultyCurve([{}],1),/Missing audited/);
});
