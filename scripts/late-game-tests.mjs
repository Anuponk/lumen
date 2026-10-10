import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {CAT} from '../src/campaign/catalogue.js';
import {playableQuest} from '../src/campaign/playable-quests.js';
import {CAMPAIGN6_ORDER,CAMPAIGN_SIZE_SCHEDULE} from '../src/campaign/data.js';
import {campaignQuestCount} from '../src/campaign/progression.js';
import {createCloudPersistence} from '../src/persistence/cloud.js';

const total=campaignQuestCount();
assert(total>100,'The extension must have playable quests after quest 100');
const source=fs.readFileSync('src/ui/game-screen.js','utf8');
const controls=new Map();
const context={campaignQuestCount,currentQuestLimit:campaignQuestCount,CAT,playableQuest,CAMPAIGN6_ORDER,CAMPAIGN_SIZE_SCHEDULE,questIsAccessible:()=>true,socialChallenge:null,levelIndex:99,n:0,puz:null,last:{},replayMode:false,lumenProgress:{solved:{}},loads:0,
 accountRequired:()=>false,document:{getElementById:id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id)}},hideSuccess(){},refreshJourney(){}};
vm.createContext(context);
vm.runInContext(functionSource(source,'choose')+'\n'+functionSource(source,'advanceToNextPuzzle')+'\nfunction loadPuzzle(){loads++;choose()}',context);
for(const index of [-1,0,99,100,101,total-1,total+5]){
 context.levelIndex=index;context.choose();
 const expected=Math.max(0,Math.min(index,total-1)),[size,slot]=CAMPAIGN_SIZE_SCHEDULE[expected];
 assert.equal(context.levelIndex,expected);
 assert.equal(context.puz,CAT[size][size==='6'?CAMPAIGN6_ORDER[slot]:slot]);
}
context.levelIndex=99;context.advanceToNextPuzzle();
assert.equal(context.levelIndex,99,'An unsolved quest 100 cannot be skipped');
context.lumenProgress.solved[99]=1;context.advanceToNextPuzzle();
assert.equal(context.levelIndex,100,'Victory on quest 100 loads quest 101');
assert.equal(context.loads,1);
context.levelIndex=99;context.replayMode=true;context.advanceToNextPuzzle();
assert.equal(context.levelIndex,100,'Replay continuation is relative to the played quest');
context.levelIndex=total-1;context.lumenProgress.solved[total-1]=1;
const loads=context.loads;context.advanceToNextPuzzle();
assert.equal(context.levelIndex,total-1);assert.equal(context.loads,loads,'Final quest cannot load beyond the catalogue');

const drawn=[];
context.document.createElement=()=>({getContext:()=>({createLinearGradient:()=>({addColorStop(){}}),fillRect(){},beginPath(){},arc(){},fill(){},strokeRect(){},fillText:text=>drawn.push(text)})});
context.wrapCanvasText=()=>{};context.formatDuration=()=>"0:00";context.location={host:"fixture"};
vm.runInContext(functionSource(source,'shareCardCanvas'),context);
for(const size of [total,total+7]){
 context.campaignQuestCount=()=>size;context.levelIndex=size-1;drawn.length=0;
 context.shareCardCanvas({kicker:"Fixture",main:"Win",detail:"",pos:1,total:1,secs:0,run:{noHint:true}});
 assert(drawn.includes(`Quête ${size} / ${size}`),'Shared results use the dynamic campaign total');
}
context.campaignQuestCount=campaignQuestCount;

for(const count of [0,99,100,101,total,total+2]){
 const calls=[],badges={historical:1},rows=Array.from({length:count},(_,i)=>({puzzle_id:i+1}));
 const model={lumenUser:{id:'fixture'},lumenSupabase:{async rpc(name){calls.push(name);return {data:rows,error:null}}},lumenProgress:{solved:{},badges,performances:{},historyBackup:{}},levelIndex:0};
 // Deliberately omit the count hook once to exercise the real content fallback.
 const hooks={...(count===101?{}:{campaignQuestCount}),exactSkyScoreForSolvedPrefix:()=>150,saveLumenProgress(){},refreshJourney(){},init(){}};
 const cloud=createCloudPersistence(model,hooks,{console,document:{}});
 await cloud.cloudMergeProgress();
 const restored=Math.min(count,total);
 assert.equal(model.sequentialSolvedCount,restored);
 assert.equal(model.levelIndex,Math.min(restored,total-1),'Cloud restore uses the current campaign boundary');
 assert.equal(Object.keys(model.lumenProgress.solved).length,restored);
 assert.equal(model.lumenProgress.badges,badges,'Restoring extended history preserves player badges');
 assert.deepEqual(calls,['lumen_get_progress']);
}

// Regression #128: stale cloud progress at quest 100 must not erase newer
// local progress in Adventure 2. The union is normalized back to a prefix,
// then missing cloud rows are uploaded.
{
 const calls=[],saved=[],cloudRows=Array.from({length:100},(_,i)=>({puzzle_id:i+1}));
 const localSolved=Object.fromEntries(Array.from({length:103},(_,i)=>[i,1]));
 const model={
  lumenUser:{id:'fixture'},
  lumenSupabase:{async rpc(name,args){calls.push(name);if(name==='lumen_get_progress')return {data:cloudRows,error:null};if(name==='lumen_save_progress'){saved.push(args.p_puzzle_id);return {data:null,error:null}}return {data:null,error:null}}},
  lumenProgress:{solved:{...localSolved},historyBackup:{...localSolved},badges:{},performances:{}},
  levelIndex:100
 };
 const hooks={campaignQuestCount,exactSkyScoreForSolvedPrefix:()=>157,saveLumenProgress(){},refreshJourney(){},init(){}};
 const cloud=createCloudPersistence(model,hooks,{console,document:{}});
 await cloud.cloudMergeProgress();
 assert.equal(model.sequentialSolvedCount,103,'Stale cloud cannot roll Adventure 2 back to quest 101');
 assert.equal(model.levelIndex,103,'Reload resumes after the newest solved quest');
 assert.equal(Object.keys(model.lumenProgress.solved).length,103,'Local Adventure 2 stars/progress remain represented by solved history');
 assert.deepEqual(saved,[101,102,103],'Missing Adventure 2 completions are repaired in cloud');
}

console.log(JSON.stringify({lateGame:true,quests:total,transition100to101:true,replay:true,finalBoundary:true,cloudRestoreFixtures:7,staleCloudMerge:true}));
