import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const extractor=readFileSync(new URL("./fetch-hipparcos-line-stars.py",import.meta.url),"utf8");
assert.match(extractor,/VizieR I\/311\/hip2 fields RArad and DErad are ALREADY IN DEGREES/);
assert.match(extractor,/0 <= ra < 360 and -90 <= dec <= 90/);
assert.match(extractor,/"raDeg": ra, "decDeg": dec/);
assert.doesNotMatch(extractor,/math\.degrees\s*\(/,"Never convert VizieR degree coordinates again");
console.log("Hipparcos degree units and bounds contract OK");
