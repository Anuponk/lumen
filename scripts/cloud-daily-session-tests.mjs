import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createCloudPersistence} from '../src/persistence/cloud.js';

for(const change of ['account','client','logout'])test(`daily read cannot mutate a new context: ${change}`,async()=>{
 let release,saves=0,renders=0;
 const gate=new Promise(resolve=>release=resolve);
 const profile={solved:{},badges:{},shards:3,daily:{dates:{},rewards:{}}};
 const client={rpc:async name=>{await gate;return {data:name==='lumen_get_daily'?[{play_date:'2026-10-22'}]:[{rewarded_days:{'2026-10-22':1}}]}}};
 const model={lumenUser:{id:'first'},lumenSupabase:client,lumenProgress:profile};
 const api=createCloudPersistence(model,{saveLumenProgress:()=>saves++,renderDaily:()=>renders++},{console:{warn(){}},setTimeout});
 const pending=api.cloudMergeDaily();
 if(change==='account')model.lumenUser={id:'second'};
 if(change==='client')model.lumenSupabase={rpc:client.rpc};
 if(change==='logout')model.lumenUser=null;
 const before=JSON.stringify(profile);release();await pending;
 assert.equal(JSON.stringify(profile),before,'Old daily data must not be installed');
 assert.equal(saves,0);assert.equal(renders,0);
});
