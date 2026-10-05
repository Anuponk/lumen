import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {functionSource} from './source-tools.mjs';
import {createAnalytics,attemptAnalyticsProperties} from '../src/analytics/events.js';
const baseline='dcd9f3c872e623541be698edc212b64589d3b164';
const source=(process.argv[2]?fs.readFileSync(process.argv[2],'utf8'):execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8'})).replace(/\r/g,'');
async function fixture(search,legacy,offline){
 const values=new Map(),calls=[],warnings=[];let sequence=0,client=null;
 const environment={localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},crypto:{randomUUID:()=>++sequence===1?'anonymous-id':'session-id'},location:{search},console:{warn:(...args)=>warnings.push(String(args[0]))}};
 let api,context;
 if(legacy){context={...environment,URLSearchParams,lumenSupabase:null};vm.createContext(context);vm.runInContext(functionSource(source,'lumenId')+'\nconst lumenAnonymousId=lumenId("lumenAnonymousIdV1");const lumenSessionId=crypto.randomUUID();\n'+functionSource(source,'trackLumenEvent')+'\n'+functionSource(source,'captureReferral'),context);api=context}
 else api=createAnalytics(()=>client,environment);
 await api.trackLumenEvent('ignored_before_client');
 client={async rpc(name,args){calls.push({name,args});if(offline)throw Error('fixture offline');return {error:null}}};
 if(legacy)context.lumenSupabase=client;
 await api.trackLumenEvent('session_start',null,{standalone:false});await api.trackLumenEvent('puzzle_start',3,{sector:0});await api.trackLumenEvent('hint_used',3);api.captureReferral();await new Promise(resolve=>setTimeout(resolve,0));
 return {values:[...values].filter(([key])=>key!=="lumenAnalyticsSessionV2"),calls:JSON.parse(JSON.stringify(calls)),warnings:[...warnings]};
}
for(const search of ['', '?ref=friend_123','?ref=%3Cbad%3E%20reference','?ref='+('x'.repeat(100))])for(const offline of [false,true])assert.deepEqual(await fixture(search,false,offline),await fixture(search,true,offline));
console.log(JSON.stringify({baseline,fixtures:8,identityStorage:'identical',eventsAndPayloads:'identical',referralSanitization:'identical',liveWrites:false}));


{
 const props=attemptAnalyticsProperties({
  attempt:{attemptId:"a-1",mode:"campaign",activeDuration:12345,resetCount:2,assistanceUsed:true,mistakeCommitted:false,qualifying:true},
  questIndex:19,gridSize:7,constellationIndex:2,constellationName:"Orion",solvedCount:19,questAttemptNumber:3,guidedEnabled:true,autoMarkingEnabled:false
 },{outcome:"success"});
 assert.deepEqual(props,{
  attempt_id:"a-1",attempt_mode:"campaign",run_index:3,active_seconds:12.3,reset_count:2,assistance_used:true,mistake_committed:false,qualifying:true,
  quest_index:19,grid_size:7,constellation_index:2,constellation_name:"Orion",progress_solved:19,quest_attempt_number:3,guided_enabled:true,auto_marking_enabled:false,outcome:"success"
 });
}

const cockpitMigration=fs.readFileSync('supabase/migrations/20261005_lumen_admin_cockpit.sql','utf8');
assert.match(cockpitMigration,/analytics_cockpit/,'cockpit RPCs must be capability protected');
assert.match(cockpitMigration,/attempt_completed/,'canonical attempt completion must be accepted');
assert.match(cockpitMigration,/p_puzzle_id between 1 and 10000/,'analytics must not retain historical 100 quest ceiling');
assert.match(cockpitMigration,/p_puzzle_id,null,greatest/,'feedback backend must discard board state');
assert.match(cockpitMigration,/revoke all on function public\.lumen_admin_cockpit\(integer\) from public,anon/,'anonymous users must not read cockpit');
assert.match(fs.readFileSync('src/analytics/events.js','utf8'),/lumenAnalyticsSessionV2/,'analytics session must survive reload inside inactivity window');
