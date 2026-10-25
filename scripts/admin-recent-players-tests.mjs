import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {buildIncidentInvestigation,incidentAlerts} from '../src/ui/incident-investigation.js';
const src=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const start=src.indexOf('async function loadAdminCockpit(){');
const end=src.indexOf('function setupAdminCockpit(){',start);
assert.ok(start>=0&&end>start);
const body=src.slice(start,end);
assert.match(body,/rpc\("lumen_admin_recent_players",\{p_limit:250\}\)/);
assert.doesNotMatch(body,/from\("lumen_admin_player_snapshot"\)/);
assert.match(body,/order|players\.map/);
assert.match(body,/playerSnapshot\.error/);
assert.match(body,/adminPlayers/);
console.log('Admin recent players use live activity RPC and expose failures');

const nodes=new Map(),calls=[];let directoryRows,timelineData;
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:7,insertAdjacentHTML(){}});return nodes.get(id)},querySelectorAll(){return []}};
const context={document,Date,Intl,Math,Number,String,adminEsc:String,adminNumber:String,
 rememberSessionExpansion:()=>{},renderPlayerDirectory:(_host,rows)=>{directoryRows=rows},renderPlayerSessions:(_host,data)=>{timelineData=data},
 lumenUser:{id:'fixture-admin'},hasInternalCapability:()=>true,buildIncidentInvestigation,incidentAlerts,renderIncidentInvestigation:()=>{},
 lumenSupabase:{async rpc(name){calls.push(name);if(name==='lumen_admin_quest_metrics')return {data:{friction:[{stable_quest_id:'new-grid',quest_ordinal:91,started:4,completed:1}],funnel:[],current_players:{'u:actor':91}}};if(name==='lumen_admin_accounts')return {data:[{user_id:'actor',current_quest:1}]};if(name==='lumen_admin_recent_players')return {data:[{player_key:'u:actor',current_quest:1}]};if(name==='lumen_admin_player_sessions')return {data:{analytics:[{event_name:'attempt_started',quest_ordinal:91,puzzle_id:null}],diagnostics:[]}};return {data:name==='lumen_admin_cockpit'?{}:[]}}}};
vm.createContext(context);
for(const fn of ['adminEventLabel','adminAlerts','loadAdminTimeline','loadAdminCockpit'])vm.runInContext(functionSource(src,fn),context);
await context.loadAdminCockpit();
assert.match(nodes.get('adminFriction').innerHTML,/Q91/,'Stable quests appear by their visible ordinal');
// The extracted loader now delegates DOM rendering. Assert the actual boundary;
// cockpit-browser.mjs separately checks Q91 in the real native renderer.
assert.equal(directoryRows[0].current_quest,91,'Latest stable play replaces dormant numeric position');
assert.match(nodes.get('adminAlerts').innerHTML,/Q91/);assert.match(nodes.get('adminAccounts').innerHTML,/>91<\/td>/);
await context.loadAdminTimeline('u:actor');
assert.equal(timelineData.analytics[0].quest_ordinal,91);
assert(calls.includes('lumen_admin_quest_metrics')&&calls.includes('lumen_admin_player_sessions'));
