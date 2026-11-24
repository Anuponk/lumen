// #960 · Real page: report a bug, a question or a suggestion from Mon espace, the
// quest help and blocking errors, without losing the attempt; drafts survive,
// network failures keep the message and retries reuse the same reference.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, navigateAndWait, acknowledgeLearningMilestones } from './cdp-client.mjs';

const { send, evaluate, errors } = await connectBrowser();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OWNER = '00000000-0000-4000-8000-000000960101';
const BASE = process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/';
const solved = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, 1]));
const profile = (n) => ({
  solved: solved(n),
  historyBackup: solved(n),
  badges: {},
  stars: {},
  performances: {},
  noHint: {},
  canonicalQuestState: {},
  xp: 100,
  shards: 10,
  skyScore: 10,
  skyHistoryVersion: 4,
  walletRevision: 1,
  daily: { dates: {}, rewards: {} },
  challenges: {},
});
function fixture(signedIn, locale) {
  const p = profile(signedIn ? 12 : 2);
  return `localStorage.clear();sessionStorage.clear();localStorage.setItem('lumen.locale',${JSON.stringify(locale)});localStorage.setItem('lumenPushChoice','off');
  localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(p))});for(const k of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');
  ${signedIn ? `localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(OWNER)});` : ''}
  window.__feedbackCalls=[];window.__feedbackMode='ok';
  window.supabase={createClient:()=>({auth:{getSession:async()=>(${signedIn}?{data:{session:{user:{id:${JSON.stringify(OWNER)}}}}}:{data:{session:null}}),
   getUser:async()=>({data:{user:${signedIn ? `{id:${JSON.stringify(OWNER)}}` : 'null'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name,args)=>{
    if(name==='lumen_send_feedback_v3'||name==='lumen_send_feedback_v2'){window.__feedbackCalls.push(args);if(name==='lumen_send_feedback_v3'&&args.p_journal!==null&&!Array.isArray(args.p_journal))throw Error('journal must be an array or null');
     if(window.__feedbackMode==='network')return {error:{message:'TypeError: Failed to fetch'}};
     if(window.__feedbackMode==='rate')return {error:{message:'rate_limited'}};
     return {data:{id:4242,status:'received',duplicate:window.__feedbackCalls.filter(c=>c.p_client_ref===args.p_client_ref).length>1}}}
    if(name==='lumen_ranking_account')return {data:{nicknameRequired:false,withdrawn:false,participating:true}};
    if(name==='lumen_restore_profile')return {data:${JSON.stringify(p)}};if(name==='lumen_get_progress')return {data:Array.from({length:${signedIn ? 12 : 2}},(_,i)=>({puzzle_id:i+1}))};
    if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};if(name==='lumen_cas_profile')return {data:true};
    if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};return {data:[]}}})};`;
}
async function open({ width, height, signedIn = false, locale = 'fr' }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    mobile: width < 700,
    deviceScaleFactor: 1,
  });
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: fixture(signedIn, locale),
  });
  await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: BASE });
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  await sleep(700);
  await acknowledgeLearningMilestones(evaluate).catch(() => {});
  await evaluate(
    `for(const id of ['questStart','returnToast'])document.getElementById(id)?.setAttribute('hidden','')`,
  );
}
const key = async (k, code) => {
  for (const type of ['keyDown', 'keyUp'])
    await send('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: code });
  await sleep(80);
};
const type = (text) =>
  evaluate(
    `(()=>{const a=document.getElementById('feedbackText');a.value=${JSON.stringify(text)};a.dispatchEvent(new Event('input',{bubbles:true}))})()`,
  );
const submit = async () => {
  await evaluate(`document.getElementById('feedbackSend').click()`);
  await sleep(250);
};
const view = () =>
  evaluate(`(()=>{const m=document.getElementById('feedbackModal'),f=document.getElementById('feedbackForm'),d=document.getElementById('feedbackDone'),r=f.getBoundingClientRect();
   return {open:!m.hidden,form:!f.hidden,done:!d.hidden,status:document.getElementById('feedbackStatus').textContent,state:document.getElementById('feedbackStatus').dataset.state||'',
    text:document.getElementById('feedbackText').value,kind:document.querySelector('input[name=feedbackKind]:checked')?.value,placeholder:document.getElementById('feedbackText').placeholder,
    receipt:document.getElementById('feedbackReceipt').textContent,context:document.getElementById('feedbackContextList').textContent,
    fits:r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight+1,overflow:document.documentElement.scrollWidth>innerWidth,menu:!document.getElementById('mobileAuthPopover').hidden}})()`);
const attempt = () =>
  evaluate(
    `JSON.stringify({id:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')?.attemptId,board:lumenDiagnostics.snapshot().state})`,
  );

const results = [];
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase*'] });
  for (const [width, height, signedIn] of [
    [360, 640, false],
    [390, 844, true],
  ]) {
    await open({ width, height, signedIn });
    // A quest in progress: one guardian placed, the clock running.
    await evaluate(`document.getElementById('attemptMask')?.click()`);
    await evaluate(
      `(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map((c,r)=>Array.from({length:s.n},(_,i)=>r===0&&i===c?2:0)))})()`,
    );
    await sleep(300);
    const before = await attempt();
    // From Mon espace.
    await evaluate(`document.getElementById('mobileAccount').click()`);
    await evaluate(`document.getElementById('betaFeedbackBtn').click()`);
    let v = await view();
    assert.equal(v.open && v.form && !v.menu, true, 'report opens and Mon espace closes');
    assert.equal(v.fits && !v.overflow, true, 'compact form fits at ' + width + 'x' + height);
    assert.equal(v.kind, 'bug');
    assert.match(v.context, /Version/);
    assert.match(v.context, /quête \d+/, 'quest context is shown to the player');
    // #959: one help entry. Mon espace has no separate diagnostic button; the full
    // account copy is a report option for signed-in players, with its consent text.
    assert.equal(
      await evaluate(`document.getElementById('supportQuickSend')`),
      null,
      'single help entry',
    );
    const fullCopy = await evaluate(
      `(()=>{const row=document.getElementById('feedbackFullCopyRow');return {shown:!!row&&!row.hidden,checked:!!document.getElementById('feedbackFullCopy')?.checked}})()`,
    );
    assert.equal(fullCopy.shown, signedIn, 'full copy offered to signed-in players only');
    if (signedIn) {
      if (!fullCopy.checked) await evaluate(`document.getElementById('feedbackFullCopy').click()`);
      assert.equal(
        await evaluate(`document.getElementById('feedbackFullCopyNote').hidden`),
        false,
        'consent text shown when ticked',
      );
      assert.match(
        await evaluate(`document.getElementById('feedbackFullCopyNote').textContent`),
        /support habilité/,
      );
      await evaluate(`document.getElementById('feedbackFullCopy').click()`);
      assert.equal(
        await evaluate(`document.getElementById('feedbackFullCopyNote').hidden`),
        true,
        'consent text hidden when unticked',
      );
    }
    assert.equal(
      await evaluate(`document.activeElement.id`),
      'feedbackText',
      'focus goes to the message',
    );
    assert.equal(
      await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).state`),
      'PAUSED',
      'the attempt is paused while reporting',
    );
    // Kinds adapt the prompt; a too-short message is refused locally.
    await evaluate(`document.querySelector('input[name=feedbackKind][value=question]').click()`);
    v = await view();
    assert.equal(v.kind, 'question');
    assert.equal(v.placeholder, 'Quelle est ta question ?');
    await type('ok');
    await submit();
    assert.equal((await view()).state, 'messageRequired');
    assert.equal(await evaluate(`window.__feedbackCalls.length`), 0, 'nothing sent');
    // The draft survives closing (and a reload, through storage).
    await type('Comment marche la Maîtrise ?');
    await evaluate(`document.getElementById('feedbackCancel').click()`);
    assert.equal((await view()).open, false);
    assert.equal(
      await evaluate(`document.activeElement.id`),
      'mobileAccount',
      'focus returns to Mon espace',
    );
    assert.match(await evaluate(`localStorage.getItem('lumenFeedbackDraftV1')`), /Maîtrise/);
    await evaluate(
      `document.getElementById('mobileAccount').click();document.getElementById('betaFeedbackBtn').click()`,
    );
    v = await view();
    assert.deepEqual(
      [v.text, v.kind, v.state],
      ['Comment marche la Maîtrise ?', 'question', 'draftRestored'],
    );
    // Network failure: message kept, explicit status, retry possible with the same reference.
    await evaluate(`window.__feedbackMode='network'`);
    await submit();
    v = await view();
    assert.deepEqual([v.form, v.state, v.text], [true, 'offline', 'Comment marche la Maîtrise ?']);
    assert.equal(await evaluate(`document.getElementById('feedbackSend').disabled`), false);
    await evaluate(`window.__feedbackMode='rate'`);
    await submit();
    assert.equal((await view()).state, 'rateLimited');
    await evaluate(`window.__feedbackMode='ok'`);
    await submit();
    v = await view();
    assert.equal(v.done && !v.form, true, 'explicit confirmation');
    assert.match(v.receipt, /n° 4242/, 'receipt number never splits from its label');
    const calls = await evaluate(`window.__feedbackCalls`);
    assert.equal(calls.length, 3);
    assert.equal(
      new Set(calls.map((c) => c.p_client_ref)).size,
      1,
      'every retry reuses the draft reference',
    );
    const last = calls.at(-1);
    assert.equal(last.p_kind, 'question');
    assert.equal(last.p_message, 'Comment marche la Maîtrise ?');
    assert.equal(last.p_context.surface, 'menu');
    assert.equal(last.p_context.in_quest, true);
    assert(
      last.p_context.app_version &&
        last.p_context.screen === width + 'x' + height &&
        last.p_context.session_id,
      'version, screen and session',
    );
    assert.doesNotMatch(
      JSON.stringify(last.p_context),
      /Mozilla|token|@|password/i,
      'no user agent, token or email',
    );
    assert.equal(
      await evaluate(`localStorage.getItem('lumenFeedbackDraftV1')`),
      null,
      'the sent draft is cleared',
    );
    await evaluate(`document.getElementById('feedbackDoneClose').click()`);
    assert.equal((await view()).open, false);
    assert.equal(await attempt(), before, 'the attempt and the board are unchanged');
    // From the quest help.
    await evaluate(`document.getElementById('tutorialHelp').click()`);
    await evaluate(`document.getElementById('helpReportProblem').click()`);
    v = await view();
    assert.equal(
      v.open && v.form && v.kind === 'bug' && v.text === '',
      true,
      'help opens a new bug report',
    );
    assert.equal(await evaluate(`document.getElementById('rulesModal').hidden`), true);
    await type('La grille ne réagit plus');
    await submit();
    assert.equal((await evaluate(`window.__feedbackCalls`)).at(-1).p_context.surface, 'help');
    // Escape closes and focus returns.
    await evaluate(
      `document.getElementById('feedbackDoneClose').click();document.getElementById('mobileAccount').click();document.getElementById('betaFeedbackBtn').click()`,
    );
    await key('Escape', 27);
    assert.equal((await view()).open, false, 'Escape closes the form');
    assert.equal(await attempt(), before, 'still the same attempt');
    results.push({ width, signedIn, calls: await evaluate(`window.__feedbackCalls.length`) });
  }
  // English labels.
  await open({ width: 360, height: 640, signedIn: false, locale: 'en' });
  await evaluate(
    `document.getElementById('mobileAccount').click();document.getElementById('betaFeedbackBtn').click()`,
  );
  assert.deepEqual(
    await evaluate(
      `[document.getElementById('feedbackTitle').textContent,[...document.querySelectorAll('.beta-kinds span')].map(s=>s.textContent).join('|'),document.getElementById('feedbackText').placeholder,document.getElementById('feedbackSend').textContent]`,
    ),
    [
      'Report a problem',
      '🐞 Bug|❓ Question|💡 Suggestion',
      'What happened? What did you expect?',
      'Send',
    ],
  );
  results.push({ english: true });
  assert.deepEqual(errors, []);
  if (process.argv[2])
    fs.writeFileSync(process.argv[2], JSON.stringify({ results, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await send('Browser.close').catch(() => {});
}
