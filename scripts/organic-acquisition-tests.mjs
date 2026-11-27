// #1056 / #1057 · Organic acquisition: mini-puzzle calendar and pages, Advent
// calendar, campaign links, daily Facebook post plan and release packaging.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createGameEngine } from '../src/game/engine.js';
import { canonicalQuestAtGridRevision, canonicalQuestById } from '../src/campaign/canonical-quests.js';
import {
  MINI_POOL,
  addDays,
  adventDoor,
  countCompletions,
  firstCompletion,
  isSolved,
  miniPuzzle,
  missingCountFor,
  openDays,
  parisDay,
  placementConflicts,
} from '../src/acquisition/mini-puzzle.js';
import { MINI_LOCALES, miniLocale, miniTranslator } from '../src/acquisition/locales.js';
import { calendarView } from '../src/acquisition/mini-calendar-page.js';
import { TERRITORY_COLORS, ctaLinks, hitUrl } from '../src/acquisition/mini-game.js';
import { METRICOOL_COLUMNS, buildPost, metricoolCsv, postKind } from '../src/acquisition/social-posts.js';
import { campaignUrl, playerShareUrlFor, readDiscoveryCampaign } from '../src/analytics/acquisition.js';
import { buildPlan } from './marketing/social-posts.mjs';
import { boardSvg } from './marketing/social-visuals.mjs';

const read = (file) => fs.readFileSync(file, 'utf8');
const calendar = JSON.parse(read('content/generated/mini-calendar.json'));
const schedule = JSON.parse(read('content/generated/daily-schedule.json'));
const dailyIds = new Set(schedule.days.map((d) => d.questId));

// Generated files are up to date and the published days never change.
for (const script of ['scripts/mini-calendar.mjs', 'scripts/marketing/social-posts.mjs']) {
  const run = spawnSync(process.execPath, [script, '--check'], { encoding: 'utf8' });
  assert.equal(run.status, 0, script + ' --check\n' + run.stderr);
}

// Paris calendar, Advent doors and difficulty.
assert.equal(parisDay(new Date('2026-11-30T23:30:00Z')), '2026-12-01');
assert.equal(parisDay(new Date('2027-06-30T22:30:00Z')), '2027-07-01');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');
assert.deepEqual(['2026-11-30', '2026-12-01', '2026-12-24', '2026-12-25'].map(adventDoor), [null, 1, 24, null]);
assert.deepEqual(['2026-12-01', '2026-12-09', '2026-12-17', '2026-12-25'].map(missingCountFor), [1, 2, 3, 2]);

// Every day: free first-sky grid, never a Défi du jour grid, one completion,
// cross-checked with the game's own solver; the given Guardians are correct.
assert.equal(calendar.start, '2026-12-01');
assert.equal(calendar.enabled, true);
let previous = null;
for (const entry of calendar.days) {
  const quest = canonicalQuestById(entry.questId);
  assert.equal(quest.packId, MINI_POOL.packId, entry.day);
  assert.equal(quest.size, 6, entry.day);
  assert.equal(quest.difficulty.label, 'Facile', entry.day);
  assert.ok(!dailyIds.has(entry.questId), 'Never a Défi du jour grid: ' + entry.day);
  assert.notEqual(entry.constellationId, previous, 'Two days in a row in the same constellation: ' + entry.day);
  previous = entry.constellationId;
  assert.equal(entry.missingRows.length, missingCountFor(entry.day), entry.day);
  const puzzle = miniPuzzle(entry, quest);
  assert.equal(countCompletions(quest.reg, puzzle.given, 5), 1, 'Unique completion ' + entry.day);
  for (const [r, c] of puzzle.given) assert.equal(quest.sol[r], c);
  const board = { n: 6, puz: { reg: quest.reg }, state: Array.from({ length: 6 }, () => Array(6).fill(0)) };
  for (const [r, c] of puzzle.given) board.state[r][c] = 2;
  const engine = createGameEngine(() => board, () => false);
  assert.equal(engine.solutions(board).length, 1, 'Game solver agrees: ' + entry.day);
  const completion = firstCompletion(quest.reg, puzzle.given);
  assert.deepEqual(completion.map(([, c]) => c), quest.sol);
  assert.ok(isSolved(quest.reg, completion));
}
const ids = calendar.days.map((e) => e.questId);
const firstCycle = ids.slice(0, calendar.pool.count);
assert.equal(new Set(firstCycle).size, firstCycle.length, 'No repetition before the pool is used up');
const reg0 = canonicalQuestById(calendar.days[0].questId).reg;
assert.equal(placementConflicts(reg0, [[0, 0], [1, 1]]).size, 2, 'Touching Guardians conflict');
assert.equal(isSolved(reg0, [[0, 0]]), false);

// Pages: one per day, data without the missing Guardians, OG preview, scripts.
for (const entry of calendar.days) {
  const html = read('mini/' + entry.day + '.html');
  const data = JSON.parse(html.match(/<script type="application\/json" id="mini-data">(.*?)<\/script>/s)[1]);
  assert.equal(data.day, entry.day);
  assert.equal(data.given.length + data.missing, 6);
  assert.ok(!/"sol"/.test(html), 'No solution in ' + entry.day);
  const missing = new Set(entry.missingRows);
  assert.ok(data.given.every(([r]) => !missing.has(r)), 'Missing rows stay empty');
  assert.ok(html.includes('<link rel="canonical" href="https://lumen.nopuna.fr/mini/' + entry.day + '.html">'));
  const image = html.match(/property="og:image" content="([^"]+)"/)[1];
  assert.ok(fs.existsSync(image.replace('https://lumen.nopuna.fr/', '')), 'OG image exists: ' + image);
  assert.ok(html.includes('src="/src/acquisition/mini-game.js"'));
  assert.ok(data.constellation.names.fr && data.constellation.names.en && data.constellation.names.es, entry.day);
  assert.ok(data.constellation.figure.pts.length >= 2);
}
assert.ok(read('mini/index.html').includes('id="mini-calendar-data"'));
assert.equal(fs.readFileSync('mini/t.gif').subarray(0, 6).toString('latin1'), 'GIF89a');

// Advent calendar view: doors open on the Paris date only; a paused calendar opens nothing.
const view = calendarView(calendar, '2026-12-03', new Set(['2026-12-02']));
assert.equal(view.advent.length, 24);
assert.deepEqual(view.advent.filter((d) => d.open).map((d) => d.door), [1, 2, 3]);
assert.equal(view.advent[1].done, true);
assert.equal(view.today, '2026-12-03');
assert.equal(calendarView(calendar, '2026-11-27').today, null);
assert.deepEqual(openDays({ ...calendar, enabled: false }, '2026-12-10'), []);
assert.deepEqual(calendarView(calendar, '2027-01-05').previous.slice(0, 2), ['2027-01-04', '2027-01-03']);

// Same territory palette as the game board.
const gamePalette = read('src/ui/game-screen.js').match(/const TERRITORY_COLORS=(\[[^\]]+\])/)[1];
assert.deepEqual(TERRITORY_COLORS, JSON.parse(gamePalette));

// Copy: same keys and placeholders in FR/EN/ES, Spanish punctuation, no French leftovers.
const keys = Object.keys(MINI_LOCALES.fr).sort();
const placeholders = (v) => (JSON.stringify(v).match(/\{\w+\}/g) || []).sort().join();
for (const code of ['en', 'es']) {
  assert.deepEqual(Object.keys(MINI_LOCALES[code]).sort(), keys, code + ' keys');
  for (const key of keys) {
    assert.equal(placeholders(MINI_LOCALES[code][key]), placeholders(MINI_LOCALES.fr[key]), code + ' ' + key);
    assert.notDeepEqual(MINI_LOCALES[code][key], MINI_LOCALES.fr[key], code + ' still French: ' + key);
  }
}
for (const [key, value] of Object.entries(MINI_LOCALES.es)) {
  const text = typeof value === 'string' ? value : Object.values(value).join(' ');
  if (text.includes('?')) assert.ok(text.includes('¿'), 'ES ¿: ' + key);
  if (text.includes('!')) assert.ok(text.includes('¡'), 'ES ¡: ' + key);
}
const tr = miniTranslator('fr');
assert.equal(tr('mini.remaining', { count: 1 }), 'Encore 1 Gardien à placer');
assert.equal(tr('mini.remaining', { count: 3 }), 'Encore 3 Gardiens à placer');
assert.equal(miniTranslator('en')('mini.titleMany', { count: 2 }), 'Place the last 2 Guardians');
assert.equal(miniLocale({ search: '?lang=es' }), 'es');
assert.equal(miniLocale({ storage: { getItem: () => 'en-GB' }, navigator: { languages: ['es-ES'] } }), 'en');
assert.equal(miniLocale({ storage: { getItem: () => null }, navigator: { languages: ['de-DE', 'es-MX'] } }), 'es');
assert.equal(miniLocale({ storage: { getItem: () => { throw Error('blocked'); } }, navigator: { languages: ['it'] } }), 'fr');

// Campaign links: allowlisted sources, reviewed flags kept, sanitized campaign.
assert.equal(playerShareUrlFor('fr'), 'https://lumen.nopuna.fr/decouvrir.html?utm_source=player_share&utm_medium=referral');
assert.throws(() => campaignUrl('https://lumen.nopuna.fr/', 'spam'));
const install = new URL(campaignUrl('https://lumen.nopuna.fr/?install=1&x=1', 'mini_puzzle', { campaign: 'mini 2026/12', keep: ['install'] }));
assert.deepEqual([...install.searchParams.keys()], ['install', 'utm_source', 'utm_medium', 'utm_campaign']);
assert.equal(install.searchParams.get('utm_campaign'), 'mini_2026_12');
const links = ctaLinks('2026-12-03', 'en');
assert.equal(new URL(links.discover).pathname, '/discover.html');
assert.equal(new URL(links.official).searchParams.get('daily'), '1');
assert.equal(
  readDiscoveryCampaign(new URL('https://lumen.nopuna.fr/'), 'https://lumen.nopuna.fr/decouvrir.html?utm_source=mini_puzzle&utm_medium=referral&utm_campaign=mini_2026-12-03'),
  'mini_puzzle',
);
// Hits: event, day, language and an allowlisted source only.
const hit = new URL(hitUrl('win', { day: '2026-12-03', locale: 'fr', search: '?utm_source=someone@example.com&fbclid=abc' }), 'https://x');
assert.deepEqual(Object.fromEntries(hit.searchParams), { e: 'win', d: '2026-12-03', l: 'fr', s: 'direct' });

// Daily post plan: one per day, Advent = mini, then alternate; official links
// only for scheduled days; captions never carry coordinates; visuals exist.
const plan = buildPlan();
assert.deepEqual(plan, JSON.parse(read('content/generated/social-posts.json')));
assert.equal(new Set(plan.posts.map((p) => p.key)).size, plan.posts.length);
for (const post of plan.posts) {
  assert.equal(post.key, 'facebook:' + post.day);
  assert.equal(post.publishAt, '08:00');
  if (adventDoor(post.day)) assert.equal(post.kind, 'mini', post.day);
  else assert.equal(post.kind, Number(post.day.slice(8)) % 2 ? 'official' : 'mini', post.day);
  const url = new URL(post.link);
  assert.equal(url.searchParams.get('utm_source'), 'facebook_daily');
  assert.ok(post.message.includes(post.link));
  assert.ok(!/(ligne|colonne|row|column)\s*\d/i.test(post.message), 'No coordinates: ' + post.day);
  assert.ok(post.image && fs.existsSync(post.image.replace('https://lumen.nopuna.fr/', '')), 'Visual exists: ' + post.day);
  if (post.kind === 'official') {
    const daily = schedule.days.find((d) => d.day === post.day);
    assert.ok(daily, 'Official post on a scheduled day');
    assert.equal(url.searchParams.get('daily'), '1');
    assert.ok(post.message.includes(canonicalQuestAtGridRevision(daily.questId, daily.gridRevision).size + '×'));
  } else assert.equal(url.pathname, '/mini/' + post.day + '.html');
}
assert.equal(postKind('2026-12-27', { miniDays: new Set(), officialDays: new Set(['2026-12-27']) }), 'official');
assert.equal(buildPost('2026-12-25', { mini: null, official: null }), null);
const fallback = buildPost('2026-12-02', { mini: { day: '2026-12-02', missing: 1 }, official: null, imageExists: () => false });
assert.equal(fallback.image, null, 'Without a visual: a plain link post');
// Metricool calendar import: exact template columns, one Facebook photo post per row.
const parseCsv = (text) => {
  const rows = [[]];
  let cell = '',
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      rows.at(-1).push(cell);
      cell = '';
    } else if (ch === '\n') {
      rows.at(-1).push(cell);
      cell = '';
      rows.push([]);
    } else cell += ch;
  }
  return rows.filter((r) => r.length > 1);
};
assert.equal(METRICOOL_COLUMNS.length, 102);
assert.deepEqual(METRICOOL_COLUMNS.slice(0, 5), ['Text', 'Date', 'Time', 'Draft', 'Facebook']);
const december = plan.posts.filter((p) => p.day.startsWith('2026-12'));
const csvText = metricoolCsv([...december, { ...fallback, message: 'a "b"\nc' }]);
assert.ok(csvText.startsWith('﻿Text,Date,Time,Draft,Facebook,'), 'UTF-8 BOM and template header');
assert.ok(!csvText.includes('\r'));
const [head, ...rows] = parseCsv(csvText.slice(1));
assert.deepEqual(head, [...METRICOOL_COLUMNS]);
assert.equal(rows.length, 32);
const col = (row, name) => row[METRICOOL_COLUMNS.indexOf(name)];
for (const [index, row] of rows.slice(0, 31).entries()) {
  const post = december[index];
  assert.equal(row.length, 102);
  assert.deepEqual([col(row, 'Text'), col(row, 'Date'), col(row, 'Time')], [post.message, post.day, '08:00:00']);
  assert.deepEqual(
    ['Draft', 'Facebook', 'Instagram', 'Twitter/X', 'TikTok', 'Shortener'].map((n) => col(row, n)),
    ['false', 'true', 'false', 'false', 'false', 'false'],
  );
  assert.equal(col(row, 'Picture Url 1'), post.image);
  assert.ok(col(row, 'Alt text picture 1').length > 10);
  assert.equal(col(row, 'Facebook Post Type'), 'POST');
}
assert.equal(col(rows[31], 'Text'), 'a "b"\nc', 'Quotes and line breaks survive');
assert.equal(col(rows[31], 'Picture Url 1'), '', 'No visual: no picture');
const [, draftRow] = parseCsv(metricoolCsv(december.slice(0, 1), { draft: true }).slice(1));
assert.equal(col(draftRow, 'Draft'), 'true', 'Rehearsal rows are drafts');

// Visuals: the official board shows territories only, the mini board the given Guardians only.
assert.ok(!boardSvg(reg0, []).includes('✦'));
const firstPuzzle = miniPuzzle(calendar.days[0], canonicalQuestById(calendar.days[0].questId));
assert.equal((boardSvg(firstPuzzle.reg, firstPuzzle.given).match(/✦/g) || []).length, firstPuzzle.given.length);

// Release packaging: both o2switch paths publish mini/, the cron checks it.
assert.ok(read('scripts/o2switch-safe-release.sh').includes('for dir in mini; do\n    if [[ -d "$dir" ]]; then cp -R "$dir" "$TMP/$dir"; fi'));
const cron = read('scripts/o2switch-cron-publish.sh');
assert.ok(cron.includes('git archive "$SHA" "$dir" | tar -xf - -C "$TMP"; fi'));
assert.ok(cron.includes('cp -Rp "$RELEASE/mini" "$TARGET/mini"'));
assert.ok(cron.includes('mini/?release=$SHA'));

console.log('organic-acquisition-tests: ' + calendar.days.length + ' mini-puzzles, Advent, copy, campaigns, ' + plan.posts.length + ' posts and packaging OK');
