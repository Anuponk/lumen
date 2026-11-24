import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createDailyPushClient,setupDailyPushSettings} from '../src/ui/daily-push.js';

const scope='https://lumen.example/src/ui/notifications/';
const key=Buffer.alloc(65,4).toString('base64url');
function fixture({permission='granted',available=true}={}){
 const data=new Map(),calls=[],local=[],owner={id:'account-a'};
 let registered=false,sub=null,promptCount=0,permissionState=permission;
 const registration={scope,active:{state:'activated',postMessage(message,[port]){local.push(message.enabled);port.postMessage(true);port.close()}},
  pushManager:{getSubscription:async()=>sub,subscribe:async options=>{
   assert.equal(options.userVisibleOnly,true);
   assert.equal(options.applicationServerKey.length,65);
   sub={options,toJSON:()=>({endpoint:'https://fcm.googleapis.com/example'}),unsubscribe:async()=>{sub=null;return true}};
   return sub;
  }},
 };
 const win={
  navigator:{serviceWorker:{getRegistration:async()=>registered?registration:{scope:'https://lumen.example/'},
   register:async(path,options)=>{assert.equal(path,'/src/ui/daily-push-worker.js');assert.equal(options.scope,'/src/ui/notifications/');registered=true;return registration}}},
  PushManager:{},Notification:{get permission(){return permissionState},requestPermission:async()=>{promptCount++;return permissionState}},
  crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},
  location:{origin:'https://lumen.example'},atob,MessageChannel,setTimeout,clearTimeout,
 };
 let enabled=false,revision=0,deviceRegistered=false;
 const client=createDailyPushClient({win,getOwner:()=>owner.id,locale:()=> 'fr',
  storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},
  rpc:async(name,args)=>{
   assert.equal(name,'lumen_daily_push_v1');assert.equal(args.p_expected_user_id,owner.id);
   calls.push(args);
   if(args.p_action==='enable'){enabled=deviceRegistered=true;revision++}
   if(args.p_action==='disable'){enabled=deviceRegistered=false;revision++}
   return {data:{version:1,available,dailyEnabled:enabled,revision,reminderHour:18,deviceRegistered,vapidPublicKey:available?key:null}};
  }
 });
 return {client,local,calls,owner,promptCount:()=>promptCount};
}

test('settings read no subscription or browser permission until an explicit enable',async()=>{
 const f=fixture();
 const state=await f.client.read();
 assert.equal(state.dailyEnabled,false);
 assert.equal(f.promptCount(),0);
 assert.deepEqual(f.local,[]);
 assert.equal(await f.client.enable(state),true);
 assert.equal(f.promptCount(),1);
 assert.equal(f.calls.at(-1).p_confirm_daily,true);
 assert.equal(f.calls.at(-1).p_expected_revision,0);
 assert.equal(f.calls.at(-1).p_locale,'fr');
 assert.deepEqual(f.local,[true]);
 assert.equal((await f.client.read()).deviceRegistered,true);
 await f.client.disable(await f.client.read());
 assert.deepEqual(f.local,[true,false]);
 assert.equal(f.calls.at(-1).p_action,'disable');
});

test('no permission prompt for an unavailable feature and no enrollment after denial',async()=>{
 const off=fixture({available:false});
 assert.equal(await off.client.enable(await off.client.read()),false);
 assert.equal(off.promptCount(),0);
 const denied=fixture({permission:'denied'});
 assert.equal(await denied.client.enable(await denied.client.read()),false);
 assert.deepEqual(denied.calls.map(x=>x.p_action),['read']);
 assert.deepEqual(denied.local,[]);
});

test('a different signed-in account stops the prior device transport',async()=>{
 const f=fixture();
 const state=await f.client.read();
 await f.client.enable(state);
 f.owner.id='account-b';
 await f.client.ownerChanged();
 assert.deepEqual(f.local,[true,false]);
 assert.equal(await f.client.enable(state),false);
 assert(!f.calls.some(x=>x.p_expected_user_id==='account-b'));
});

test('result invitation is contextual, deferrable and silent by default',async()=>{
 const f=fixture();
 const elements=new Map();
 const settings=setupDailyPushSettings({client:f.client,t:k=>k,document:{getElementById(id){
  if(!elements.has(id))elements.set(id,{hidden:false});
  return elements.get(id);
 }}});
 await settings.presentResult(false);
 assert.equal(elements.get('dailyPushOffer').hidden,true);
 assert.equal(f.calls.length,0);
 await settings.presentResult(true);
 assert.equal(elements.get('dailyPushOffer').hidden,false);
 elements.get('dailyPushOfferLater').onclick();
 await settings.presentResult(true);
 assert.equal(elements.get('dailyPushOffer').hidden,true);
 assert.equal(f.promptCount(),0);
 assert.equal(f.calls.length,1);
});

test('dedicated service worker fails closed and opens only the current daily route',async()=>{
 const handlers={},events=[],entries=new Map();
 const context={
  self:{location:{origin:'https://lumen.example'},addEventListener:(name,cb)=>{handlers[name]=cb},
   registration:{showNotification:(...args)=>events.push(args)},clients:{openWindow:url=>events.push(url)}},
  caches:{open:async()=>({put:(k,v)=>entries.set(k,v),match:k=>entries.get(k),delete:k=>entries.delete(k)})},
  URL,Response,Date
 };
 vm.createContext(context);
 vm.runInContext(readFileSync(new URL('../src/ui/daily-push-worker.js',import.meta.url),'utf8'),context);
 const send=async (name,event)=>{let task;handlers[name]({...event,waitUntil:p=>{task=p}});await task};
 const payload={type:'daily-challenge',day:'2026-11-25',expiresAt:Date.now()+100_000,title:'Daily Challenge',body:'A new grid is available.',url:'https://outside.example/'};
 const push=data=>send('push',{data:{json:()=>data}});
 await push(payload);assert.equal(events.length,0);
 const mark=enabled=>send('message',{data:{type:'LUMEN_DAILY_PUSH_LOCAL',enabled},ports:[{postMessage(){}}]});
 await mark(true);
 await push({...payload,expiresAt:0});assert.equal(events.length,0);
 await push(payload);assert.equal(events[0][1].tag,'lumen-daily-2026-11-25');
 await send('notificationclick',{notification:{close(){},data:events[0][1].data}});
 assert.equal(events[1],'https://lumen.example/?daily=1');
 await mark(false);await push(payload);assert.equal(events.length,2);
});
