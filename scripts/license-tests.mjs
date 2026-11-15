// LICENSE: all rights reserved for Lumen's own work, third-party exceptions kept accurate.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const license=fs.readFileSync('LICENSE','utf8'),pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
assert.match(license,/Tous droits réservés/);assert.match(license,/All rights\s+reserved/);
assert.equal(pkg.license,'UNLICENSED','npm metadata matches the reserved licence');
assert.equal(pkg.private,true);
// The CC BY-SA attribution is the one the astronomy contract requires.
const attribution=fs.readFileSync('docs/ASTRONOMY_DATA_ATTRIBUTION.md','utf8').match(/« (Données de constellations Western[^»]+) »/)[1];
assert.equal(license.match(/« (Données de constellations Western[^»]+) »/)[1].replace(/\s+/g,' '),attribution.replace(/\s+/g,' '));
// Every third-party path named in the exceptions exists, and every vendored licence is listed.
for(const p of license.matchAll(/((?:src|scripts|docs)\/[A-Za-z0-9_./-]+[A-Za-z0-9_/-])/g))assert(fs.existsSync(p[1]),'LICENSE path exists: '+p[1]);
for(const f of fs.readdirSync('src/vendor').filter(f=>/LICENSE/i.test(f)))assert(license.includes('src/vendor/'+f),'Vendored licence listed: '+f);
assert(fs.existsSync('src/data/astronomy/stellarium-western-figures.json'));
console.log('license-tests: reserved rights, npm metadata, CC BY-SA attribution and third-party paths OK');
