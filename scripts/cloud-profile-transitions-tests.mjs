import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {applyLegacyVictory,legacyVictoryRules} from '../src/campaign/legacy-victory.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {CLOUD_PROFILE_FIELDS,cloudSafelyCoversLocal,reconcileDominantLocalProfile,reconcileCompatibleCloudProfiles,installCloudProfileLocally,sameCloudProfile} from '../src/persistence/cloud-profile.js';
const flags=['autonomySeen','fullBadgeIntroSeen','autoCrossUnlockSeen','speedBadgeIntroSeen'];
const base=()=>({solved:{0:1},historyBackup:{0:1},noHint:{},badges:{},stars:{},performances:{},canonicalQuestState:{},daily:{},challenges:{},shards:3,xp:15,skyScore:1,skyHistoryVersion:4});
function fixture(local,initial,{race=false,readFailure=false,protectedLegacy=false}={}){
 const raw=JSON.stringify(local),records=new Map([['lumenProgressV1',raw]]),calls=[];
 let server=structuredClone(initial);
 const storage={get length(){return records.size},key:i=>[...records.keys()][i],getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,String(v))};
 const projection=p=>Object.fromEntries(['solved','stars','challenges','noHint','autonomousWins','performances'].map(k=>[k,p[k]??null]));
 const client={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='lumen_cas_profile'){
   assert([...records.values()].includes(raw));
   assert([...records.values()].some(v=>sameCloudProfile(JSON.parse(v),initial)));
   if(race||!sameCloudProfile(server,args.p_expected))return {data:false};
   if(protectedLegacy&&(!sameCloudProfile(projection(server),projection(args.p_payload))||server.legacyVictoryRevision!==args.p_payload.legacyVictoryRevision))return {error:{code:'22023',message:'legacy command required'}};
   server=structuredClone(args.p_payload);return {data:true};
  }
  if(name==='lumen_restore_profile')return readFailure?{error:{message:'offline'}}:{data:structuredClone(server)};
  throw Error(name);
 }};
 async function hydrate(){
  const local=JSON.parse(storage.getItem('lumenProgressV1'));
  let resolution={status:'cloud_dominant',profile:server};
  if(!cloudSafelyCoversLocal(local,server)){
   resolution=await reconcileDominantLocalProfile(client,storage,server);
   if(resolution.status==='blocked'&&['missing_cloud_achievements','mutable_balance','mutable_ledger'].includes(resolution.reason))resolution=await reconcileCompatibleCloudProfiles(client,storage,server);
  }
  if(!['cloud_dominant','reconciled','identical'].includes(resolution.status))return resolution;
  const profile=resolution.profile??server;
  if(!cloudSafelyCoversLocal(JSON.parse(storage.getItem('lumenProgressV1')),profile))return {status:'blocked',reason:'not_covered'};
  installCloudProfileLocally(storage,profile);return {status:'ready',profile};
 }
 return {raw,records,storage,client,calls,hydrate,get server(){return server}};
}
for(const flag of flags){
 test(`hydration retains local tutorial ${flag} when cloud otherwise covers the save`,async()=>{
  const local={...base(),[flag]:1},f=fixture(local,base());
  assert.equal(cloudSafelyCoversLocal(local,f.server),false,'A restore must not erase an introduction acknowledgement');
  const result=await f.hydrate();assert.equal(result.status,'ready');assert.equal(result.profile[flag],1);
  assert.deepEqual(result.profile,{...base(),[flag]:1});assert.deepEqual(f.calls,['lumen_cas_profile','lumen_restore_profile']);
  assert.equal((await f.hydrate()).status,'ready');assert.equal(f.calls.length,2);
 });
 test(`dominant local achievements plus tutorial ${flag} reach compatible reconciliation`,async()=>{
  const local={...base(),[flag]:1};local.solved[1]=1;local.historyBackup[1]=1;
  const f=fixture(local,base()),result=await f.hydrate();
  assert.equal(result.status,'ready');assert.equal(result.profile[flag],1);assert.equal(result.profile.solved[1],1);
 });
}

// Cross product of old/new command cursors, both device directions and every
// tutorial flag. The command-protected projection remains unchanged.
for(const flag of flags)for(const revision of [undefined,0,1,2])for(const seenOnCloud of [false,true]){
 test(`transition ${flag}, cursor ${revision??'absent'}, seen on ${seenOnCloud?'cloud':'device'}`,async()=>{
  const local=base(),cloud={...base(),legacyVictoryRevision:2};
  if(revision!==undefined)local.legacyVictoryRevision=revision;
  (seenOnCloud?cloud:local)[flag]=1;
  const f=fixture(local,cloud,{protectedLegacy:true}),result=await f.hydrate();
  assert.equal(result.status,'ready');assert.equal(result.profile[flag],1);assert.equal(result.profile.legacyVictoryRevision,2);
  const expected={...cloud,[flag]:1};assert.deepEqual(result.profile,expected);
  assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),expected);
  assert.equal((await f.hydrate()).status,'ready');
  const device2=fixture(base(),f.server,{protectedLegacy:true});
  const restored=await device2.hydrate();assert.equal(restored.status,'ready');assert.deepEqual(restored.profile,expected);
 });
}
for(const reverse of [false,true]){
 test(`V2/V3 summary and tutorial migration, reverse=${reverse}`,async()=>{
  const local=base(),cloud=base();
  const old={version:2,attempts:1,stars:1,badges:{autonomy:true,mastery:true},bestTime:55,time:55};
  const current={version:3,attempts:3,stars:2,badges:{speed:true},bestTime:40,time:40};
  local.performances[0]=structuredClone(reverse?current:old);cloud.performances[0]=structuredClone(reverse?old:current);
  local.fullBadgeIntroSeen=1;
  const f=fixture(local,cloud),result=await f.hydrate();assert.equal(result.status,'ready');
  const p=result.profile.performances[0];assert.equal(p.version,3);assert.equal(p.attempts,3);assert.equal(p.bestTime,40);
  assert.equal(p.badges.mastery,true);assert.equal(p.badges.speed,true);assert.equal(result.profile.fullBadgeIntroSeen,1);
  assert.equal(result.profile.xp,15);assert.equal(result.profile.shards,3);
 });
}
for(const failure of [{race:true},{readFailure:true}]){
 test(`transition retains both originals on ${Object.keys(failure)[0]}`,async()=>{
  const f=fixture({...base(),autonomySeen:1},base(),failure);
  await assert.rejects(f.hydrate());assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);
  assert([...f.records.keys()].some(k=>k.startsWith('lumenBeforeCloudReconcileLocal_')));
  assert([...f.records.keys()].some(k=>k.startsWith('lumenBeforeCloudReconcileRemote_')));
 });
}
test('command-protected local wins are refused with the exact pending intention preserved',async()=>{
 const cloud={...base(),legacyVictoryRevision:2},local={...base(),autonomySeen:1};local.solved[1]=1;
 const f=fixture(local,cloud,{protectedLegacy:true});
 const key='lumenLegacyVictoryOutboxV2:fixture:operation';f.records.set(key,'immutable-pending-facts');
 await assert.rejects(f.hydrate());assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);
 assert.equal(f.storage.getItem(key),'immutable-pending-facts');assert.deepEqual(f.server,cloud);
});
for(const bad of ['yes',2,{},[]]){
 test(`invalid tutorial shape ${JSON.stringify(bad)} stays blocked`,async()=>{
  const f=fixture({...base(),speedBadgeIntroSeen:bad},base());
  const result=await f.hydrate();assert.equal(result.status,'blocked');assert.equal(result.reason,'invalid_intro_flag');assert.equal(f.calls.length,0);
 });
}
test('future fields, unsupported sky schema and conflicting receipts still hold reconciliation',async()=>{
 for(const extra of [{unknownReceipt:'pending'},{skyHistoryVersion:999}]){
  const f=fixture({...base(),...extra,autonomySeen:1},base()),result=await f.hydrate();
  assert.equal(result.status,'blocked');assert.equal(result.reason,'unclassified_field');assert.equal(f.calls.length,0);
 }
});
// Discovery is deliberately bounded: literal JS profile writes and actual
// catalogue-derived guest victory output. Dynamic SQL is audited separately.
function sourceFields(source){
 return [...source.matchAll(/(?:lumenProgress|getProgress\(\)|progress)\.([A-Za-z_][A-Za-z_0-9]*)\s*(?:\?\?=|\|\|=|=(?!=)|\+\+|\+=)/g)].map(m=>m[1]);
}
test('every discovered literal profile producer declares ownership and reconciliation',()=>{
 const observed=new Set();
 for(const folder of ['campaign','persistence','ui'])for(const file of readdirSync(new URL(`../src/${folder}/`,import.meta.url))){
  if(!file.endsWith('.js'))continue;
  const source=readFileSync(new URL(`../src/${folder}/${file}`,import.meta.url),'utf8');
  for(const field of sourceFields(source))observed.add(field);
 }
 for(const field of observed)assert(Object.hasOwn(CLOUD_PROFILE_FIELDS,field),`Unclassified producer: ${field}`);
 assert(observed.size>15);
 assert.deepEqual(sourceFields('lumenProgress.futureServerCursor=1'),['futureServerCursor']);
 for(const [field,policy] of Object.entries(CLOUD_PROFILE_FIELDS)){
  assert(policy.owner,field);assert(['achievement','catalogue','revision','legacy_balance','ledger','intro','equal'].includes(policy.reconcile),field);
  assert(Object.isFrozen(policy));
 }
});
test('all catalogue-derived legacy victory outputs retain declared fields',()=>{
 const facts={seconds:40,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-19',qualifiedAt:'2026-10-19T10:00:00.000Z'};
 for(const rule of legacyVictoryRules()){
  const p=base();applyLegacyVictory(p,rule.index,facts);
  for(const field of Object.keys(p))assert(Object.hasOwn(CLOUD_PROFILE_FIELDS,field),`Victory ${rule.questId}: ${field}`);
 }
});
// Scan only outer arguments of the audited SQL profile-assignment shape. This
// is a tripwire for new server fields, not a general PostgreSQL parser.
function sqlProfileFields(source){
 const fields=new Set();
 for(const match of source.matchAll(/v_profile\s*:=\s*v_profile\s*\|\|\s*jsonb_build_object\(/g)){
  let depth=1,quoted=false,part='',args=[];
  for(let i=match.index+match[0].length;i<source.length;i++){
   const c=source[i];
   if(c==="'"){
    part+=c;
    if(quoted&&source[i+1]==="'"){part+=source[++i];continue}
    quoted=!quoted;continue;
   }
   if(!quoted){
    if(c==='(')depth++;
    if(c===')'){depth--;if(depth===0){args.push(part.trim());break}}
    if(c===','&&depth===1){args.push(part.trim());part='';continue}
   }
   part+=c;
  }
  assert.equal(depth,0,'Unclosed profile assignment: update SQL field scanner');
  for(let i=0;i<args.length;i+=2){
   const key=args[i];
   if(/^'[A-Za-z_][A-Za-z_0-9]*'$/.test(key))fields.add(key.slice(1,-1));
   else assert.equal(key,'v_name','New dynamic SQL profile producer needs explicit coverage');
  }
 }
 return fields;
}
test('SQL command profile assignments cannot introduce unclassified fields',()=>{
 const directory=new URL('../supabase/migrations/',import.meta.url),observed=new Set();
 for(const file of readdirSync(directory)){
  if(!file.endsWith('.sql'))continue;
  for(const field of sqlProfileFields(readFileSync(new URL(file,directory),'utf8')))observed.add(field);
 }
 assert(observed.has('legacyVictoryRevision'));assert(observed.has('skyHistoryVersion'));
 for(const field of observed)assert(Object.hasOwn(CLOUD_PROFILE_FIELDS,field),`Unclassified server field: ${field}`);
 const probe=sqlProfileFields("v_profile:=v_profile||jsonb_build_object('futureServerCursor',1,'daily',jsonb_build_object('nested',2));");
 assert.deepEqual([...probe],['futureServerCursor','daily']);assert(!Object.hasOwn(CLOUD_PROFILE_FIELDS,'futureServerCursor'));
});
// Every declared field needs a behavioral transition fixture, even if its
// category already exists. A new allowlist entry alone cannot satisfy this gate.
test('each declared profile field has an executable reconciliation policy fixture',async()=>{
 const cases={
  solved:[{0:1,1:1},{0:1},{0:1,1:1}],historyBackup:[{0:1,1:1},{0:1},{0:1,1:1}],
  badges:[{first:1},{},{first:1}],stars:[{'sky2-1':1},{},{'sky2-1':1}],noHint:[{0:1},{},{0:1}],
  performances:[{0:{version:3,attempts:1,badges:{speed:true}}},{},{0:{version:3,attempts:1,badges:{speed:true}}}],
  canonicalQuestState:[{q:{solved:true,badges:{speed:true},stars:2}},{},{q:{solved:true,badges:{speed:true},stars:2}}],
  autonomousWins:[1,0,1],legacyAdventureAccess:[['earned-adventure'],[],['earned-adventure']],
  catalogueOrigin:[undefined,currentCatalogueOrigin,currentCatalogueOrigin],legacyVictoryRevision:[undefined,2,2],
  shards:[9,3,9],xp:[20,15,20],skyScore:[2,1,2],
  daily:[{dates:{'2026-10-19':1}},{},{dates:{'2026-10-19':1}}],challenges:[{'sky2-1':1},{},{'sky2-1':1}],
  autonomySeen:[1,undefined,1],fullBadgeIntroSeen:[1,0,1],autoCrossUnlockSeen:[true,false,1],speedBadgeIntroSeen:[false,true,1],
  skyHistoryVersion:[3,4,'blocked']
 };
 assert.deepEqual(Object.keys(cases).sort(),Object.keys(CLOUD_PROFILE_FIELDS).sort(),'New fields require a policy fixture');
 for(const [field,[left,right,expected]] of Object.entries(cases)){
  const local=base(),cloud=base();
  if(left===undefined)delete local[field];else local[field]=structuredClone(left);
  if(right===undefined)delete cloud[field];else cloud[field]=structuredClone(right);
  const f=fixture(local,cloud),result=await reconcileCompatibleCloudProfiles(f.client,f.storage,cloud);
  if(expected==='blocked'){assert.equal(result.status,'blocked',field);assert.equal(f.calls.length,0);continue}
  assert(['reconciled','cloud_dominant'].includes(result.status),field+': '+result.reason);
  assert.deepEqual(result.profile[field],expected,field);
 }
});
test('coverage cannot discard a local unknown field before reconciliation is considered',async()=>{
 const local={...base(),futureReceipt:{operation:'pending'}},f=fixture(local,base());
 assert.equal(cloudSafelyCoversLocal(local,f.server),false);
 const result=await f.hydrate();assert.equal(result.status,'blocked');assert.equal(f.calls.length,0);
 assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);
});
test('coverage respects the declared equal-only score-schema marker',async()=>{
 const f=fixture({...base(),skyHistoryVersion:3},base());
 assert.equal(cloudSafelyCoversLocal(JSON.parse(f.raw),f.server),false);
 const result=await f.hydrate();assert.equal(result.status,'blocked');assert.equal(f.calls.length,0);
 assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);
});
