// #740: visible CC BY-SA attribution (account menu) and a licence notice next to the derived data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CREDITS_ATTRIBUTION,CREDITS_LINKS} from '../src/ui/credits.js';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const html=read('index.html'),js=read('src/ui/game-screen.js'),notice=read('src/data/astronomy/NOTICE.md'),doc=read('docs/ASTRONOMY_DATA_ATTRIBUTION.md');
const menu=html.slice(html.indexOf('id="mobileAuthPopover"'),html.indexOf('id="administrationEntry"'));
assert.ok(menu.includes('id="showCredits"')&&menu.includes('id="creditsPanel"'),'Credits live in the account menu, outside Administration');
const sky=html.slice(html.indexOf('id="mapModal"'));
assert.ok(!sky.includes('id="creditsPanel"'),'Not in Mon ciel (owner decision)');
const panel=menu.slice(menu.indexOf('id="creditsPanel"'));
assert.ok(panel.includes(CREDITS_ATTRIBUTION),'The exact attribution is shown');
for(const href of Object.values(CREDITS_LINKS))assert.ok(panel.includes(href.replace(/&/g,'&amp;')),'Link present: '+href);
assert.ok(doc.includes('Données de constellations Western © équipe Stellarium, CC BY-SA ; coordonnées stellaires Hipparcos II'),'Same attribution as the repository documentation');
assert.match(js,/import \{setupCredits\} from "\.\/credits\.js";/);
assert.match(js,/ menu\.onclick=\(e\)=>\{[^\n]*e\.stopPropagation\(\)\};[\s\S]{0,400}?\n setupCredits\(document\);/);
assert.match(notice,/stellarium-western-figures\.json/);assert.match(notice,/CC BY-SA/);assert.match(notice,/ne s’applique pas au jeu/);
console.log('credits-tests: account-menu attribution, links and data notice OK');
