// #695: a completed quest opens a read-only review (time, badges, ranking) on
// the shared victory surface, from the real Mon ciel tiles, at portrait sizes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, closeBrowser, navigateAndWait, acknowledgeLearningMilestones } from './cdp-client.mjs';
import { multiAccountFixture } from './fixtures/multi-account-browser.mjs';
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
  const guestFixture = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(progress))});localStorage.setItem('lumenSound','off');localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenInstallLater',String(Date.now()));localStorage.setItem('lumenPushChoice','later');`,
  });
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
    [1440, 900],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
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
    // P1: real browser DOM with synthetic Play only; no PaymentRequest.show or server purchase.
    await evaluate(`(async()=>{
      const {createPlayPriceLoader}=await import('/src/persistence/play-billing.js');
      const {adventureOfferModel,mountAdventureOffer}=await import('/src/ui/adventure-offer.js');
      const {contentMapModel}=await import('/src/campaign/content.js');
      const {canonicalQuestList}=await import('/src/campaign/canonical-quests.js');
      const packs=contentMapModel([],{progress:lumenDiagnostics.snapshot().progress}).skies.flatMap(s=>s.packs),pack=packs.find(p=>p.accessible===false);
      window.__playShows=0;window.__playFail=true;
      const win={navigator:{language:'fr-FR'},PaymentRequest:function(){this.canMakePayment=async()=>true;this.show=()=>{window.__playShows++}},getDigitalGoodsService:async()=>({getDetails:()=>new Promise((resolve,reject)=>{window.__playResolve=()=>window.__playFail?reject(Error('offline')):resolve([{itemId:'real_adventure_02',price:{currency:'EUR',value:'1.00'}},{itemId:'real_sky_all',price:{currency:'EUR',value:'5.00'}}])})})};
      window.__playLoader=createPlayPriceLoader({win,ids:[pack.id,'real-sky-all'],playApp:true,onChange:s=>mountAdventureOffer(document.getElementById('adventureNoticeOffer'),adventureOfferModel({pack,packs,quests:canonicalQuestList(),progress:lumenDiagnostics.snapshot().progress,signedIn:true,purchasesAvailable:s.status!=='loading'&&!!s.service,pricesRequired:true,prices:s.prices,priceStatus:s.status,priceErrors:s.errors}),{onRetry:()=>window.__playLoader.load()})});
      window.__playLoad=window.__playLoader.load();
    })()`,true);
    assert.equal(await evaluate(`document.querySelector('[data-offer="unit"]').disabled`),true);
    assert.match(await evaluate(`document.querySelector('.adventure-offer').textContent`),/Chargement du prix/);
    await evaluate(`window.__playResolve();window.__playLoad`,true);
    assert.equal(await evaluate(`document.querySelector('[data-offer="unit"]').disabled`),true);
    assert.match(await evaluate(`document.querySelector('[data-play-price-reason]').dataset.playPriceReason`),/details_request_failed/);
    await evaluate(`window.__playFail=false;document.querySelector('[data-offer="retry"]').click()`);
    await until(`typeof window.__playResolve==='function'&&window.__playLoader.snapshot().status==='loading'`);
    await evaluate(`window.__playResolve();window.__playLoader.load()`,true);
    assert.equal(await evaluate(`document.querySelector('[data-offer="unit"]').disabled`),false);
    assert.match(await evaluate(`document.querySelector('.adventure-offer-price').textContent`),/1,00\s€/);
    assert.equal(await evaluate(`window.__playShows`),0);
    assert.equal(await evaluate(`(()=>{const e=document.querySelector('.adventure-offer');return e.scrollWidth>e.clientWidth+1})()`),false);
    await evaluate(`document.getElementById('adventureNoticeClose').click()`);
  }
  // #817: use the actual signed-in review and its RPC-driven podium. A board
  // reply can replace the exact step a finger is resting on before release.
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: guestFixture.identifier });
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
  const rankedProfile = { ...progress, historyBackup: progress.solved, canonicalQuestState: {}, daily: { dates: {}, rewards: {} }, challenges: {}, stars: {}, noHint: {}, xp: 1000, shards: 7, walletRevision: 1, skyHistoryVersion: 4 };
  const rankedFixture = multiAccountFixture({ 'ranking-fixture': rankedProfile }, 'ranking-fixture').replace(
    'const a=account();',
    "if(name==='lumen_ranking_board')return window.__fixtureRankingBoard(args.p_quest_id);if(name==='lumen_get_profile')return {data:[{nickname:'Fixture'}]};if(name==='lumen_ranking_account')return {data:{participating:true,nicknameRequired:false}};const a=account();",
  );
  const rankedSource = "localStorage.clear();sessionStorage.clear();localStorage.setItem('lumenInstallLater',String(Date.now()));localStorage.setItem('lumenPushChoice','later');" + rankedFixture + String.raw`
window.__rankingReply=null;
window.__fixtureRankingBoard=id=>{
  const board={data:{participating:true,realParticipants:6,top:[1,2,3].map(position=>({position,place:position,nickname:id+' / '+position,score:position*30,mine:position===2})),personal:{position:2,place:2,score:60}}};
  return id==='base-q003'&&!window.__rankingReply?new Promise(resolve=>window.__rankingReply=()=>resolve(board)):Promise.resolve(board);
};`;
  await send('Page.addScriptToEvaluateOnNewDocument', { source: rankedSource });
  for (const [width, height] of [[360, 640], [390, 844]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/' });
    await until("!!window.lumenDiagnostics&&document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')");
    await acknowledgeLearningMilestones(evaluate);
    await evaluate(`(()=>{document.getElementById('openSky').click();
      document.querySelector('#adventureRail [data-pack-id="base-real-sky"]').click();
      for(let page=0;!document.querySelector('#sectorTabs [data-content-id="real-01"]')&&page<12;page++)document.getElementById('constellationPrevious').click();
      document.querySelector('#sectorTabs [data-content-id="real-01"]').click();
      document.querySelector('#puzzleGrid [data-quest-id="base-q003"]').click();
    })()`);
    await until("!!window.__rankingReply&&!!document.querySelector('#skyRevealPodium .ranking-step-skeleton.ranking-step-1')");
    const profileBefore = await evaluate("localStorage.getItem('lumenProgressV1')");
    const attemptBefore = await evaluate("JSON.stringify(lumenDiagnostics.snapshot())");
    const point = selector => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect();
      const x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2),hit=document.elementFromPoint(x,y);
      return {x,y,hits:hit===el||el.contains(hit)};})()`);
    let touchId = 0;
    const touch = (kind, ...points) => {
      if (kind === 'touchStart') touchId++;
      return send('Input.dispatchTouchEvent', {
        type: kind,
        touchPoints: points.map(point => ({ ...point, id: touchId })),
        timestamp: Date.now() / 1000,
      });
    };
    const tap = async selector => {
      const { x, y } = await hitPoint(selector);
      await touch('touchStart', { x, y });
      await touch('touchMove', { x: x + 1, y });
      await sleep(60);
      await touch('touchEnd');
    };
    const hitPoint = async selector => {
      const { x, y, hits } = await point(selector);
      assert.equal(hits, true, 'The gesture starts on ' + selector);
      return { x, y };
    };
    const drag = async ({ x, y }, dx, dy, duringTouch, beforeFirstMove = false) => {
      await touch('touchStart', { x, y });
      if (beforeFirstMove) await duringTouch();
      await touch('touchMove', { x: x + dx / 3, y: y + dy / 3 });
      if (duringTouch && !beforeFirstMove) await duringTouch();
      await touch('touchMove', { x: x + dx, y: y + dy });
      await touch('touchEnd');
    };
    const podiumReady = quest => until(`document.querySelector('#skyRevealPodium .ranking-name')?.textContent.startsWith(${JSON.stringify(quest)})`);
    const kicker = () => evaluate("document.getElementById('skyRevealKicker').textContent");
    const crown = '#skyRevealPodium .ranking-row.ranking-step-1';
    const reply = async () => {
      await evaluate('window.__rankingReply()');
      await podiumReady('base-q003');
    };
    const skeleton = '#skyRevealPodium .ranking-step-skeleton.ranking-step-1';
    await evaluate("document.getElementById('skyRevealPodium').addEventListener('click',event=>{if(event.isTrusted)window.__podiumTaps=(window.__podiumTaps||0)+1})");
    await tap(skeleton);
    await until('window.__podiumTaps===1');
    assert.match(await kicker(), /QUÊTE 3/, 'A normal touch still reaches the original podium');
    await drag(await hitPoint(skeleton), -102, 18, reply, height === 844);
    assert.match(await kicker(), /QUÊTE 4/, 'A board reply during a swipe on the podium cannot swallow the gesture at ' + width + '×' + height);
    await podiumReady('base-q004');
    await drag(await hitPoint(crown), 102, -18);
    assert.match(await kicker(), /QUÊTE 3/, 'A swipe in the other direction starts directly on a ranked row');
    await podiumReady('base-q003');
    assert.equal(await evaluate("document.querySelector('#skyReveal .sky-reveal-card').scrollTop"), 0, 'Horizontal swipes do not scroll the review');
    await drag(await hitPoint(crown), -15, -70);
    // A native Back gesture is allowed from the edge. Keep that history entry
    // in this document so browser Back cannot replace the test fixture.
    await evaluate("history.pushState(null, '', '#ranked-review-edge')");
    await drag({ x: 5, y: Math.round(height / 2) }, 105, 0);
    const replayButton = await hitPoint('#skyRevealRetry');
    await drag(replayButton, replayButton.x < width / 2 ? 105 : -105, 0);
    assert.match(await kicker(), /QUÊTE 3/, 'Vertical, edge and button gestures leave the review on the same quest');
    assert.equal(await evaluate('window.__podiumTaps'), 1, 'A drag cannot click a podium row');
    assert.equal(await evaluate("localStorage.getItem('lumenProgressV1')"), profileBefore, 'Ranked browsing does not write a save');
    assert.equal(await evaluate("JSON.stringify(lumenDiagnostics.snapshot())"), attemptBefore, 'Ranked browsing never launches a quest');
    await tap('#skyRevealSky');
    await until("document.getElementById('skyReveal').hidden&&!document.getElementById('mapModal').hidden");
    results.push({ width, height, rankedTouch: true });
  }

  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify(results.map(({ width, height, time, owned, rankedTouch }) => ({ width, height, time, owned, rankedTouch }))));
} finally {
  await closeBrowser(send);
}
