import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const ui=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.match(ui,/recordCloudDiagnostic\("hydration_reconciliation",\{[^\n]+conflictId:typeof resolution.conflictId/);
console.log("The exact conflicting reward key is included in bounded local diagnostics");
