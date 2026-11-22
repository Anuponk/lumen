// #945 · Real page: the main player journeys in Spanish show no French left.
// The same journeys run in French and in Spanish; any visible text (or
// accessible label/title/placeholder) identical in both runs is untranslated,
// except an explicit allowlist (nicknames, brand, symbols, numbers).
// Also: no missing-translation warning while Spanish is active, no horizontal
// overflow at 360 px, and the language can be switched back and forth.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { connectBrowser, navigateAndWait, acknowledgeLearningMilestones } from './cdp-client.mjs';

const { send, evaluate, errors } = await connectBrowser();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OWNER = '00000000-0000-4000-8000-000000945101';
const CHALLENGE = '00000000-0000-4000-8000-000000945201';
const solved = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i, 1]));
const profile = {
  solved,
  historyBackup: { ...solved },
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
};
const BASE = process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/';
// Words that legitimately read the same in French and Spanish here.
const ALLOW =
  /^(?:LUMEN|Lumen|Ana945|Moi945|VS|QA|XP|OK|Orion|Canal|disponible|Stellarium|Google Play|Google|Hipparcos.*|CC BY-SA.*|LUMEN · v[\w.-]+)$/;

function fixture({ locale, signedIn }) {
  return `localStorage.clear();localStorage.setItem('lumen.locale',${JSON.stringify(locale)});localStorage.setItem('lumenSound','off');localStorage.setItem('lumenPushChoice','off');
  window.__missing=[];const warn=console.warn;console.warn=(...a)=>{if(a[0]==='Missing Lumen translation')window.__missing.push(a.slice(1).join(':'));return warn.apply(console,a)};
  ${signedIn ? `localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(profile))});for(const k of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(OWNER)});` : ''}
  window.supabase={createClient:()=>({auth:{getSession:async()=>(${signedIn}?{data:{session:{user:{id:${JSON.stringify(OWNER)}}}}}:{data:{session:null}}),
   getUser:async()=>({data:{user:${signedIn ? `{id:${JSON.stringify(OWNER)}}` : 'null'}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name)=>{
    if(name==='lumen_ranking_account')return {data:{nicknameRequired:false,withdrawn:false,participating:true}};
    if(name==='lumen_restore_profile')return {data:${JSON.stringify(profile)}};
    if(name==='lumen_get_progress')return {data:Array.from({length:12},(_,i)=>({puzzle_id:i+1}))};
    if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
    if(name==='lumen_cas_profile')return {data:true};
    if(name==='lumen_friend_list')return {data:[{nickname:'Ana945',state:'friends',since:'2026-11-20T10:00:00Z'}]};
    if(name==='lumen_challenge_inbox')return {data:{received:[],sent:[]}};
    if(name==='lumen_get_quest_challenge_v2'||name==='lumen_get_quest_challenge')return {data:{challenge_id:${JSON.stringify(CHALLENGE)},puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,sender_display_name:'Ana945',created_at:'2026-11-20T10:00:00Z',participant_status:null,source_duration_seconds:80,source_autonomy:true,source_first_play:true,server_now:new Date().toISOString()}};
    if(name==='lumen_list_quest_challenges_v2')return {data:[]};
    if(name==='lumen_circle_list')return {data:{circles:[],invitations:[],limits:{circles:10}}};
    if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};
    return {data:[]}}})};`;
}
// Visible texts keyed by element (id path) so both runs can be compared.
const COLLECT = `(()=>{const out={};const visible=e=>{for(let x=e;x;x=x.parentElement){if(x.hidden)return false;const s=getComputedStyle(x);if(s.display==='none'||s.visibility==='hidden')return false}return !!e.getClientRects().length};
 const key=el=>{const parts=[];for(let x=el;x&&x!==document.body;x=x.parentElement){if(x.id){parts.unshift('#'+x.id);break}parts.unshift(x.tagName.toLowerCase())}return parts.join('>')};
 const add=(k,t)=>{t=t.replace(/\\s+/g,' ').trim();if(t)(out[k]??=[]).push(t)};
 const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const el=n.parentElement;if(!el||el.closest('script,style,svg')||!visible(el))continue;add(key(el),n.textContent)}
 for(const el of document.querySelectorAll('[aria-label],[title],[placeholder]')){if(!visible(el))continue;for(const a of ['aria-label','title','placeholder']){const t=el.getAttribute(a);if(t)add(key(el)+'@'+a,t)}}
 return out})()`;
const click = (sel) =>
  evaluate(
    `(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(e){e.click();return true}return false})()`,
  );
async function open({ locale, signedIn, width, query = '' }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height: width < 700 ? 640 : 900,
    mobile: width < 700,
    deviceScaleFactor: 1,
  });
  const { identifier } = await send('Page.addScriptToEvaluateOnNewDocument', {
    source: fixture({ locale, signedIn }),
  });
  const url = new URL(BASE);
  url.search = query;
  await navigateAndWait({ send, evaluate }, 'Page.navigate', { url: String(url) });
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  await sleep(700);
}
async function journeys(locale, width) {
  const seen = {},
    snap = async (step) => {
      const texts = await evaluate(COLLECT);
      for (const [k, list] of Object.entries(texts)) seen[step + ' ' + k] = list;
      assert.equal(
        await evaluate('document.documentElement.scrollWidth<=innerWidth'),
        true,
        step + ': no horizontal scroll at ' + width,
      );
    };
  // 1. First launch, account creation while signed out.
  await open({ locale, signedIn: false, width });
  await snap('first-launch');
  await acknowledgeLearningMilestones(evaluate).catch(() => {});
  await sleep(300);
  await snap('tutorial');
  await click('#mobileAccount');
  await sleep(250);
  await click('#mobileAuthAction');
  await sleep(600);
  await snap('account-create');
  // 2. Challenge received by link.
  await open({ locale, signedIn: true, width, query: '?challenge=' + CHALLENGE });
  await sleep(800);
  await snap('challenge-link');
  // 3. Returning player: board, menus, social, sky, review, shop, victory.
  await open({ locale, signedIn: true, width });
  await acknowledgeLearningMilestones(evaluate).catch(() => {});
  await snap('board');
  for (const [sel, step, close] of [
    ['#tutorialHelp', 'rules', '#closeRulesModal'],
    ['#mobileAccount', 'account', '#mobileAccount'],
    ['#openSocial', 'social', '#socialHubClose'],
    ['#openFriends', 'friends', '#friendsClose'],
    ['#openMyChallenges', 'my-challenges', '#myChallengesClose'],
    ['#openCircles', 'circles', '#circlesClose'],
    ['#performanceLegend', 'badge-rules', '#closeBadgeRules'],
    ['#openSky', 'sky', '#closeMap'],
  ]) {
    await click(sel);
    await sleep(600);
    await snap(step);
    await click(close);
    await sleep(200);
  }
  await click('#shareLumen');
  await sleep(500);
  await snap('share');
  await evaluate(`document.getElementById('lumenShareDialog')?.close?.()`);
  await click('#openSky');
  await sleep(400);
  await evaluate(`[...document.querySelectorAll('#adventureRail [data-pack-id]')].at(-1)?.click()`);
  await sleep(600);
  await snap('shop');
  await click('#closeMap');
  await click('#openSky');
  await sleep(400);
  await evaluate(`document.querySelector('#puzzleGrid [data-quest-id]')?.click()`);
  await sleep(600);
  await snap('quest-review');
  await click('#closeMap');
  await evaluate(
    `document.getElementById('attemptMask')?.click();(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`,
  );
  await sleep(2500);
  await snap('victory');
  const missing = await evaluate('window.__missing||[]');
  return { seen, missing };
}

const results = [];
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*supabase*'] });
  for (const width of [360, 1440]) {
    const fr = await journeys('fr', width),
      es = await journeys('es', width);
    const untranslated = [];
    for (const [k, esTexts] of Object.entries(es.seen)) {
      const frTexts = fr.seen[k];
      if (!frTexts) continue;
      for (const text of esTexts)
        if (
          frTexts.includes(text) &&
          /\p{L}{3,}/u.test(text) &&
          !ALLOW.test(text) &&
          !/^[\d\s:·%/★✦✓⚡🧠+.,()\-–—#°²×]+$/u.test(text)
        )
          untranslated.push(k + ' :: ' + text);
    }
    assert.deepEqual(
      [...new Set(untranslated)],
      [],
      'French left in Spanish journeys at ' + width + ':\n' + [...new Set(untranslated)].join('\n'),
    );
    assert.deepEqual([...new Set(es.missing)], [], 'no missing Spanish translation while playing');
    results.push({
      width,
      comparedElements: Object.keys(es.seen).length,
      untranslated: 0,
      missing: 0,
    });
  }
  // Switching languages keeps the attempt, the board and the clock.
  await open({ locale: 'es', signedIn: true, width: 390 });
  await acknowledgeLearningMilestones(evaluate).catch(() => {});
  await evaluate(`document.getElementById('attemptMask')?.click()`);
  const before = await evaluate(
    `JSON.stringify({a:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')?.attemptId,b:lumenDiagnostics.snapshot().state})`,
  );
  await click('#tutorialHelp');
  const choose = (mode) =>
    evaluate(
      `(()=>{const s=document.getElementById('gameLocaleMode');s.value=${JSON.stringify(mode)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`,
    );
  for (const mode of ['fr', 'en', 'es']) {
    await choose(mode);
    await sleep(150);
  }
  assert.equal(await evaluate('document.documentElement.lang'), 'es');
  assert.deepEqual(
    await evaluate(
      `[...document.getElementById('gameLocaleMode').options].filter(o=>o.value).map(o=>o.textContent)`,
    ),
    ['Automático', 'Français', 'English', 'Español'],
    'selector: Auto translated, each language in its own name',
  );
  await choose('auto');
  await sleep(150);
  assert.equal(await evaluate(`localStorage.getItem('lumen.locale')`), 'auto');
  assert.equal(
    await evaluate(
      `JSON.stringify({a:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')?.attemptId,b:lumenDiagnostics.snapshot().state})`,
    ),
    before,
    'switching languages keeps the attempt and the board',
  );
  // Automatic mode on a Mexican-Spanish phone opens Lumen in Spanish.
  const userAgent = await evaluate('navigator.userAgent');
  await send('Emulation.setUserAgentOverride', { userAgent, acceptLanguage: 'es-MX,es;q=0.9' });
  await open({ locale: 'auto', signedIn: true, width: 390 });
  assert.deepEqual(
    await evaluate(
      `[navigator.language,document.documentElement.lang,document.getElementById('openSky')?.textContent.trim()]`,
    ).then((v) => v.slice(0, 2)),
    ['es-MX', 'es'],
  );
  await send('Emulation.setUserAgentOverride', { userAgent });
  results.push({ switching: true, autoEsMx: true });
  assert.deepEqual(errors, []);
  if (process.argv[2])
    fs.writeFileSync(process.argv[2], JSON.stringify({ results, physicalDevice: false }, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await send('Browser.close').catch(() => {});
}
