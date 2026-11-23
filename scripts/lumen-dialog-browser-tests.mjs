// #921 · Real browser: the grid reset is confirmed by the in-game Lumen dialog,
// never by a native « lumen.nopuna.fr indique » box. Cancel, Escape, backdrop and
// Back keep the board; confirming clears only the marks and keeps the attempt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, acknowledgeLearningMilestones } from './cdp-client.mjs';

const { send, evaluate, errors } = await connectBrowser(),
  results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expression) {
  for (let i = 0; i < 150; i++) {
    if (await evaluate(expression)) return;
    await sleep(80);
  }
  throw Error('Timed out: ' + expression);
}
const url = new URL(process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/');
url.searchParams.set('qa', 'new');
const visible = (id) =>
  `(()=>{const e=document.getElementById(${JSON.stringify(id)});return !!e&&!e.hidden&&e.getClientRects().length>0})()`;
const attempt = () => evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')`);
const marks = () => evaluate('lumenDiagnostics.snapshot().state.flat().filter(Boolean).length');
// Past the scripted lesson: the first quests are already solved.
const progress = {
  solved: { 0: 1, 1: 1, 2: 1 },
  xp: 60,
  shards: 3,
  badges: {},
  autoCrossUnlockSeen: 1,
  fullBadgeIntroSeen: 1,
};
const copy = {
  fr: { title: 'Effacer tes placements ?', keep: 'Continuer à jouer', yes: 'Effacer' },
  en: { title: 'Clear your placements?', keep: 'Keep playing', yes: 'Clear' },
};

async function tapCell(row, col) {
  const point = await evaluate(
    `(()=>{const el=document.querySelector('.cell[data-row="${row}"][data-col="${col}"]');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, ...point, button: 'left', clickCount: 1 });
  await sleep(60);
}
async function openReset() {
  await evaluate('document.getElementById("new").click()');
  assert.equal(await evaluate(visible('lumenConfirm')), true, 'the Lumen dialog opens');
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  for (const [width, height, locale] of [
    [360, 640, 'fr'],
    [390, 844, 'en'],
    [1440, 900, 'fr'],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    const fixture = await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const key of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(key,'1');localStorage.setItem('lumenSound','off');localStorage.setItem('lumen.locale',${JSON.stringify(locale)});window.__nativeDialogs=0;for(const name of ['alert','confirm','prompt'])window[name]=()=>{window.__nativeDialogs++;return false};`,
    });
    await send('Page.navigate', { url: url.href });
    await until('!!window.lumenDiagnostics');
    await sleep(600);
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixture.identifier });
    await evaluate('lumenDiagnostics.setupQuest(3)');
    await acknowledgeLearningMilestones(evaluate);
    await evaluate(
      `document.getElementById('autoCross').checked=false;document.getElementById('autoCross').dispatchEvent(new Event('change'));if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click()`,
    );
    const solutionCol = await evaluate('lumenDiagnostics.snapshot().puz.sol[0]');
    await tapCell(0, solutionCol === 0 ? 1 : 0);
    assert.equal(await marks(), 1, 'one mark before the reset');
    const before = await attempt();

    // 1. Opening: Lumen copy, safe default focus, readable on the screen.
    await openReset();
    const dialog = await evaluate(
      `(()=>{const o=document.getElementById('lumenConfirm'),card=o.querySelector('.social-card'),r=card.getBoundingClientRect();return {role:o.getAttribute('role'),modal:o.getAttribute('aria-modal'),title:document.getElementById('lumenConfirmTitle').textContent,copy:document.getElementById('lumenConfirmCopy').textContent,keep:document.getElementById('lumenConfirmCancel').textContent,yes:document.getElementById('lumenConfirmYes').textContent,focus:document.activeElement?.id,overflow:document.documentElement.scrollWidth>innerWidth,fits:r.top>=0&&r.bottom<=innerHeight&&card.scrollHeight<=card.clientHeight+1,tap:Math.min(...[...card.querySelectorAll('button')].map(b=>b.offsetHeight))}})()`,
    );
    assert.equal(dialog.role, 'alertdialog');
    assert.equal(dialog.modal, 'true');
    assert.equal(dialog.title, copy[locale].title);
    assert.equal(dialog.keep, copy[locale].keep);
    assert.equal(dialog.yes, copy[locale].yes);
    assert.match(
      dialog.copy,
      locale === 'fr' ? /chrono continuera/ : /timer keeps running/,
      'consequences stay explicit',
    );
    assert.equal(dialog.focus, 'lumenConfirmCancel', 'the safe choice has focus');
    assert.equal(dialog.overflow, false);
    assert.equal(
      dialog.fits,
      true,
      'the whole dialog is visible without scrolling ' + JSON.stringify({ width, height }),
    );
    assert(dialog.tap >= 44, 'touch targets are at least 44px');

    // 2. Keyboard focus stays in the dialog.
    for (let i = 0; i < 3; i++)
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Tab',
        code: 'Tab',
        windowsVirtualKeyCode: 9,
      });
    assert.equal(
      await evaluate("!!document.activeElement.closest('#lumenConfirm')"),
      true,
      'Tab is trapped',
    );

    // 3. Every cancel path keeps the board and the attempt.
    await evaluate('document.getElementById("lumenConfirmCancel").click()');
    assert.equal(await evaluate(visible('lumenConfirm')), false);
    assert.equal(
      await evaluate('document.activeElement?.id'),
      'new',
      'focus returns to the reset button',
    );
    await openReset();
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
    });
    assert.equal(await evaluate(visible('lumenConfirm')), false, 'Escape cancels');
    await openReset();
    await evaluate(
      `document.getElementById('lumenConfirm').dispatchEvent(new MouseEvent('click',{bubbles:true}))`,
    );
    assert.equal(await evaluate(visible('lumenConfirm')), false, 'the backdrop cancels');
    await openReset();
    const href = await evaluate('location.href');
    await evaluate('history.back()');
    await until(`!${visible('lumenConfirm')}`);
    assert.equal(
      await evaluate('location.href'),
      href,
      'Back closes the dialog without leaving the game',
    );
    assert.equal(await marks(), 1, 'cancelling never clears the board');
    assert.equal((await attempt()).resetCount || 0, before.resetCount || 0);

    // 4. Confirm: marks cleared; same attempt, time, aids and qualification.
    await openReset();
    await evaluate('document.getElementById("lumenConfirmYes").click()');
    await sleep(100);
    const after = await attempt();
    assert.equal(await evaluate(visible('lumenConfirm')), false);
    assert.equal(await marks(), 0, 'confirming clears the marks');
    assert.equal(after.attemptId, before.attemptId, 'the run identity continues');
    assert.equal(after.resetCount, (before.resetCount || 0) + 1);
    assert(after.activeDuration >= before.activeDuration, 'the official time is never reset');
    assert.equal(after.qualifying, before.qualifying);
    assert.deepEqual(after.helpUses || {}, before.helpUses || {});
    await sleep(200);
    assert.equal(
      await evaluate('location.href'),
      href,
      'removing the dialog history entry stays on the game',
    );
    assert.equal(await evaluate('window.__nativeDialogs'), 0, 'no native alert/confirm/prompt');
    results.push({
      width,
      height,
      locale,
      cancel: true,
      escape: true,
      backdrop: true,
      back: true,
      confirm: true,
      focusTrap: true,
    });
  }
  assert.deepEqual(errors, []);
  if (process.argv[2])
    fs.writeFileSync(process.argv[2], JSON.stringify({ results, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await send('Browser.close').catch(() => {});
}
