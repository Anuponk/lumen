import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {functionSource} from './source-tools.mjs';
import {gridCellsAlongSegment} from '../src/ui/drag-grid-path.js';
const source=fs.readFileSync('src/ui/game-screen.js','utf8'),rect={left:0,top:0,width:60,height:60};
assert.deepEqual(gridCellsAlongSegment([5,15],[55,15],rect,6),[0,1,2,3,4,5].map(c=>[1,c]));
assert.deepEqual(gridCellsAlongSegment([5,5],[55,55],rect,6),[0,1,2,3,4,5].map(c=>[c,c]));
assert.deepEqual(gridCellsAlongSegment([-30,15],[90,15],rect,6),[0,1,2,3,4,5].map(c=>[1,c]));
for(const end of [55,25,45]){
 const state=Array.from({length:6},()=>Array(6).fill(0)),marked=[];
 const context={n:6,state,gridCellsAlongSegment,board:{getBoundingClientRect:()=>rect,setPointerCapture(){}},dragCross:{id:1,startX:5,startY:15,lastX:5,lastY:15,dragging:false,visited:new Set()},dragCrossSuppressClick:false,
  dragCrossCellAt:(x,y)=>[Math.floor(y/10),Math.floor(x/10)],markDragCross:(r,c)=>{state[r][c]=1;marked.push([r,c])}};
 vm.createContext(context);for(const name of ['dragCellAt','dragLeftStartCell','moveDragCross'])vm.runInContext(functionSource(source,name),context);
 context.moveDragCross({pointerId:1,clientX:end,clientY:15,preventDefault(){}});
 assert.deepEqual(state[1].slice(0,Math.floor(end/10)+1),Array(Math.floor(end/10)+1).fill(1),'Fast moves must mark every traversed cell, even during a visual cascade');
}
// #994: more than 8 px but still inside the starting cell stays a tap (no drag,
// nothing marked, the native click is not suppressed).
{
 const state=Array.from({length:6},()=>Array(6).fill(0));
 const context={n:6,state,gridCellsAlongSegment,board:{getBoundingClientRect:()=>rect,setPointerCapture(){}},dragCross:{id:1,startX:0.5,startY:10.5,lastX:0.5,lastY:10.5,dragging:false,visited:new Set()},dragCrossSuppressClick:false,markDragCross:(r,c)=>{state[r][c]=1}};
 vm.createContext(context);for(const name of ['dragCellAt','dragLeftStartCell','moveDragCross'])vm.runInContext(functionSource(source,name),context);
 context.moveDragCross({pointerId:1,clientX:6.5,clientY:16.5,preventDefault(){}});
 assert.equal(context.dragCross.dragging,false,'8.5 px inside the cell is still a tap');
 assert.equal(context.dragCrossSuppressClick,false,'the native click is kept');
 assert.equal(state.flat().some(Boolean),false,'nothing marked');
 context.moveDragCross({pointerId:1,clientX:12,clientY:16.5,preventDefault(){}});
 assert.equal(context.dragCross.dragging,true,'leaving the cell starts the drag');
}
{
 const state=[[1,2,0,1,0,3]],covered=new Set();
 const context={state,dragCross:{mode:'erase',visited:new Set()},document:{getElementById:()=>({hidden:true})},
  attemptEngine:{snapshot:()=>({})},paintCell:(r,c)=>covered.add(c)};
 vm.createContext(context);vm.runInContext(functionSource(source,'markDragCross'),context);
 for(let c=0;c<state[0].length;c++)context.markDragCross(0,c);
 assert.deepEqual(state[0],[0,2,0,0,0,3],'An erase sweep changes only the editable red marks');
 assert.deepEqual([...covered],[0,3]);
}
console.log('PASS grid paths, dense sampling and mixed red-mark erasure');
