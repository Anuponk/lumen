// #687/#688: on phones the learning coach never covers the board, and account
// screens always win over it (one modal at a time, same step after closing).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, closeBrowser, navigateAndWait } from './cdp-client.mjs';
const { send, evaluate, errors } = await connectBrowser(),
  results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expr) {
  for (let i = 0; i < 160; i++) {
    try {
      if (await evaluate(expr)) return;
    } catch (error) {
      if (!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message)) throw error;
    }
    await sleep(80);
  }
  throw Error('Timed out: ' + expr);
}
const MEASURE = `(()=>{const c=document.getElementById('scriptedLearn'),b=document.getElementById('board');if(!c||c.hidden)return null;const r=c.getBoundingClientRect(),g=b.getBoundingClientRect();
 const ox=Math.max(0,Math.min(r.right,g.right)-Math.max(r.left,g.left)),oy=Math.max(0,Math.min(r.bottom,g.bottom)-Math.max(r.top,g.top));
 return {title:document.getElementById('scriptedLearnTitle').textContent.trim(),covered:ox*oy,boardWidth:Math.round(g.width),gapBelow:Math.round(innerHeight-Math.max(document.querySelector('.game-core').getBoundingClientRect().bottom,document.querySelector('.actions').getBoundingClientRect().bottom)),coachHeight:Math.round(r.height),fullText:document.getElementById('scriptedLearnCopy').scrollHeight<=document.getElementById('scriptedLearnCopy').clientHeight+1,helpReachable:(()=>{const h=document.getElementById('tutorialHelp').getBoundingClientRect();return r.top>=h.bottom+8})(),nextVisible:(()=>{const n=document.getElementById('learningCoachNext');if(n.hidden)return true;const q=n.getBoundingClientRect();return q.bottom<=innerHeight&&q.top>=0})()}})()`;
async function freshGuest(width, height, locale = 'fr') {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
  const isEnglish = locale === 'en';
  const languages = isEnglish ? ['de-DE', 'en-GB'] : ['fr-FR'];
  const fixture = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if(!sessionStorage.getItem('coachTest')){localStorage.clear();sessionStorage.setItem('coachTest','1')}localStorage.setItem('lumenSound','off');
      Object.defineProperty(navigator,'languages',{value:${JSON.stringify(languages)}});
      ${isEnglish ? "Object.defineProperty(navigator,'standalone',{value:true});" : ''}`,
  });
  try {
    await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/' });
  } finally {
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixture.identifier });
  }
  assert.equal(await evaluate("document.getElementById('gameLocaleSetting').hidden"), false, 'The normal game entry point exposes the language selector');
  assert.equal(await evaluate("document.documentElement.lang"), locale);
  if (isEnglish) {
    await until("!document.getElementById('pwaWelcome').hidden");
    assert.equal(await evaluate("document.activeElement.textContent"), 'I’ve played before — Find my progress');
    await evaluate("document.getElementById('pwaWelcomeNew').click()");
    assert.equal(await evaluate("document.activeElement.textContent"), 'Yes, start a new adventure');
    await evaluate("document.getElementById('pwaWelcomeNew').click()");
    await until("!!document.querySelector('.first-welcome:not([hidden]) .intro-play')");
    assert.equal(await evaluate("document.activeElement.textContent"), 'Watch the intro');
  } else {
    await until(`!!document.querySelector('.first-welcome:not([hidden])')||!document.getElementById('scriptedLearn').hidden`);
  }
  await evaluate(`document.querySelector('.first-welcome:not([hidden]) .intro-play')?.click()`);
  await until(`!document.getElementById('scriptedLearn').hidden&&document.getElementById('scriptedLearn').contains(document.elementFromPoint(innerWidth/2,document.getElementById('scriptedLearn').getBoundingClientRect().top+20))`);
  await evaluate(`sessionStorage.removeItem('coachTest')`);
}
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  const snapshot = 'JSON.stringify({board:lumenDiagnostics.snapshot().state,progress:lumenDiagnostics.snapshot().progress,attempt:(a=>a&&(({state,activeDuration,lastActiveAt,updatedAt,...rest})=>rest)(a))(JSON.parse(localStorage.getItem("lumenActiveAttemptV1")))})'; // #925: Help pauses; only pause bookkeeping may change
  for (const [width, height, locale] of [
    [320, 568, 'fr'],
    [360, 640, 'fr'],
    [390, 844, 'fr'],
    [320, 568, 'en'],
    [360, 640, 'en'],
  ]) {
    await freshGuest(width, height, locale);
    const before = await evaluate(snapshot);
    const help = locale === 'en' ? 'Help and rules' : 'Aide et règles';
    const menuTitle = locale === 'en' ? 'LUMEN help' : 'Aide LUMEN';
    assert.equal(await evaluate("document.getElementById('tutorialHelp').getAttribute('aria-label')"), help);
    assert.equal(await evaluate("document.getElementById('undo').textContent"), locale === 'en' ? 'Undo' : 'Annuler');
    assert.equal(await evaluate("document.getElementById('hint').textContent"), locale === 'en' ? 'Hint · +15 s' : 'Indice · +15 s');
    assert.equal(await evaluate("document.getElementById('verify').textContent"), locale === 'en' ? '✓ Check · +5 s' : '✓ Vérifier · +5 s');
    assert.equal(await evaluate("document.querySelector('.learning-territory-number').getAttribute('aria-label').split(' ')[0]"), locale === 'en' ? 'Territory' : 'Territoire');
    await evaluate("document.getElementById('tutorialHelp').click()");
    await until("!document.getElementById('rulesModal').hidden");
    assert.equal(await evaluate("document.getElementById('rulesModalTitle').textContent"), menuTitle);
    assert.equal(await evaluate("document.activeElement.id"), 'closeRulesModal');
    await evaluate("document.getElementById('closeRulesModal').click()");
    await until("document.getElementById('rulesModal').hidden");
    assert.equal(await evaluate(snapshot), before, 'Reading localized rules leaves the board and attempt intact');
    const steps = [];
    for (let i = 0; i < 8; i++) {
      await sleep(250);
      const m = await evaluate(MEASURE);
      if (!m) break;
      assert.equal(m.covered, 0, 'Coach covers the board at ' + width + 'x' + height + ' on « ' + m.title + ' »');
      // #690: the board keeps one size for the whole lesson.
      assert(!steps.length || Math.abs(m.boardWidth - steps[0].boardWidth) <= 1, 'Board size changes on « ' + m.title + ' » (' + steps[0]?.boardWidth + ' -> ' + m.boardWidth + ')');
      assert(!steps.length || Math.abs(m.coachHeight - steps[0].coachHeight) <= 1, 'Coach reserve changes on « ' + m.title + ' »');
      assert(m.boardWidth >= 180, 'Board stays playable (' + m.boardWidth + 'px) on « ' + m.title + ' »');
      assert.equal(m.fullText, true, 'Coach text is not clipped on « ' + m.title + ' »');
      assert.equal(m.helpReachable, true, 'Help button stays reachable above the coach on « ' + m.title + ' »');
      assert.equal(m.nextVisible, true, 'Next control stays reachable on « ' + m.title + ' »');
      steps.push(m);
      const moved = await evaluate(
        `(()=>{const n=document.getElementById('learningCoachNext');if(n.hidden)return false;n.click();return true})()`,
      );
      if (!moved) break;
    }
    assert(steps.length >= 4, 'The intro steps were measured at ' + width + 'x' + height);
    if (locale === 'en') {
      assert.deepEqual(steps.slice(0, 6).map(step => step.title), [
        'Look at the board', 'Your goal', 'One per territory', 'One per row and per column', 'Keep them apart', 'How to play',
      ]);
      assert.equal(await evaluate(snapshot), before, 'Teaching steps leave the board, progress and attempt unchanged');
      assert.equal(await evaluate("document.getElementById('board').dataset.learningStage"), 'place');
    }
    results.push({ width, height, locale, steps: steps.length, covered: 0, board: steps[0].boardWidth, coach: steps[0].coachHeight, gapBelow: steps[0].gapBelow });
  }
  // #754: change language with an active lesson, using the actual rules control.
  await freshGuest(360, 640, 'en');
  for (let step = 0; step < 6; step++) await evaluate("document.getElementById('learningCoachNext').click()");
  await until("document.getElementById('board').dataset.learningStage==='place'");
  await evaluate("document.querySelector('#board .coach-target').click()");
  await until("document.querySelector('#board .coach-target .lumen-dim')?.getAttribute('aria-label')==='Excluded cell'");
  const active = await evaluate(snapshot);
  const runState = () => evaluate('JSON.parse(localStorage.getItem("lumenActiveAttemptV1")).state');
  assert.equal(await runState(), 'RUNNING');
  const epoch = await evaluate('performance.timeOrigin');
  await evaluate("window.i18nBoardCell=document.querySelector('#board .coach-target');document.getElementById('tutorialHelp').click()");
  await until("!document.getElementById('rulesModal').hidden");
  const selectMode = mode => evaluate("(() => {const select=document.getElementById('gameLocaleMode');select.value="+JSON.stringify(mode)+";select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  assert.equal(await evaluate("document.getElementById('gameLocaleMode').value"), 'auto');
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await selectMode('fr');
  assert.equal(await evaluate("document.getElementById('rulesModalTitle').textContent"), 'Aide LUMEN');
  assert.equal(await evaluate("document.getElementById('undo').textContent"), 'Annuler');
  assert.equal(await evaluate("i18nBoardCell.querySelector('.lumen-dim').getAttribute('aria-label')"), 'Emplacement assombri');
  assert.equal(await evaluate("localStorage.getItem('lumen.locale')"), 'fr');
  assert.equal(await evaluate("document.documentElement.lang"), 'fr');
  assert.equal(await evaluate("document.getElementById('scriptedLearnTitle').textContent"), 'Encore une fois…');
  await selectMode('auto');
  assert.equal(await evaluate("document.getElementById('rulesModalTitle').textContent"), 'LUMEN help');
  assert.equal(await evaluate("document.documentElement.lang"), 'en');
  assert.equal(await evaluate("localStorage.getItem('lumen.locale')"), 'auto');
  assert.equal(await evaluate("i18nBoardCell===document.querySelector('#board .coach-target')"), true);
  assert.equal(await evaluate(snapshot), active);
  assert.equal(await runState(), 'PAUSED', '#925: the open Help menu pauses the same run');
  assert.equal(await evaluate('performance.timeOrigin'), epoch);
  assert.equal(await evaluate("document.getElementById('scriptedLearnTitle').textContent"), 'One more tap…');
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await evaluate("document.getElementById('closeRulesModal').click()");
  await until("document.getElementById('rulesModal').hidden");
  await evaluate("document.getElementById('tutorialHelp').click()");
  await selectMode('fr');
  await evaluate("document.getElementById('replayIntroduction').click()");
  await until("!!document.querySelector('.first-welcome:not([hidden]) .intro-caption:not([hidden])')");
  assert.equal(await evaluate("document.querySelector('.first-welcome').getAttribute('aria-label')"), 'Lumen — Le réveil du ciel');
  const reloadFixture = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: "Object.defineProperty(navigator,'languages',{value:['en-US']})",
  });
  try {
    await navigateAndWait({ send, evaluate }, 'Page.reload');
    assert.equal(await evaluate("document.getElementById('gameLocaleMode').value"), 'fr');
    assert.equal(await evaluate("document.documentElement.lang"), 'fr', 'A saved explicit choice wins over the browser language after reload');
  } finally {
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: reloadFixture.identifier });
  }
  // #688: opening the sign-up screen during a learning step.
  await freshGuest(390, 844);
  const title = await evaluate(`document.getElementById('scriptedLearnTitle').textContent.trim()`);
  await evaluate(`document.getElementById('mobileAccount').click()`);
  await sleep(300);
  await evaluate(`document.getElementById('mobileAuthAction').click()`);
  await until(`!document.getElementById('accountOptin').hidden`);
  const front = await evaluate(`(()=>{const f=document.getElementById('accountOptin').querySelector('input,button');const r=document.getElementById('scriptedLearn').getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {accountOnTop:document.getElementById('accountOptin').contains(hit),coachHidden:getComputedStyle(document.getElementById('scriptedLearn')).visibility==='hidden'}})()`);
  assert.deepEqual(front, { accountOnTop: true, coachHidden: true }, 'Account screen wins over the learning coach');
  await evaluate(`[...document.querySelectorAll('#accountOptin button')].find(b=>/Retour au jeu|Plus tard|Fermer|×/i.test(b.textContent)||b.getAttribute('aria-label')==='Fermer')?.click()`);
  await until(`document.getElementById('accountOptin').hidden`);
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('scriptedLearn')).visibility`), 'visible');
  assert.equal(await evaluate(`document.getElementById('scriptedLearnTitle').textContent.trim()`), title, 'Learning resumes at the same step');
  results.push({ accountScreen: true, resumedStep: title });
  assert.deepEqual(errors, []);
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await closeBrowser(send);
}
