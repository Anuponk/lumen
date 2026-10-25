import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const extract=(name,next)=>source.slice(source.indexOf('function '+name+'('),source.indexOf('\nfunction '+next,source.indexOf('function '+name+'(')));
test('switching between authorised administrators clears the previous scope immediately',()=>{
 const nodes={adminTools:{},adminUnlimitedShards:{parentElement:{}},adminCockpitOpen:{},qaAccountTools:{},adminCockpit:{hidden:false,cockpitOwner:'admin-a'},adminTimeline:{cockpitPlayer:'u:old',replaceChildren(){this.cleared=true}}};
 for(const id of ['adminDiagnosticIncidents','adminPlayers','adminAccounts'])nodes[id]={replaceChildren(){this.cleared=true}};
 const context=vm.createContext({syncAdministrationMenu:()=>{},hasInternalCapability:()=>true,unlimitedShardsEnabled:()=>false,
  qaActive:false,lumenUser:{id:'admin-b'},document:{getElementById:id=>nodes[id]}});
 vm.runInContext(extract('updateAdminTools','cloudReconciliationMessage')+';updateAdminTools()',context);
 assert.equal(nodes.adminCockpit.hidden,true);assert.equal(nodes.adminTimeline.cleared,true);
 assert.equal(nodes.adminTimeline.cockpitPlayer,null);assert.equal(nodes.adminAccounts.cleared,true);
});
test('timeline refusals are visible, and stale refusals never replace the next selection',async()=>{
 let reject;const wait=new Promise((_,r)=>reject=r),box={innerHTML:''};
 const context=vm.createContext({lumenUser:{id:'admin'},lumenSupabase:{rpc:()=>wait},hasInternalCapability:()=>true,
  rememberSessionExpansion:()=>{},document:{getElementById:()=>box},renderPlayerSessions:()=>{throw Error('rejected transport rendered data')}});
 vm.runInContext('async '+extract('loadAdminTimeline','adminAlerts')+';globalThis.load=loadAdminTimeline',context);
 const pending=context.load('u:old');box.cockpitRequest={};box.innerHTML='new selection';reject(Error('network failed'));
 await pending;assert.equal(box.innerHTML,'new selection');
 context.lumenSupabase={rpc:async()=>{throw Error('Bearer PRIVATE')}};await context.load('u:current');
 assert.match(box.innerHTML,/indisponible/);assert(!box.innerHTML.includes('PRIVATE'));
});
test('explicit Auth, confirmed domain receipts and waiting devices remain independent across resume',async()=>{
 const {playerDates}=await import('../src/ui/cockpit-dates.js');
 const player={last_seen:'2026-10-23T10:00:00Z'},proof={auth_at:'2026-10-22T10:00:00Z',domains:{canonical:null,legacy:null,wallet:'2026-10-23T09:00:00Z'},state:'pending'};
 const opening=playerDates({...player,last_seen:'2026-10-25T05:00:00Z'},proof);
 assert.equal(opening.auth,proof.auth_at);assert.equal(opening.domains.wallet,proof.domains.wallet);
 const reconnect=playerDates(player,{...proof,auth_at:'2026-10-25T06:00:00Z'});assert.notEqual(reconnect.auth,opening.auth);
 assert.equal(reconnect.domains.wallet,opening.domains.wallet);
 const resumed=playerDates(player,{...proof,domains:{...proof.domains,wallet:'2026-10-25T07:00:00Z'},state:'confirmed'});
 assert.equal(resumed.auth,opening.auth);assert.notEqual(resumed.domains.wallet,opening.domains.wallet);assert.equal(resumed.state,'observed');
});
