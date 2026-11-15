// #705 test aid: the admin cockpit opens the real adventure-mastery celebration
// as a preview, on a phone viewport, without writing anything.
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
const all = canonicalQuestList(),
  boundary = all.find((q) => q.id === 'planned-real-24-q10');
const done = all.filter((q) => q.ordinal <= boundary.ordinal),
  solved = Object.fromEntries(done.filter((q) => q.legacyIndex !== null).map((q) => [q.legacyIndex, 1]));
const admin = { solved, historyBackup: solved, badges: {}, stars: {}, performances: {}, noHint: {}, canonicalQuestState: Object.fromEntries(done.filter((q) => q.legacyIndex === null).map((q) => [q.id, { solved: true, stars: 1, badges: {} }])), daily: { dates: {}, rewards: {} }, challenges: {}, xp: 1000, shards: 7, walletRevision: 1, skyHistoryVersion: 4 };
async function until(expression, label) {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(expression, true)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Timed out (' + label + '): ' + expression);
}
const results = [];
try {
  await new Promise((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  // #705 (owner's phone, 15/11): the preview inherited the previous screen's
  // performance block (review sentence, « Pas encore classé », empty podium) and
  // scrolled. It now fills time, badges and the real board of this quest itself.
  const board = { participating: true, realParticipants: 6, top: [1, 2, 3].map((p) => ({ place: p, position: p, nickname: p === 2 ? 'Admin' : 'Écho ' + p, score: p * 40, mine: p === 2, virtual: p !== 2 })), personal: { place: 2, position: 2, nickname: 'Admin', score: 80, mine: true } };
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('fixtureCapabilities','["analytics_cockpit"]');` + multiAccountFixture({ admin }, 'admin').replace('if(!uid())return', "if(name==='lumen_ranking_board')return {data:" + JSON.stringify(board) + '};if(!uid())return') });
  for (const [width, height] of [[360, 640], [390, 844], [412, 915]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: 'http://127.0.0.1:' + appServer.address().port + '/' });
    await until(`!!window.lumenDiagnostics&&document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')`, 'hydrated');
    await acknowledgeLearningMilestones(evaluate);
    const before = await evaluate(`({local:localStorage.getItem('lumenProgressV1'),writes:window.__server.accounts.admin.writes,attempt:localStorage.getItem('lumenActiveAttemptV1')})`);
    // Leftovers of a previous quest review, exactly as on the phone capture.
    await evaluate(`(()=>{document.getElementById('skyRevealTime').textContent='Pas encore de temps officiel sur cette version de la grille';document.getElementById('skyRevealPerformance').classList.add('victory-performance-ranked');const r=document.getElementById('skyRevealRank');r.hidden=false;r.innerHTML='<strong>Pas encore classé</strong>'})()`);
    await evaluate(`document.getElementById('adminCockpitOpen').click()`);
    await until(`document.getElementById('adminCockpit').hidden===false`, 'cockpit open');
    await evaluate(`document.querySelector('[data-analytics-section="support"]').click()`);
    await until(`!!document.getElementById('adminPreviewMastery').getClientRects().length`, 'test tools visible in Support & administration');
    await evaluate(`document.getElementById('adminPreviewMastery').click()`);
    await until(`document.getElementById('skyReveal').dataset.celestial==='adventure-mastery'&&!document.getElementById('skyReveal').hidden`, 'preview open');
    await until(`document.querySelectorAll('#skyRevealPodium .ranking-row').length===3&&/place/.test(document.getElementById('skyRevealRank').textContent)`, 'real board of the quest shown');
    assert.equal(await evaluate(`document.getElementById('adminCockpit').hidden`), true, 'The cockpit closes to show the preview');
    assert.match(await evaluate(`document.getElementById('skyRevealTitle').textContent`), /aventure pleinement maîtrisée/);
    const fit = await evaluate(`(()=>{const o=document.getElementById('skyReveal'),card=o.querySelector('.sky-reveal-card'),buttons=[...card.querySelectorAll('button')].filter(b=>!b.hidden&&b.getClientRects().length),slot=document.getElementById('skyRevealPodium').getBoundingClientRect(),steps=[1,2,3].map(p=>document.querySelector('#skyRevealPodium .ranking-step-'+p)?.getBoundingClientRect());return {labels:buttons.map(b=>b.textContent.trim()),cardScroll:card.scrollHeight-card.clientHeight,lowest:Math.max(...buttons.map(b=>Math.round(b.getBoundingClientRect().bottom))),height:innerHeight,rank:document.getElementById('skyRevealRank').textContent,podium:steps.every(r=>r&&r.top>=slot.top-1&&r.bottom<=slot.bottom+1&&r.height>20),rewards:document.querySelectorAll('#skyRevealRewards .victory-reward').length}})()`);
    assert(!fit.labels.some((label) => /Revoir mon aventure|Défier/.test(label)), 'No review CTA and no challenge in the preview: ' + JSON.stringify(fit));
    assert(!/Pas encore classé/.test(fit.rank) && fit.podium && fit.rewards === 5, 'Rank, full podium and the 5 badges are shown: ' + JSON.stringify(fit));
    assert(fit.cardScroll <= 1 && fit.lowest <= fit.height, 'The preview fits ' + width + 'x' + height + ' without scrolling: ' + JSON.stringify(fit));
    const after = await evaluate(`({local:localStorage.getItem('lumenProgressV1'),writes:window.__server.accounts.admin.writes,attempt:localStorage.getItem('lumenActiveAttemptV1')})`);
    assert.deepEqual(after, before, 'The preview writes nothing locally or to the server');
    results.push({ width, height, fit });
  }
  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results, errors, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await closeBrowser(send);
  appServer.close();
}
