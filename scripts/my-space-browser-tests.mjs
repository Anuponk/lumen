// #959 · Real page: four header actions with one visual language, and a compact
// « Mon espace » (language, help, report, one section open at a time, tips usable
// by touch and keyboard) for guests and signed-in players, at phone and desktop sizes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, navigateAndWait, acknowledgeLearningMilestones } from './cdp-client.mjs';

const { send, evaluate, errors } = await connectBrowser();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OWNER = '00000000-0000-4000-8000-000000959101';
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
function fixture(signedIn, locale, labGrant) {
  const p = profile(signedIn ? 12 : 2);
  return `localStorage.clear();localStorage.setItem('lumen.locale',${JSON.stringify(locale)});localStorage.setItem('lumenPushChoice','off');
  window.labGrant=${labGrant};
  localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(p))});for(const k of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');
  ${signedIn ? `localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(OWNER)});` : ''}
  window.supabase={createClient:()=>({auth:{getSession:async()=>(${signedIn}?{data:{session:{user:{id:${JSON.stringify(OWNER)}}}}}:{data:{session:null}}),
   getUser:async()=>({data:{user:${signedIn ? `{id:${JSON.stringify(OWNER)}}` : 'null'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name)=>{if(name==='lumen_ranking_account')return {data:{nicknameRequired:false,withdrawn:false,participating:true}};
    if(name==='lumen_get_internal_capabilities')return {data:${labGrant ? "['ux_v2_preview']" : '[]'}};
    if(name==='lumen_ux_v2_access')return {data:window.labGrant};
    if(name==='lumen_restore_profile')return {data:${JSON.stringify(p)}};if(name==='lumen_get_progress')return {data:Array.from({length:${signedIn ? 12 : 2}},(_,i)=>({puzzle_id:i+1}))};
    if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};if(name==='lumen_cas_profile')return {data:true};
    if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};return {data:[]}}})};`;
}
async function open({ width, height, signedIn, locale = 'fr', labGrant = false }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    mobile: width < 700,
    deviceScaleFactor: 1,
  });
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: fixture(signedIn, locale, labGrant),
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
const menuOpen = () => evaluate(`!document.getElementById('mobileAuthPopover').hidden`);

const results = [];
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase*'] });
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [1440, 900],
  ]) {
    for (const signedIn of [false, true]) {
      await open({ width, height, signedIn });
      // Header: four actions, same colour and size, nothing overflows.
      const head =
        await evaluate(`(()=>{const row=[...document.querySelectorAll('.head-actions > button')].filter(b=>b.getClientRects().length);
        return {ids:row.map(b=>b.id),colors:[...new Set(row.map(b=>getComputedStyle(b).color))],sizes:[...new Set(row.map(b=>Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height)))],
         names:row.map(b=>b.getAttribute('aria-label')),emoji:row.some(b=>/\\p{Extended_Pictographic}/u.test(b.textContent)),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
      assert.deepEqual(
        head.ids,
        ['soundToggle', 'shareLumen', 'openSocial', 'mobileAccount'],
        'four header actions in order',
      );
      assert.equal(
        head.colors.length,
        1,
        'one colour for every header icon (social is no longer blue): ' + head.colors,
      );
      assert.equal(head.sizes.length, 1, 'one size for every header icon: ' + head.sizes);
      assert(parseInt(head.sizes[0]) >= 36, 'touch target ≥ 36 px: ' + head.sizes[0]);
      assert.equal(head.emoji, false, 'monochrome icons, no colour emoji');
      assert(head.names.every(Boolean), 'every header action has an accessible name');
      assert.equal(head.overflow, false);
      // Sound toggles in one tap, without a submenu.
      const sound = await evaluate(
        `(()=>{const b=document.getElementById('soundToggle'),before=b.getAttribute('aria-pressed');b.click();const after=b.getAttribute('aria-pressed'),stored=localStorage.getItem('lumenSound');b.click();return {before,after,stored,menus:document.querySelectorAll('.mobile-auth-popover:not([hidden]),.social-hub:not([hidden])').length}})()`,
      );
      assert.notEqual(sound.before, sound.after, 'sound toggles in one gesture');
      assert.equal(sound.stored, sound.after === 'true' ? 'on' : 'off');
      // Mon espace: compact first level.
      await evaluate(`document.getElementById('mobileAccount').click()`);
      assert.equal(await menuOpen(), true);
      const menu =
        await evaluate(`(()=>{const m=document.getElementById('mobileAuthPopover'),r=m.getBoundingClientRect(),visible=e=>!!e.getClientRects().length&&!e.closest('[hidden]');
        const first=[...m.querySelectorAll('p,div,span,label')].filter(e=>visible(e)&&!e.closest('details[open] .my-space-body,.tip-bubble')&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>0));
        return {expanded:document.getElementById('mobileAccount').getAttribute('aria-expanded'),
         language:visible(document.getElementById('gameLocaleMode')),help:visible(document.getElementById('tutorialHelp')),report:visible(document.getElementById('betaFeedbackBtn')),
         account:visible(document.getElementById('mySpaceAccount')),longest:Math.max(...first.map(e=>e.textContent.trim().length)),
         bottom:Math.round(r.bottom),viewport:innerHeight,scroll:m.scrollHeight>m.clientHeight+1,
         primary:document.getElementById('mobileAuthAction').classList.contains('primary'),
         rowHeights:[...m.querySelectorAll('.my-space-row,.my-space-section>summary')].filter(visible).map(e=>Math.round(e.getBoundingClientRect().height))}})()`);
      assert.equal(menu.expanded, 'true');
      assert.equal(
        menu.language && menu.help && menu.report,
        true,
        'language, help and report are in Mon espace',
      );
      assert.equal(menu.account, signedIn, 'account section only for signed-in players');
      assert.equal(
        await evaluate("document.getElementById('uxLabPreference').closest('fieldset').hidden"),
        true,
        'normal players and guests never see LUMEN Lab',
      );
      assert.equal(menu.primary, !signedIn, 'guests get sign-in as the primary action');
      assert(
        menu.longest <= 80,
        'no paragraph competes with the actions at first level: ' + menu.longest,
      );
      assert(
        menu.bottom <= menu.viewport && !menu.scroll,
        'Mon espace fits without scrolling at ' + width + 'x' + height,
      );
      assert(
        menu.rowHeights.every((h) => h >= 44),
        'rows are 44 px touch targets: ' + menu.rowHeights,
      );
      // One section open at a time.
      const exclusive = await evaluate(
        `(async()=>{const s=[...document.querySelectorAll('#mobileAuthPopover details.my-space-section')].filter(d=>!d.hidden);
        s[0].querySelector('summary').click();await new Promise(r=>setTimeout(r,60));s[1].querySelector('summary').click();await new Promise(r=>setTimeout(r,60));
        const open=s.filter(d=>d.open).map(d=>d.id);s[1].querySelector('summary').click();return open})()`,
        true,
      );
      assert.deepEqual(exclusive.length, 1, 'only one section open: ' + exclusive);
      // Tip: tap opens it, Escape closes the tip first, then Mon espace, focus back on its button.
      await evaluate(
        `(()=>{const d=document.getElementById('mySpaceData');d.open=true;d.querySelector('.tip-button').click()})()`,
      );
      const tip =
        await evaluate(`(()=>{const b=document.querySelector('#mySpaceData .tip-button'),bubble=document.getElementById(b.getAttribute('aria-controls')),r=bubble.getBoundingClientRect();
        return {expanded:b.getAttribute('aria-expanded'),shown:!bubble.hidden,live:bubble.getAttribute('role'),inside:r.left>=0&&r.right<=innerWidth,label:b.getAttribute('aria-label')}})()`);
      assert.deepEqual(
        tip,
        { expanded: 'true', shown: true, live: 'status', inside: true, label: 'Plus d’infos' },
        'tip opens on tap, announced, fits the screen',
      );
      await evaluate(`document.querySelector('#mySpaceData .tip-button').focus()`);
      await key('Escape', 27);
      assert.equal(
        await evaluate(
          `document.querySelector('#mySpaceData .tip-button').getAttribute('aria-expanded')`,
        ),
        'false',
        'Escape closes the tip',
      );
      assert.equal(await menuOpen(), true, 'Mon espace stays open after closing the tip');
      await key('Escape', 27);
      assert.equal(await menuOpen(), false, 'second Escape closes Mon espace');
      assert.equal(
        await evaluate(`document.activeElement?.id`),
        'mobileAccount',
        'focus returns to Mon espace',
      );
      // Help from Mon espace: the menu closes, the dialog opens, focus comes back.
      await evaluate(`document.getElementById('mobileAccount').click()`);
      await evaluate(`document.getElementById('tutorialHelp').click()`);
      assert.deepEqual(
        await evaluate(
          `[document.getElementById('mobileAuthPopover').hidden,document.getElementById('rulesModal').hidden]`,
        ),
        [true, false],
        'help opens and Mon espace closes',
      );
      assert.equal(
        await evaluate(`document.querySelector('#rulesModal .help-more')?.open`),
        false,
        'gestures and timer details stay folded',
      );
      await evaluate(`document.getElementById('closeRulesModal').click()`);
      assert.equal(await evaluate(`document.activeElement?.id`), 'mobileAccount');
      results.push({ width, signedIn, longestFirstLevel: menu.longest, menuBottom: menu.bottom });
    }
  }
  // Language from Mon espace; labels follow (EN).
  await open({ width: 390, height: 844, signedIn: false });
  await evaluate(`document.getElementById('mobileAccount').click()`);
  await evaluate(
    `(()=>{const s=document.getElementById('gameLocaleMode');s.value='en';s.dispatchEvent(new Event('change',{bubbles:true}))})()`,
  );
  assert.deepEqual(
    await evaluate(
      `[document.documentElement.lang,document.getElementById('mySpaceTitle').textContent,document.querySelector('#tutorialHelp [data-game-text]').textContent,document.querySelector('#mySpaceData .tip-button').getAttribute('aria-label')]`,
    ),
    ['en', 'My space', 'Help and rules', 'More info'],
  );
  assert.match(
    await evaluate(`document.getElementById('mobileAccount').getAttribute('aria-label')`),
    /^My space · /,
  );
  results.push({ english: true });
  await open({ width: 390, height: 844, signedIn: true, labGrant: true });
  await evaluate("document.getElementById('mobileAccount').click()");
  await sleep(100);
  assert.equal(
    await evaluate("document.getElementById('uxLabPreference').closest('fieldset').hidden"),
    false,
  );
  await evaluate(`(()=>{
    const preference=document.getElementById('uxLabPreference');
    preference.value='v2';
    preference.dispatchEvent(new Event('change',{bubbles:true}));
  })()`);
  await sleep(100);
  assert.equal(
    await evaluate(`localStorage.getItem('lumenUxVariantV1:'+${JSON.stringify(OWNER)})`),
    'v2',
  );
  await evaluate(
    `window.labGrant=false;const button=document.getElementById('mobileAccount');button.click();button.click()`,
  );
  await sleep(100);
  assert.equal(
    await evaluate("document.getElementById('uxLabPreference').closest('fieldset').hidden"),
    true,
    'a fresh server denial hides the Lab even with a stored V2 preference',
  );
  results.push({ labAccess: true, labRevocation: true });
  assert.deepEqual(errors, []);
  if (process.argv[2])
    fs.writeFileSync(process.argv[2], JSON.stringify({ results, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await send('Browser.close').catch(() => {});
}
