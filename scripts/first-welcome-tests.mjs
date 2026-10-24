import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {claimFirstWelcome,INTRO_SEEN_KEY,INTRO_SCENES,INTRO_DURATION,createIntroTimeline} from '../src/ui/first-welcome.js';

function storage(entries=[]){const values=new Map(entries);return {get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}
const url=new URL('https://lumen.example/');
const fresh=storage();assert.equal(claimFirstWelcome(fresh,url),true);assert.equal(fresh.getItem(INTRO_SEEN_KEY),'1');assert.equal(claimFirstWelcome(fresh,url),false);
for(const key of ['lumenProgressV1','lumenActiveAttemptV1','lumenCloudOwnerId','lumenTutorialSeen','sb-example-auth-token','lumenGuestBeforeAccount_original','lumenCloudRecoveryV1']){
 const saved=storage([[key,'original']]);assert.equal(claimFirstWelcome(saved,url),false,key);assert.equal(saved.getItem(key),'original');assert.equal(saved.getItem(INTRO_SEEN_KEY),null);
}
for(const suffix of ['?challenge=synthetic','?qa=new','#access_token=synthetic','?code=synthetic'])assert.equal(claimFirstWelcome(storage(),new URL(suffix,url)),false);
assert.equal(claimFirstWelcome({getItem(){throw Error('denied')}},url),false);
const denied=storage();denied.setItem=()=>{throw Error('quota')};assert.equal(claimFirstWelcome(denied,url),false);
const unread=storage();unread.setItem=()=>{};assert.equal(claimFirstWelcome(unread,url),false);

let now=0,frames=[],finishes=0;
const timeline=createIntroTimeline({now:()=>now,onFrame:f=>frames.push(f),onFinish:()=>finishes++});
timeline.start();assert.equal(frames.at(-1).scene,0);
for(const [time,scene] of [[4999,0],[5000,1],[10000,2],[16000,3],[23000,4]]){now=time;timeline.frame();assert.equal(frames.at(-1).scene,scene)}
now=24000;timeline.pause();const paused=timeline.elapsed;now+=60000;timeline.frame();assert.equal(timeline.elapsed,paused,'Background/reading time is excluded');
timeline.resume();now+=1000;timeline.frame();assert.equal(timeline.elapsed,25000);
assert.ok(frames.at(-1).passage>0&&frames.at(-1).passage<1);
now+=5000;timeline.frame();timeline.frame();timeline.start();assert.equal(finishes,1,'One completion only');
assert.equal(INTRO_DURATION,30000);assert.deepEqual(INTRO_SCENES.map(s=>s.text),[
 "Le ciel s'est assombri.","Les constellations sommeillent dans l'ombre.",'Une dernière lueur peut encore les éveiller.','Chaque énigme résolue rendra une étoile au ciel.','À toi de réveiller les étoiles.'
]);
const stopped=createIntroTimeline({now:()=>now,onFrame(){},onFinish(){throw Error('Cancelled timeline completed')}});stopped.start();stopped.stop();now+=INTRO_DURATION;stopped.frame();stopped.resume();stopped.frame();
// Execute the actual controller-change callback, preserving OAuth exceptions.
const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const handler=source.match(/navigator.serviceWorker.addEventListener\("controllerchange",\(\)=>\{([\s\S]*?)\n \}\);/)[1];
let reloads=0;const worker={controller:{id:'first'}},location={search:'',hash:'',reload(){reloads++}};
const context=vm.createContext({navigator:{serviceWorker:worker},location,URLSearchParams,previousServiceWorkerController:null,lumenReloadingForSW:false});
vm.runInContext('function controllerChanged(){'+handler+'}',context);
vm.runInContext('controllerChanged()',context);assert.equal(reloads,0,'Initial worker acquisition must not interrupt the welcome');
worker.controller={id:'update'};vm.runInContext('controllerChanged()',context);assert.equal(reloads,1,'Actual upgrade reloads');
vm.runInContext('controllerChanged()',context);assert.equal(reloads,1,'Upgrade reload once');
context.lumenReloadingForSW=false;location.search='?code=synthetic';vm.runInContext('controllerChanged()',context);assert.equal(reloads,1,'OAuth exception retained');
console.log('First welcome: fresh/returning/owned/deep-link/storage guards, exact story, boundaries, background pause and cancellation passed');
