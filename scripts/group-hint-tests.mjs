import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {canonicalQuestByOrdinal} from '../src/campaign/canonical-quests.js';
import {createGameEngine} from '../src/game/engine.js';

const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const handler=source.slice(source.indexOf('document.getElementById("hint").onclick=()=>{'),source.indexOf('\nconst testModel='));
function present(h,lesson=false,engine=null){
 const button={},messages=[],grants=[];
 const context={document:{getElementById:()=>button},scriptedLearningActive:()=>lesson,activeQuestOrdinal:()=>91,levelIndex:70,
  consumeHintCost:()=>{grants.push(true);return true},playerError:()=>engine?.playerError()??null,directMissingCross:()=>engine?.directMissingCross()??null,
  simpleForcedPlacement:()=>engine?.simpleForcedPlacement()??null,proofEngine:()=>h,proofs:{},hi:null,hiCells:[],hintStage:0,hintFocus:null,
  showHintMessage:t=>messages.push(t),render(){}};
 vm.createContext(context);vm.runInContext(handler,context);
 return {context,messages,grants,click:()=>button.onclick()};
}
test('forced onboarding still gates hints before spending or displaying a deduction',()=>{
 const f=present(null,true);f.click();assert.equal(f.grants.length,0);assert.equal(f.messages.length,0);
 assert.equal(f.context.hi,null);assert.equal(f.context.hintStage,0);
});
test('quest 91: first group hint names columns, certain exclusion and both visual roles',()=>{
 const puz=canonicalQuestByOrdinal(91),n=puz.size;
 const state=[[1,1,0,0,1,1],[2,1,1,1,1,1],[1,1,0,0,1,1],[1,1,1,0,0,0],[1,0,1,0,0,0],[1,0,0,0,1,0]];
 for(const auto of [false,true]){
  const engine=createGameEngine(()=>({n,puz,state}),()=>auto),h=engine.proofEngine();
  assert.equal(h.detail.rule,'group');assert.equal(h.detail.axis,'col');
  assert.deepEqual(h.detail.indices,[2,3]);assert.deepEqual(h.cell,[5,2]);
  const f=present(h,false,engine);f.click();
  assert.match(f.messages[0],/colonnes 3 et 4/);assert.match(f.messages[0],/L6C3/);assert.match(f.messages[0],/écarter/);
  assert.deepEqual(Array.from(f.context.hi),[5,2]);assert.equal(f.context.hiCells.length,h.detail.source.length);
  assert.equal(engine.solutions().length,1);state[5][2]=2;assert.equal(engine.solutions().length,0);state[5][2]=0;
  for(let step=0;step<3;step++){f.click();assert.match(f.messages.at(-1),/L6C3/);assert.match(f.messages.at(-1),/écarter/)}
 }
});
for(const axis of ['col','row'])for(const count of [2,3]){
 test(`group ${count} ${axis}: a single request explains the guaranteed action`,()=>{
  const h={kind:'elim',cell:[4,4],detail:{rule:'group',axis,indices:Array.from({length:count},(_,i)=>i),regions:Array.from({length:count},(_,i)=>i),source:[[0,0],[1,1]]}};
  const f=present(h);f.click();
  assert.match(f.messages[0],new RegExp(axis==='col'?'colonnes':'lignes'));
  assert.match(f.messages[0],/L5C5/);assert.match(f.messages[0],/écarter/);
  assert.deepEqual(Array.from(f.context.hi),[4,4]);
 });
}
