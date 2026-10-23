import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const handler=source.split(/\r?\n/).find(line=>line.startsWith('document.getElementById("undo").onclick=')).split('.onclick=')[1].replace(/;$/,'');
for(const pending of [true,false]){
 const controls={guidedCard:{hidden:!pending}},board={removeAttribute(name){delete this[name]},'aria-disabled':'true'};
 const previous=[[0,1],[0,0]],ctx=vm.createContext({
  document:{getElementById:id=>controls[id]},board,
  celebrated:false,scriptedLearningActive:()=>false,hist:[previous],state:[[2,1],[0,0]],
  guidedPending:pending?{r:0,c:0}:null,guidedDeferred:pending?null:{r:0,c:0},
  attemptEngine:{snapshot:()=>({wrongGuardianPending:'0,0'}),clearWrongGuardianPending:()=>{}},
  clearHintDisplay:()=>{},hintStage:1,hintFocus:{},msg:{textContent:'error'},render:()=>{},persistAttemptBoard:()=>{}
 });
 if(source.includes('function clearGuidedConflict('))vm.runInContext(functionSource(source,'clearGuidedConflict'),ctx);
 vm.runInContext(`(${handler})()`,ctx);
 assert.equal(ctx.state,previous);
 assert.equal(ctx.guidedPending,null,'Undo releases the guided input guard');
 assert.equal(ctx.guidedDeferred,null,'Undo discards stale deferred coordinates');
 assert.equal(controls.guidedCard.hidden,true);
 assert.equal(board['aria-disabled'],undefined);
 assert.equal(ctx.hist.length,0);
 vm.runInContext(`(${handler})()`,ctx);
 assert.equal(ctx.state,previous,'Repeated undo with empty history preserves the board');
}
console.log('Guided undo: pending/deferred conflict, preserved board and repeated undo passed');
