import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {originQuests,publishedCatalogueQuests} from '../src/campaign/catalogue-origin.js';
import {buildQuestDefinitions} from '../src/campaign/quest-definition.js';
import {catalogueQuestDecision,questCompleted} from '../src/campaign/catalogue-access.js';

test('published catalogue is the schedule, including variable constellation sizes',()=>{
 const records=[{id:'a',ordinal:1,legacyIndex:0,packId:'p',constellationId:'c'},
  {id:'b',ordinal:2,legacyIndex:null,packId:'p',constellationId:'c'},
  {id:'c',ordinal:3,legacyIndex:1,packId:'p',constellationId:'d'}];
 const packs=[{id:'p',constellationIds:['c','d']}],constellations=[{id:'c',packId:'p',questIndices:[0]},{id:'d',packId:'p',questIndices:[1]}];
 const actual=buildQuestDefinitions(records,packs,constellations);
 assert.equal(actual.length,records.length);assert.deepEqual(actual.map(q=>q.position),[1,2,1]);
 assert.deepEqual(actual.map(({position,...q})=>q),records);
 for(const k of [1,3,11]){
  const added=Array.from({length:k},(_,i)=>({id:'added-'+i,ordinal:records.length+i+1,legacyIndex:null,packId:'new-pack',constellationId:'new-constellation'}));
  const grown=buildQuestDefinitions([...records,...added],[...packs,{id:'new-pack',constellationIds:['new-constellation']}],[...constellations,{id:'new-constellation',packId:'new-pack'}]);
  assert.deepEqual(grown.slice(0,records.length),actual,'Growth cannot renumber or reassign existing quests');
  const profile={solved:{0:1,1:1},canonicalQuestState:{b:{solved:true}}},before=JSON.stringify(profile);
  assert.equal(grown.find(q=>!questCompleted(q,profile)).id,added[0].id,'Previously complete save resumes at appended content');
  assert.equal(catalogueQuestDecision(grown[records.length],profile,grown,{packAllowed:true,originQuests:actual}).status,'ready');
  assert.equal(JSON.stringify(profile),before,'Reading appended content cannot mutate badges, history or rewards');
 }
 for(const invalid of [records.map(q=>({...q,id:'duplicate'})),records.map(q=>({...q,ordinal:q.ordinal+1})),records.map(q=>({...q,legacyIndex:0})),records.map(q=>({...q,constellationId:'unknown'}))])assert.throws(()=>buildQuestDefinitions(invalid,packs,constellations));
 assert(Object.isFrozen(actual)&&actual.every(Object.isFrozen));
});
test('all published IDs, numeric keys, memberships and orders stay byte-for-byte compatible',()=>{
 const all=canonicalQuestList(),published=originQuests({catalogueOrigin:2});
 assert.deepEqual(all.map(({id,ordinal,legacyIndex,packId,constellationId})=>({id,ordinal,legacyIndex,packId,constellationId})),published.map(({id,ordinal,legacyIndex,packId,constellationId})=>({id,ordinal,legacyIndex,packId,constellationId})));
 assert.equal(all.length,publishedCatalogueQuests().length,'Current catalogue has no fixed total');
});
