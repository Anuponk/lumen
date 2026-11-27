// #1057 · Public mini-puzzle in a real browser (called per viewport by
// landing-browser-tests.mjs): locked before its Paris date, real taps (cross →
// Guardian → empty), conflict feedback, unique completion, victory with the three
// calls to action, local "solved" flag, FR/EN/ES copy, the Advent calendar, no
// Supabase request and only anonymous hits on /mini/t.gif.
import assert from 'node:assert/strict';

const DAY = '2026-12-03';
async function open({ send, evaluate }, href, { now = null, locale = null } = {}) {
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__LUMEN_MINI_TEST__=${now ? 'true' : 'false'};try{localStorage.removeItem('lumenMiniDoneV1');${
      locale ? `localStorage.setItem('lumen.locale',${JSON.stringify(locale)})` : "localStorage.removeItem('lumen.locale')"
    }}catch{}`,
  }).then(({ identifier }) => (open.scripts = [...(open.scripts || []), identifier]));
  const previous = await evaluate('performance.timeOrigin').catch(() => 0);
  await send('Page.navigate', { url: href });
  for (let i = 0; i < 100; i++) {
    try {
      if (await evaluate(`performance.timeOrigin!==${previous}&&document.readyState==='complete'`)) break;
    } catch (error) {
      if (!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message)) throw error;
    }
    await new Promise((r) => setTimeout(r, 60));
  }
  for (const identifier of open.scripts.splice(0)) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  if (now)
    await evaluate(
      `(async()=>{const m=await import('/src/acquisition/${href.includes('/mini/' + DAY) || /\/mini\/\d/.test(href) ? 'mini-game' : 'mini-calendar-page'}.js');
       const el=document.getElementById('mini')||document.getElementById('mini-calendar');
       const data=JSON.parse((document.getElementById('mini-data')||document.getElementById('mini-calendar-data')).textContent);
       window.__mini=el.id==='mini'?m.mountMiniGame(el,{data,now:()=>new Date(${JSON.stringify(now)})}):m.mountMiniCalendar(el,{calendar:data,now:()=>new Date(${JSON.stringify(now)})});
       return true})()`,
      true,
    );
}

export async function verifyMini({ send, evaluate }, baseUrl) {
  const page = new URL('/mini/' + DAY + '.html?utm_source=facebook_daily&utm_medium=social', baseUrl).href;
  await send('Network.enable');
  // Before its Paris date the page shows the closed door, never the board.
  await open({ send, evaluate }, page, { now: '2026-12-02T22:59:00Z' });
  const locked = await evaluate(
    `({state:document.getElementById('mini').dataset.state,cells:document.querySelectorAll('.mini-cell').length,status:document.getElementById('mini-status').textContent})`,
  );
  assert.equal(locked.state, 'locked');
  assert.equal(locked.cells, 0, 'No board before the Paris date');
  assert.match(locked.status, /3 décembre 2026/);

  // 23:00 UTC on 2 December is already 3 December in Paris.
  await open({ send, evaluate }, page, { now: '2026-12-02T23:00:00Z' });
  const solved = await evaluate(
    `(async()=>{const {firstCompletion}=await import('/src/acquisition/mini-puzzle.js');
     const data=JSON.parse(document.getElementById('mini-data').textContent);
     const cell=(r,c)=>document.querySelectorAll('.mini-row')[r].children[c];
     const solution=firstCompletion(data.reg,data.given);
     const givenRows=new Set(data.given.map(([r])=>r));
     const missing=solution.filter(([r])=>!givenRows.has(r));
     const out={state:document.getElementById('mini').dataset.state,size:data.size,given:data.given.length,missing:missing.length,
       title:document.getElementById('mini-title').textContent,kicker:document.getElementById('mini-kicker').textContent,
       solutionShipped:JSON.stringify(data).includes('"sol"')};
     // Cycle on a free cell: cross, Guardian, empty.
     const [mr,mc]=missing[0];const free=[...Array(data.size).keys()].find(c=>c!==mc);
     const probe=cell(mr,free);probe.click();out.cross=probe.dataset.value;probe.click();out.guardian=probe.dataset.value;
     out.conflictStatus=document.getElementById('mini-status').dataset.kind;out.conflictCells=document.querySelectorAll('.mini-cell.conflict').length;
     probe.click();out.empty=probe.dataset.value;
     // A given Guardian cannot be moved.
     const [gr,gc]=data.given[0];out.givenDisabled=cell(gr,gc).disabled;
     for(const [r,c] of missing){cell(r,c).click();cell(r,c).click()}
     const win=document.getElementById('mini-win');
     out.won=document.getElementById('mini').dataset.state;out.winVisible=!win.hidden;
     out.figure=win.querySelectorAll('.mini-figure line').length;
     out.links=['discover','install','official'].map(k=>document.getElementById('mini-cta-'+k).href);
     out.done=JSON.parse(localStorage.getItem('lumenMiniDoneV1')||'[]');
     out.board=document.getElementById('mini-board').getBoundingClientRect().width;
     out.cell=cell(0,0).getBoundingClientRect().width;
     out.overflow=document.documentElement.scrollWidth>innerWidth;
     await new Promise(r=>setTimeout(r,150));
     out.requests=performance.getEntriesByType('resource').map(e=>e.name);
     return out})()`,
    true,
  );
  assert.equal(solved.state, 'playing');
  assert.equal(solved.size, 6);
  assert.equal(solved.given + solved.missing, 6);
  assert.equal(solved.missing, 1, 'Advent door 3: one missing Guardian');
  assert.equal(solved.solutionShipped, false, 'The page never ships the solution');
  assert.match(solved.kicker, /case 3/);
  assert.deepEqual([solved.cross, solved.guardian, solved.empty], ['1', '2', '0'], 'Tap cycle: cross, Guardian, empty');
  assert.equal(solved.conflictStatus, 'conflict');
  assert.ok(solved.conflictCells >= 2, 'Conflicting Guardians are outlined');
  assert.equal(solved.givenDisabled, true);
  assert.equal(solved.won, 'won');
  assert.equal(solved.winVisible, true);
  assert.ok(solved.figure > 0, 'The constellation figure lights up');
  const [discover, install, official] = solved.links.map((h) => new URL(h));
  assert.equal(discover.pathname, '/decouvrir.html');
  assert.equal(install.searchParams.get('install'), '1');
  assert.equal(official.searchParams.get('daily'), '1');
  for (const link of [discover, install, official]) {
    assert.equal(link.searchParams.get('utm_source'), 'mini_puzzle');
    assert.equal(link.searchParams.get('utm_campaign'), 'mini_' + DAY);
  }
  assert.deepEqual(solved.done, [DAY]);
  assert.equal(solved.overflow, false, 'No horizontal overflow');
  assert.ok(solved.cell >= 44, 'Cells stay touch-sized');
  assert.equal(solved.requests.some((u) => /supabase/.test(u)), false, 'No Supabase request');
  const hits = solved.requests.filter((u) => u.includes('/mini/t.gif')).map((u) => new URL(u).searchParams);
  assert.deepEqual(hits.map((h) => h.get('e')).sort(), ['view', 'win']);
  assert.ok(hits.every((h) => h.get('d') === DAY && h.get('s') === 'facebook_daily' && h.get('l') === 'fr'));
  assert.ok(hits.every((h) => [...h.keys()].sort().join() === 'd,e,l,s'), 'Hits carry no identifier');

  // English copy from the app's stored language choice.
  await open({ send, evaluate }, page, { now: '2026-12-03T10:00:00Z', locale: 'en' });
  const english = await evaluate(`({lang:document.documentElement.lang,title:document.getElementById('mini-title').textContent})`);
  assert.deepEqual(english, { lang: 'en', title: 'Place the last Guardian' });

  // Advent calendar: doors open on the Paris date only.
  await open({ send, evaluate }, new URL('/mini/', baseUrl).href, { now: '2026-12-03T10:00:00Z', locale: 'es' });
  const calendar = await evaluate(
    `({doors:document.querySelectorAll('.mini-door').length,open:[...document.querySelectorAll('a.mini-door')].map(a=>a.textContent),
      today:document.getElementById('mini-today').getAttribute('href'),lang:document.documentElement.lang,
      overflow:document.documentElement.scrollWidth>innerWidth})`,
  );
  assert.equal(calendar.doors, 24);
  assert.deepEqual(calendar.open, ['1', '2', '3']);
  assert.equal(calendar.today, '/mini/' + DAY + '.html');
  assert.equal(calendar.lang, 'es');
  assert.equal(calendar.overflow, false);

  // Without the test clock the real page boots by itself (production path).
  await open({ send, evaluate }, page);
  const boot = await evaluate(`document.getElementById('mini').dataset.state`);
  assert.ok(['locked', 'playing'].includes(boot), 'The page mounts itself: ' + boot);
  return { mini: true, miniCell: Math.round(solved.cell), miniAdvent: calendar.open.length };
}
