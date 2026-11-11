import test from 'node:test';
import assert from 'node:assert/strict';
import {createVictoryPresentation} from '../src/ui/victory-presentation.js';
function fixture(reduced=false){
 const host=new EventTarget();host.dataset={};host.classList={add(){}};host.focus=()=>{};
 const button=new EventTarget();button.hidden=true;host.querySelector=()=>button;
 let frame,resolve,elapsed;const finished=new Promise(r=>resolve=r);
 host.getAnimations=()=>[{finished,effect:{getComputedTiming:()=>({endTime:7000})}},{finished:new Promise(()=>{}),effect:{getComputedTiming:()=>({endTime:Infinity})}}];
 const view=createVictoryPresentation(host,{frame:f=>frame=f,reducedMotion:()=>reduced,delay:ms=>{assert.ok(ms>=2000,'Minimum viewing period is two seconds');return new Promise(r=>elapsed=r)}});let completions=0;
 return {host,button,view,start(){view.start(()=>completions++)},frame:()=>frame(),resolve,elapsed:()=>elapsed(),get completions(){return completions}};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('never opens ranking automatically; waits at least two seconds and actual finite animations',async()=>{
 const f=fixture();f.start();f.frame();f.elapsed();await settle();assert.equal(f.button.hidden,true);
 f.resolve();await settle();assert.equal(f.completions,0);assert.equal(f.button.hidden,false);assert.equal(f.host.dataset.victoryPhase,'admire');
 f.host.dispatchEvent(new Event('click'));await settle();assert.equal(f.completions,0);
 f.button.dispatchEvent(new Event('click'));assert.equal(f.completions,1);assert.equal(f.host.dataset.victoryPhase,'ranking');
 f.button.dispatchEvent(new Event('click'));assert.equal(f.completions,1);
});
test('reduced motion also preserves the two second viewing period, including no badge animation',async()=>{
 const f=fixture(true);f.start();f.frame();await settle();assert.equal(f.button.hidden,true);assert.equal(f.completions,0);
 f.elapsed();await settle();assert.equal(f.button.hidden,false);assert.equal(f.completions,0);
});
test('closing cancels a stale completion and detaches its button',async()=>{
 const f=fixture();f.start();f.frame();f.view.clear();f.resolve();f.elapsed();await settle();
 assert.equal(f.button.hidden,true);f.button.dispatchEvent(new Event('click'));assert.equal(f.completions,0);
});

test('a victory without finite badge animations still waits and never opens ranking itself',async()=>{
 const f=fixture();f.host.getAnimations=()=>[];f.start();f.frame();await settle();assert.equal(f.button.hidden,true);
 const key=new Event('keydown');Object.defineProperty(key,'key',{value:'Enter'});f.host.dispatchEvent(key);assert.equal(f.completions,0);
 f.elapsed();await settle();assert.equal(f.button.hidden,false);assert.equal(f.completions,0);
});
