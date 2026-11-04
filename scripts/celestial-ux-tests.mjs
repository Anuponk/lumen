import test from 'node:test';
import assert from 'node:assert/strict';
import {celestialScope,captureCelestialProgress,celestialTransition} from '../src/ui/celestial-progress.js';
import {milkyWaySvg} from '../src/ui/celestial-effects.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
const quests=[{id:'a',ordinal:1,legacyIndex:0,constellationId:'small',packId:'first'},{id:'b',ordinal:2,legacyIndex:null,constellationId:'small',packId:'first'},{id:'c',ordinal:3,legacyIndex:null,constellationId:'large',packId:'first'},{id:'d',ordinal:4,legacyIndex:null,constellationId:'future',packId:'next'}];
function won(ids,badges={}){return {solved:ids.includes('a')?{0:1}:{},performances:{0:{version:3,badges}},canonicalQuestState:Object.fromEntries(ids.filter(id=>id!=='a').map(id=>[id,{solved:true,badges}]))}}
const transition=(ids,id,options={firstCompletion:true},list=quests)=>celestialTransition(captureCelestialProgress(won(ids),list.find(q=>q.id===id),list),won([...ids,id]),list.find(q=>q.id===id),list,options);
test('one priority, independent of quest order and missing badges',()=>{
 assert.equal(transition([],'a').kind,null);
 assert.equal(transition(['b'],'a').kind,'constellation');
 assert.equal(transition(['a','c'],'b').kind,'adventure');
 assert.equal(transition(['a','b','c'],'d').kind,'campaign');
 assert.equal(transition(['a','b'],'b').kind,null);
 assert.equal(transition(['a','c'],'b',{firstCompletion:false}).kind,null,'receipt recovery is not a new visual event');
 assert.equal(transition(['a','c'],'b',{firstCompletion:true,recovered:true}).kind,null);
});
test('catalogue changes cannot manufacture a crossing; empty scopes do not complete',()=>{
 const q=quests[1],before=captureCelestialProgress(won(['a']),q,quests),expanded=[...quests,{...q,id:'inserted',ordinal:5}];
 assert.equal(celestialTransition(before,won(['a','b','inserted']),q,expanded,{firstCompletion:true}).kind,null);
 assert.equal(celestialScope({},[]).ratio,0);assert.equal(celestialScope({},[]).complete,false);
 assert.equal(transition(['a','c'],'b',{firstCompletion:true},[...quests].reverse()).kind,'adventure');
 const old=captureCelestialProgress(won([]),q,quests);
 assert.equal(celestialTransition(old,won(['a','b','c']),q,quests,{firstCompletion:true}).kind,null,'An unrelated remote batch is not the last local completion');
});
test('real badge ratio preserves historical evidence without inferring mastery',()=>{
 const p=won(['a','b'],{autonomy:true,speed:true,noError:true});
 assert.equal(celestialScope(p,quests.slice(0,2)).ratio,.75);
 assert.equal(celestialScope(p,quests.slice(0,2)).badges.mastery,0);
 p.performances[0]={version:1,badges:{mastery:true}};
 assert.equal(celestialScope(p,quests.slice(0,2)).earned,3,'unversioned facts are not qualified awards');
 p.performances[0]={version:2,badges:{mastery:true}};
 assert.equal(celestialScope(p,quests.slice(0,2)).earned,4,'explicit historical Mastery stays earned');
 const extra={...quests[1],id:'more'};assert.equal(celestialScope(p,[...quests.slice(0,2),extra]).ratio,4/12);
});
test('badge acquisition pulses once through a real before/after transition, including replay',()=>{
 const q=quests[1],p=won(['a','b'],{autonomy:true,speed:true,noError:true,mastery:true});delete p.canonicalQuestState.b.badges; p.canonicalQuestState.b.badges={autonomy:true,speed:true,noError:true};
 const before=captureCelestialProgress(p,q,quests);p.canonicalQuestState.b.badges.mastery=true;
 const event=celestialTransition(before,p,q,quests);assert.equal(event.kind,null);assert.equal(event.pulse.full,true);assert.equal(event.pulse.ratio,1);
 assert.equal(celestialTransition(before,p,q,quests,{recovered:true}).pulse,null,'Recovered receipts cannot manufacture a mastery animation');
 assert.equal(celestialTransition(captureCelestialProgress(p,q,quests),p,q,quests).pulse,null,'opening/reloading an acquired state cannot replay');
});
test('pure projections cannot modify a save, reward, wallet or catalogue',()=>{
 const p=won(['a'],{speed:true});p.shards=7;p.wallet={balance:2};const bytes=JSON.stringify(p),catalogue=JSON.stringify(quests);
 const b=captureCelestialProgress(p,quests[0],quests);celestialTransition(b,p,quests[0],quests,{firstCompletion:true});milkyWaySvg('small',.7);
 assert.equal(JSON.stringify(p),bytes);assert.equal(JSON.stringify(quests),catalogue);
 for(const q of canonicalQuestList())assert.equal(celestialScope({},[q]).possible,4,'current eligibility is shared with gameplay');
});
test('dust is deterministic, continuous, bounded, behind the original cyan drawing',()=>{
 assert.equal(milkyWaySvg('x',0),'');
 for(const ratio of [.25,.5,.75,1]){const a=milkyWaySvg('x',ratio);assert.equal(a,milkyWaySvg('x',ratio));assert.equal((a.match(/<circle /g)||[]).length,48);assert(!/NaN|Infinity|crown|Math.random/.test(a))}
 assert.notEqual(milkyWaySvg('x',.51),milkyWaySvg('x',.5));
 assert.notEqual(milkyWaySvg('x',1),milkyWaySvg('y',1));
 const positions=ratio=>[...milkyWaySvg('x',ratio).matchAll(/cx="([^"]+)" cy="([^"]+)"/g)].map(m=>m.slice(1));
 assert.deepEqual(positions(.25),positions(1));
});
test('actual pulse consumer keeps one playhead across repeated renders and isolates owners/catalogues',()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');let now=100;
 const entry={id:'fixture'},pulses=new Map(),current={signature:'same',ratio:1};
 const context={masteryPulses:pulses,constellationMastery:()=>current,lumenUser:{id:'a'},Date:{now:()=>now}};
 vm.createContext(context);vm.runInContext(functionSource(source,'takeMasteryPulse'),context);
 const queue=()=>pulses.set(entry.id,{owner:'a',signature:'same',ratio:1,full:true});
 queue();assert.equal(context.takeMasteryPulse(entry).elapsed,0);now+=400;assert.equal(context.takeMasteryPulse(entry).elapsed,400);
 now+=1200;assert.equal(context.takeMasteryPulse(entry),null);assert.equal(pulses.size,0);
 queue();context.lumenUser={id:'b'};assert.equal(context.takeMasteryPulse(entry),null);
 context.lumenUser={id:'a'};queue();current.signature='grown';assert.equal(context.takeMasteryPulse(entry),null);
});
