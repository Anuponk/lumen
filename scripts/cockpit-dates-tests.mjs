import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('dates keep Auth, activity, durable commits and pending observations independent', async()=>{
 const {playerDates}=await import('../src/ui/cockpit-dates.js');
 const source={last_seen:'2026-10-25T05:00:00Z',updated_at:'2026-10-25T06:00:00Z'};
 const proof={auth_at:'2026-10-23T10:00:00Z',domains:{wallet:'2026-10-24T10:00:00Z'},state:'pending'};
 const before=JSON.stringify({source,proof});
 const result=playerDates(source,proof);
 assert.equal(result.activity,source.last_seen);assert.equal(result.auth,proof.auth_at);
 assert.equal(result.domains.wallet,proof.domains.wallet);assert.equal(result.state,'pending');
 assert.equal(JSON.stringify({source,proof}),before);
 assert.equal(playerDates({...source,last_seen:'2026-10-25T07:00:00Z'},proof).auth,proof.auth_at);
 assert.deepEqual(playerDates(source).domains,{});assert.equal(playerDates(source).auth,undefined);
 assert.equal(playerDates(source,{...proof,state:'confirmed'}).state,'observed');
});
test('dates show qualified absence, local timezone, full time, UTC and signal age',async()=>{
 const {datePresentation}=await import('../src/ui/cockpit-dates.js');
 assert.equal(datePresentation(undefined).text,'Indisponible');
 assert.equal(datePresentation(null).text,'Jamais observée');
 assert.equal(datePresentation('not-a-date').text,'Indisponible');
 const options={now:Date.parse('2026-10-25T06:30:00Z'),timeZone:'Europe/Paris'};
 const p=datePresentation('2026-10-25T05:30:00Z',options);
 assert.match(p.text,/06:30:00/);assert.match(p.title,/05:30:00.*UTC/);assert.match(p.title,/60 min/);
 assert.match(datePresentation('2026-10-25T05:30:00Z',{...options,timeZone:'America/New_York'}).text,/01:30:00/);
});
test('timeline never publishes a stale account result or an older player selection',async()=>{
 const source=readFileSync('src/ui/game-screen.js','utf8');
 const start=source.indexOf('async function loadAdminTimeline('),end=source.indexOf('\nfunction adminAlerts',start);
 let resolve;const pending=new Promise(r=>resolve=r);const box={innerHTML:''};
 const context=vm.createContext({lumenUser:{id:'admin'},lumenSupabase:{rpc:()=>pending},hasInternalCapability:()=>true,rememberSessionExpansion:()=>{},document:{getElementById:()=>box}});
 vm.runInContext(source.slice(start,end)+';globalThis.load=loadAdminTimeline',context);
 const loading=context.load('u:player');context.lumenUser={id:'other'};box.innerHTML='new account';
 resolve({data:[],error:null});await loading;assert.equal(box.innerHTML,'new account');
});
