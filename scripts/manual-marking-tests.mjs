import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGameEngine} from '../src/game/engine.js';
import {createOnboardingPreferences} from '../src/ui/onboarding-preferences.js';
import {questLearningRules} from '../src/campaign/quest-rules.js';
const original=JSON.stringify({auto:true,tips:['drag']}),storage={getItem:()=>original,setItem(){throw Error('Must not rewrite original preference')}};
const p=createOnboardingPreferences({storage});assert.equal(p.auto(),false);p.setAuto(true);assert.equal(p.auto(),false);assert.equal(p.seen('drag'),true);
for(const ordinal of [1,2,6,11,880,1001])assert.equal(questLearningRules(ordinal).autoMarking,false);
const board={n:3,puz:{reg:[[0,0,0],[1,1,1],[2,2,2]],sol:[0,2,1]},state:[[2,0,0],[0,0,0],[0,0,0]]};
// The proof auditor retains its historical simulation API. Live play always
// injects false, independently of the old checkbox/preference value.
const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
assert.ok(source.includes('createGameEngine(()=>({n,puz,state}),()=>false)'));
const engine=createGameEngine(()=>board,()=>false);
for(let r=0;r<3;r++)for(let c=0;c<3;c++)assert.equal(engine.isAutoCross(r,c),false);
assert.deepEqual(board.state,[[2,0,0],[0,0,0],[0,0,0]],'Retirement never mutates saved marks');
console.log('Manual marking: stale preferences, growth, engine bypass and saved cells pass');
