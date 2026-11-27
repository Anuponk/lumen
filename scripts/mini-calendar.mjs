// #1057 · Mini-puzzle calendar and public pages.
//   node scripts/mini-calendar.mjs            extend the calendar and regenerate mini/
//   node scripts/mini-calendar.mjs --check    fail if a published day changed or mini/ is stale
//   node scripts/mini-calendar.mjs --until=2027-02-28
// Append-only: a day already in content/generated/mini-calendar.json is never
// rewritten. Pool: free 6×6 « Facile » quests of the first sky, never a Défi du
// jour grid (checked against the whole content/generated/daily-schedule.json).
import fs from 'node:fs';
import path from 'node:path';
import { canonicalQuestById, canonicalQuestList } from '../src/campaign/canonical-quests.js';
import { verifiedAstronomicalFigure } from '../src/ui/astronomical-catalogue.js';
import frConstellations from '../src/ui/locales/fr/constellations.js';
import enConstellations from '../src/ui/locales/en/constellations.js';
import esConstellations from '../src/ui/locales/es/constellations.js';
import {
  MINI_SCHEDULE_START,
  adventDoor,
  countCompletions,
  miniPool,
  miniPuzzle,
  planMiniCalendar,
} from '../src/acquisition/mini-puzzle.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const CALENDAR = path.join(root, 'content/generated/mini-calendar.json');
const DAILY = path.join(root, 'content/generated/daily-schedule.json');
const OUT = path.join(root, 'mini');
const SITE = 'https://lumen.nopuna.fr';
const DEFAULT_UNTIL = '2027-01-31';
const args = process.argv.slice(2);
const check = args.includes('--check');
const until = args.find((a) => a.startsWith('--until='))?.split('=')[1] || DEFAULT_UNTIL;
// 1×1 transparent GIF: the static hit pixel counted from the access log.
export const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const read = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5) + 1;
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

export function constellationOf(constellationId) {
  const figure = verifiedAstronomicalFigure({ id: constellationId });
  if (!figure) return { names: {}, figure: null };
  const key = 'constellation.' + figure.iau + '.name';
  return {
    iau: figure.iau,
    names: { fr: frConstellations[key], en: enConstellations[key], es: esConstellations[key] },
    figure: { pts: figure.pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]), edges: figure.edges },
  };
}

function frDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function pageData(calendar, entry) {
  const quest = canonicalQuestById(entry.questId);
  const puzzle = miniPuzzle(entry, quest);
  return {
    enabled: calendar.enabled !== false,
    day: entry.day,
    door: adventDoor(entry.day),
    size: puzzle.size,
    reg: puzzle.reg,
    given: puzzle.given,
    missing: puzzle.missing,
    constellation: constellationOf(entry.constellationId),
  };
}

export function ogImageFor(day) {
  const file = 'content/social/mini-' + day + '.jpg';
  return fs.existsSync(path.join(root, file)) ? SITE + '/' + file : SITE + '/src/landing/og.jpg';
}

export function renderDayPage(data) {
  const door = data.door;
  const title = door
    ? 'Calendrier de l’Avent LUMEN · case ' + door + ' — mini-puzzle du ' + frDate(data.day)
    : 'Mini-puzzle LUMEN du ' + frDate(data.day);
  const description =
    data.missing === 1
      ? 'Saurez-vous placer le dernier Gardien ? Un mini-puzzle de logique en une minute, sans compte ni installation.'
      : 'Saurez-vous placer les ' + data.missing + ' derniers Gardiens ? Un mini-puzzle de logique en une minute, sans compte ni installation.';
  const url = SITE + '/mini/' + data.day + '.html';
  const image = ogImageFor(data.day);
  return `<!doctype html>
<html lang="fr">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <title>${escapeHtml(title)}</title>
 <meta name="description" content="${escapeHtml(description)}">
 <link rel="canonical" href="${url}">
 <meta property="og:type" content="website">
 <meta property="og:locale" content="fr_FR">
 <meta property="og:site_name" content="Lumen">
 <meta property="og:title" content="${escapeHtml(title)}">
 <meta property="og:description" content="${escapeHtml(description)}">
 <meta property="og:url" content="${url}">
 <meta property="og:image" content="${image}">
 <meta property="og:image:width" content="1200">
 <meta property="og:image:height" content="630">
 <meta property="og:image:alt" content="Une grille LUMEN presque terminée : territoires de couleur et Gardiens déjà placés">
 <meta name="twitter:card" content="summary_large_image">
 <meta name="twitter:title" content="${escapeHtml(title)}">
 <meta name="twitter:description" content="${escapeHtml(description)}">
 <meta name="twitter:image" content="${image}">
 <meta name="theme-color" content="#07111d">
 <link rel="icon" href="/icon.svg" type="image/svg+xml">
 <link rel="stylesheet" href="/src/landing/landing.css">
 <link rel="stylesheet" href="/src/acquisition/mini.css">
 <script type="application/json" id="mini-data">${json(data)}</script>
 <script type="module" src="/src/acquisition/mini-game.js"></script>
</head>
<body>
 <main id="mini" class="mini-page" data-state="loading">
  <p class="brand"><a href="/decouvrir.html">✦ LUMEN</a></p>
  <p class="mini-kicker" id="mini-kicker">${door ? 'Calendrier de l’Avent · case ' + door : 'Mini-puzzle du jour'}</p>
  <p class="mini-date" id="mini-date">${escapeHtml(frDate(data.day))} · Date de Paris</p>
  <h1 id="mini-title">${data.missing === 1 ? 'Placez le dernier Gardien' : 'Placez les ' + data.missing + ' derniers Gardiens'}</h1>
  <p class="mini-rules" id="mini-rules">Un Gardien par ligne, par colonne et par territoire de couleur. Deux Gardiens ne se touchent jamais, même en diagonale.</p>
  <p class="mini-how" id="mini-how">Touchez une case : une croix pour l’écarter, puis un Gardien ✦, puis elle redevient vide.</p>
  <div class="mini-board" id="mini-board" aria-labelledby="mini-title"></div>
  <p class="mini-status" id="mini-status" role="status" aria-live="polite"><noscript>Ce mini-puzzle nécessite JavaScript.</noscript></p>
  <p class="mini-done" id="mini-done"></p>
  <div class="mini-actions"><button type="button" id="mini-reset">Recommencer</button><button type="button" id="mini-share">Partager ce mini-puzzle</button></div>
  <section class="mini-win" id="mini-win" hidden aria-labelledby="mini-win-title">
   <h2 id="mini-win-title"></h2>
   <div id="mini-win-figure"></div>
   <p id="mini-win-text"></p>
   <div class="mini-ctas">
    <a class="play" id="mini-cta-discover" href="/decouvrir.html"></a>
    <p class="cta-note" id="mini-cta-note"></p>
    <a class="install-mobile" id="mini-cta-install" href="/?install=1"></a>
    <a class="mini-cta-official" id="mini-cta-official" href="/?daily=1"></a>
   </div>
  </section>
  <p class="mini-note" id="mini-note">Sans compte ni installation. Votre progression reste sur cet appareil.</p>
  <p class="mini-note"><a href="/mini/" id="mini-archive-link">Jours précédents</a></p>
 </main>
</body>
</html>
`;
}

export function calendarSummary(calendar) {
  return { enabled: calendar.enabled !== false, days: calendar.days.map((e) => ({ day: e.day })) };
}

export function renderIndexPage(calendar) {
  return `<!doctype html>
<html lang="fr">
<head>
 <meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <title>Calendrier de l’Avent LUMEN — un mini-puzzle de logique par jour</title>
 <meta name="description" content="Du 1er au 24 décembre, une case par jour : un mini-puzzle LUMEN à résoudre en une minute, sans compte ni installation.">
 <link rel="canonical" href="${SITE}/mini/">
 <meta property="og:type" content="website">
 <meta property="og:locale" content="fr_FR">
 <meta property="og:site_name" content="Lumen">
 <meta property="og:title" content="Calendrier de l’Avent LUMEN">
 <meta property="og:description" content="Une case par jour, du 1er au 24 décembre : un mini-puzzle de logique en une minute, sans compte ni installation.">
 <meta property="og:url" content="${SITE}/mini/">
 <meta property="og:image" content="${SITE}/src/landing/og.jpg">
 <meta property="og:image:width" content="1200">
 <meta property="og:image:height" content="630">
 <meta name="twitter:card" content="summary_large_image">
 <meta name="theme-color" content="#07111d">
 <link rel="icon" href="/icon.svg" type="image/svg+xml">
 <link rel="stylesheet" href="/src/landing/landing.css">
 <link rel="stylesheet" href="/src/acquisition/mini.css">
 <script type="application/json" id="mini-calendar-data">${json(calendarSummary(calendar))}</script>
 <script type="module" src="/src/acquisition/mini-calendar-page.js"></script>
</head>
<body>
 <main id="mini-calendar" class="mini-page">
  <p class="brand"><a href="/decouvrir.html">✦ LUMEN</a></p>
  <h1 id="mini-calendar-title">Le calendrier de l’Avent LUMEN</h1>
  <p class="mini-rules" id="mini-calendar-intro">Une case par jour, du 1er au 24 décembre : un mini-puzzle à résoudre en une minute.</p>
  <p class="cta"><a class="play" id="mini-today" href="/mini/">Mini-puzzle du jour</a></p>
  <div class="mini-doors" id="mini-doors"></div>
  <section id="mini-archive" hidden><h2 id="mini-archive-title">Jours précédents</h2><ul class="mini-previous" id="mini-previous"></ul></section>
  <p class="mini-note"><a href="/decouvrir.html">Découvrir LUMEN</a></p>
 </main>
</body>
</html>
`;
}

export async function buildCalendar({ existing, until: lastDay = DEFAULT_UNTIL } = {}) {
  const daily = read(DAILY);
  const excluded = new Set(daily.days.map((d) => d.questId));
  const pool = miniPool(canonicalQuestList(), excluded);
  const days = daysBetween(MINI_SCHEDULE_START, lastDay);
  const kept = existing?.days || [];
  const planned = await planMiniCalendar({ pool, days: Math.max(days, kept.length), existing: kept });
  for (const entry of planned) {
    const quest = canonicalQuestById(entry.questId);
    const puzzle = miniPuzzle(entry, quest);
    if (excluded.has(entry.questId)) throw Error('Mini-puzzle reuses a Défi du jour grid: ' + entry.day);
    if (countCompletions(quest.reg, puzzle.given) !== 1) throw Error('Mini-puzzle is not unique: ' + entry.day);
  }
  return {
    schema: 'lumen-mini-calendar-v1',
    start: MINI_SCHEDULE_START,
    timeZone: 'Europe/Paris',
    enabled: existing?.enabled !== false,
    pool: { packId: 'base-real-sky', label: 'Facile', size: 6, count: pool.length },
    days: planned,
  };
}

export function renderAll(calendar) {
  const files = new Map();
  for (const entry of calendar.days) files.set('mini/' + entry.day + '.html', renderDayPage(pageData(calendar, entry)));
  files.set('mini/index.html', renderIndexPage(calendar));
  return files;
}

if (import.meta.url === new URL(process.argv[1], 'file:').href || process.argv[1]?.endsWith('mini-calendar.mjs')) {
  const existing = read(CALENDAR);
  const calendar = await buildCalendar({ existing, until });
  if (existing) {
    for (const [i, entry] of existing.days.entries())
      if (JSON.stringify(entry) !== JSON.stringify(calendar.days[i])) throw Error('Published mini-puzzle day changed: ' + entry.day);
  }
  const files = renderAll(calendar);
  const calendarText = JSON.stringify(calendar, null, 1) + '\n';
  if (check) {
    const stale = [];
    if (!existing || fs.readFileSync(CALENDAR, 'utf8') !== calendarText) stale.push('content/generated/mini-calendar.json');
    for (const [file, text] of files) {
      const target = path.join(root, file);
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) stale.push(file);
    }
    if (!fs.existsSync(path.join(OUT, 't.gif')) || !fs.readFileSync(path.join(OUT, 't.gif')).equals(PIXEL)) stale.push('mini/t.gif');
    if (stale.length) {
      console.error('Run node scripts/mini-calendar.mjs, stale:\n' + stale.slice(0, 20).join('\n'));
      process.exit(1);
    }
    console.log('mini-calendar: ' + calendar.days.length + ' days, append-only and pages up to date');
  } else {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(CALENDAR, calendarText);
    for (const [file, text] of files) fs.writeFileSync(path.join(root, file), text);
    fs.writeFileSync(path.join(OUT, 't.gif'), PIXEL);
    console.log('mini-calendar: wrote ' + calendar.days.length + ' days and ' + files.size + ' pages');
  }
}
