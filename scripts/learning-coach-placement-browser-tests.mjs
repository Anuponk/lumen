// #687/#688: on phones the learning coach never covers the board, and account
// screens always win over it (one modal at a time, same step after closing).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, closeBrowser } from './cdp-client.mjs';
const { send, evaluate, errors } = await connectBrowser(),
  results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(expr) {
  for (let i = 0; i < 160; i++) {
    if (await evaluate(expr)) return;
    await sleep(80);
  }
  throw Error('Timed out: ' + expr);
}
const MEASURE = `(()=>{const c=document.getElementById('scriptedLearn'),b=document.getElementById('board');if(!c||c.hidden)return null;const r=c.getBoundingClientRect(),g=b.getBoundingClientRect();
 const ox=Math.max(0,Math.min(r.right,g.right)-Math.max(r.left,g.left)),oy=Math.max(0,Math.min(r.bottom,g.bottom)-Math.max(r.top,g.top));
 return {title:document.getElementById('scriptedLearnTitle').textContent.trim(),covered:ox*oy,boardWidth:Math.round(g.width),fullText:document.getElementById('scriptedLearnCopy').scrollHeight<=document.getElementById('scriptedLearnCopy').clientHeight+1,helpReachable:(()=>{const h=document.getElementById('tutorialHelp').getBoundingClientRect();return r.top>=h.bottom+8})(),nextVisible:(()=>{const n=document.getElementById('learningCoachNext');if(n.hidden)return true;const q=n.getBoundingClientRect();return q.bottom<=innerHeight&&q.top>=0})()}})()`;
async function freshGuest(width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
  const fixture = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if(!sessionStorage.getItem('coachTest')){localStorage.clear();sessionStorage.setItem('coachTest','1')}localStorage.setItem('lumenSound','off');`,
  });
  await send('Page.navigate', { url: process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/' });
  await until('!!document.getElementById("board")&&document.readyState==="complete"');
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fixture.identifier });
  await until(`!![...document.querySelectorAll('button')].find(b=>b.offsetParent&&/directement/i.test(b.textContent))||!document.getElementById('scriptedLearn').hidden`);
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.offsetParent&&/directement/i.test(b.textContent))?.click()`);
  await until(`!document.getElementById('scriptedLearn').hidden&&document.getElementById('scriptedLearn').contains(document.elementFromPoint(innerWidth/2,document.getElementById('scriptedLearn').getBoundingClientRect().top+20))`);
  await evaluate(`sessionStorage.removeItem('coachTest')`);
}
try {
  await send('Page.enable');
  await send('Runtime.enable');
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [390, 844],
  ]) {
    await freshGuest(width, height);
    const steps = [];
    for (let i = 0; i < 8; i++) {
      await sleep(250);
      const m = await evaluate(MEASURE);
      if (!m) break;
      steps.push(m);
      assert.equal(m.covered, 0, 'Coach covers the board at ' + width + 'x' + height + ' on « ' + m.title + ' »');
      assert(m.boardWidth >= 180, 'Board stays playable (' + m.boardWidth + 'px) on « ' + m.title + ' »');
      assert.equal(m.fullText, true, 'Coach text is not clipped on « ' + m.title + ' »');
      assert.equal(m.helpReachable, true, 'Help button stays reachable above the coach on « ' + m.title + ' »');
      assert.equal(m.nextVisible, true, 'Next control stays reachable on « ' + m.title + ' »');
      const moved = await evaluate(
        `(()=>{const n=document.getElementById('learningCoachNext');if(n.hidden)return false;n.click();return true})()`,
      );
      if (!moved) break;
    }
    assert(steps.length >= 4, 'The intro steps were measured at ' + width + 'x' + height);
    results.push({ width, height, steps: steps.length, covered: 0 });
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
