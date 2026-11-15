// #711: same device, A → sign out → B → sign out → A. Each account must see only
// its own progress; no write may reach the other account. Real Chrome, real app,
// synthetic multi-account server (scripts/fixtures/multi-account-browser.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { connectBrowser, closeBrowser, navigateAndWait, acknowledgeLearningMilestones } from './cdp-client.mjs';
import { canonicalQuestList } from '../src/campaign/canonical-quests.js';
import { multiAccountFixture } from './fixtures/multi-account-browser.mjs';

const { send, evaluate, errors } = await connectBrowser();
const appRoot = path.resolve('.');
const appServer = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(appRoot, pathname === '/' ? 'index.html' : pathname.replace(/^\//, ''));
  if (path.relative(appRoot, file).startsWith('..') || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
const all = canonicalQuestList();
function profileUpTo(ordinal, { xp, shards }) {
  const done = all.filter((q) => q.ordinal <= ordinal),
    solved = Object.fromEntries(done.filter((q) => q.legacyIndex !== null).map((q) => [q.legacyIndex, 1]));
  return {
    solved,
    historyBackup: solved,
    badges: {},
    stars: {},
    performances: {},
    noHint: {},
    canonicalQuestState: Object.fromEntries(done.filter((q) => q.legacyIndex === null).map((q) => [q.id, { solved: true, stars: 1, badges: {} }])),
    daily: { dates: {}, rewards: {} },
    challenges: {},
    xp,
    shards,
    walletRevision: 1,
    skyHistoryVersion: 4,
  };
}
const boundary = all.find((q) => q.id === 'planned-real-24-q10');
const A = profileUpTo(boundary.ordinal, { xp: 1000, shards: 7 }),
  B = profileUpTo(12, { xp: 50, shards: 2 });
async function until(expression, label, tries = 150) {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(expression, true)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Timed out (' + label + '): ' + expression + ' ' + JSON.stringify(await evaluate(`({owner:localStorage.getItem('lumenCloudOwnerId'),status:document.getElementById('mobileAuthStatus')?.textContent,action:document.getElementById('mobileAuthAction')?.textContent,diag:JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').slice(-8).map(e=>e.event+':'+(e.stage||e.reason||''))})`)));
}
const local = `(()=>{const p=JSON.parse(localStorage.getItem('lumenProgressV1')||'null');return p&&{xp:p.xp,shards:p.shards,canonical:Object.keys(p.canonicalQuestState||{}).length,legacy:Object.keys(p.solved||{}).length}})()`;
const server = `(()=>Object.fromEntries(Object.entries(window.__server.accounts).map(([id,a])=>[id,{xp:a.profile.xp,shards:a.profile.shards,canonical:Object.keys(a.profile.canonicalQuestState||{}).length,legacy:Object.keys(a.profile.solved||{}).length,writes:a.writes}])))()`;
const summary = (p) => ({ xp: p.xp, shards: p.shards, canonical: Object.keys(p.canonicalQuestState).length, legacy: Object.keys(p.solved).length });
async function signOut() {
  await evaluate(`document.getElementById('mobileAuthAction').click()`);
  await until(`window.__server.session===null&&document.getElementById('mobileAuthAction').textContent!=='D'+String.fromCharCode(233)+'connexion'`, 'signed out');
}
async function signIn(id) {
  await until("document.getElementById('signedOutScreen')?.hidden===false", 'neutral screen before sign-in');
  await evaluate(`document.getElementById('signedOutLogin').click();document.getElementById('accountEmail').value='${id}@example.test';document.getElementById('accountPassword').value='test-password-only';document.getElementById('accountPasswordSubmit').click()`);
  await until(`window.__server.session?.user?.id==='${id}'&&localStorage.getItem('lumenCloudOwnerId')==='${id}'&&document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')`, 'signed in ' + id, 250);
}
const timeline = [];
try {
  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: multiAccountFixture({ a: A, b: B }, 'a') });
  await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: 'http://127.0.0.1:' + appServer.address().port + '/' });
  await until(`!!window.lumenDiagnostics&&document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')`, 'A hydrated');
  await acknowledgeLearningMilestones(evaluate);
  timeline.push({ step: 'A', local: await evaluate(local), server: await evaluate(server) });
  assert.deepEqual(timeline.at(-1).local, summary(A), 'A sees its own progress');

  // A is playing its advanced frontier quest (started, one mark placed).
  await evaluate("(()=>{const m=document.getElementById('attemptMask');if(m&&!m.hidden)m.click();const d=lumenDiagnostics.snapshot();const cell=document.querySelectorAll('#board .cell')[d.puz.sol[0]];cell.click();cell.click()})()");
  const aQuest = await evaluate("JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId");
  timeline.push({ step: 'A playing', quest: aQuest });
  // A owns a durable, not yet confirmed victory when the device changes account.
  const pendingQuest = all.find((q) => q.ordinal === boundary.ordinal + 1 && q.legacyIndex === null);
  await evaluate(`(async()=>{const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');await createDurableCanonicalVictoryOutbox(localStorage).enqueue('a',${JSON.stringify(pendingQuest.id)},{facts:{seconds:61,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-11-15',qualifiedAt:'2026-11-15T08:00:00.000Z'}},{operationId:'switch-a-pending-reset-0'})})()`, true);
  await signOut();
  const neutralCheck = "(()=>{const n=document.getElementById('signedOutScreen'),r=n.getBoundingClientRect();return {visible:n.hidden===false,cover:r.width>=innerWidth&&r.height>=innerHeight,top:document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#signedOutScreen,#accountOptin')!==null}})()";
  timeline.push({ step: 'signed out after A', local: await evaluate(local), owner: await evaluate(`localStorage.getItem('lumenCloudOwnerId')`), neutral: await evaluate(neutralCheck) });
  assert.deepEqual(timeline.at(-1).neutral, { visible: true, cover: true, top: true }, '#711: after sign-out a neutral screen replaces the last account progress');
  assert.deepEqual(timeline.at(-1).local, summary(A), 'Signing out erases nothing on the device');
  await navigateAndWait({ send, evaluate }, 'Page.reload');
  await until("!!window.lumenDiagnostics&&document.getElementById('signedOutScreen')?.hidden===false", 'neutral screen after reload');
  await evaluate("document.getElementById('signedOutLogin').click()");
  assert.equal(await evaluate("(()=>{const o=document.getElementById('accountOptin');return !o.hidden&&document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('#accountOptin')!==null})()"), true, 'The sign-in dialog opens above the neutral screen');
  await evaluate("document.getElementById('accountOptinLater')?.click()");

  // Sample what the app shows while B's session exists but B's profile is not installed yet.
  await evaluate(`window.__transient=[];window.__probe=setInterval(()=>{if(window.__server.session?.user?.id!=='b')return;const d=lumenDiagnostics.snapshot();window.__transient.push({owner:localStorage.getItem('lumenCloudOwnerId'),memoryXp:d.progress?.xp,status:document.getElementById('mobileAuthStatus')?.textContent,skyOpen:!document.getElementById('mapModal').hidden,hold:document.getElementById('accountSwitchHold')?.hidden===false,holdText:document.getElementById('accountSwitchHoldText')?.textContent??null})},40)`);
  await evaluate('window.__rpcDelay=800');
  await signIn('b');
  await evaluate('window.__rpcDelay=0');
  const transient = await evaluate('(()=>{clearInterval(window.__probe);return window.__transient})()');
  const exposed = transient.filter((t) => t.owner === 'a' && !t.hold);
  timeline.push({ step: 'B transition', samples: transient.length, heldWhileA: transient.filter((t) => t.owner === 'a' && t.hold).length, exposed: exposed.length, statuses: [...new Set(transient.map((t) => t.status))], holdTexts: [...new Set(transient.map((t) => t.holdText))] });
  assert(transient.some((t) => t.owner === 'a'), 'The 4G-like latency exposes a real transition window');
  assert.deepEqual(exposed, [], '#711: B never sees the progress of A while its own loads: ' + JSON.stringify(exposed.slice(0, 2)));
  assert(!transient.some((t) => /Enregistrement local indisponible/.test(t.status)), 'A session change is not reported as a local storage failure');
  assert.equal(await evaluate("document.getElementById('accountSwitchHold').hidden"), true, 'The hold ends once B is installed');
  const bStep = { step: 'B', local: await evaluate(local), server: await evaluate(server) };
  timeline.push(bStep);
  await new Promise((r) => setTimeout(r, 4000)); // Give any (wrong) replay a chance to run under B.
  timeline.push({ step: 'B settled', server: await evaluate(server), pendingA: await evaluate(`(async()=>{const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');return (await createDurableCanonicalVictoryOutbox(localStorage).pending('a')).length})()`, true) });
  assert.equal(timeline.at(-1).pendingA, 1, "A's pending victory stays durable while B plays");
  assert.equal(await evaluate("window.__server.accounts.b.receipts.length"), 0, "A's victory never reaches B");
  assert.deepEqual(bStep.local, summary(B), 'B sees only its own progress: ' + JSON.stringify(timeline));
  const bShown = await evaluate("({quest:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')?.questId,started:!!JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')?.startedAt,reg:JSON.stringify(lumenDiagnostics.snapshot().puz.reg)})");
  const bFrontier = all.find((q) => q.ordinal === 13);
  timeline.push({ step: 'B shown', ...bShown, expected: bFrontier.legacyIndex === null ? bFrontier.id : bFrontier.legacyIndex + 1 });
  assert.notEqual(bShown.quest, aQuest, '#711: B must not continue the quest A was playing: ' + JSON.stringify(timeline.slice(-2)));
  assert.equal(bShown.reg, JSON.stringify(bFrontier.reg), '#711: B is shown its own next quest');
  const settled = timeline.find((t) => t.step === 'B settled').server;
  assert.deepEqual({ ...settled.b, writes: 0 }, { ...summary(B), writes: 0 }, 'Nothing from A reached B on the server');
  assert.deepEqual({ ...settled.a, writes: 0 }, { ...summary(A), writes: 0 }, 'A is unchanged on the server while B plays');

  await signOut();
  await signIn('a');
  await until("window.__server.accounts.a.grants===1", 'A pending victory replayed to A', 300);
  await until(`document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')`, 'A synced after replay', 250);
  timeline.push({ step: 'A again', local: await evaluate(local), server: await evaluate(server) });
  assert.deepEqual(timeline.at(-1).local, { ...summary(A), canonical: summary(A).canonical + 1, xp: timeline.at(-1).server.a.xp }, 'A recovers its own progress plus its pending victory: ' + JSON.stringify(timeline));
  assert(timeline.at(-1).server.a.xp > A.xp, 'The pending victory was credited to A only');
  assert.deepEqual({ ...timeline.at(-1).server.b, writes: 0 }, { ...summary(B), writes: 0 }, 'B is unchanged on the server');
  // B's progress cannot be loaded: the device must keep hiding A, then load B on retry.
  await signOut();
  await evaluate("sessionStorage.setItem('failRestoreFor','b')");
  await evaluate(`document.getElementById('mobileAuthAction').click();document.getElementById('accountAuthSwitch').click();document.getElementById('accountEmail').value='b@example.test';document.getElementById('accountPassword').value='test-password-only';document.getElementById('accountPasswordSubmit').click()`);
  await until("window.__server.session?.user?.id==='b'&&document.getElementById('accountSwitchHold')?.hidden===false&&!document.getElementById('accountSwitchHoldRetry').hidden", 'failed B load stays held', 250);
  const held = await evaluate("({owner:localStorage.getItem('lumenCloudOwnerId'),text:document.getElementById('accountSwitchHoldText').textContent,cover:(()=>{const r=document.getElementById('accountSwitchHold').getBoundingClientRect();return r.width>=innerWidth&&r.height>=innerHeight})()})");
  timeline.push({ step: 'B load failed', ...held });
  assert.equal(held.owner, 'a', 'The failed load leaves the previous owner in place');
  assert(held.cover, 'The hold covers the whole screen: nothing of A is visible');
  assert.match(held.text, /n’a pas pu être chargée/);
  // #711: « Diagnostic » on the hold must show a readable report ON TOP of the
  // hold (a tap on the phone did nothing visible), and it can be closed again.
  await evaluate("document.getElementById('accountSwitchHoldDiagnostic').click()");
  await until("!document.getElementById('accountSwitchHoldReport').hidden&&document.getElementById('accountSwitchHoldReportText').value.length>0", 'diagnostic report filled', 250);
  const report = await evaluate("(()=>{const t=document.getElementById('accountSwitchHoldReportText'),r=t.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(r.height/2,20));return {visible:r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight,onTop:hit===t,hit:hit?.id||hit?.className||null}})()");
  timeline.push({ step: 'diagnostic on hold', ...report });
  assert(report.visible && report.onTop, 'The diagnostic report is visible above the hold: ' + JSON.stringify(report));
  // Reloading while B still fails must never flash A's grid before the hold.
  await send('Page.reload');
  const early = [];
  for (let i = 0; i < 40; i++) { const v = await evaluate("(()=>{const h=document.getElementById('accountSwitchHold');return h?{hold:h.hidden===false,mask:document.getElementById('attemptMask')?.hidden===false}:null})()").catch(() => null); if (v) early.push(v); await new Promise((r) => setTimeout(r, 25)); }
  timeline.push({ step: 'reload while failing', samples: early.length, flashed: early.filter((v) => v.mask && !v.hold).length });
  assert(early.some((v) => v.hold) && !early.some((v) => v.mask && !v.hold), 'No flash of the previous account after reload: ' + JSON.stringify(early.slice(0, 5)));
  await until("!document.getElementById('accountSwitchHoldRetry').hidden", 'failed again after reload', 250);
  await evaluate("sessionStorage.removeItem('failRestoreFor');document.getElementById('accountSwitchHoldRetry').click()");
  await until(`localStorage.getItem('lumenCloudOwnerId')==='b'&&document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')&&document.getElementById('accountSwitchHold').hidden`, 'B loaded after retry', 250);
  assert.deepEqual(await evaluate(local), summary(B), 'Retry installs B only');
  // #711 root cause (phone telemetry: storage_quota at owner_backup): every
  // switch added a full copy of the previous profile, never removed, until the
  // localStorage quota refused the next switch. Saturate the quota with such old
  // copies; switching back to A must still work and keep every copy, B's profile
  // being preserved in the verified IndexedDB recovery store instead.
  await signOut();
  const bRaw = await evaluate("localStorage.getItem('lumenProgressV1')");
  const saturation = await evaluate(`(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('lumenBeforeAccountSwitch_')&&!k.startsWith('lumenBeforeAccountSwitchAttempt_')&&localStorage.getItem(k)===localStorage.getItem('lumenProgressV1'))localStorage.removeItem(k);
   const chunk='x'.repeat(256*1024);let n=0,size=chunk.length;
   for(;;){try{localStorage.setItem('lumenBeforeAccountSwitch_1700000'+String(n).padStart(6,'0'),n+chunk.slice(0,size));n++}catch(e){if(size<=16)break;size=Math.floor(size/2)}}
   const keys=Object.keys(localStorage).filter(k=>k.startsWith('lumenBeforeAccountSwitch_1700000')).sort();
   return {count:keys.length,fingerprint:keys.map(k=>k+':'+localStorage.getItem(k).length).join(',')}})()`);
  assert(saturation.count > 5, 'The local quota is saturated by old switch copies');
  await signIn('a');
  const afterQuota = await evaluate(`(async()=>{const keys=Object.keys(localStorage).filter(k=>k.startsWith('lumenBeforeAccountSwitch_1700000')).sort();
   const db=await new Promise((ok,ko)=>{const r=indexedDB.open('lumenCloudRecoveryV1',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>ko(r.error)});
   const values=await new Promise(ok=>{const q=db.transaction('snapshots').objectStore('snapshots').getAll();q.onsuccess=()=>ok(q.result)});db.close();
   return {fingerprint:keys.map(k=>k+':'+localStorage.getItem(k).length).join(','),bInIndexedDb:values.includes(${JSON.stringify(bRaw)})}})()`, true);
  timeline.push({ step: 'switch with saturated quota', copies: saturation.count, kept: afterQuota.fingerprint === saturation.fingerprint, bInIndexedDb: afterQuota.bInIndexedDb, memory: await evaluate(`(()=>{const p=lumenDiagnostics.snapshot().progress;return {canonical:Object.keys(p.canonicalQuestState||{}).length,owner:localStorage.getItem('lumenCloudOwnerId')}})()`) });
  assert.equal(afterQuota.fingerprint, saturation.fingerprint, 'No previous copy is removed or altered');
  assert.equal(afterQuota.bInIndexedDb, true, "B's local profile is preserved in the verified IndexedDB recovery store");
  // #391 contract: with a full quota, the verified cloud profile of A runs in memory.
  assert.deepEqual(timeline.at(-1).memory, { canonical: summary(A).canonical + 1, owner: 'a' }, 'A is signed in and shown despite the full local quota: ' + JSON.stringify(timeline.at(-1)));
  await evaluate("for(const k of Object.keys(localStorage))if(k.startsWith('lumenBeforeAccountSwitch_1700000'))localStorage.removeItem(k)");
  const refused = await evaluate('window.__server.refused');
  assert.deepEqual(refused, [], 'No call targeted another account than the session: ' + JSON.stringify(refused));
  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ timeline, errors, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(timeline));
} finally {
  await closeBrowser(send);
  appServer.close();
}
