// #1030 LUMEN Premium — daily quota engine (src/campaign/premium-quota.js).
// Server reconciliation and storage rules are proven by
// scripts/fixtures/premium-foundation-1030.sql (canonical-ledger CI).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMERCE_DEFAULTS,normalizeCommerceConfig,localDay,effectiveDay,constellationOrdinals,discoveryQuestIds,
  activationReached,attemptQuotaKind,quotasApply,quotaDecision,createQuotaLedger,QUOTA_STORAGE_PREFIX,QUOTA_KEEP_DAYS
} from '../src/campaign/premium-quota.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),get size(){return m.size},map:m}}
const ON=normalizeCommerceConfig({premiumEnabled:true,quotasEnabled:true,newDaily:3,replayDaily:5});
const at=iso=>Date.parse(iso);

test('defaults are off, undecided and safe against malformed settings',()=>{
  assert.equal(COMMERCE_DEFAULTS.premiumEnabled,false);
  assert.equal(COMMERCE_DEFAULTS.quotasEnabled,false);
  assert.equal(COMMERCE_DEFAULTS.newDaily,null);
  assert.equal(COMMERCE_DEFAULTS.replayDaily,5);
  assert.equal(COMMERCE_DEFAULTS.thresholdConstellation,4);
  const bad=normalizeCommerceConfig({premiumEnabled:'yes',quotasEnabled:1,newDaily:0,replayDaily:-1,thresholdConstellation:99});
  assert.deepEqual(bad,COMMERCE_DEFAULTS);
  assert.deepEqual(normalizeCommerceConfig(null),COMMERCE_DEFAULTS);
  assert.ok(Object.isFrozen(normalizeCommerceConfig({})));
});

test('the real catalogue: three discovery constellations, the fourth starts at quest 31',()=>{
  const quests=canonicalQuestList(),ord=constellationOrdinals(quests);
  const discovery=discoveryQuestIds(quests,4);
  assert.equal(discovery.length,30);
  assert.equal(ord.get(quests[30].id),4);
  assert.equal(quests[30].id,'base-q021','catalogue order, not the numeric suffix, defines the threshold');
  assert.ok(!discovery.includes('base-q021'));
  assert.ok(discovery.includes('planned-real-03-q10'));
  const done=new Set(discovery);
  assert.equal(activationReached({quests,threshold:4,isCompleted:q=>done.has(q.id)}),false,'finishing the 30 discovery quests does not activate');
  done.add('base-q021');
  assert.equal(activationReached({quests,threshold:4,isCompleted:q=>done.has(q.id)}),true,'an already advanced player is activated by progress');
});

test('kind: never won is new (also after an abandon), won before is replay',()=>{
  assert.equal(attemptQuotaKind({wonBefore:false}),'new');
  assert.equal(attemptQuotaKind({wonBefore:true}),'replay');
});

test('who is limited: public launch or QA preview, never Premium',()=>{
  assert.equal(quotasApply({config:COMMERCE_DEFAULTS}),false,'off in production by default');
  assert.equal(quotasApply({config:normalizeCommerceConfig({quotasEnabled:true})}),false,'quotas need the commercial model');
  assert.equal(quotasApply({config:ON}),true);
  assert.equal(quotasApply({config:ON,premium:true}),false);
  assert.equal(quotasApply({config:COMMERCE_DEFAULTS,preview:true}),true,'controlled QA access before launch');
  assert.equal(quotasApply({config:COMMERCE_DEFAULTS,preview:true,premium:true}),false);
});

test('decision: discovery, threshold gesture, exemptions, limits and undecided value',()=>{
  assert.deepEqual(quotaDecision({config:ON,activated:false,thresholdQuest:false}).reason,'discovery');
  const first=quotaDecision({config:ON,activated:false,thresholdQuest:true,kind:'new',used:{new:0,replay:0}});
  assert.equal(first.counted,true);assert.equal(first.activate,true,'the first gesture on the 4th constellation activates durably');
  assert.equal(quotaDecision({config:ON,activated:true,kind:'new',used:{new:2}}).remaining,0);
  const blocked=quotaDecision({config:ON,activated:true,kind:'new',used:{new:3}});
  assert.equal(blocked.allowed,false);assert.equal(blocked.reason,'new_limit');assert.equal(blocked.counted,false);
  assert.equal(quotaDecision({config:ON,activated:true,kind:'replay',used:{replay:4}}).allowed,true);
  assert.equal(quotaDecision({config:ON,activated:true,kind:'replay',used:{replay:5}}).reason,'replay_limit');
  assert.equal(quotaDecision({config:ON,activated:true,kind:'new',used:{new:99},premium:true}).allowed,true);
  assert.equal(quotaDecision({config:ON,activated:true,kind:'new',used:{new:99},exempt:true}).reason,'exempt','daily, duels and tutorial are never limited');
  const undecided=normalizeCommerceConfig({premiumEnabled:true,quotasEnabled:true,newDaily:null});
  const u=quotaDecision({config:undecided,activated:true,kind:'new',used:{new:500}});
  assert.equal(u.allowed,true);assert.equal(u.reason,'unlimited');
  assert.equal(quotaDecision({config:normalizeCommerceConfig({premiumEnabled:true,quotasEnabled:true,replayDaily:0}),activated:true,kind:'replay',used:{replay:0}}).allowed,false);
});

test('ledger: one count per attempt identity (reset and resume never count again)',()=>{
  const storage=memoryStorage();let now=at('2026-12-10T10:00:00Z');
  const l=createQuotaLedger({storage,owner:'u1',now:()=>now,timeZone:'Europe/Paris'});
  assert.equal(l.record({attemptId:'a-1-reset-0',questId:'base-q021',kind:'new'}),'2026-12-10');
  assert.equal(l.record({attemptId:'a-1-reset-0',questId:'base-q021',kind:'new'}),'2026-12-10','same identity after a grid reset');
  assert.deepEqual(l.used(),{new:1,replay:0});
  l.record({attemptId:'a-2-reset-0',questId:'base-q001',kind:'replay'});
  assert.deepEqual(l.used(),{new:1,replay:1});
  assert.ok(storage.map.has(QUOTA_STORAGE_PREFIX+'u1'));
  const other=createQuotaLedger({storage,owner:'u2',now:()=>now,timeZone:'Europe/Paris'});
  assert.deepEqual(other.used(),{new:0,replay:0},'ledgers are per account');
  assert.equal(l.record({attemptId:'',questId:'x',kind:'new'}),null);
  assert.equal(l.record({attemptId:'a-3',questId:'x',kind:'bonus'}),null);
});

test('midnight: a run started before midnight stays on its start day; reset at local midnight',()=>{
  const storage=memoryStorage();let now=at('2026-12-10T22:58:00Z'); // 23:58 Paris
  const l=createQuotaLedger({storage,owner:'u',now:()=>now,timeZone:'Europe/Paris'});
  l.record({attemptId:'late-run',questId:'base-q021',kind:'new'});
  now=at('2026-12-10T23:05:00Z'); // 00:05 Paris, next day
  assert.equal(l.record({attemptId:'late-run',questId:'base-q021',kind:'new'}),'2026-12-10','never imputed twice');
  assert.equal(l.day(),'2026-12-11');
  assert.deepEqual(l.used(),{new:0,replay:0},'a fresh day');
  assert.deepEqual(l.used('2026-12-10'),{new:1,replay:0});
});

test('time zone: automatic update without a double reset (travel and manual changes)',()=>{
  // Paris 20:00 on the 10th, then the device switches to Tokyo (04:00 on the 11th).
  assert.equal(effectiveDay({day:'2026-12-10',tz:'Europe/Paris'},at('2026-12-10T19:00:00Z'),'Asia/Tokyo'),'2026-12-10',
    'no early reset: the previous day zone has not reached midnight');
  assert.equal(effectiveDay({day:'2026-12-10',tz:'Europe/Paris'},at('2026-12-10T23:30:00Z'),'Asia/Tokyo'),'2026-12-11','reset once Paris midnight passed');
  // Going west never goes back to an earlier day (counts already used).
  assert.equal(effectiveDay({day:'2026-12-11',tz:'Asia/Tokyo'},at('2026-12-11T01:00:00Z'),'America/Los_Angeles'),'2026-12-11');
  // Toggling +14h back and forth cannot open a day two steps ahead.
  assert.equal(effectiveDay({day:'2026-12-11',tz:'Europe/Paris'},at('2026-12-11T11:00:00Z'),'Pacific/Kiritimati'),'2026-12-11');
  const storage=memoryStorage();let now=at('2026-12-10T19:00:00Z'),zone='Europe/Paris';
  const l=createQuotaLedger({storage,owner:'t',now:()=>now,timeZone:()=>zone});
  l.record({attemptId:'p1',questId:'q',kind:'new'});
  zone='Asia/Tokyo';
  l.record({attemptId:'t1',questId:'q',kind:'new'});
  assert.deepEqual(l.used(),{new:2,replay:0},'the zone change did not reset the counters');
  now=at('2026-12-11T00:30:00Z');
  assert.equal(l.day(),'2026-12-11');
  l.record({attemptId:'t2',questId:'q',kind:'new'});
  assert.equal(l.snapshot().latest.tz,'Asia/Tokyo','the new day adopts the current zone');
});

test('DST: 25-hour and 23-hour days reset at local midnight',()=>{
  // Europe/Paris leaves summer time on 2026-10-25 (03:00 -> 02:00).
  assert.equal(localDay(at('2026-10-24T21:59:00Z'),'Europe/Paris'),'2026-10-24');
  assert.equal(localDay(at('2026-10-24T22:00:00Z'),'Europe/Paris'),'2026-10-25','midnight CEST');
  assert.equal(localDay(at('2026-10-25T22:59:00Z'),'Europe/Paris'),'2026-10-25','25-hour day');
  assert.equal(localDay(at('2026-10-25T23:00:00Z'),'Europe/Paris'),'2026-10-26','midnight CET');
  // Spring forward 2027-03-28: 23-hour day.
  assert.equal(localDay(at('2027-03-27T23:00:00Z'),'Europe/Paris'),'2027-03-28');
  assert.equal(localDay(at('2027-03-28T21:59:00Z'),'Europe/Paris'),'2027-03-28');
  assert.equal(localDay(at('2027-03-28T22:00:00Z'),'Europe/Paris'),'2027-03-29');
  assert.equal(localDay(at('2026-12-10T12:00:00Z'),'Not/AZone'),'2026-12-10','invalid zone falls back to UTC');
});

test('offline and multi-device reconciliation: pending stays counted, server counts adopted',()=>{
  const storage=memoryStorage();const now=at('2026-12-10T10:00:00Z');
  const l=createQuotaLedger({storage,owner:'m',now:()=>now,timeZone:'UTC'});
  l.record({attemptId:'local-1',questId:'q1',kind:'new'});
  l.record({attemptId:'local-2',questId:'q2',kind:'new'});
  assert.equal(l.pending().length,2,'offline attempts wait for the next sync');
  // Server already holds 3 attempts from another device + local-1 acknowledged.
  l.acknowledge({attemptIds:['local-1'],counts:{day:'2026-12-10',new:4,replay:1}});
  assert.deepEqual(l.used(),{new:5,replay:1},'server count + still pending local attempt');
  assert.deepEqual(l.pending().map(p=>p.attemptId),['local-2']);
  l.acknowledge({attemptIds:['local-2'],counts:{day:'2026-12-10',new:5,replay:1}});
  assert.deepEqual(l.used(),{new:5,replay:1},'no double counting after acknowledgement');
  assert.equal(l.pending().length,0);
  const p=l.pending(1);assert.ok(Array.isArray(p));
});

test('durable activation is monotonic: the earliest wins on both sides',()=>{
  const storage=memoryStorage();const l=createQuotaLedger({storage,owner:'a',now:()=>at('2026-12-10T10:00:00Z'),timeZone:'UTC'});
  assert.equal(l.activate({at:at('2026-12-10T10:00:00Z'),questId:'base-q021'}),true);
  assert.equal(l.activate({at:at('2026-12-10T11:00:00Z'),questId:'base-q022'}),false);
  assert.deepEqual(l.pendingActivation(),{at:'2026-12-10T10:00:00.000Z',questId:'base-q021'});
  l.acknowledge({activatedAt:'2026-12-09T08:00:00.000Z',activationSent:true});
  assert.equal(l.snapshot().activatedAt,'2026-12-09T08:00:00.000Z','another device activated earlier');
  assert.equal(l.pendingActivation(),null);
});

test('bounded local storage and resilience to corrupt or unavailable storage',()=>{
  const storage=memoryStorage();let now=at('2026-12-01T10:00:00Z');
  const l=createQuotaLedger({storage,owner:'b',now:()=>now,timeZone:'UTC'});
  for(let i=0;i<QUOTA_KEEP_DAYS+5;i++){now=at('2026-12-01T10:00:00Z')+i*86400000;l.record({attemptId:'d'+i,questId:'q',kind:'new'});l.acknowledge({counts:{day:l.day(),new:1,replay:0}})}
  assert.equal(Object.keys(l.snapshot().days).length,QUOTA_KEEP_DAYS);
  assert.ok(Object.keys(l.snapshot().server).length<=QUOTA_KEEP_DAYS);
  storage.setItem(QUOTA_STORAGE_PREFIX+'b','{not json');
  assert.deepEqual(l.used(),{new:0,replay:0});
  const broken={getItem(){throw Error('denied')},setItem(){throw Error('full')}};
  const b=createQuotaLedger({storage:broken,owner:'x',now:()=>now,timeZone:'UTC'});
  assert.doesNotThrow(()=>b.record({attemptId:'z1',questId:'q',kind:'new'}));
  assert.deepEqual(b.used(),{new:0,replay:0});
});

// ---- Client commerce state (src/persistence/commerce.js) -------------------------
import {createCommerceClient,premiumSurfaceVisible,COMMERCE_CONFIG_TTL_MS} from '../src/persistence/commerce.js';
import fs from 'node:fs';
function fakeRpc(handlers){const calls=[];const rpc=async(name,args)=>{calls.push({name,args});const h=handlers[name];return h?h(args):{data:null,error:Error('unexpected '+name)}};rpc.calls=calls;return rpc}
function clientWith(handlers,{now=()=>at('2026-12-10T10:00:00Z')}={}){
  const storage=memoryStorage(),ledgers=new Map();
  const ledgerFor=o=>{if(!ledgers.has(o))ledgers.set(o,createQuotaLedger({storage,owner:o,now,timeZone:'UTC'}));return ledgers.get(o)};
  const rpc=fakeRpc(handlers);return {client:createCommerceClient({rpc,ledgerFor,now}),rpc,ledgerFor,storage};
}

test('Free-first: everything off means one cached public read and no account read or sync',async()=>{
  const {client,rpc}=clientWith({lumen_get_commerce_config:()=>({data:{premiumEnabled:false}})});
  await client.refresh({owner:'u1',signedIn:true});
  await client.refresh({owner:'u1',signedIn:true});
  assert.deepEqual(rpc.calls.map(c=>c.name),['lumen_get_commerce_config'],'TTL cache, no state read while off');
  assert.deepEqual(await client.sync({owner:'u1',signedIn:true}),{skipped:'off'});
  assert.ok(COMMERCE_CONFIG_TTL_MS>=3600000);
});

test('launch or QA preview reads the account state once; failures keep confirmed rights',async()=>{
  let fail=false;
  const {client,rpc,ledgerFor}=clientWith({
    lumen_get_commerce_config:()=>fail?{data:null,error:Error('offline')}:{data:{premiumEnabled:true,quotasEnabled:true,newDaily:10}},
    lumen_get_commerce_state:a=>({data:{premium:{active:true,source:'sky_purchase'},preview:false,activatedAt:'2026-12-01T00:00:00Z',counts:{day:a.p_day,new:4,replay:0}}}),
  });
  await client.refresh({owner:'u1',signedIn:true});
  assert.equal(client.state.premium,true);assert.equal(client.state.premiumSource,'sky_purchase');
  assert.deepEqual(rpc.calls.map(c=>c.name),['lumen_get_commerce_config','lumen_get_commerce_state']);
  assert.equal(rpc.calls[1].args.p_expected_user_id,'u1');
  assert.equal(ledgerFor('u1').snapshot().activatedAt,'2026-12-01T00:00:00.000Z','durable activation adopted');
  fail=true;
  await client.refresh({owner:'u1',signedIn:true,force:true});
  assert.equal(client.state.premium,true,'a failed read is not a revocation');
});

test('guests never read an account state; preview needs a signed-in capability',async()=>{
  const {client,rpc}=clientWith({lumen_get_commerce_config:()=>({data:{premiumEnabled:true}})});
  await client.refresh({owner:'guest',signedIn:false,previewCapability:true});
  assert.equal(client.state.preview,false);
  assert.ok(!rpc.calls.some(c=>c.name==='lumen_get_commerce_state'));
  assert.deepEqual(await client.sync({owner:'guest',signedIn:false}),{skipped:'guest'});
});

test('quota sync: batched pending attempts, idempotent acknowledgement, retried on failure',async()=>{
  let down=true;
  const {client,rpc,ledgerFor}=clientWith({
    lumen_get_commerce_config:()=>({data:{}}),
    lumen_get_commerce_state:a=>({data:{premium:{active:false},preview:true,activatedAt:null,counts:{day:a.p_day,new:0,replay:0}}}),
    lumen_quota_sync:a=>down?{data:null,error:Error('offline')}:{data:{accepted:a.p_attempts.length,counts:{day:a.p_day,new:a.p_attempts.length,replay:0},activatedAt:a.p_activation?.at??null,premium:{active:false}}},
  });
  await client.refresh({owner:'qa1',signedIn:true,previewCapability:true});
  assert.equal(client.state.preview,true);
  const l=ledgerFor('qa1');
  l.activate({questId:'base-q021'});l.record({attemptId:'a-1',questId:'base-q021',kind:'new'});l.record({attemptId:'a-2',questId:'base-q022',kind:'new'});
  assert.equal((await client.sync({owner:'qa1',signedIn:true})).ok,false);
  assert.equal(l.pending().length,2,'offline: still pending and still counted');
  assert.deepEqual(l.used(),{new:2,replay:0});
  down=false;
  assert.equal((await client.sync({owner:'qa1',signedIn:true})).accepted,2);
  const sent=rpc.calls.filter(c=>c.name==='lumen_quota_sync').at(-1).args;
  assert.equal(sent.p_attempts.length,2);assert.equal(sent.p_activation.questId,'base-q021');
  assert.equal(l.pending().length,0);assert.equal(l.pendingActivation(),null);
  assert.deepEqual(await client.sync({owner:'qa1',signedIn:true}),{skipped:'nothing'});
});

test('Premium surfaces stay hidden during discovery and before launch',()=>{
  const off={config:normalizeCommerceConfig({}),premium:false,preview:false};
  assert.equal(premiumSurfaceVisible({state:off,activated:true}),false);
  const live={config:normalizeCommerceConfig({premiumEnabled:true,stats:true}),premium:false,preview:false};
  assert.equal(premiumSurfaceVisible({state:live,feature:'stats',activated:false}),false,'not proposed during discovery');
  assert.equal(premiumSurfaceVisible({state:live,feature:'stats',activated:true}),true);
  assert.equal(premiumSurfaceVisible({state:{...live,premium:true},feature:'stats',activated:false}),true,'acquired rights are never hidden');
  assert.equal(premiumSurfaceVisible({state:{...off,preview:true},feature:'stats'}),true,'QA preview');
});

test('game wiring: the first gesture can be refused, never a started run; exemptions are explicit',()=>{
  const src=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
  const start=src.slice(src.indexOf('function ensureAttemptStarted(){'),src.indexOf('function persistAttemptBoard(){'));
  assert.match(start,/if\(a\?\.state!==ATTEMPT_STATES\.READY\)return true;/,'a started, paused or resumed run is never gated');
  assert.ok(start.indexOf('premiumQuotaGate()')<start.indexOf('attemptEngine.start()'),'decided before the run starts');
  assert.ok(start.indexOf('recordQuotaAttempt(quotaGate,started)')>start.indexOf('attemptEngine.start()'),'counted once the identity exists');
  assert.match(src,/if\(!ensureAttemptStarted\(\)\)\{dragCross=null;return\}/);
  assert.match(src,/if\(!ensureAttemptStarted\(\)\)return;/);
  assert.match(src,/exempt:!!socialChallenge\|\|learningReplayActive\(\)\|\|scriptedLearningActive\(\)/,'daily, duels and tutorial are exempt');
  const guest=src.slice(src.indexOf('function guestDailyAssistance('),src.indexOf('function guestDailyClock('));
  assert.match(guest,/if\(!challenge\?\.guestEligible\|\|challenge\.forfeited\)return false;/,'only guest daily assistance can start this attempt');
  assert.match(guest,/if\(!ensureAttemptStarted\(\)\)return true;/,'assistance cannot bypass the attempt gate');
  assert.equal((src.match(/ensureAttemptStarted\(\)/g)||[]).length,5,'every caller is reviewed');
});

test('shop: the single Premium offer uses the catalogue price on the web and Google Play price in the app',async()=>{
  const {adventureOfferModel}=await import('../src/ui/adventure-offer.js');
  const {CONTENT_PACKS}=await import('../src/campaign/content.js');
  const pack=CONTENT_PACKS.find(p=>p.access==='locked'),base={pack,packs:CONTENT_PACKS,quests:canonicalQuestList(),progress:{},signedIn:true,purchasesAvailable:true};
  assert.equal(adventureOfferModel(base).premium,null,'no Premium offer unless the shop switch provides it');
  const web=adventureOfferModel({...base,premium:{product:'lumen-premium',priceCents:499}});
  assert.equal(web.premium.product,'lumen-premium');assert.equal(web.premium.price,'4,99 €');assert.equal(web.premium.priceKnown,true);
  const play=adventureOfferModel({...base,pricesRequired:true,prices:{'lumen-premium':'4,99 €'},premium:{product:'lumen-premium',priceCents:499}});
  assert.equal(play.premium.price,'4,99 €');assert.equal(play.premium.priceKnown,true);
  const missing=adventureOfferModel({...base,pricesRequired:true,prices:{},premium:{product:'lumen-premium',priceCents:499}});
  assert.equal(missing.premium.priceKnown,false,'never a fixed price in the Play app');
  assert.ok(missing.mastery!==undefined,'mastery unlock path is kept');
});

// ---- Lot 2: advanced statistics and playable archives ---------------------------
test('advanced statistics: bounded model, difficulty from the catalogue, accessible chart', async () => {
  const {premiumStatsModel, renderSeriesChart, STATS_PAGE} = await import('../src/ui/premium-stats.js');
  const quests = new Map(canonicalQuestList().map((q) => [q.id, q]));
  const easy = canonicalQuestList().find((q) => q.difficulty?.label === 'Facile');
  const data = {
    series: [{day: '2026-11-25', attempts: 4, wins: 2, medianSeconds: 60}, {day: '2026-11-26', attempts: 6, wins: 4, medianSeconds: 90}],
    records: [{questId: easy.id, score: 50}, {questId: 'unknown', score: 10}],
    history: [{at: '2026-11-26T10:00:00Z', questId: easy.id, status: 'confirmed', seconds: 42, improved: true}],
  };
  const m = premiumStatsModel(data, {questById: (id) => quests.get(id)});
  assert.equal(m.summary.attempts, 10);
  assert.equal(m.summary.winRate, 60);
  assert.equal(m.summary.medianSeconds, 75);
  assert.deepEqual(m.byDifficulty, [{label: 'Facile', count: 1, best: 50, median: 50}], 'unknown quests are ignored');
  assert.equal(m.history[0].quest.id, easy.id);
  assert.deepEqual(premiumStatsModel({}).summary, {attempts: 0, wins: 0, winRate: null, medianSeconds: null, records: 0, bestScore: null});
  const svg = renderSeriesChart(m.series, {t: (k) => k});
  assert.match(svg, /role="img" aria-label="premiumStats.chartLabel"/);
  assert.equal((svg.match(/<rect /g) || []).length, 2);
  assert.equal(renderSeriesChart([]), '');
  assert.ok(STATS_PAGE <= 50, 'server page bound');
});

test('wiring: archives replay past days only as training, stats behind Premium surfaces', () => {
  const src = fs.readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
  const archive = src.slice(src.indexOf('async function bootstrapDailyArchive('), src.indexOf('async function bootstrapDailyChallenge('));
  assert.match(archive, /lumen_daily_archive/);
  assert.match(archive, /training:true,archive:true/, 'never an official attempt');
  assert.doesNotMatch(archive, /dailyClient\.begin|lumen_daily_begin/);
  assert.match(src, /day<dailyWeekToday&&premiumSurfaceVisible\(\{state:commerce\.state,feature:'archives'/, 'only past days, only Premium surfaces');
  assert.match(src, /if\(params\.has\('archive'\)\)return bootstrapDailyArchive/);
  assert.match(src, /stats\.hidden=!lumenUser\|\|qaActive\|\|!premiumSurfaceVisible\(\{state:commerce\.state,feature:'stats'/);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="premiumStatsBtn"[^>]*hidden/, 'hidden by default');
});

test('« Découvrir Premium » opens the shop on the first locked Adventure, not only Mon ciel', () => {
  const src = fs.readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
  assert.match(src, /function openPremiumOffer\(\)\{openJourneyMap\(true\);skyNavigation\.showPremiumOffer\?\.\(\)\}/);
  const sky = fs.readFileSync(new URL('../src/ui/sky-navigation.js', import.meta.url), 'utf8');
  assert.match(sky, /function showPremiumOffer\(origin\)\{[^}]*!p\.accessible[^}]*showLocked\(pack,origin\)/);
});
