import test from 'node:test';
import assert from 'node:assert/strict';
import {createVictoryPresentation} from '../src/ui/victory-presentation.js';
function fixture(reduced=false){
 const host=new EventTarget();host.dataset={};host.classList={add(){},remove(){}};host.focus=()=>{};
 const button=new EventTarget();button.hidden=true;host.querySelector=()=>button;
 let frame,resolve;const finished=new Promise(r=>resolve=r);
 host.getAnimations=()=>[{animationName:'victoryRewardIn',finished,effect:{getComputedTiming:()=>({endTime:1600})}},{animationName:'celestial-conclusion',finished:new Promise(()=>{}),effect:{getComputedTiming:()=>({endTime:7000})}},{finished:new Promise(()=>{}),effect:{getComputedTiming:()=>({endTime:Infinity})}}];
 const view=createVictoryPresentation(host,{frame:f=>frame=f,reducedMotion:()=>reduced,delay:()=>assert.fail('Victory must not schedule a fixed wait')});let completions=0;
 return {host,button,view,start(){view.start(()=>completions++)},frame:()=>frame?.(),resolve,get completions(){return completions}};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('reveals ranking on the same screen immediately after the badges, even while the constellation is still animating',async()=>{
 const f=fixture();f.start();assert.equal(f.host.dataset.victoryPhase,'combined','Unified layout must exist before animation finishes');f.frame();await settle();
 assert.equal(f.completions,0);assert.equal(f.button.hidden,true);
 f.resolve();await settle();
 assert.equal(f.completions,1);assert.equal(f.host.dataset.victoryPhase,'combined');
 assert.equal(f.button.hidden,true);
});
test('reduced motion displays combined results without waiting',async()=>{
 const f=fixture(true);f.start();assert.equal(f.host.dataset.victoryPhase,'combined');f.frame();await settle();
 assert.equal(f.completions,1);assert.equal(f.host.dataset.victoryPhase,'combined');
});
test('closing cancels stale completion',async()=>{
 const f=fixture();f.start();f.frame();f.view.clear();f.resolve();await settle();
 assert.equal(f.button.hidden,true);assert.equal(f.completions,0);
});
test('the focused victory screen can skip the reveal with Enter only once',async()=>{
 const f=fixture();f.start();f.frame();
 const key=new Event('keydown',{cancelable:true});Object.defineProperty(key,'key',{value:'Enter'});
 f.host.dispatchEvent(key);assert.equal(key.defaultPrevented,true);assert.equal(f.completions,1);
 f.resolve();await settle();assert.equal(f.completions,1);
});
test('victory without animations displays combined results on the first frame',async()=>{
 const f=fixture();f.host.getAnimations=()=>[];f.start();f.frame();await settle();
 assert.equal(f.completions,1);assert.equal(f.host.dataset.victoryPhase,'combined');
});
