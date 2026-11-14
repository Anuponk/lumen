// #682: stable victory layout, five badges on one row, performance block with a
// reserved podium slot, stepped podium, one row of secondary actions, no
// participant counters, reduced motion. Real Chrome portrait viewports (Lumen is
// portrait-only: manifest orientation portrait-primary), synthetic board.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, closeBrowser, revealVictoryResults } from './cdp-client.mjs';
const { send, evaluate, errors } = await connectBrowser(),
  results = [];
async function until(expr) {
  for (let i = 0; i < 160; i++) {
    if (await evaluate(expr)) return;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw Error('Timed out: ' + expr);
}
const ZONES = `(()=>{const q=s=>document.querySelector(s),r=e=>{const b=e.getBoundingClientRect();return [Math.round(b.top),Math.round(b.height)]};
 return {canvas:r(q('#skyRevealCanvas')),rewards:r(q('#skyRevealRewards')),performance:r(q('#skyRevealPerformance')),row:r(q('.victory-performance-row')),slot:r(q('#skyRevealPodium')),next:r(q('#skyRevealNext')),retry:r(q('#skyRevealRetry'))}})()`;
try {
  await send('Page.enable');
  await send('Runtime.enable');
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    const fixture = await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.clear();localStorage.setItem('lumenOnboardingV1:guest','{"auto":true}');localStorage.setItem('lumenSound','off');`,
    });
    const url = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
    url.searchParams.set('qa', 'new');
    await send('Page.navigate', { url: url.href });
    await until('!!window.lumenDiagnostics');
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixture.identifier });
    await evaluate(
      `lumenDiagnostics.setupQuest(20);(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`,
    );
    await until('!document.getElementById("skyReveal").hidden');
    await revealVictoryResults(evaluate);
    // Five stable reward slots on a single row.
    const rewards = await evaluate(
      `(()=>{const items=[...document.querySelectorAll('#skyRevealRewards .victory-reward')];return {count:items.length,tops:[...new Set(items.map(e=>Math.round(e.getBoundingClientRect().top)))].length,keys:items.map(e=>e.dataset.reward),overflow:items.some(e=>e.scrollWidth>e.clientWidth+1)}})()`,
    );
    assert.deepEqual(rewards.keys, ['star', 'autonomy', 'speed', 'noError', 'mastery']);
    assert.equal(rewards.tops, 1, 'Five badges on one row at ' + width + 'x' + height);
    // Navigation: dominant next action, then three equal secondary actions on one row.
    const actions = await evaluate(
      `(()=>{const r=id=>document.getElementById(id).getBoundingClientRect(),n=r('skyRevealNext'),s=['skyRevealSky','skyRevealShare','skyRevealRetry'].map(r);return {nextWide:n.width>=s[0].width*2.5,below:s.every(b=>b.top>=n.bottom-1),oneRow:new Set(s.map(b=>Math.round(b.top))).size===1,sameWidth:Math.max(...s.map(b=>b.width))-Math.min(...s.map(b=>b.width))<2,tall:s.every(b=>b.height>=44),labels:['skyRevealSky','skyRevealShare','skyRevealRetry'].map(id=>document.getElementById(id).textContent.trim())}})()`,
    );
    assert.deepEqual(
      { ...actions, labels: undefined },
      { nextWide: true, below: true, oneRow: true, sameWidth: true, tall: true, labels: undefined },
      JSON.stringify({ width, height, actions }),
    );
    assert.deepEqual(actions.labels, ['✦ Mon ciel', '➤ Défier', '↻ Rejouer']);
    // A signed-in player expects a ranking: reserve the slot, then let the board
    // arrive late (0 s, 1 s, 5 s). No other zone may move.
    await evaluate(`(async()=>{
      document.getElementById('skyRevealPerformance').classList.add('victory-performance-ranked');
      const tile=document.getElementById('skyRevealRank');tile.hidden=false;tile.textContent='Classement…';
      const {createRankingView}=await import('./src/ui/ranking.js');
      window.layoutBoard={participating:true,realParticipants:6,top:[1,2,3].map(p=>({place:p,position:p,nickname:p===2?'Anupon':'Écho '+p,score:p*40,mine:p===2,virtual:p!==2})),personal:{place:2,position:2,nickname:'Anupon',score:80,mine:true}};
      window.layoutDelay=0;
      window.layoutView=createRankingView({client:{flush:async()=>[],board:()=>new Promise(r=>setTimeout(()=>r(window.layoutBoard),window.layoutDelay))},getContext:()=>({owner:'synthetic',client:null}),format:s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0')});
    })()`);
    for (const delay of [0, 1000, 5000]) {
      await evaluate(`window.layoutView.clear();window.layoutDelay=${delay};window.layoutView.show({id:'layout'});window.layoutView.mount()`);
      const before = await evaluate(ZONES);
      await until('document.querySelectorAll("#skyRevealPodium .ranking-row").length===3');
      const after = await evaluate(ZONES);
      for (const zone of Object.keys(before))
        assert(
          Math.abs(before[zone][0] - after[zone][0]) <= 1 && Math.abs(before[zone][1] - after[zone][1]) <= 1,
          'Late board (' + delay + ' ms) moved ' + zone + ' ' + JSON.stringify({ width, height, before: before[zone], after: after[zone] }),
        );
    }
    // Stepped podium 2-1-3, decreasing heights, only the player's step highlighted.
    const podium = await evaluate(
      `(()=>{const step=p=>document.querySelector('#skyRevealPodium .ranking-step-'+p).getBoundingClientRect();const s=[1,2,3].map(step);return {order:s[1].left<s[0].left&&s[0].left<s[2].left,heights:s[0].height>s[1].height&&s[1].height>s[2].height,mine:[...document.querySelectorAll('#skyRevealPodium .ranking-mine')].map(e=>Number(e.dataset.position))}})()`,
    );
    assert.deepEqual(podium, { order: true, heights: true, mine: [2] }, JSON.stringify({ width, height, podium }));
    const text = await evaluate(`document.getElementById('skyReveal').innerText`);
    assert.doesNotMatch(text, /\d+\s+joueurs?\b|joueurs? réels?|\d+\s+virtuels?\b/i, 'No participant counter on the victory screen');
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth>innerWidth`),
      false,
      'No horizontal scrolling at ' + width + 'x' + height,
    );
    results.push({ width, height, rewards: rewards.count, actions: true, lateBoard: [0, 1000, 5000], podium: true });
  }
  // Reduced motion: the shared celebration renders no particles.
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const url = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
  url.searchParams.set('qa', 'new');
  await send('Page.navigate', { url: url.href });
  await until('!!window.lumenDiagnostics');
  await evaluate(
    `lumenDiagnostics.setupQuest(20);(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`,
  );
  await until('!document.getElementById("skyReveal").hidden');
  assert.equal(await evaluate(`document.querySelectorAll('.victory-particle').length`), 0, 'Reduced motion: no particles');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  results.push({ reducedMotion: true });
  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await closeBrowser(send);
}
