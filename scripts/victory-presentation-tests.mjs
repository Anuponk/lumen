import test from 'node:test';
import assert from 'node:assert/strict';
import {createVictoryPresentation} from '../src/ui/victory-presentation.js';
function fixture(reduced=false){
 const host=new EventTarget();host.dataset={};host.classList={add(){}};host.focus=()=>{};
 let frame,resolve;const finished=new Promise(r=>resolve=r);
 host.getAnimations=()=>[{finished,effect:{getComputedTiming:()=>({endTime:7000})}},{finished:new Promise(()=>{}),effect:{getComputedTiming:()=>({endTime:Infinity})}}];
 const view=createVictoryPresentation(host,{frame:f=>frame=f,reducedMotion:()=>reduced});let completions=0,actions=0;host.addEventListener('click',()=>actions++);
 return {host,view,start(){view.start(()=>completions++)},frame:()=>frame(),resolve,get completions(){return completions},get actions(){return actions}};
}
test('waits for actual animation completion, excludes ambient infinity and completes once',async()=>{
 const f=fixture();f.start();f.frame();await Promise.resolve();assert.equal(f.completions,0);
 f.resolve();await new Promise(r=>setImmediate(r));assert.equal(f.completions,1);assert.equal(f.host.dataset.victoryPhase,'ranking');
});
test('surface acceleration consumes the activation and never repeats after animation settles',async()=>{
 const f=fixture();f.start();f.frame();let stopped=false;
 // EventTarget in Node does not model DOM capture ordering. Call the installed
 // capture listener through a DOM-like host to assert cancellation separately.
 f.host.addEventListener('lumen:celebration-end',()=>stopped=true);
 f.host.dispatchEvent(new Event('keydown'));assert.equal(f.completions,0);
 const e=new Event('keydown',{cancelable:true});Object.defineProperty(e,'key',{value:'Enter'});f.host.dispatchEvent(e);
 assert.equal(e.defaultPrevented,true);assert.equal(stopped,true);assert.equal(f.completions,1);
 f.resolve();await new Promise(r=>setImmediate(r));assert.equal(f.completions,1);
});
test('clearing or replacing a surface cancels stale completion; reduced motion is immediate',async()=>{
 const f=fixture();f.start();f.frame();f.view.clear();f.resolve();await new Promise(r=>setImmediate(r));assert.equal(f.completions,0);
 const r=fixture(true);r.start();r.frame();assert.equal(r.completions,1);
});
