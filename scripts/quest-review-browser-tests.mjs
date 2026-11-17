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
    [1440, 900],
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
    // #784: actual surface handlers browse, never launch or write a quest.
    const snapshot=await evaluate(`JSON.stringify(lumenDiagnostics.snapshot())`);
    const arrow=key=>evaluate(`document.getElementById('skyReveal').dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(key)},bubbles:true}))`);
    if(width<600){
      const y=await evaluate(`(()=>{const r=document.getElementById('skyRevealCanvas').getBoundingClientRect();return r.y+r.height/2})()`);
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2+65,y}]});
      await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:width/2-65,y}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      assert.match(await evaluate(`document.getElementById('skyRevealKicker').textContent`),/QUÊTE 4/,'Native touch dispatch browses the next quest');
      await arrow('ArrowLeft');
    }
    await arrow('ArrowRight');
    assert.match(await evaluate(`document.getElementById('skyRevealKicker').textContent`),/QUÊTE 4/);
    await arrow('ArrowRight');
    assert.equal(await evaluate(`document.getElementById('skyRevealTime').textContent`),'À jouer');
    assert.equal(await evaluate(`document.querySelectorAll('#skyRevealRewards .victory-reward-owned').length`),0);
    assert.equal(await evaluate(`document.getElementById('skyRevealRetry').textContent`),'Jouer →');
    await arrow('ArrowRight');
    assert.match(await evaluate(`document.getElementById('skyRevealKicker').textContent`),/QUÊTE 5/,'Locked immediate quest is never skipped');
    await arrow('ArrowLeft');await arrow('ArrowLeft');
    assert.equal(await evaluate(`JSON.stringify(lumenDiagnostics.snapshot())`),snapshot,'No board, attempt, reward or progression mutation');
    assert.equal(await evaluate(`document.querySelectorAll('.victory-particle').length`),0);
    const reviewGeometry=await evaluate(`(()=>{const e=document.querySelector('#skyReveal .sky-reveal-card');return {scroll:e.scrollHeight>e.clientHeight+1}})()`);
    assert.equal(reviewGeometry.scroll,false,'Browsing adds no scroll');
    if(process.env.LUMEN_UX_CAPTURE_DIR){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.LUMEN_UX_CAPTURE_DIR+'/review-'+width+'.png',Buffer.from(shot.data,'base64'))}
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
    await evaluate(`(()=>{document.getElementById('openSky').click();document.querySelector('#puzzleGrid [data-quest-id="base-q004"]').click();document.getElementById('skyReveal').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))})()`);
    assert.equal(await evaluate(`document.getElementById('skyRevealRetry').textContent`),'Jouer →');
    await evaluate(`document.getElementById('skyRevealRetry').click()`);
    assert.deepEqual(await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();return {level:s.levelIndex,replay:s.replayMode,solved:!!s.progress.solved[4],review:!document.getElementById('skyReveal').hidden}})()`),{level:4,replay:false,solved:false,review:false},'Only explicit Jouer starts the unfinished target, without completing it');
    results.push({ width, height, ...view });
  }
  // A quest that is not completed still starts directly (unchanged).
  await evaluate(`(()=>{document.getElementById('openSky').click();document.querySelector('#sectorTabs [data-content-id="real-01"]')?.click();document.querySelector('#puzzleGrid .puzzle-card[data-quest-id="base-q005"]')?.click()})()`);
  await sleep(300);
  assert.equal(await evaluate(`document.getElementById('skyReveal').hidden`), true, 'An unfinished quest opens no review');
  // Browse directly from a new victory, then return to the target's sky, never
  // a hidden historical success dialog or an automatic board launch.
  await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
  await until(`!document.getElementById('skyReveal').hidden`);
  await evaluate(`document.getElementById('skyReveal').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`);
  await until(`document.getElementById('skyReveal').classList.contains('quest-review')`);
  await evaluate(`document.getElementById('skyRevealSky').click()`);
  assert.equal(await evaluate(`document.getElementById('mapModal').hidden`),false,'Mon ciel works when browsing originated at victory');
  // #786: real locked-Adventure surface, canonical prices and delivered counts.
  for(const [width,height] of [[360,640],[1440,900]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
    await evaluate(`(()=>{document.getElementById('openSky').click();document.querySelector('#adventureRail .adventure-chip.locked').click()})()`);
    await until(`!!document.querySelector('[data-offer="unit"]')`);
    const offer=await evaluate(`(()=>{const e=document.querySelector('.adventure-offer');return {text:e.textContent,unit:e.querySelector('[data-offer-count="unit"]').textContent,sky:e.querySelector('[data-offer-count="sky"]').textContent,prices:[...e.querySelectorAll('.adventure-offer-price')].map(x=>x.textContent),overflow:e.scrollWidth>e.clientWidth+1}})()`);
    assert.match(offer.unit,/\+ \d+ nouvelles quêtes/);assert.match(offer.sky,/\+ \d+ nouvelles grilles/);
    assert.deepEqual(offer.prices,['1 €','5 €']);assert.match(offer.text,/Le savais-tu/);assert.equal(offer.overflow,false);
    if(process.env.LUMEN_UX_CAPTURE_DIR){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.LUMEN_UX_CAPTURE_DIR+'/store-'+width+'.png',Buffer.from(shot.data,'base64'))}
    await evaluate(`(async()=>{const {adventureOfferModel,mountAdventureOffer}=await import('/src/ui/adventure-offer.js');const {CONTENT_PACKS,contentMapModel}=await import('/src/campaign/content.js');const {canonicalQuestList}=await import('/src/campaign/canonical-quests.js');const packs=contentMapModel([],{progress:lumenDiagnostics.snapshot().progress}).skies.flatMap(s=>s.packs);const pack=packs.find(p=>p.accessible===false);const model=adventureOfferModel({pack,packs,quests:canonicalQuestList(),progress:lumenDiagnostics.snapshot().progress,signedIn:true,purchasesAvailable:true});window.__offerCalls=[];mountAdventureOffer(document.getElementById('adventureNoticeOffer'),model,{onBuy:(id)=>window.__offerCalls.push(id)});document.querySelector('[data-offer="unit"]').click()})()`,true);
    assert.equal(await evaluate(`window.__offerCalls.length`),0,'Consent gate preserved on the real offer DOM');
    await evaluate(`document.querySelector('[data-offer="waiver"]').click();document.querySelector('[data-offer="unit"]').click();document.querySelector('[data-offer="sky"]').click()`);
    assert.deepEqual(await evaluate(`window.__offerCalls`),['real-adventure-02','real-sky-all']);
    if(process.env.LUMEN_UX_CAPTURE_DIR){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.LUMEN_UX_CAPTURE_DIR+'/store-ready-'+width+'.png',Buffer.from(shot.data,'base64'))}
    await evaluate(`document.getElementById('adventureNoticeClose').click()`);
  }
  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify(results.map(({ width, height, time, owned }) => ({ width, height, time, owned }))));
} finally {
  await closeBrowser(send);
}
