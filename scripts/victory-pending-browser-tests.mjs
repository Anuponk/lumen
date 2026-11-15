// #682 (I) / #699 / #706: a slow (4G-like) canonical victory first appears as a
// local pending result on the single victory screen, then the server
// confirmation updates that same screen in place. Real Chrome, synthetic RPC.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { connectBrowser, closeBrowser, navigateAndWait, acknowledgeLearningMilestones, PENDING_VICTORY_SHOWN } from './cdp-client.mjs';
import { canonicalQuestList } from '../src/campaign/canonical-quests.js';
import { authenticatedCampaignFixture } from './fixtures/authenticated-campaign-browser.mjs';

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
const all = canonicalQuestList(),
  boundary = all.find((q) => q.id === 'planned-real-24-q10'),
  next = all.find((q) => q.ordinal === boundary.ordinal + 1);
const done = all.filter((q) => q.ordinal <= boundary.ordinal),
  solved = Object.fromEntries(done.filter((q) => q.legacyIndex !== null).map((q) => [q.legacyIndex, 1]));
const profile = {
  solved,
  historyBackup: solved,
  badges: {},
  stars: {},
  performances: {},
  noHint: {},
  canonicalQuestState: Object.fromEntries(done.filter((q) => q.legacyIndex === null).map((q) => [q.id, { solved: true, stars: 1, badges: {} }])),
  daily: { dates: {}, rewards: {} },
  challenges: {},
  xp: 1000,
  shards: 3,
  walletRevision: 1,
  skyScore: 298,
  skyHistoryVersion: 4,
};
async function until(expression, tries = 160) {
  for (let i = 0; i < tries; i++) {
    if (await evaluate(expression, true)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Timed out ' + expression);
}
const ZONES = `(()=>{const q=s=>document.querySelector(s),r=e=>{const b=e.getBoundingClientRect();return [Math.round(b.top),Math.round(b.height)]};
 return {canvas:r(q('#skyRevealCanvas')),rewards:r(q('#skyRevealRewards')),performance:r(q('#skyRevealPerformance')),row:r(q('.victory-performance-row')),slot:r(q('#skyRevealPodium')),next:r(q('#skyRevealNext')),sky:r(q('#skyRevealSky')),retry:r(q('#skyRevealRetry'))}})()`;
const SLOTS = `[...document.querySelectorAll('#skyRevealRewards .victory-reward')].map(e=>e.dataset.reward+':'+[...e.classList].find(c=>/^victory-reward-(new|owned|missing|pending)$/.test(c)))`;
const results = {};
try {
  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 1, mobile: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: authenticatedCampaignFixture(profile) });
  await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: 'http://127.0.0.1:' + appServer.address().port + '/' });
  await until(`!!window.lumenDiagnostics&&JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
  await acknowledgeLearningMilestones(evaluate);
  await until(`document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId`), next.id);
  // Watch the historical card: it must never be shown at the end of a quest.
  await evaluate(`(()=>{window.__overlayShown=false;const o=document.getElementById('successOverlay');new MutationObserver(()=>{if(o.classList.contains('show'))window.__overlayShown=true}).observe(o,{attributes:true,attributeFilter:['class']})})()`);
  // Slow command: 4 s, beyond the 2.5 s pending threshold.
  await evaluate(`window.__commitDelay=4000`);
  await evaluate(`(()=>{document.getElementById('attemptMask').click();const d=lumenDiagnostics.snapshot();const s=d.puz.reg.map(row=>row.map(()=>0));d.puz.sol.forEach((col,row)=>s[row][col]=2);lumenDiagnostics.setBoard(s)})()`);
  await until(PENDING_VICTORY_SHOWN);
  const pending = await evaluate(`({zones:${ZONES},slots:${SLOTS},rank:document.getElementById('skyRevealRank').textContent,status:document.getElementById('skyRevealSync').textContent,
    kicker:document.getElementById('skyRevealKicker').textContent,progress:document.querySelector('.sky-reveal-progress').textContent,
    disabled:['skyRevealShare','skyRevealRetry'].map(id=>document.getElementById(id).disabled),nextEnabled:!document.getElementById('skyRevealNext').disabled,
    saved:!!window.__profile.canonicalQuestState[${JSON.stringify(next.id)}]?.solved,grants:window.__canonicalGrants})`);
  assert.equal(pending.saved, false, 'The pending screen appears before any server acknowledgement');
  assert.equal(pending.grants, 0);
  assert.equal(pending.kicker, 'QUÊTE RÉSOLUE');
  assert.match(pending.status, /Victoire conservée sur cet appareil — confirmation cloud en attente/);
  assert.match(pending.progress, /1 en attente/);
  assert.equal(pending.rank, 'Classement après confirmation', 'No rank before confirmation');
  assert.deepEqual(pending.slots, ['star:victory-reward-pending', 'autonomy:victory-reward-pending', 'speed:victory-reward-pending', 'noError:victory-reward-pending', 'mastery:victory-reward-pending']);
  assert.deepEqual(pending.disabled, [true, true], 'Challenge and replay wait for the server');
  assert.equal(pending.nextEnabled, true, 'The player can keep playing');
  // The server confirms: the same screen is updated in place.
  await until(`(()=>{const o=document.getElementById('skyReveal');return !o.hidden&&!o.dataset.sync&&!document.getElementById('skyRevealSync')})()`, 120);
  const confirmed = await evaluate(`({zones:${ZONES},slots:${SLOTS},saved:!!window.__profile.canonicalQuestState[${JSON.stringify(next.id)}]?.solved,grants:window.__canonicalGrants,
    rank:document.getElementById('skyRevealRank').textContent,retry:document.getElementById('skyRevealRetry').disabled,
    diagnostics:JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').map(e=>e.event)})`);
  assert.equal(confirmed.saved, true);
  assert.equal(confirmed.grants, 1, 'Exactly one server grant');
  assert.equal(confirmed.slots[0], 'star:victory-reward-new', 'The confirmed first win earns its star');
  assert.notEqual(confirmed.rank, 'Classement après confirmation');
  assert.equal(confirmed.retry, false, 'Replay becomes available after confirmation');
  assert(confirmed.diagnostics.includes('victory_pending_shown') && confirmed.diagnostics.includes('victory_pending_upgraded'));
  for (const zone of Object.keys(pending.zones))
    assert(
      Math.abs(pending.zones[zone][0] - confirmed.zones[zone][0]) <= 1 && Math.abs(pending.zones[zone][1] - confirmed.zones[zone][1]) <= 1,
      'Confirmation moved ' + zone + ' ' + JSON.stringify({ pending: pending.zones[zone], confirmed: confirmed.zones[zone] }),
    );
  assert.equal(await evaluate('window.__overlayShown'), false, 'No historical successOverlay card');
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`), false, 'No horizontal scrolling');
  results.pendingThenConfirmed = { pending: pending.zones, confirmed: confirmed.zones };
  // #706: a replay keeps the earned star on the confirmed victory screen.
  await evaluate(`window.__commitDelay=0`);
  await until(`(()=>{const b=document.getElementById('skyRevealRetry');return !b.disabled&&b.getClientRects().length>0})()`);
  await evaluate(`document.getElementById('skyRevealRetry').click()`);
  await until(`document.getElementById('skyReveal').hidden&&lumenDiagnostics.snapshot().puz.reg.length>0`);
  await evaluate(`(()=>{const m=document.getElementById('attemptMask');if(m&&!m.hidden)m.click();const d=lumenDiagnostics.snapshot();const s=d.puz.reg.map(row=>row.map(()=>0));d.puz.sol.forEach((col,row)=>s[row][col]=2);lumenDiagnostics.setBoard(s)})()`);
  await until(`(()=>{const o=document.getElementById('skyReveal');return !o.hidden&&!o.dataset.sync&&document.querySelectorAll('#skyRevealRewards .victory-reward').length===5})()`);
  const replay = await evaluate(`({slots:${SLOTS},grants:window.__canonicalGrants})`);
  assert.equal(replay.grants, 1, 'A replay never grants a second star');
  assert.equal(replay.slots[0], 'star:victory-reward-owned', '#706: the completed quest keeps its star on a replay');
  results.replayStarOwned = true;
  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await closeBrowser(send);
  appServer.close();
}
