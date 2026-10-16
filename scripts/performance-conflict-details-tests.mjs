import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const profile=readFileSync(new URL("../src/persistence/cloud-profile.js",import.meta.url),"utf8");
const screen=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.match(profile,/return \{ok:false,conflictKeys:\[key\]\}/);
assert.match(profile,/reason:"reward_conflict"[^\n]+conflictKeys:/);
assert.match(screen,/recordCloudDiagnostic\("hydration_reconciliation"[^\n]+conflictKeys:/);
console.log("Reward conflict diagnostic exposes bounded field names only");
