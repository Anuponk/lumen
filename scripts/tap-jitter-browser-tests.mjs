// #994 · Real touch input: a tap whose finger rolls a few pixels INSIDE its cell
// is still a tap (cross -> Guardian -> empty), never a drag that erases or does
// nothing. Android's own tap slop is larger than Lumen's 8 px drag threshold.
// Drags across cells keep working (drag-cascade-browser-tests.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, navigateAndWait, acknowledgeLearningMilestones } from './cdp-client.mjs';

const { send, evaluate, errors } = await connectBrowser(),
  results = [];
const url = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
url.searchParams.set('qa', 'new');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const progress = {
  catalogueOrigin: 1,
  badges: {},
  stars: {},
  challenges: {},
  performances: {},
  solved: Object.fromEntries(Array.from({ length: 80 }, (_, i) => [i, 1])),
  shards: 80,
  autoCrossUnlockSeen: 1,
  fullBadgeIntroSeen: 1,
};
const cellState = (r, c) => evaluate(`lumenDiagnostics.snapshot().state[${r}][${c}]`);
async function center(r, c) {
  return evaluate(
    `(()=>{const b=document.querySelector('.cell[data-row="${r}"][data-col="${c}"]').getBoundingClientRect();return {x:b.x+b.width/2,y:b.y+b.height/2,w:b.width}})()`,
  );
}
// One finger: down, a small roll inside the same cell, up. Returns the time from
// touchEnd until the cell shows the new state (render latency, not a timer).
async function tap(r, c, jitter) {
  const p = await center(r, c);
  const before = await cellState(r, c);
  await evaluate(
    `window.__shown=null;window.__seen=new MutationObserver(()=>{window.__shown??=performance.now()});window.__seen.observe(document.querySelector('.cell[data-row="${r}"][data-col="${c}"]'),{attributes:true,attributeFilter:['data-shown','class']})`,
  );
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] });
  if (jitter) {
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x + jitter * 0.6, y: p.y + jitter * 0.8 }] });
  }
  const end = await evaluate('performance.now()');
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(60);
  const shownAt = await evaluate('(window.__seen.disconnect(),window.__shown)');
  return { before, after: await cellState(r, c), latencyMs: shownAt == null ? null : Math.round(shownAt - end), cellPx: Math.round(p.w) };
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const k of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');`,
  });
  await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: url.href });
  for (const width of [360, 412]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 800, mobile: true, deviceScaleFactor: 2.625 });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await evaluate('lumenDiagnostics.setupQuest(70)');
    await acknowledgeLearningMilestones(evaluate);
    await evaluate(
      `(()=>{for(const id of ['questStart','manualCrossTip','autonomyOverlay'])document.getElementById(id).hidden=true;const a=document.getElementById('autoCross');if(a.checked)a.click();const g=document.getElementById('guidedErrors');if(g?.checked)g.click();if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click()})()`,
    );
    for (const jitter of [0, 6, 11, 14]) {
      await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(Array.from({length:s.n},()=>Array(s.n).fill(0)))})()');
      await sleep(30);
      const [r, c] = await evaluate('(()=>{const s=lumenDiagnostics.snapshot();return [0,s.puz.sol[0]]})()');
      const first = await tap(r, c, jitter);
      await sleep(120);
      const second = await tap(r, c, jitter);
      await sleep(120);
      const third = await tap(r, c, jitter);
      assert.deepEqual(
        [first.after, second.after, third.after],
        [1, 2, 0],
        `${width}px, ${jitter}px roll inside the cell: cross -> Guardian -> empty ` + JSON.stringify({ first, second, third }),
      );
      // Two quick taps (double tap) on an empty cell reach the Guardian.
      await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(Array.from({length:s.n},()=>Array(s.n).fill(0)))})()');
      await sleep(30);
      const d1 = await tap(r, c, jitter);
      const d2 = await tap(r, c, jitter);
      assert.equal(d2.after, 2, `${width}px, ${jitter}px: a double tap places the Guardian ` + JSON.stringify({ d1, d2 }));
      results.push({ width, jitter, cellPx: first.cellPx, latencyMs: [first, second, third, d1, d2].map((t) => t.latencyMs) });
    }
  }
  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await send('Browser.close').catch(() => {});
}
