import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';

const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
function feedback(n){
 const toasts=[],sounds=[];
 const context={n,halfRewardShown:false,lastPlacedCount:0,celebrated:false,
  board:{style:{setProperty(){}},classList:{add(){},remove(){}},offsetWidth:0},
  guardianSound:q=>sounds.push(q),halfSound(){},requestAnimationFrame(){},
  setTimeout(){},showRewardToast:t=>toasts.push(t),updateLiveReward(){}};
 vm.createContext(context);vm.runInContext(functionSource(source,'rewardProgressPulse'),context);
 return {context,toasts,sounds,half:()=>toasts.filter(t=>t.includes('Mi-chemin')),
  paint:q=>context.rewardProgressPulse(q),move:q=>context.rewardProgressPulse(q,{mutation:true})};
}
for(const size of [5,6,7,8]){
 test(`halfway ${size}: only the actual crossing celebrates, once`,()=>{
  const f=feedback(size),half=Math.ceil(size/2);
  for(let q=0;q<half;q++)f.move(q);
  assert.equal(f.half().length,0);f.move(half);assert.equal(f.half().length,1);
  f.paint(half);f.paint(half-1);f.move(half);f.move(size);
  assert.equal(f.half().length,1,'undo/repaint/finish cannot repeat halfway');
 });
 test(`halfway ${size}: restoration, terminal boards and hints stay silent`,()=>{
  for(const q of [Math.ceil(size/2),size-1,size]){
   const f=feedback(size);f.paint(q);assert.equal(f.half().length,0,'render/restore is not a mutation');
   assert.equal(f.sounds.length,0,'restoration is not a Guardian placement');
   f.move(q);assert.equal(f.half().length,0,'restored progress consumes the old crossing');
  }
  const final=feedback(size);final.move(size);assert.equal(final.half().length,0,'jump directly to terminal never celebrates halfway');
  const won=feedback(size);won.context.celebrated=true;won.move(Math.ceil(size/2));assert.equal(won.half().length,0);
 });
 test(`halfway ${size}: fresh reset and replay have their own crossing`,()=>{
  const f=feedback(size),ctx=f.context,button={};f.move(Math.ceil(size/2));assert.equal(f.half().length,1);
  Object.assign(ctx,{document:{getElementById:()=>button},confirm:()=>true,socialChallenge:null,hideSuccess(){},
   attemptEngine:{snapshot:()=>({attemptId:'same-attempt',resetCount:0}),reset(){}},trackAttemptEvent(){},
   clearHintDisplay(){},msg:{},updateHintButton(){},updateVerifyButton(){},clock(){},refreshJourney(){},
   render:()=>f.paint(0)});
  const start=source.indexOf('document.getElementById("new").onclick=()=>{');
  const end=source.indexOf('\ndocument.getElementById("learningCoachDismiss")',start);
  vm.runInContext(source.slice(start,end),ctx);button.onclick();f.move(Math.ceil(size/2));
  assert.equal(f.half().length,2,'Actual reset handler starts a fresh halfway crossing');
 });
}

test('drag release clears hint roles/card through the same path without a full render',()=>{
 const card={hidden:false},removed=[],ctx={dragCross:{id:1,dragging:true,changed:true,snapshot:[[0]]},
  hist:[],hi:[0,0],hiCells:[[0,0]],hintStage:1,hintFocus:'old',msg:{},levelIndex:70,
  board:{querySelectorAll:()=>[{classList:{remove:(...roles)=>removed.push(...roles)}}]},
  document:{getElementById:()=>card},persistAttemptBoard(){},paintBoardState(){},updateScriptedLearning(){},
  scriptedLearningActive:()=>false,setTimeout:fn=>fn(),render(){throw Error('Drag rebuilt the board')}};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'clearHintDisplay')+'\n'+functionSource(source,'endDragCross'),ctx);
 ctx.endDragCross({pointerId:1});
 assert(card.hidden,'A used hint card cannot remain on a dragged board');
 assert.deepEqual(removed,['hi','hint-source','hint-target']);assert.equal(ctx.hist.length,1);
});
