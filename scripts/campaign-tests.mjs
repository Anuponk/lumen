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
assert.deepEqual(plain(CAT),plain(vm.runInContext('CAT',context)));
assert.deepEqual(plain(LEVELS),plain(vm.runInContext('LEVELS',context)));
for(const name of Object.keys(data))assert.deepEqual(plain(data[name]),plain(vm.runInContext(name,context)),'Data changed: '+name);
for(let index=0;index<100;index++)for(const name of ['chapterForGrid','milestoneFor','skyStarsForGrid','bonusChallengeFor','challengeFor'])assert.deepEqual(plain(campaign[name](index)),plain(context[name](index)),name+' changed');
let progress;const live=campaign.createCampaign(()=>progress,()=>{},()=>({hintUsesThisGame:0,autoUsedThisGame:false,mistakesThisGame:0,activeGameSeconds:()=>42}));
for(const solved of [{},{0:1},{0:1,1:1,3:1},Object.fromEntries(Array.from({length:100},(_,i)=>[i,1]))]){
 progress={solved:structuredClone(solved),badges:{},stars:{},performances:{}};
 context.lumenProgress=structuredClone(progress);
 for(const name of ['normalizeSequentialProgress','solvedCount','exactSkyScoreForSolvedPrefix','ensureSkyScore','skyStarsEarned','challengeRewardKeys','constellationProgress','awards']){
  const old=context[name](),next=live[name]();
  assert.deepEqual(next===undefined?next:plain(next),old===undefined?old:plain(old),name+' changed');
  assert.deepEqual(plain(progress),plain(context.lumenProgress),'Persisted contract changed');
 }
 }
console.log(JSON.stringify({baseline,catalogueEntries:Object.values(CAT).flat().length,quests:100,savedProgressFixtures:4,results:'identical'}));
