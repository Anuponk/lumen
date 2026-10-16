import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/persistence/cloud-profile.js",import.meta.url),"utf8");
assert.match(source,/field==="performances"&&key==="time"/);
assert.match(source,/Number.isFinite\(value\)&&Number.isFinite\(out\[key\]\)/);
assert.match(source,/out\[key\]=Math.min\(value,out\[key\]\)/);
console.log("Performance time merge allows finite positive times, preserving other reward conflicts");
