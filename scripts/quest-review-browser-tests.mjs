// #695: a completed quest opens a read-only review (time, badges, ranking) on
// the shared victory surface, from the real Mon ciel tiles, at portrait sizes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, closeBrowser } from './cdp-client.mjs';
const { send, evaluate, errors } = await connectBrowser();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expr) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expr)) return;
    await sleep(80);
  }
  throw Error('Timed out: ' + expr);
}
// Quest 3 completed with two saved badges and an official time on revision 1.
const progress = {
  solved: { 0: 1, 1: 1, 2: 1, 3: 1 },
  badges: {},
  performances: { 2: { version: 2, badges: { autonomy: true, speed: true }, officialTimes: { 1: 83 } } },
  autonomySeen: 1,
  fullBadgeIntroSeen: 1,
  speedBadgeIntroSeen: 1,
  autoCrossUnlockSeen: 1,
};
const results = [];
try {
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(progress))});localStorage.setItem('lumenSound','off');localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenInstallLater',String(Date.now()));localStorage.setItem('lumenPushChoice','later');`,
  });
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/' });
    await until('!!window.lumenDiagnostics&&document.readyState==="complete"');
    await sleep(600);
    const open = `(()=>{for(const id of ['questStart','rulesModal','manualCrossTip'])document.getElementById(id)&&(document.getElementById(id).hidden=true);
      document.getElementById('openSky').click();
      document.querySelector('#adventureRail [data-pack-id="base-real-sky"]')?.click();
      for(let page=0;!document.querySelector('#sectorTabs [data-content-id="real-01"]')&&page<12;page++)document.getElementById('constellationPrevious').click();
      document.querySelector('#sectorTabs [data-content-id="real-01"]')?.click();
      const card=document.querySelector('#puzzleGrid .puzzle-card[data-quest-id="base-q003"]');if(!card)return 'no card';card.click();return 'ok'})()`;
    const before = await evaluate(`localStorage.getItem('lumenProgressV1')`);
    assert.equal(await evaluate(open), 'ok', 'Completed quest card found in Mon ciel');
    await until(`!document.getElementById('skyReveal').hidden`);
    await sleep(300);
    const view = await evaluate(`(()=>{const q=id=>document.getElementById(id),inView=e=>{const r=e.getBoundingClientRect();return !e.hidden&&r.width>0&&r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1};
      return {kicker:q('skyRevealKicker').textContent,time:q('skyRevealTime').textContent,
       owned:[...document.querySelectorAll('#skyRevealRewards .victory-reward-owned')].map(e=>e.dataset.reward),
       fresh:document.querySelectorAll('#skyRevealRewards .victory-reward-new').length,
       next:q('skyRevealNext').hidden,share:q('skyRevealShare').hidden,retry:inView(q('skyRevealRetry')),sky:inView(q('skyRevealSky')),
       particles:document.querySelectorAll('.victory-particle').length,mapOpen:!q('mapModal').hidden,
       onTop:q('skyReveal').contains(document.elementFromPoint(innerWidth/2,innerHeight/2))}})()`);
    assert.match(view.kicker, /TON BILAN · QUÊTE 3/);
    assert.match(view.time, /^Record : /, 'Saved official time of the current grid revision');
    assert.deepEqual(view.owned, ['star', 'autonomy', 'speed'], 'Only saved badges are shown as owned');
    assert.equal(view.fresh, 0, 'A review never presents a reward as new');
    assert.equal(view.next, true, 'No "next quest" from a review');
    assert.equal(view.share, true, 'Challenges are only created after a first success');
    assert.equal(view.retry && view.sky, true, 'Rejouer and Mon ciel stay on screen at ' + width + 'x' + height);
    assert.equal(view.particles, 0, 'No celebration effect');
    assert.equal(view.onTop, true, 'The review is above Mon ciel');
    // Mon ciel closes the review and returns to the map, with nothing written.
    await evaluate(`document.getElementById('skyRevealSky').click()`);
    await until(`document.getElementById('skyReveal').hidden`);
    assert.equal(await evaluate(`!document.getElementById('mapModal').hidden`), true, 'Back to Mon ciel');
    assert.equal(await evaluate(`localStorage.getItem('lumenProgressV1')`), before, 'Opening a review writes nothing');
    // Rejouer keeps the former replay entry.
    await evaluate(`document.querySelector('#puzzleGrid .puzzle-card[data-quest-id="base-q003"]').click()`);
    await until(`!document.getElementById('skyReveal').hidden`);
    await evaluate(`document.getElementById('skyRevealRetry').click()`);
    await until(`document.getElementById('skyReveal').hidden&&document.getElementById('mapModal').hidden`);
    const replay = await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();return {replay:s.replayMode,level:s.levelIndex}})()`);
    assert.deepEqual(replay, { replay: true, level: 2 }, 'Rejouer starts the usual replay of quest 3');
    results.push({ width, height, ...view });
  }
  // A quest that is not completed still starts directly (unchanged).
  await evaluate(`(()=>{document.getElementById('openSky').click();document.querySelector('#sectorTabs [data-content-id="real-01"]')?.click();document.querySelector('#puzzleGrid .puzzle-card[data-quest-id="base-q005"]')?.click()})()`);
  await sleep(300);
  assert.equal(await evaluate(`document.getElementById('skyReveal').hidden`), true, 'An unfinished quest opens no review');
  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify(results.map(({ width, height, time, owned }) => ({ width, height, time, owned }))));
} finally {
  await closeBrowser(send);
}
