// #847: Lumen must stay playable when the backend is unreachable although the
// browser still reports navigator.onLine === true (Wi-Fi without Internet, mobile
// data without signal, TWA). Real Chrome, real app, synthetic multi-account server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, closeBrowser, navigateAndWait, acknowledgeLearningMilestones } from './cdp-client.mjs';
import { canonicalQuestList } from '../src/campaign/canonical-quests.js';
import { QUEST_MILESTONES } from '../src/campaign/quest-rules.js';
import { multiAccountFixture } from './fixtures/multi-account-browser.mjs';

const { send, evaluate, errors } = await connectBrowser();
const base = process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/';
const all = canonicalQuestList();
const frontier = all.find((q) => q.ordinal === QUEST_MILESTONES.discovery + 6);
function profileUpTo(ordinal) {
  const done = all.filter((q) => q.ordinal < ordinal);
  const solved = Object.fromEntries(done.filter((q) => q.legacyIndex !== null).map((q) => [q.legacyIndex, 1]));
  return { solved, historyBackup: solved, badges: {}, stars: {}, performances: {}, noHint: {},
    canonicalQuestState: Object.fromEntries(done.filter((q) => q.legacyIndex === null).map((q) => [q.id, { solved: true, stars: 1, badges: {} }])),
    daily: { dates: {}, rewards: {} }, challenges: {}, xp: 300, shards: 4, walletRevision: 1, skyHistoryVersion: 4 };
}
const A = profileUpTo(frontier.ordinal);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expression, label, tries = 200) {
  for (let i = 0; i < tries; i++) { if (await evaluate(expression, true)) return; await sleep(100); }
  throw Error('Timed out (' + label + '): ' + JSON.stringify(await evaluate(view, true)));
}
const view = `({hold:!document.getElementById('accountSwitchHold').hidden,title:document.getElementById('accountSwitchHoldTitle').textContent,
status:document.getElementById('mobileAuthStatus')?.textContent,
 cells:document.querySelectorAll('#board .cell').length,owner:localStorage.getItem('lumenCloudOwnerId'),
 solved:Object.keys(JSON.parse(localStorage.getItem('lumenProgressV1')||'{}').solved||{}).length,
 quest:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')?.questId??null,
 locked:document.documentElement.innerHTML.includes('Synchronisation du compte requise')})`;
const results = [];
async function reloadWith(mode) {
  await evaluate(`sessionStorage.setItem('fixtureNetworkDown',${JSON.stringify(mode)});localStorage.setItem('sb-tjdjlavmusmncuszhsuw-auth-token',JSON.stringify(window.__server.session))`);
  await navigateAndWait({ send, evaluate }, 'Page.reload');
}
async function assertPlayableOffline(label, tries = 200) {
  await until(`(${view}).hold===false&&(${view}).cells>0&&/hors connexion/.test((${view}).status)`, label, tries);
  const state = await evaluate(view, true);
  assert.equal(state.owner, 'a', label + ': only the owner cache is used');
  assert.equal(state.solved, Object.keys(A.solved).length, label + ': local progress kept, no fake quest 1');
  assert.equal(state.locked, false, label + ': the frontier quest is not locked behind a sync');
  // Still playable: a tap changes the live attempt board.
  const before = await evaluate(`localStorage.getItem('lumenActiveAttemptV1')`);
  await evaluate(`(()=>{const m=document.getElementById('attemptMask');if(m&&!m.hidden)m.click();document.querySelectorAll('#board .cell')[0].click()})()`);
  await until(`localStorage.getItem('lumenActiveAttemptV1')!==${JSON.stringify(before)}`, label + ' tap saved');
  results.push(label);
  return state;
}
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: multiAccountFixture({ a: A }, 'a') });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>sessionStorage.getItem('fixtureAirplane')!=='1'})" });
  await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: base });
  await until(`!!window.lumenDiagnostics&&document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')`, 'online hydration');
  await acknowledgeLearningMilestones(evaluate);
  await until(`!!localStorage.getItem('lumenOfflineVerifiedOwnerV1')`, 'offline proof after verified hydration');
  const online = await evaluate(view, true);
  assert.equal(online.solved, Object.keys(A.solved).length);
  const writes = await evaluate(`window.__server.accounts.a.writes`);

  // 0. Airplane mode right after a verified online session, then a second cold start.
  await evaluate("sessionStorage.setItem('fixtureAirplane','1')");
  await reloadWith('1');
  await assertPlayableOffline('airplane mode cold start');
  await navigateAndWait({ send, evaluate }, 'Page.reload');
  await assertPlayableOffline('airplane mode second restart');
  await evaluate("sessionStorage.removeItem('fixtureAirplane')");

  // 1. Expired token refresh and RPCs fail while the browser says "online".
  await reloadWith('1');
  await assertPlayableOffline('auth refresh unreachable');
  // 2. Valid token, but every RPC fails with a network error.
  await reloadWith('rpc');
  await assertPlayableOffline('rpc unreachable');
  // 3. RPCs never answer: the watchdog switches to the verified local profile.
  await reloadWith('hang');
  await assertPlayableOffline('rpc hanging', 400);
  // No server write while unreachable, and no reward granted twice later.
  assert.equal(await evaluate(`window.__server.accounts.a.writes`), writes);

  // 4. Network back: a safe reload restores the verified cloud state.
  await evaluate(`sessionStorage.removeItem('fixtureNetworkDown')`);
  await navigateAndWait({ send, evaluate }, 'Page.reload');
  await until(`document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')&&document.getElementById('accountSwitchHold').hidden`, 'reconnected');
  assert.equal((await evaluate(view, true)).solved, Object.keys(A.solved).length);
  results.push('reconnection');

  // 5. A stored session for another account never opens A's cache offline.
  await evaluate(`window.__server.session={user:{id:'b'}};window.__saveServer()`);
  await reloadWith('1');
  await until(`(${view}).hold===true&&/hors ligne/i.test((${view}).title)`, 'unverified owner held');
  const held = await evaluate(view, true);
  assert.equal(held.owner, 'a', 'Cache of A preserved, not shown');
  assert.equal(held.solved, Object.keys(A.solved).length, 'Unverified identity: data untouched');
  results.push('unverified identity held');

  // 6. No offline proof (never verified on this device): explicit message, never quest 1.
  await evaluate(`window.__server.session={user:{id:'a'}};window.__saveServer();localStorage.removeItem('lumenOfflineVerifiedOwnerV1')`);
  await reloadWith('1');
  await until(`(${view}).hold===true&&/hors ligne/i.test((${view}).title)`, 'no proof held');
  assert.equal((await evaluate(view, true)).solved, Object.keys(A.solved).length, 'Local data untouched');
  results.push('no proof: explicit offline message');

  assert.deepEqual(errors, []);
  const report = { results, uncaughtErrors: errors };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await closeBrowser(send); }
