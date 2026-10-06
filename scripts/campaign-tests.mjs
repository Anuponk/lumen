import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {functionSource} from './source-tools.mjs';
import {CAT,LEVELS} from '../src/campaign/catalogue.js';
import * as data from '../src/campaign/data.js';
import * as campaign from '../src/campaign/progression.js';

const baseline='dcd9f3c872e623541be698edc212b64589d3b164';
const source=(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8'})).replace(/\r/g,'');
const declarations=Object.keys(data).map(name=>{
 const start=source.indexOf('const '+name+'=');
 return source.slice(start,source.indexOf(';',start)+1);
}).join('\n');
const legacyNames=['sequentialCount','constellationGridRange','chapterForGrid','milestoneFor','skyStarsForGrid','bonusChallengeFor','challengeFor','constellationCheckpoint','constellationStateForEarned','starsAwardedForGrid','normalizeSequentialProgress','solvedCount','exactSkyScoreForSolvedPrefix','ensureSkyScore','skyStarsEarned','challengeRewardKeys','constellationProgress','constellationLitAt','awards' ];
const context={};vm.createContext(context);
vm.runInContext(declarations+'\n'+source.slice(source.indexOf('const CAT='),source.indexOf('const COLORS='))+'\n'+legacyNames.map(name=>functionSource(source,name)).join('\n')+'\nvar lumenProgress,hintUsesThisGame=0,autoUsedThisGame=false,mistakesThisGame=0;function activeGameSeconds(){return 42}function saveLumenProgress(){}',context);
const plain=value=>JSON.parse(JSON.stringify(value));
const total=Object.keys(data.CAMPAIGN_SIZE_SCHEDULE).length;
const legacyCAT=plain(vm.runInContext('CAT',context));
for(const [size,legacyPuzzles] of Object.entries(legacyCAT)){
 assert.deepEqual(plain(CAT[size].slice(0,legacyPuzzles.length)),legacyPuzzles,'Historical catalogue changed for '+size+'x'+size);
}
assert.deepEqual(plain(LEVELS),plain(vm.runInContext('LEVELS',context)));
for(const name of Object.keys(data)){
 if(name==='CAMPAIGN_SIZE_SCHEDULE'||name==='SKY_TARGET')continue;
 if(name==='CONSTELLATION_QUESTS')continue;
 const old=plain(vm.runInContext(name,context));
 const next=['CAMPAIGN6_ORDER','CONSTELLATIONS','CONSTELLATION_GRID_COUNTS'].includes(name)?data[name].slice(0,old.length):data[name];
 assert.deepEqual(plain(next),old,'Historical data changed: '+name);
}
// #94 deliberately extends the campaign; its original 100 quest assignments
// must remain identical to the audited schedule immediately before wave 2.
const preWave=execFileSync('git',['show','8041bdc373d53a11f90ace0e741c499e4ccad6ce:src/campaign/data.js'],{encoding:'utf8'});
const frozen={};vm.createContext(frozen);vm.runInContext(preWave.replaceAll('export const ','var '),frozen);
for(let i=0;i<100;i++)assert.deepEqual(data.CAMPAIGN_SIZE_SCHEDULE[i],plain(frozen.CAMPAIGN_SIZE_SCHEDULE[i]),'Historical quest changed: '+(i+1));
for(let index=0;index<100;index++)for(const name of ['chapterForGrid','milestoneFor','skyStarsForGrid','bonusChallengeFor','challengeFor'])assert.deepEqual(plain(campaign[name](index)),plain(context[name](index)),name+' changed');
let progress;const live=campaign.createCampaign(()=>progress,()=>{},()=>({hintUsesThisGame:0,autoUsedThisGame:false,mistakesThisGame:0,activeGameSeconds:()=>42}));
for(const solved of [{},{0:1},{0:1,1:1,3:1},Object.fromEntries(Array.from({length:100},(_,i)=>[i,1]))]){
 progress={solved:structuredClone(solved),badges:{},stars:{},performances:{}};
 context.lumenProgress=structuredClone(progress);
 for(const name of ['normalizeSequentialProgress','solvedCount','exactSkyScoreForSolvedPrefix','ensureSkyScore','skyStarsEarned','challengeRewardKeys','constellationProgress','awards']){
  const old=context[name](),next=live[name]();
  if(name==='constellationProgress'&&Object.keys(solved).length===100){
   assert.equal(old.index,11);assert.equal(old.lit,old.count);
   assert.equal(next.index,12);assert.equal(next.lit,0,'Completed historical sky leads to the first extension constellation');
  }else assert.deepEqual(next===undefined?next:plain(next),old===undefined?old:plain(old),name+' changed');
  if(name==='awards'&&Object.keys(solved).length===100)delete context.lumenProgress.badges.master;
  assert.deepEqual(plain(progress),plain(context.lumenProgress),'Persisted contract changed');
 }
 }
console.log(JSON.stringify({baseline,catalogueEntries:Object.values(CAT).flat().length,historicalQuests:100,quests:total,savedProgressFixtures:4,results:'historical rewards/data preserved; extension and finale covered'}));

assert.equal(campaign.campaignQuestCount(),total);
assert.equal(campaign.isCampaignFinalQuest(total-1),true);
assert.equal(campaign.isCampaignFinalQuest(99),false);
assert.equal(campaign.isCampaignComplete(Object.fromEntries(Array.from({length:total},(_,i)=>[i,1]))),true);
assert.equal(campaign.isCampaignComplete(Object.fromEntries(Array.from({length:total-1},(_,i)=>[i,1]))),false);
assert.equal(campaign.isCampaignComplete({...Object.fromEntries(Array.from({length:total},(_,i)=>[i,1])),42:0}),false);

{
 const expected={66:["7",16],68:["8",8],72:["7",19],75:["8",7],78:["7",15],79:["8",10],83:["8",6],85:["7",18],90:["8",9],95:["8",11],98:["7",17],100:["8",5]};
 for(const [quest,pair] of Object.entries(expected))assert.deepEqual(data.CAMPAIGN_SIZE_SCHEDULE[Number(quest)-1],pair,"Late-game difficulty schedule Q"+quest);
 const refs=Object.values(data.CAMPAIGN_SIZE_SCHEDULE).map(([size,index])=>size+"/"+(size==="6"?data.CAMPAIGN6_ORDER[index]:index));
 assert.equal(new Set(refs).size,total,"Campaign must keep unique puzzle references");
 assert.equal(refs.slice(0,100).filter(x=>x.startsWith("7/")).length,20);
 assert.equal(refs.slice(0,100).filter(x=>x.startsWith("8/")).length,12);
}

assert.equal(data.SKY_TARGET,data.CONSTELLATIONS.reduce((sum,c)=>sum+c.count,0));
let earned=0;
for(let ci=0;ci<data.CONSTELLATIONS.length;ci++){
 const {start,count,quests}=campaign.constellationGridRange(ci);
 const awards=quests.map(quest=>campaign.skyStarsForGrid(quest));
 assert(awards.every(value=>Number.isInteger(value)&&value>0));
 assert.equal(awards.reduce((sum,value)=>sum+value,0),data.CONSTELLATIONS[ci].count,'Every constellation earns exactly its displayed stars');
 earned+=data.CONSTELLATIONS[ci].count;
 const solvedThroughConstellation=Object.fromEntries(Array.from({length:Math.max(...quests)+1},(_,i)=>[i,1]));
 progress={solved:solvedThroughConstellation,badges:{master:1},skyScore:150,skyHistoryVersion:4};
 assert.equal(live.exactSkyScoreForSolvedPrefix(),earned);
 if(start>=100){assert.equal(live.skyStarsEarned(),earned,'Previously capped extension saves recover their earned stars');assert.equal(progress.badges.master,1,'Historical Mastery remains earned');}
}
assert.equal(earned,data.SKY_TARGET);
for(const count of [0,99,100,101,total-1,total]){
 let saves=0;
 progress={solved:Object.fromEntries(Array.from({length:count},(_,i)=>[i,1])),badges:{historical:1,master:1},performances:{99:{version:3,badges:{mastery:true}}},historyBackup:{42:1}};
 const api=campaign.createCampaign(()=>progress,()=>saves++,()=>({}));
 const before=structuredClone(progress),exact=api.exactSkyScoreForSolvedPrefix();
 api.ensureSkyScore();assert.equal(progress.skyScore,exact);assert.equal(saves,1);
 api.ensureSkyScore();assert.equal(saves,1,'Repeated restoration is idempotent');
 for(const key of ['solved','badges','performances','historyBackup'])assert.deepEqual(progress[key],before[key]);
 api.awards();assert.equal(progress.badges.master,1,'Already-earned campaign badges are never revoked');
 assert.equal(campaign.starsAwardedForGrid(Math.max(0,count-1),false,true),0,'Replay cannot farm sky stars');
}
progress={solved:{0:1},badges:{},skyScore:10,skyHistoryVersion:4};
assert.equal(live.skyStarsEarned(),10,'Valid previously stored rewards are preserved');

// Exercise actual content/progression modules with hypothetical appended
// constellations, so another expansion cannot reintroduce fixed ceilings.
const withoutModules=source=>source.replace(/^import .*;\r?$/gm,'').replaceAll('export ','');
for(const [questCount,starCount] of [[1,4],[2,7],[3,12],[10,14]]){
 const additions=`CONSTELLATIONS.push({name:"Future fixture",count:${starCount}});CONSTELLATION_GRID_COUNTS.push(${questCount});CONSTELLATION_QUESTS.push(Array.from({length:${questCount}},(_,i)=>${total}+i));for(let i=0;i<${questCount};i++)CAMPAIGN_SIZE_SCHEDULE[${total}+i]=["6",0];`;
 const expanded=fs.readFileSync('src/campaign/data.js','utf8').replace('export const SKY_TARGET=',additions+'export const SKY_TARGET=');
 const fixture={};vm.createContext(fixture);
 vm.runInContext([expanded,fs.readFileSync('src/campaign/content.js','utf8'),fs.readFileSync('src/campaign/progression.js','utf8')].map(withoutModules).join('\n'),fixture);
 assert.equal(fixture.campaignQuestCount(),total+questCount);
 assert.equal(fixture.isCampaignFinalQuest(total+questCount-1),true);
 assert.equal(fixture.isCampaignFinalQuest(total-1),false);
 assert.equal(fixture.baseQuestId(total+questCount),null);
 assert.equal(fixture.chapterForGrid(total+questCount-1),data.CONSTELLATIONS.length);
 const rewards=Array.from({length:questCount},(_,i)=>fixture.skyStarsForGrid(total+i));
 assert.equal(rewards.reduce((sum,value)=>sum+value,0),starCount);
 const history={solved:Object.fromEntries(Array.from({length:total+questCount},(_,i)=>[i,1])),badges:{},skyScore:data.SKY_TARGET,skyHistoryVersion:4};
 const api=fixture.createCampaign(()=>history,()=>{},()=>({}));
 assert.equal(api.skyStarsEarned(),data.SKY_TARGET+starCount);
 assert.equal(api.constellationProgress().lit,starCount);
}
