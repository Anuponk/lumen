import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const load=()=>import('../src/ui/long-press-guardian.js');
const event=(extra={})=>({pointerId:1,pointerType:'touch',isPrimary:true,clientX:10,clientY:20,...extra});
async function fixture(options={}){
 const {createLongPressGuardian}=await load();const timers=new Map(),actions=[];let serial=0,enabled=true;
 const cell={contains:target=>target===cell};
 const gesture=createLongPressGuardian({allowed:()=>enabled,activate:c=>{actions.push(c);return true},...options,schedule:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial},unschedule:id=>timers.delete(id)});
 return {gesture,cell,timers,actions,disable:()=>{enabled=false},fire(){for(const [id,t] of [...timers]){timers.delete(id);t.fn()}}};
}
test('one 500ms hold activates once and consumes only its generated click',async()=>{
 const f=await fixture();f.gesture.down(event(),f.cell);assert.equal([...f.timers.values()][0].ms,500);
 f.fire();f.fire();assert.equal(f.actions.length,1);f.gesture.up(event());
 assert.equal(f.gesture.consumeClick({target:f.cell,detail:1}),true);
 assert.equal(f.gesture.consumeClick({target:f.cell,detail:1}),false);
});
test('short tap, mouse and keyboard keep their normal click behavior',async()=>{
 const f=await fixture();f.gesture.down(event(),f.cell);f.gesture.up(event());f.fire();assert.equal(f.actions.length,0);
 assert.equal(f.gesture.consumeClick({target:f.cell,detail:1}),false);
 f.gesture.down(event({pointerType:'mouse'}),f.cell);f.fire();assert.equal(f.actions.length,0);
 assert.equal(f.gesture.consumeClick({target:f.cell,detail:0}),false);
});
test('movement, cancellation and multitouch cannot become a long action',async()=>{
 for(const stop of [f=>f.gesture.move(event({clientX:19})),f=>f.gesture.cancel(),f=>f.gesture.down(event({pointerId:2,isPrimary:false}),f.cell)]){
  const f=await fixture();f.gesture.down(event(),f.cell);stop(f);f.fire();assert.equal(f.actions.length,0);
 }
});
test('a guard is checked again at activation and the old click cannot mutate after a blocked hold',async()=>{
 const f=await fixture();f.gesture.down(event(),f.cell);f.disable();f.fire();f.gesture.up(event());
 assert.equal(f.actions.length,0);assert.equal(f.gesture.consumeClick({target:f.cell,detail:1}),true);
});
test('a fresh gesture clears a stale consumed click and an unrelated click is never swallowed',async()=>{
 const f=await fixture();f.gesture.down(event(),f.cell);f.fire();f.gesture.up(event());
 assert.equal(f.gesture.consumeClick({target:{},detail:1}),false);
 assert.equal(f.gesture.consumeClick({target:f.cell,detail:0}),false);
 f.gesture.down(event(),f.cell);f.gesture.up(event());assert.equal(f.gesture.consumeClick({target:f.cell,detail:1}),false);
});
test('release retargeted to a pause mask keeps its touch identity and is suppressed',async()=>{
 const f=await fixture();f.gesture.down(event(),f.cell);f.fire();f.gesture.up(event());
 assert.equal(f.gesture.consumeClick({target:{},detail:1,pointerType:'touch',pointerId:1}),true);
});
test('legacy click uses the board frame, while a fresh outside touch remains available',async()=>{
 const mask={},scope={contains:t=>t===mask},f=await fixture({clickScope:()=>scope});
 f.gesture.down(event(),f.cell);f.fire();f.gesture.up(event());
 assert.equal(f.gesture.consumeClick({target:mask,detail:1}),true);
 f.gesture.down(event(),f.cell);f.fire();f.gesture.up(event());
 f.gesture.down(event(),null);f.gesture.up(event());
 assert.equal(f.gesture.consumeClick({target:mask,detail:1}),false,'Fresh outside touch clears stale suppression');
});
test('real cell action preserves direct toggle, ordinary cycle, undo and blocked input',async()=>{
 const source=readFileSync('src/ui/game-screen.js','utf8');
 const body=source.split('d.onclick=async(event)=>{')[1].split('};board.appendChild(d)')[0];
 for(const [initial,direct,expected] of [[0,true,2],[1,true,2],[2,true,0],[0,false,1],[1,false,2],[2,false,0]]){
  const cell={classList:{add(){},remove(){}}},ctx=vm.createContext({r:0,c:0,d:cell,state:[[initial,0],[0,0]],n:2,puz:{sol:[0,1]},hist:[],
   celebrated:false,dragCrossSuppressClick:false,guidedPending:null,verifyPending:false,
   longPressGuardianAllowed:()=>true,displayedCellState:()=>initial,scriptedLearningActive:()=>false,ensureAttemptStarted(){},guidedDeferred:null,
   guidedErrorsEnabled:()=>false,attemptEngine:{snapshot:()=>({}),setWrongGuardianPending(){},markAssistance(){}},resolutionSnapshot:()=>null,
   document:{getElementById:()=>({checked:false})},clearHintDisplay(){},hintStage:0,hintFocus:null,msg:{},paintBoardState(){},updateScriptedLearning(){},
   levelIndex:2,persistAttemptBoard(){},rewardProgressPulse(){},navigator:{},setTimeout:fn=>fn(),render(){throw Error('Ordinary input rebuilt board')}});
  vm.runInContext('globalThis.act=async(event)=>{'+body+'}',ctx);
  await ctx.act({type:direct?'lumen-guardian-toggle':'click'});assert.equal(ctx.state[0][0],expected);assert.equal(ctx.hist.length,1);
  assert.equal(ctx.hist[0][0][0],initial,'Undo retains the actual prior state');
  ctx.longPressGuardianAllowed=()=>false;await ctx.act({type:'lumen-guardian-toggle'});assert.equal(ctx.hist.length,1,'Locked direct input cannot mutate');
 }
});
