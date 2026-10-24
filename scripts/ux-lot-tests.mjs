import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
function context({completed=true,available=true,legacy=null}={}){
 const quests=[{id:'old-91',ordinal:1,legacyIndex:70},{id:'inserted-a',ordinal:2,legacyIndex:legacy},{id:'tail',ordinal:3,legacyIndex:92}];
 const progress={solved:{70:1},shards:7,badges:{kept:true}},calls=[];
 const c={activeQuest:()=>quests[0],canonicalQuestList:()=>quests,questIsCompleted:(_p,id)=>id==='old-91'&&completed,
  lumenProgress:progress,canonicalQuestAvailable:()=>available,questIsAccessible:()=>available,
  socialChallenge:null,learningReplayActive:()=>false,startCanonicalQuest:q=>calls.push(q.id),startReplay:i=>calls.push(i),
  canonicalActiveQuest:null,levelIndex:70,replayMode:true,loadPuzzle:()=>calls.push('load'),refreshJourney:()=>calls.push('refresh')};
 vm.createContext(c);for(const name of ['completedQuestSuccessor','advanceCompletedQuest'])vm.runInContext(functionSource(source,name),c);
 return {c,quests,progress,calls};
}
test('completed quest uses catalogue order including inserted stable quests without granting progress',()=>{
 const {c,progress,calls}=context(),before=JSON.stringify(progress);
 assert.equal(c.completedQuestSuccessor().id,'inserted-a');c.advanceCompletedQuest();assert.deepEqual(calls,['inserted-a']);assert.equal(JSON.stringify(progress),before);
});
test('historical successor can have a nonconsecutive persistence ID',()=>{
 const {c,calls}=context({legacy:88});c.advanceCompletedQuest();assert.equal(c.levelIndex,88);assert.deepEqual(calls,['load','refresh']);assert.equal(c.replayMode,false);
});
test('completed historical successor uses existing replay entry point',()=>{
 const {c,calls}=context({legacy:88});c.questIsCompleted=()=>true;c.advanceCompletedQuest();assert.deepEqual(calls,[88]);
});
for(const reason of ['incomplete','locked','end','unknown','challenge','lesson'])test('no completed navigation for '+reason,()=>{
 const {c,quests,calls,progress}=context(),before=JSON.stringify(progress);
 if(reason==='incomplete')c.questIsCompleted=()=>false;
 if(reason==='locked')c.canonicalQuestAvailable=()=>false;
 if(reason==='end')quests.splice(1);
 if(reason==='unknown')c.activeQuest=()=>({id:'unknown'});
 if(reason==='challenge')c.socialChallenge={};
 if(reason==='lesson')c.learningReplayActive=()=>true;
 c.advanceCompletedQuest();assert.deepEqual(calls,[]);assert.equal(JSON.stringify(progress),before);
});
test('click rechecks live access rather than a rendered stale decision',()=>{
 const {c,calls}=context();assert(c.completedQuestSuccessor());c.canonicalQuestAvailable=()=>false;c.advanceCompletedQuest();assert.deepEqual(calls,[]);
});
test('completed shortcut disappears once replay starts, pauses or celebrates',()=>{
 const {c}=context(),elements=new Map();let attempt={state:'READY'};
 Object.assign(c,{attemptEngine:{snapshot:()=>attempt},ATTEMPT_STATES:{READY:'READY',RUNNING:'RUNNING',PAUSED:'PAUSED'},celebrated:false,
  learningQuestActive:()=>false,attemptMode:()=> 'replay',document:{getElementById(id){if(!elements.has(id))elements.set(id,{});return elements.get(id)}}});
 vm.runInContext(functionSource(source,'updateAttemptUI'),c);
 c.updateAttemptUI();assert.equal(elements.get('completedQuestNext').hidden,false);
 for(const state of ['RUNNING','PAUSED','COMPLETED']){attempt={state};c.updateAttemptUI();assert.equal(elements.get('completedQuestNext').hidden,true)}
 attempt={state:'READY'};c.celebrated=true;c.updateAttemptUI();assert.equal(elements.get('completedQuestNext').hidden,true);
});
