import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {badgeCooldownRemaining,badgeCooldownLabel} from '../src/campaign/performance.js';
const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const controls=Object.fromEntries(['badgeUnlockOverlay','badgeUnlockTitle','badgeUnlockCopy'].map(id=>[id,{hidden:true,dataset:{},style:{}}]));
const ctx=vm.createContext({lumenProgress:{performances:{}},badgeCooldownRemaining,badgeCooldownLabel,document:{getElementById:id=>controls[id]},pauseGameClock:()=>{},levelIndex:2});
for(const name of ['performanceIcon','performanceBadges','maybeShowBadgeMilestone'])vm.runInContext(functionSource(source,name),ctx);
for(const index of [0,1,2,3])for(const earned of [false,true]){
 ctx.lumenProgress=JSON.parse(JSON.stringify({performances:{[index]:{version:3,badges:{speed:earned}}}}));
 const html=vm.runInContext(`performanceBadges(${index})`,ctx);
 assert.equal((html.match(/performance-slot /g)||[]).length,4);
 assert(!html.includes('🔒')&&!html.includes('locked')&&!html.includes('verrouillé'));
 assert(html.includes(earned?'Rapidité obtenu':'Rapidité non obtenu'));
 assert(html.includes('Autonomie non obtenu'));
}
vm.runInContext('maybeShowBadgeMilestone()',ctx);
assert.equal(controls.badgeUnlockOverlay.hidden,false);
assert(controls.badgeUnlockCopy.innerHTML.includes('depuis la première quête'));
assert(!controls.badgeUnlockTitle.textContent.includes('premier badge'));
ctx.levelIndex=5;vm.runInContext('maybeShowBadgeMilestone()',ctx);
assert(!controls.badgeUnlockTitle.textContent.includes('maintenant accessibles'));
assert(controls.badgeUnlockCopy.innerHTML.includes('Marquage auto débloqué'),'The separate assistance unlock remains accurate');
console.log('Four early quests: earned/missing badge UI, reload and educational dialogs passed');
