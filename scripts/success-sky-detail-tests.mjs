import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const nav=readFileSync(new URL('../src/ui/sky-navigation.js',import.meta.url),'utf8');
assert.match(src,/skyNavigation\.open\(\{detail:focusSky,questIndex:skyQuestIndex,constellationId\}\)/);
assert.match(src,/successSky"\)\.onclick=[^\n]*openJourneyMap\(true,\{/);
assert.match(nav,/view=showDetail\?'detail':'overview'/);
assert.match(nav,/setView\(next\)\{view=next;tabs\.hidden=next==='detail'/);
console.log('Success screen opens the exact played constellation detail, not overview');
