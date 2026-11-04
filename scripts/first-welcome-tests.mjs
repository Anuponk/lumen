import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {claimFirstWelcome,INTRO_SEEN_KEY,INTRO_SCENES,INTRO_DURATION,createIntroTimeline} from '../src/ui/first-welcome.js';
import {createIntroMusic} from '../src/ui/intro-music.js';

// Audio lifecycle uses fake nodes here; native synthesis is covered in Chromium.
const contexts=[];
class AudioFixture{
 constructor(){this.currentTime=0;this.destination={};this.nodes=[];this.closed=false;contexts.push(this)}
 createGain(){const node={gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}},connect(){},disconnect(){this.disconnected=true}};this.nodes.push(node);return node}
 createOscillator(){const node={frequency:{},connect(){},start(t){this.startsAt=t},stop(){this.stopped=true},disconnect(){this.disconnected=true}};this.nodes.push(node);return node}
 resume(){return Promise.resolve()}
 close(){this.closed=true;return Promise.resolve()}
}
const audioWindow={AudioContext:AudioFixture,localStorage:{getItem:()=> 'off'}};
const score=createIntroMusic({window:audioWindow});score.start();assert.equal(contexts.length,0,'Respect existing mute');
score.setEnabled(true);score.start();assert.equal(contexts.length,1);assert.ok(contexts[0].nodes.length<60,'Bounded score');
score.pause();assert.equal(contexts[0].closed,true);assert.ok(contexts[0].nodes.every(n=>n.disconnected),'No connected nodes after pause');
score.start(19000);assert.ok(contexts[1].nodes.length<contexts[0].nodes.length,'Resume current passage without replaying earlier notes');
score.setEnabled(false);assert.equal(contexts[1].closed,true);score.start();assert.equal(contexts.length,2);
score.setEnabled(true);score.start(23999);score.stop();assert.equal(contexts[2].closed,true,'Near-end resume is safe');
const unavailable=createIntroMusic({window:{localStorage:{getItem:()=> 'on'}}});unavailable.start();assert.equal(unavailable.enabled,false,'Unavailable audio never blocks the story');
const deniedAudio=createIntroMusic({window:{AudioContext:AudioFixture,localStorage:{getItem(){throw Error('denied')}}}});deniedAudio.start();assert.equal(contexts.length,3);
class RejectedAudio extends AudioFixture{resume(){return Promise.reject(Error('blocked'))}}
const blocked=createIntroMusic({window:{...audioWindow,AudioContext:RejectedAudio}});blocked.setEnabled(true);blocked.start();await Promise.resolve();assert.equal(blocked.enabled,false);assert.equal(contexts.at(-1).closed,true);
const stale=createIntroMusic({window:{...audioWindow,AudioContext:RejectedAudio}});stale.setEnabled(true);stale.start();stale.stop();await Promise.resolve();assert.equal(stale.enabled,true,'Late rejection cannot change a stopped presentation');
let currentSound='on';const changedPreference=createIntroMusic({window:{...audioWindow,localStorage:{getItem:()=>currentSound}}});
currentSound='off';changedPreference.resetPreference();assert.equal(changedPreference.enabled,false,'Replay reads the current global sound setting');
changedPreference.setEnabled(true);changedPreference.resetPreference();assert.equal(changedPreference.enabled,false,'A local override ends with this presentation');

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
for(const [time,scene] of [[3999,0],[4000,1],[8000,2],[13000,3],[18000,4]]){now=time;timeline.frame();assert.equal(frames.at(-1).scene,scene)}
now=19000;timeline.pause();const paused=timeline.elapsed;now+=60000;timeline.frame();assert.equal(timeline.elapsed,paused,'Background/reading time is excluded');
timeline.resume();now+=1000;timeline.frame();assert.equal(timeline.elapsed,20000);
assert.ok(frames.at(-1).passage>0&&frames.at(-1).passage<1);
now+=4000;timeline.frame();timeline.frame();timeline.start();assert.equal(finishes,1,'One completion only');
assert.equal(INTRO_DURATION,24000);assert.deepEqual(INTRO_SCENES.map(s=>s.text),[
 "Le ciel s'est assombri.","Les constellations sommeillent dans l'ombre.",'Une dernière lueur peut encore les éveiller.','Chaque énigme résolue rendra une étoile au ciel.','À toi de réveiller les étoiles.'
]);
assert.deepEqual(INTRO_SCENES.map(scene=>scene.start),[0,4000,8000,13000,18000]);
const welcomeSource=fs.readFileSync(new URL('../src/ui/first-welcome.js',import.meta.url),'utf8');
assert.ok(welcomeSource.indexOf('class=\"intro-story\"')<welcomeSource.indexOf('class=\"intro-play\"'),'Watch story comes first');
assert.match(welcomeSource,/else story\.focus\(\)/,'Watch story gets initial focus');
const welcomeCss=fs.readFileSync(new URL('../src/ui/first-welcome.css',import.meta.url),'utf8');
assert.match(welcomeCss,/\.first-welcome \.intro-story\{background:#a9eef5/,'Watch story is primary');
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
