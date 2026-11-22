import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const src=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/ui/styles.css',import.meta.url),'utf8');
// #959: the administration entry is the last block of Mon espace; slice exactly that block.
const start=html.indexOf('id="administrationEntry"');
let end=-1;{let depth=0;for(const m of html.slice(html.lastIndexOf('<',start)).matchAll(/<(\/?)div\b[^>]*>/g)){depth+=m[1]?-1:1;if(!depth){end=html.lastIndexOf('<',start)+m.index+m[0].length;break}}}
assert(start>0&&end>start);
const panel=html.slice(start,end);
for(const id of ['administrationToggle','administrationPanel','qaAccountTools','qaAccountSwitch','qaAccountReset','qaPreviewStreakLoss','adminTools','adminCockpitOpen'])assert(panel.includes('id="'+id+'"'),id+' must be in Administration');
assert.doesNotMatch(panel,/adminUnlimitedShards/);
assert.match(panel,/aria-expanded="false"/);
assert.match(src,/function syncAdministrationMenu\(\)/);
assert.match(src,/const visible=qaActive\|\|authorized/);
assert.match(src,/entry\.hidden=!visible/);
assert.match(src,/if\(!visible&&panel\)panel\.hidden=true/);
assert.match(src,/function syncMobileAuthUI\(\)\{\s*syncAdministrationMenu\(\)/);
assert.match(src,/function updateAdminTools\(\)\{\s*syncAdministrationMenu\(\)/);
assert.match(src,/adminToggle\.onclick=/);
assert.match(src,/if\(qaActive\)\{url\.searchParams\.delete\("qa"\)/);
assert.match(styles,/#administrationPanel\[hidden\]/);
console.log('Administration UI and internal tester access contracts passed');
