// #759 · Records the six kit videos from the REAL game (real grids, real taps).
// Marketing tool only: never loaded by the app. Usage:
//   node scripts/marketing/record-video-kit.mjs --out <dir> [--only A1,B2] [--check]
// Env: LUMEN_CHROME_BIN (Chrome/Chromium), LUMEN_FFMPEG (ffmpeg with libx264 and
// libass). Without ffmpeg it writes the frames, timings and SRT files only.
// --check validates every scene against the catalogue and writes the SRT files
// to docs/marketing/video-kit/ (no browser).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SCENES, srt, validateScene} from './video-kit-scenes.mjs';
import {canonicalQuestList} from '../../src/campaign/canonical-quests.js';
import {currentCatalogueOrigin} from '../../src/campaign/catalogue-origin.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const quests = canonicalQuestList();
const questById = id => quests.find(q => q.id === id);
const only = (option('--only') || '').split(',').filter(Boolean);
const scenes = SCENES.filter(s => !only.length || only.includes(s.id));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const errors = scenes.flatMap(s => validateScene(s, questById(s.questId)));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
if (args.includes('--check')) {
  const dir = path.join(root, 'docs/marketing/video-kit');
  fs.mkdirSync(dir, {recursive: true});
  for (const s of scenes) for (const locale of ['fr', 'en']) fs.writeFileSync(path.join(dir, s.id + '-' + locale + '.srt'), srt(s, locale));
  console.log('video kit: ' + scenes.length + ' scenes match the catalogue solutions; SRT written');
  process.exit(0);
}

const out = path.resolve(option('--out') || path.join(os.tmpdir(), 'lumen-video-kit'));
fs.mkdirSync(out, {recursive: true});
const ffmpeg = process.env.LUMEN_FFMPEG || null;

// Static server over the checkout and a headless browser with a French profile.
const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg'};
const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  let file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise(r => server.once('listening', r));
const url = 'http://127.0.0.1:' + server.address().port + '/';
const chromeBin = process.env.LUMEN_CHROME_BIN || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => fs.existsSync(p));
if (!chromeBin) throw Error('Set LUMEN_CHROME_BIN');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-video-'));
fs.mkdirSync(path.join(profile, 'Default'));
fs.writeFileSync(path.join(profile, 'Default', 'Preferences'), JSON.stringify({intl: {accept_languages: 'fr-FR,fr'}}));
const port = 9500 + Math.floor(Math.random() * 400);
const chrome = spawn(chromeBin, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--no-first-run', '--hide-scrollbars', 'about:blank'], {stdio: 'ignore'});
const {navigateAndWait, acknowledgeLearningMilestones} = await import('../cdp-client.mjs');
// Minimal CDP client: commands, evaluation and raw events (screencast frames).
async function connect() {
  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    try { page = (await (await fetch('http://127.0.0.1:' + port + '/json')).json()).find(t => t.type === 'page'); } catch {}
    if (!page) await sleep(250);
  }
  if (!page) throw Error('Chrome did not start');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const pending = new Map(), listeners = [];
  ws.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.id) { pending.get(m.id)?.(m); pending.delete(m.id); } else listeners.forEach(fn => fn(m));
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id; pending.set(key, m => m.error ? reject(Error(method + ': ' + JSON.stringify(m.error))) : resolve(m.result));
    ws.send(JSON.stringify({id: key, method, params}));
  });
  const evaluate = async (expression, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', {expression, awaitPromise, returnByValue: true});
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result.value;
  };
  return {send, evaluate, onEvent: fn => listeners.push(fn), close: () => ws.close()};
}
const browser = await connect(), {send, evaluate} = browser;
await send('Page.enable'); await send('Runtime.enable');
await send('Page.addScriptToEvaluateOnNewDocument', {source: 'delete Object.getPrototypeOf(navigator).serviceWorker'});

// 9:16 phone: 405×720 CSS px at 8/3 → 1080×1920 frames.
const WIDTH = 405, HEIGHT = 720, SCALE = 8 / 3;
// Capture hygiene: no QA banner, toasts or account prompts in the frame.
const CAPTURE_CSS = '#qaBanner,#returnToast,.reward-toast,#rewardToast,.share-toast,#accountOptin,.welcome-back,#pwaWelcome,#installOptin{display:none!important}.vk-mark{box-shadow:inset 0 0 0 4px #ffe39a,0 0 14px rgba(255,227,154,.75)!important;z-index:3}';

async function prepare(scene, locale) {
  const quest = questById(scene.questId);
  // Exactly the quests a player has solved before this one: quest 1 stays a
  // plain quest victory, quest 10 of Ursa Major really completes the constellation.
  const prior = quests.filter(q => q.ordinal < quest.ordinal);
  const progress = {catalogueOrigin: currentCatalogueOrigin,
    solved: Object.fromEntries(prior.filter(q => q.legacyIndex !== null).map(q => [q.legacyIndex, 1])),
    canonicalQuestState: Object.fromEntries(prior.filter(q => q.legacyIndex === null).map(q => [q.id, {solved: true, badges: {}}])),
    badges: {}, performances: {}, shards: 100, speedBadgeIntroSeen: 1, fullBadgeIntroSeen: 1, autonomySeen: 1};
  await send('Emulation.setDeviceMetricsOverride', {width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: true});
  await send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 1});
  const hook = await send('Page.addScriptToEvaluateOnNewDocument', {source: `localStorage.clear();sessionStorage.clear();
    localStorage.setItem('lumen.locale',${JSON.stringify(locale)});
    localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});
    for(const [k,v] of [['lumenSound','off'],['lumenSkyTourSeen','1'],['lumenAutoCross','0'],['lumenGuidedErrors','off'],['lumenInstallLater',String(Date.now())],['lumenPushChoice','later'],['lumenTutorialSeen','1'],['lumenTutorialCompletedV1','1'],['lumenQaTutorialSeen','1'],['lumenQaTutorialCompletedV1','1']])localStorage.setItem(k,v);
    addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(CAPTURE_CSS)};document.head.append(s)});`});
  await navigateAndWait(browser, 'Page.navigate', {url: url + '?qa=new'});
  await sleep(1500);
  await send('Page.removeScriptToEvaluateOnNewDocument', {identifier: hook.identifier});
  await acknowledgeLearningMilestones(evaluate);
  if (quest.legacyIndex !== null) {
    await evaluate(`lumenDiagnostics.setupQuest(${quest.legacyIndex})`);
  } else {
    // Canonical-only quest: the real route, Mon ciel → constellation → quest.
    await evaluate(`document.getElementById('openSky').click()`);
    await sleep(500);
    await evaluate(`(()=>{const tab=document.querySelector('#sectorTabs [data-content-id="${scene.viaSky}"]');if(tab)tab.click()})()`);
    await sleep(500);
    await evaluate(`document.querySelector('.puzzle-card[data-quest-id="${quest.id}"]').click()`);
    await sleep(800);
  }
  await acknowledgeLearningMilestones(evaluate);
  // Learning quests (1–2) start a guided coach that blocks free play: leave it
  // through its own « Passer le tutoriel » button, like a returning player.
  for (let i = 0; i < 6; i++) {
    const skipped = await evaluate(`(()=>{const b=document.getElementById('learningSkip');if(b&&!b.hidden&&b.offsetParent){b.click();return true}return false})()`);
    if (!skipped) break;
    await sleep(400);
    await evaluate(`(()=>{const c=document.querySelector('.learning-skip-confirm:not([hidden]) button.primary,#learningSkipConfirm');if(c)c.click()})()`);
    await sleep(400);
  }
  await acknowledgeLearningMilestones(evaluate);
  await evaluate(`(()=>{const q=document.getElementById('questStart');if(q)q.hidden=true;document.getElementById('attemptMask')?.click()})()`);
  await sleep(500);
  const shown = await evaluate('lumenDiagnostics.snapshot().puz?.sol');
  if (JSON.stringify(shown) !== JSON.stringify(quest.sol)) throw Error(scene.id + ': the board shown is not ' + quest.id);
  for (const cell of scene.pre) { await tapCell(cell); await tapCell(cell); }
  await sleep(700);
  const missing = await guardiansMissing(scene.pre);
  if (missing.length) throw Error(scene.id + ': Guardians not placed by the real taps: ' + JSON.stringify(missing));
}
async function guardiansMissing(cells) {
  const state = await evaluate('lumenDiagnostics.snapshot().state');
  return cells.filter(([r, c]) => state?.[r - 1]?.[c - 1] !== 2);
}
async function tapCell([r, c]) {
  const p = await evaluate(`(()=>{const e=document.querySelector('#board .cell[data-row="${r - 1}"][data-col="${c - 1}"]').getBoundingClientRect();return {x:e.left+e.width/2,y:e.top+e.height/2}})()`);
  await send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [p]});
  await send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await sleep(120);
}
function cellsOf(spec) {
  return spec.split(',').flatMap(part => {
    const [a, b] = part.split(':');
    if (a === 'row') return [`#board .cell[data-row="${b - 1}"]`];
    if (a === 'col') return [`#board .cell[data-col="${b - 1}"]`];
    return [`#board .cell[data-row="${a - 1}"][data-col="${b - 1}"]`];
  }).join(',');
}
async function act(a) {
  if (a.type === 'guardian') { await tapCell(a.cell); await tapCell(a.cell); }
  else if (a.type === 'cross') await tapCell(a.cell);
  else if (a.type === 'mark') await evaluate(`document.querySelectorAll(${JSON.stringify(cellsOf(a.cells))}).forEach(e=>e.classList.add('vk-mark'))`);
  else if (a.type === 'unmark') await evaluate(`document.querySelectorAll('.vk-mark').forEach(e=>e.classList.remove('vk-mark'))`);
}

async function record(scene, locale) {
  const dir = path.join(out, scene.id + '-' + locale); fs.rmSync(dir, {recursive: true, force: true}); fs.mkdirSync(dir, {recursive: true});
  const frames = [];
  const onFrame = message => {
    if (message.method !== 'Page.screencastFrame') return;
    const {data, metadata, sessionId} = message.params;
    const file = path.join(dir, String(frames.length).padStart(5, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    frames.push({file, at: metadata.timestamp});
    void send('Page.screencastFrameAck', {sessionId});
  };
  browser.onEvent(onFrame);
  await send('Page.startScreencast', {format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1});
  const start = Date.now();
  for (const a of scene.actions) { const wait = a.at * 1000 - (Date.now() - start); if (wait > 0) await sleep(wait); await act(a); }
  const rest = scene.duration * 1000 - (Date.now() - start); if (rest > 0) await sleep(rest + 300);
  await send('Page.stopScreencast');
  // Never ship a misleading video: every scripted Guardian must be on the board,
  // and the « last Guardian » scenes must end on a solved grid.
  const placed = scene.pre.concat(scene.actions.filter(a => a.type === 'guardian').map(a => a.cell));
  const missing = await guardiansMissing(placed);
  if (missing.length) throw Error(scene.id + ': final board misses Guardians ' + JSON.stringify(missing));
  if (/^[AC]/.test(scene.id) && !(await evaluate('lumenDiagnostics.snapshot().celebrated'))) throw Error(scene.id + ': the grid was not solved');
  return frames;
}

// Each language is recorded with the game itself in that language (#754).
function render(scene, frames, locale) {
  fs.writeFileSync(path.join(out, scene.id + '-' + locale + '.srt'), srt(scene, locale));
  if (!frames.length) throw Error(scene.id + ': no frame captured');
  const first = frames[0].at, list = [];
  frames.forEach((f, i) => {
    const next = frames[i + 1]?.at ?? (first + scene.duration);
    list.push("file '" + f.file.replaceAll('\\', '/') + "'", 'duration ' + Math.max(0.001, Math.min(next, first + scene.duration) - f.at).toFixed(3));
  });
  list.push("file '" + frames.at(-1).file.replaceAll('\\', '/') + "'");
  const listFile = path.join(out, scene.id + '-' + locale + '-frames.txt'); fs.writeFileSync(listFile, list.join('\n'));
  if (!ffmpeg) { console.log(scene.id + ': frames and SRT in ' + out + ' (set LUMEN_FFMPEG to render MP4)'); return; }
  {
    const sub = (scene.id + '-' + locale + '.srt');
    // libass reads SRT alignment in legacy SSA numbering: 6 = top centre, under the
    // LUMEN header and above the grid, so no cell is ever covered.
    const style = 'FontName=Arial,Fontsize=10,Bold=1,PrimaryColour=&H00FFFFFF,BackColour=&H30101D2E,BorderStyle=3,Outline=4,Shadow=0,Alignment=6,MarginV=26,MarginL=16,MarginR=16';
    const result = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x07131f,fps=30,format=yuv420p,subtitles=' + sub + ":force_style='" + style + "'",
      '-t', String(scene.duration), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', scene.id + '-' + locale + '.mp4'], {cwd: out, encoding: 'utf8'});
    if (result.status !== 0) throw Error(scene.id + ' ffmpeg: ' + result.stderr);
    console.log(scene.id + ': ' + path.join(out, scene.id + '-' + locale + '.mp4'));
  }
}

try {
  for (const scene of scenes) for (const locale of ['fr', 'en']) {
    await prepare(scene, locale);
    const frames = await record(scene, locale);
    render(scene, frames, locale);
  }
} finally {
  browser.close(); chrome.kill(); server.close();
}
