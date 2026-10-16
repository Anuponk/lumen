import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const code=readFileSync(new URL("../src/persistence/cloud-profile.js",import.meta.url),"utf8");
for(const flag of ["autonomySeen","fullBadgeIntroSeen","autoCrossUnlockSeen","speedBadgeIntroSeen"])assert.ok(code.includes(flag));
assert.match(code,/if\(Boolean\(left\)\|\|Boolean\(right\)\)merged\[flag\]=1/);
assert.match(code,/introFlags\.includes\(field\)/);
assert.match(code,/reason:"invalid_intro_flag"/);
console.log("Four monotonically seen tutorial flags reconciled without arbitrary values");
