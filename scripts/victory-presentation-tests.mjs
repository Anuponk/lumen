import test from 'node:test';
import assert from 'node:assert/strict';
import {createVictoryPresentation} from '../src/ui/victory-presentation.js';
function fixture(reduced=false){
 const host=new EventTarget();host.dataset={};host.classList={add(){},remove(){}};host.focus=()=>{};
 const button=new EventTarget();button.hidden=true;host.querySelector=()=>button;
 let frame,resolve,elapsed;const finished=new Promise(r=>resolve=r);
 host.getAnimations=()=>[{finished,effect:{getComputedTiming:()=>({endTime:7000})}},{finished:new Promise(()=>{}),effect:{getComputedTiming:()=>({endTime:Infinity})}}];
 const view=createVictoryPresentation(host,{frame:f=>frame=f,reducedMotion:()=>reduced,delay:ms=>{assert.ok(ms>=2000);return new Promise(r=>elapsed=r)}});let completions=0;
 return {host,button,view,start(){view.start(()=>completions++)},frame:()=>frame(),resolve,elapsed:()=>elapsed(),get completions(){return completions}};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('reveals ranking automatically on the same screen only after minimum and finite animations',async()=>{
 const f=fixture();f.start();assert.equal(f.host.dataset.victoryPhase,'combined','Unified layout must exist before animation finishes');f.frame();f.elapsed();await settle();
 assert.equal(f.completions,0);assert.equal(f.button.hidden,true);
 f.resolve();await settle();
 assert.equal(f.completions,1);assert.equal(f.host.dataset.victoryPhase,'combined');
 assert.equal(f.button.hidden,true);
});
test('reduced motion waits two seconds then displays combined results',async()=>{
 const f=fixture(true);f.start();assert.equal(f.host.dataset.victoryPhase,'combined');f.frame();await settle();assert.equal(f.completions,0);
 f.elapsed();await settle();assert.equal(f.completions,1);assert.equal(f.host.dataset.victoryPhase,'combined');
});
test('closing cancels stale completion',async()=>{
 const f=fixture();f.start();f.frame();f.view.clear();f.resolve();f.elapsed();await settle();
 assert.equal(f.button.hidden,true);assert.equal(f.completions,0);
});
test('victory without animations displays combined results after minimum delay',async()=>{
 const f=fixture();f.host.getAnimations=()=>[];f.start();f.frame();await settle();assert.equal(f.completions,0);
 f.elapsed();await settle();assert.equal(f.completions,1);assert.equal(f.host.dataset.victoryPhase,'combined');
});
