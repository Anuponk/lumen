import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {buildIncidentInvestigation,incidentAlerts} from '../src/ui/incident-investigation.js';
import {registeredPlayers} from '../src/ui/cockpit-sessions.js';
import {analyticsPlayers} from '../src/ui/analytics-dashboard.js';
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

const nodes=new Map(),calls=[];let directoryRows,timelineData,supportOptions,lookupOptions,adventureOptions,dashboardInput;
const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',value:7,insertAdjacentHTML(){}});return nodes.get(id)},querySelectorAll(){return []}};
const context={document,t:key=>key,renderAnalyticsEngagement:()=>{},renderVersionHealth:()=>{},renderCriticalIncidents:()=>{},Date,Intl,Math,Number,String,adminEsc:String,adminNumber:String,registeredPlayers,analyticsPlayers,
 buildAnalyticsDashboard:input=>{dashboardInput=input;return input},renderAnalyticsDashboard:()=>{},adminCanonicalCatalogueTree:()=>[],
 mountSupportDossier:(_host,options)=>{supportOptions=options},
 mountSupportLookup:(_host,options)=>{lookupOptions=options},
 mountAdventureAccess:(_host,options)=>{adventureOptions=options},CONTENT_PACKS:[{id:'base-real-sky',access:'included'},{id:'real-adventure-02',access:'locked'}],
 rememberSessionExpansion:()=>{},renderPlayerDirectory:(_host,rows)=>{directoryRows=rows},renderPlayerSessions:(_host,data)=>{timelineData=data},
 lumenUser:{id:'fixture-admin'},hasInternalCapability:()=>true,buildIncidentInvestigation,incidentAlerts,renderIncidentInvestigation:()=>{},
 lumenSupabase:{async rpc(name,args){calls.push(name);if(name==='lumen_admin_quest_metrics')return {data:{friction:[{stable_quest_id:'new-grid',quest_ordinal:91,started:4,completed:1}],funnel:[],current_players:{'u:actor':91}}};if(name==='lumen_admin_accounts')return {data:[{user_id:'actor',current_quest:1,nickname:' ',email:'sans.pseudo@example.invalid'}]};if(name==='lumen_admin_recent_players')return {data:[{player_key:'a:guest',player_type:'anonymous',display_name:'Joueur 3E8B'},{player_key:'u:actor',player_type:'authenticated',current_quest:1}]};if(name==='lumen_admin_player_observations'){assert.deepEqual(Array.from(args.p_player_keys),['u:actor']);return {data:{players:{}}}}if(name==='lumen_admin_player_sessions')return {data:{analytics:[{event_name:'attempt_started',quest_ordinal:91,puzzle_id:null}],diagnostics:[]}};return {data:name==='lumen_admin_cockpit'?{}:[]}}}};
vm.createContext(context);
for(const fn of ['adminEventLabel','adminAlerts','loadAdminTimeline','loadAdminCockpit'])vm.runInContext(functionSource(src,fn),context);
await context.loadAdminCockpit();
assert.equal(lookupOptions.owner,'fixture-admin');assert.equal(lookupOptions.authorized(),true,'Reference lookup uses the current guarded cockpit scope');
assert.match(nodes.get('adminFriction').innerHTML,/Q91/,'Stable quests appear by their visible ordinal');
// The extracted loader now delegates DOM rendering. Assert the actual boundary;
// cockpit-browser.mjs separately checks Q91 in the real native renderer.
assert.equal(directoryRows[0].current_quest,91,'Latest stable play replaces dormant numeric position');
assert.equal(directoryRows.length,1,'Anonymous rows never reach the directory or metadata request');
assert.equal(directoryRows[0].display_name,'sans.pseudo@example.invalid','Directory uses the account email when nickname is blank');
assert(!nodes.get('adminAlerts').innerHTML.includes('Q91'),'Product friction does not appear as a technical incident');assert.match(nodes.get('adminAccounts').innerHTML,/>91<\/td>/);
assert.equal(dashboardInput.quests.friction[0].quest_ordinal,91,'Quest evidence reaches the dedicated dashboard');
await context.loadAdminTimeline('u:actor');
assert.equal(timelineData.analytics[0].quest_ordinal,91);
assert.equal(supportOptions.owner,'fixture-admin');assert.equal(supportOptions.target,'actor');assert.equal(supportOptions.authorized(),true);
// #724: the Adventure access panel receives the same owner, player and revocable authorization, and the catalogue packs.
assert.equal(adventureOptions.owner,'fixture-admin');assert.equal(adventureOptions.target,'actor');assert.equal(adventureOptions.authorized(),true);assert.equal(adventureOptions.packs,context.CONTENT_PACKS);
assert(calls.includes('lumen_admin_quest_metrics')&&calls.includes('lumen_admin_player_sessions'));
const timeline=nodes.get('adminTimeline');timeline.cockpitPlayer='a:guest';timeline.cockpitRequest={};
assert.equal(supportOptions.authorized(),false,'Changing the selected request revokes support actions');
assert.equal(adventureOptions.authorized(),false,'#724: changing the selected player revokes Adventure actions');
await context.loadAdminCockpit();assert.equal(timeline.cockpitPlayer,null);assert.equal(timeline.cockpitRequest,null);
assert.match(timeline.textContent,/inscrit/,'A previously selected anonymous timeline is cleared');

// Product analytics is optional. Its outage must not hide operational evidence.
const originalRpc=context.lumenSupabase.rpc;
let renderedHealth=null;
context.renderIncidentInvestigation=(_host,data)=>{renderedHealth=data};
context.lumenSupabase.rpc=async(name,args)=>name==='lumen_admin_cockpit'
 ?{error:{message:'Product service unavailable'}}
 :name==='lumen_admin_sync_health'
 ?{data:{failures:3,affected_players:2,stalled_players:1,diagnostics:{sample:'technical evidence',timeline:[],signatures:[]}}}
 :originalRpc(name,args);
await context.loadAdminCockpit();
assert.equal(renderedHealth?.sample,'technical evidence','Technical diagnostics remain usable when the product aggregate fails');
context.lumenUser={id:'different-admin'};
assert.equal(lookupOptions.authorized(),false,'#776: an account switch revokes existing reference lookup actions');
