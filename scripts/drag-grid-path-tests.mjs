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
 vm.createContext(context);vm.runInContext(functionSource(source,'moveDragCross'),context);
 context.moveDragCross({pointerId:1,clientX:end,clientY:15,preventDefault(){}});
 assert.deepEqual(state[1].slice(0,Math.floor(end/10)+1),Array(Math.floor(end/10)+1).fill(1),'Fast moves must mark every traversed cell, even during a visual cascade');
}
console.log('PASS grid paths and actual pointermove sampling: horizontal, diagonal, outside and rapid moves');
