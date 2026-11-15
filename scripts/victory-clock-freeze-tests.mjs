// #698: the shown clock and the captured victory time freeze at local victory
// detection, independently of network work; editing the board again resumes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {functionSource} from './source-tools.mjs';

const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
function harness(){
 let ms=61_400,intervals=0;
 const ctx={victoryClockFreeze:null,timer:1,socialChallenge:null,shown:[],
  attemptEngine:{activeMs:()=>ms,officialSeconds:()=>Math.floor(ms/1000)+30},
  clearInterval:()=>{},setInterval:()=>++intervals,
  clock:()=>ctx.shown.push(ctx.victoryClockFreeze?ctx.victoryClockFreeze.official:ctx.attemptEngine.officialSeconds())};
 vm.createContext(ctx);
 for(const name of ['freezeVictoryClock','thawVictoryClock','activeGameMs','activeGameSeconds'])vm.runInContext(functionSource(source,name),ctx);
 return {ctx,advance:delta=>{ms+=delta},intervals:()=>intervals};
}

test('freeze keeps the shown official time and the captured seconds while network work runs',()=>{
 const {ctx,advance}=harness();
 vm.runInContext('freezeVictoryClock()',ctx);
 const seconds=vm.runInContext('activeGameSeconds()',ctx);
 advance(4_000); // slow 4G: the engine keeps running behind the frozen display
 assert.equal(vm.runInContext('activeGameSeconds()',ctx),seconds,'Captured victory seconds do not include network time');
 assert.equal(seconds,61);
 assert.equal(ctx.shown.at(-1),91,'Shown time is the official time with penalties at detection');
 vm.runInContext('freezeVictoryClock()',ctx);
 assert.equal(ctx.victoryClockFreeze.official,91,'A second render cannot move the frozen time');
});

test('editing a solved board again resumes the live clock',()=>{
 const {ctx,advance,intervals}=harness();
 vm.runInContext('freezeVictoryClock()',ctx);advance(2_000);
 vm.runInContext('thawVictoryClock()',ctx);
 assert.equal(ctx.victoryClockFreeze,null);assert.equal(intervals(),1);
 assert.equal(vm.runInContext('activeGameSeconds()',ctx),63);
});

test('wiring: freeze happens at local detection, before any save; new grids reset it',()=>{
 assert.match(source,/msg\.textContent="Constellation complète\.";\s*freezeVictoryClock\(\);\s*celebrateSuccess\(\);/);
 assert.match(source,/formatDuration\(victoryClockFreeze\?victoryClockFreeze\.official:/);
 assert.match(source,/drawLevels\(\);victoryClockFreeze=null;clearInterval\(timer\);timer=setInterval\(clock,100\);/);
 assert.match(source,/if\(victoryClockFreeze&&q!==n&&!celebrated&&!pendingVictoryView\)thawVictoryClock\(\);/);
 // The canonical capture reads the frozen value, before awaiting any storage or network.
 const canonical=functionSource(source,'celebrateCanonicalSuccess');
 assert(canonical.indexOf('const seconds=activeGameSeconds()')<canonical.indexOf('await '),'Seconds captured before the first await');
});
