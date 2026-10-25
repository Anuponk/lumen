import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import './reward-conflict-diagnostics-tests.mjs';
const profile=readFileSync(new URL("../src/persistence/cloud-profile.js",import.meta.url),"utf8");
assert.match(profile,/return \{ok:false,conflictKeys:\[key\]\}/);
assert.match(profile,/reason:"reward_conflict"[^\n]+conflictKeys:/);
console.log("Reward conflict diagnostic exposes bounded field names only");
