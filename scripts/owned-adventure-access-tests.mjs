import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT_PACKS,contentMapModel} from '../src/campaign/content.js';
import {canonicalQuestList,canonicalCampaignQuestDecision} from '../src/campaign/canonical-quests.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {resolveCanonicalQuest,nextCanonicalQuest} from '../src/campaign/playable-navigation.js';
import {createCloudPersistence} from '../src/persistence/cloud.js';
import {extendedQuestLimit} from '../src/campaign/extended-boundary.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';

const quests=canonicalQuestList();
const fresh=()=>({catalogueOrigin:currentCatalogueOrigin,solved:{},canonicalQuestState:{},shards:7,xp:31,performances:{},future:{keep:true}});
const context=id=>({entitlements:[{entitlement:id,source:'purchase'}],signedIn:true,cloudReady:true,entitlementsState:'ready'});
const complete=(p,q)=>{if(q.legacyIndex!==null)p.solved[q.legacyIndex]=1;else p.canonicalQuestState[q.id]={solved:true,badges:{speed:true}}};

for(const id of ['real-adventure-04','real-adventure-06'])test(`#783 ${id}: ownership opens its first quest, then only its own sequence`,()=>{
 const own=quests.filter(q=>q.packId===id),p=fresh(),before=JSON.stringify(p),c=context(id);
 assert.equal(canonicalCampaignQuestDecision(own[0],p,c).status,'ready');
 assert.equal(resolveCanonicalQuest(own[0].ordinal,c.entitlements,p).status,'ready','Canonical navigation/direct-entry resolver shares the rule');
 if(own[0].legacyIndex!==null)assert(extendedQuestLimit(c.entitlements,p)>own[0].legacyIndex,'The runtime must not clamp this quest to an earlier locked pack');
 assert.equal(canonicalCampaignQuestDecision(own[1],p,c).status,'prerequisite');
 assert.equal(canonicalCampaignQuestDecision(own[7],p,c).status,'prerequisite');
 assert.equal(JSON.stringify(p),before,'Opening an owned Adventure grants no completion/reward');
 complete(p,own[0]);
 assert.equal(canonicalCampaignQuestDecision(own[1],p,c).status,'ready');
 assert.equal(canonicalCampaignQuestDecision(own[7],p,c).status,'prerequisite');
 const other=quests.find(q=>q.packId==='real-adventure-03');
 assert.equal(canonicalCampaignQuestDecision(other,p,c).status,'pack-locked');
 for(let device=0;device<3;device++)assert.equal(resolveCanonicalQuest(own[1].ordinal,c.entitlements,JSON.parse(JSON.stringify(p))).status,'ready');
});

test('#783 default resume skips an unowned unfinished Adventure for a later owned one',()=>{
 const p=fresh();for(const q of quests.filter(q=>q.packId===CONTENT_PACKS[0].id))complete(p,q);
 const id='real-adventure-06',c=context(id);
 const next=nextCanonicalQuest(p.solved,p.canonicalQuestState,c.entitlements,p);
 assert.equal(next.status,'ready');assert.equal(next.quest.id,quests.find(q=>q.packId===id).id);
});

test('#783 missing rights remain denied and verification is distinct from a genuine lock',()=>{
 const q=quests.find(q=>q.packId==='real-adventure-04'),p=fresh();
 assert.equal(resolveCanonicalQuest(q.ordinal,[],p).status,'locked');
 assert.equal(canonicalCampaignQuestDecision(q,p,{signedIn:true,cloudReady:true,entitlementsState:'loading'}).status,'entitlements-loading');
 assert.equal(canonicalCampaignQuestDecision(q,p,{signedIn:true,cloudReady:true,entitlementsState:'error'}).status,'entitlements-unavailable');
 const pack=contentMapModel([],{progress:p,entitlementsState:'loading'}).skies.flatMap(s=>s.packs).find(p=>p.id===q.packId);
 assert.equal(pack.accessible,false);assert.equal(pack.accessStatus,'loading');assert.match(pack.lockReason,/Vérification/);
});

function fixture(){
 let handler=async()=>({data:[],error:null});const refresh=[];
 const model={lumenUser:{id:'owner'},lumenSupabase:{rpc:(...args)=>handler(...args)},lumenEntitlements:[],lumenProgress:fresh()};
 const api=createCloudPersistence(model,{refreshJourney:()=>refresh.push(model.lumenEntitlementsState)},{console:{warn(){}},setTimeout});
 return {model,api,refresh,set handler(h){handler=h}};
}
test('#783 delayed server rights, reload and transient errors never change the save or revoke confirmed ownership',async()=>{
 const f=fixture(),before=JSON.stringify(f.model.lumenProgress);let finish;
 f.handler=()=>new Promise(r=>finish=r);const loading=f.api.loadEntitlements();
 assert.equal(f.model.lumenEntitlementsState,'loading');
 finish({data:[{entitlement:'real-adventure-04',source:'purchase'}],error:null});await loading;
 assert.equal(f.model.lumenEntitlementsState,'ready');
 f.handler=async()=>({data:null,error:{code:'NETWORK'}});await f.api.loadEntitlements();
 assert.equal(f.model.lumenEntitlementsState,'error');assert.equal(f.model.lumenEntitlements[0].entitlement,'real-adventure-04');
 assert.equal(JSON.stringify(f.model.lumenProgress),before);
 const device=fixture();device.handler=async()=>({data:structuredClone(f.model.lumenEntitlements),error:null});await device.api.loadEntitlements();
 assert.equal(device.model.lumenEntitlementsState,'ready');assert.deepEqual(device.model.lumenEntitlements,f.model.lumenEntitlements);
});
test('#783 an old owner response and an older same-owner read cannot overwrite current server rights',async()=>{
 const f=fixture();let release;
 f.handler=()=>new Promise(r=>release=r);const old=f.api.loadEntitlements();
 f.model.lumenUser={id:'other'};f.handler=async()=>({data:[{entitlement:'real-adventure-06'}],error:null});await f.api.loadEntitlements();
 release({data:[{entitlement:'real-adventure-04'}],error:null});await old;
 assert.deepEqual(f.model.lumenEntitlements,[{entitlement:'real-adventure-06'}]);
 f.handler=()=>new Promise(r=>release=r);const stale=f.api.loadEntitlements();
 f.handler=async()=>({data:[],error:null});await f.api.loadEntitlements();release({data:[{entitlement:'real-adventure-06'}],error:null});await stale;
 assert.deepEqual(f.model.lumenEntitlements,[],'A newer successful server read may revoke a right');
});

test('#783 an initial stale cache, thrown transport error and client change cannot confer rights',async()=>{
 const f=fixture();f.model.lumenEntitlements=[{entitlement:'real-adventure-04'}];
 f.handler=async()=>{throw new TypeError('offline')};await f.api.loadEntitlements();
 assert.deepEqual(f.model.lumenEntitlements,[]);assert.equal(f.model.lumenEntitlementsState,'error');
 f.handler=async()=>({data:[{entitlement:'real-adventure-06'}],error:null});await f.api.loadEntitlements();
 let release;f.handler=()=>new Promise(r=>release=r);const old=f.api.loadEntitlements();
 f.model.lumenSupabase={rpc:async()=>({data:[],error:null})};await f.api.loadEntitlements();
 release({data:[{entitlement:'real-adventure-06'}],error:null});await old;
 assert.deepEqual(f.model.lumenEntitlements,[]);
 f.model.lumenUser=null;await f.api.loadEntitlements();assert.equal(f.model.lumenEntitlementsState,'idle');
});

test('#783 purchase Explore targets the purchased constellation only after rights finish loading',()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8'),calls=[];
 const ctx={qaActive:false,lumenEntitlementsState:'loading',canonicalQuestList,CONTENT_PACKS,document:{},purchaseThanksModel:x=>x,
 showPurchaseThanks:(_d,_m,{onExplore})=>onExplore(),openJourneyMap:(focus,options)=>calls.push({focus,options})};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'thankForPurchase'),ctx);
 ctx.thankForPurchase('real-adventure-04');assert.equal(calls.length,0);
 ctx.lumenEntitlementsState='error';ctx.thankForPurchase('real-adventure-04');assert.equal(calls.length,0);
 ctx.lumenEntitlementsState='ready';ctx.thankForPurchase('real-adventure-04');
 assert.equal(calls[0].focus,true);assert.equal(calls[0].options.detail,true);
 assert.equal(calls[0].options.constellationId,quests.find(q=>q.packId==='real-adventure-04').constellationId);
});
