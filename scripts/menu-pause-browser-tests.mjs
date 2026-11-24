// #925 · Real browser: every top menu pauses the live quest through the existing
// pause; the grid is masked (opaque, inert) and the official clock stops, then
// resumes once when the last menu closes. No time counted twice, none lost.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, acknowledgeLearningMilestones } from './cdp-client.mjs';

const { send, evaluate, errors } = await connectBrowser(),
  results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expression, label = expression) {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(expression)) return;
    await sleep(40);
  }
  throw Error('Timed out: ' + label);
}
const url = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
url.searchParams.set('qa', 'new');
const progress = {
  solved: { 0: 1, 1: 1, 2: 1 },
  xp: 60,
  shards: 3,
  badges: {},
  autoCrossUnlockSeen: 1,
  fullBadgeIntroSeen: 1,
};
const attempt = () => evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')`);
const state = async () => (await attempt())?.state;
const running = `JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).state==='RUNNING'`;
const paused = `JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).state==='PAUSED'`;
const masked = `(()=>{const m=document.getElementById('attemptMask'),b=document.getElementById('board'),mr=m.getBoundingClientRect(),br=b.getBoundingClientRect(),c=b.querySelector('.cell').getBoundingClientRect(),top=document.elementFromPoint(c.x+c.width/2,c.y+c.height/2);return !m.hidden&&getComputedStyle(m).backgroundColor==='rgb(7, 17, 29)'&&b.inert===true&&mr.left<=br.left+1&&mr.top<=br.top+1&&mr.right>=br.right-1&&mr.bottom>=br.bottom-1&&!top?.closest?.('#board')})()`;
const menus = [
  {
    name: 'social',
    open: `document.getElementById('openSocial').click()`,
    close: `document.getElementById('socialHubClose').click()`,
    shown: `!document.getElementById('socialHub').hidden`,
  },
  {
    name: 'account',
    open: `document.getElementById('mobileAccount').click()`,
    close: `document.getElementById('mobileAccount').click()`,
    shown: `!document.getElementById('mobileAuthPopover').hidden`,
  },
  {
    name: 'help',
    open: `document.getElementById('tutorialHelp').click()`,
    close: `document.getElementById('rulesModal').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
    shown: `!document.getElementById('rulesModal').hidden`,
  },
  {
    name: 'report',
    open: `document.getElementById('betaFeedbackBtn').click()`,
    close: `document.getElementById('feedbackCancel').click()`,
    shown: `!document.getElementById('feedbackModal').hidden`,
  },
  {
    name: 'share',
    open: `document.getElementById('shareLumen').click()`,
    close: `document.getElementById('lumenShareDialog').close()`,
    shown: `document.getElementById('lumenShareDialog').open`,
  },
];

try {
  await send('Page.enable');
  await send('Runtime.enable');
  for (const [width, height] of [
    [360, 640],
    [1440, 900],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    const fixture = await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const key of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(key,'1');localStorage.setItem('lumenSound','off');`,
    });
    await send('Page.navigate', { url: url.href });
    await until('!!window.lumenDiagnostics');
    await sleep(600);
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixture.identifier });
    await evaluate('lumenDiagnostics.setupQuest(3)');
    await acknowledgeLearningMilestones(evaluate);
    await evaluate(`document.getElementById('attemptMask').click()`);
    await until(running, 'the run starts');

    // 1. Each top menu: pause on open, frozen clock, opaque inert grid, one resume on close.
    for (const menu of menus) {
      await evaluate(menu.open);
      await until(menu.shown, menu.name + ' opens');
      await until(paused, menu.name + ' pauses');
      assert.equal(await evaluate(masked), true, menu.name + ': grid masked, opaque and inert');
      const frozen = (await attempt()).activeDuration;
      await sleep(600);
      assert.equal(
        (await attempt()).activeDuration,
        frozen,
        menu.name + ': no time counted while open',
      );
      await evaluate(menu.close);
      await until(`!(${menu.shown})`, menu.name + ' closes');
      await until(running, menu.name + ' resumes');
      assert.equal(
        await evaluate(
          `document.getElementById('attemptMask').hidden&&!document.getElementById('board').inert`,
        ),
        true,
      );
      await evaluate(`document.getElementById('attemptPause').click()`);
      const after = (await attempt()).activeDuration;
      assert(
        after >= frozen && after - frozen < 500,
        menu.name + ': resumed exactly once, no time lost ' + JSON.stringify({ frozen, after }),
      );
      await evaluate(`document.getElementById('attemptPause').click()`);
      await until(running);
    }

    // 1b. Android native share sheet (recette 22/11): no Lumen dialog opens and the
    // page stays visible, yet the clock stops until the sheet settles, then resumes once.
    await evaluate(
      `(()=>{window.__shareDone=null;Object.defineProperty(navigator,'share',{configurable:true,value:()=>new Promise(r=>{window.__shareDone=r})})})()`,
    );
    await evaluate(`document.getElementById('shareLumen').click()`);
    await until('!!window.__shareDone', 'native sheet opens');
    await until(paused, 'native sheet pauses');
    assert.equal(await evaluate(masked), true, 'native share: grid masked, opaque and inert');
    assert.equal(await evaluate(`document.getElementById('lumenShareDialog').open`), false);
    const sheetFrozen = (await attempt()).activeDuration;
    await sleep(600);
    assert.equal((await attempt()).activeDuration, sheetFrozen, 'native share: no time counted');
    await evaluate('window.__shareDone()');
    await until(running, 'native share resumes');
    await evaluate(`document.getElementById('attemptPause').click()`);
    const sheetAfter = (await attempt()).activeDuration;
    assert(
      sheetAfter >= sheetFrozen && sheetAfter - sheetFrozen < 500,
      'native share: resumed exactly once ' + JSON.stringify({ sheetFrozen, sheetAfter }),
    );
    await evaluate(`document.getElementById('attemptPause').click()`);
    await until(running);
    await evaluate(`delete navigator.share`);

    // 2. Chained menus: the grid never shows and the clock never restarts in between.
    await evaluate(`document.getElementById('tutorialHelp').click()`);
    await until(paused);
    await evaluate(
      `(()=>{window.__seen=[];document.getElementById('closeRulesModal').click();document.getElementById('mobileAccount').click();const id=setInterval(()=>{window.__seen.push(JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).state+':'+document.getElementById('attemptMask').hidden)},15);setTimeout(()=>clearInterval(id),400)})()`,
    );
    await sleep(500);
    const samples = await evaluate('window.__seen');
    assert(
      samples.length > 10 && samples.every((s) => s === 'PAUSED:false'),
      'chained menus keep the pause ' + JSON.stringify(samples),
    );
    await evaluate(`document.getElementById('mobileAccount').click()`);
    await until(running, 'resume after the last menu');

    // 3. Already paused by the player: stays paused.
    await evaluate(`document.getElementById('attemptPause').click()`);
    await until(paused);
    await evaluate(`document.getElementById('openSocial').click()`);
    await evaluate(`document.getElementById('socialHubClose').click()`);
    await sleep(500);
    assert.equal(await state(), 'PAUSED', 'the player intent wins');

    // 4. Backgrounded while a menu is open: returning never silently resumes.
    await evaluate(`document.getElementById('attemptPause').click()`);
    await until(running);
    await evaluate(`document.getElementById('tutorialHelp').click()`);
    await until(paused);
    await evaluate(
      `(()=>{const set=v=>Object.defineProperty(document,'visibilityState',{get:()=>v,configurable:true});set('hidden');document.dispatchEvent(new Event('visibilitychange'));set('visible');document.dispatchEvent(new Event('visibilitychange'))})()`,
    );
    await evaluate(`document.getElementById('closeRulesModal').click()`);
    await sleep(500);
    assert.equal(await state(), 'PAUSED', 'background then menu close stays paused');
    await evaluate(`document.getElementById('attemptMask').click()`);
    await until(running, 'explicit resume');

    // 5. In-game dialog (Abandonner): paused while asking, resumed on cancel.
    await evaluate(`document.getElementById('attemptAbandon').click()`);
    await until(paused, 'abandon dialog pauses');
    assert.equal(await evaluate(masked), true);
    await evaluate(`document.getElementById('abandonContinue').click()`);
    await until(running, 'cancel resumes');
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    results.push({
      width,
      height,
      menus: menus.map((m) => m.name),
      chained: true,
      alreadyPaused: true,
      background: true,
      dialog: true,
    });
  }
  assert.deepEqual(errors, []);
  if (process.argv[2])
    fs.writeFileSync(process.argv[2], JSON.stringify({ results, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await send('Browser.close').catch(() => {});
}
