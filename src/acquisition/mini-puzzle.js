// #1057 · Mini-puzzle du jour, jouable sans compte ni installation.
// Pure helpers shared by the calendar generator, the public page and the tests.
// The calendar never contains a Défi du jour grid, never the solution of the
// missing rows, and every entry has exactly one completion (checked here and in CI).
// No Supabase, no account, no write: the page only keeps a local "done" flag.

export const MINI_TIME_ZONE = 'Europe/Paris';
export const MINI_SCHEDULE_START = '2026-12-01';
export const ADVENT_DAYS = 24;
export const MINI_POOL = Object.freeze({ packId: 'base-real-sky', label: 'Facile', size: 6, minOrdinal: 13 });

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value) {
  if (!DAY_RE.test(String(value))) return false;
  const [y, m, d] = value.split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
}

export function addDays(day, count) {
  if (!isDay(day)) throw Error('Invalid mini-puzzle date ' + day);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + count)).toISOString().slice(0, 10);
}

// Civil date in Europe/Paris, the same calendar as the Défi du jour.
export function parisDay(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MINI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant instanceof Date ? instant : new Date(instant));
}

// Advent door number (1–24) or null outside 1–24 December.
export function adventDoor(day) {
  if (!isDay(day)) return null;
  const [, m, d] = day.split('-').map(Number);
  return m === 12 && d >= 1 && d <= ADVENT_DAYS ? d : null;
}

// One missing Guardian the first week, then two, then three before Christmas.
export function missingCountFor(day) {
  const door = adventDoor(day);
  if (door) return door <= 8 ? 1 : door <= 16 ? 2 : 3;
  return 2;
}

// A placement is valid when every row, column and territory holds exactly one
// Guardian and no two Guardians touch, diagonals included (docs/GAMEPLAY.md).
export function placementConflicts(reg, guardians) {
  const bad = new Set();
  const list = [...guardians];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [r1, c1] = list[i],
        [r2, c2] = list[j];
      if (
        r1 === r2 ||
        c1 === c2 ||
        reg[r1][c1] === reg[r2][c2] ||
        (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1)
      ) {
        bad.add(r1 + ',' + c1);
        bad.add(r2 + ',' + c2);
      }
    }
  return bad;
}

export function isSolved(reg, guardians) {
  const n = reg.length;
  return guardians.length === n && placementConflicts(reg, guardians).size === 0;
}

// Number of complete, valid placements that extend the given Guardians (capped).
export function countCompletions(reg, given, cap = 2) {
  const n = reg.length;
  const fixed = new Map(given.map(([r, c]) => [r, c]));
  let found = 0;
  const cols = new Set(),
    regs = new Set();
  const place = (r, prev) => {
    if (found >= cap) return;
    if (r === n) {
      found++;
      return;
    }
    const options = fixed.has(r) ? [fixed.get(r)] : [...Array(n).keys()];
    for (const c of options) {
      if (cols.has(c) || regs.has(reg[r][c]) || (prev >= 0 && Math.abs(prev - c) <= 1)) continue;
      cols.add(c);
      regs.add(reg[r][c]);
      place(r + 1, c);
      cols.delete(c);
      regs.delete(reg[r][c]);
    }
  };
  place(0, -1);
  return found;
}

// The single completion of a mini-puzzle (tests and asset generation only; the
// public page never ships the missing Guardians).
export function firstCompletion(reg, given) {
  const n = reg.length;
  const fixed = new Map(given.map(([r, c]) => [r, c]));
  const cols = new Set(),
    regs = new Set(),
    out = [];
  const place = (r, prev) => {
    if (r === n) return true;
    for (const c of fixed.has(r) ? [fixed.get(r)] : [...Array(n).keys()]) {
      if (cols.has(c) || regs.has(reg[r][c]) || (prev >= 0 && Math.abs(prev - c) <= 1)) continue;
      cols.add(c);
      regs.add(reg[r][c]);
      out[r] = c;
      if (place(r + 1, c)) return true;
      cols.delete(c);
      regs.delete(reg[r][c]);
    }
    return false;
  };
  return place(0, -1) ? out.map((c, r) => [r, c]) : null;
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function miniPool(quests, excludedQuestIds = new Set()) {
  return quests
    .filter(
      (q) =>
        q.packId === MINI_POOL.packId &&
        q.size === MINI_POOL.size &&
        q.difficulty?.label === MINI_POOL.label &&
        q.ordinal >= MINI_POOL.minOrdinal &&
        !excludedQuestIds.has(q.id),
    )
    .sort((a, b) => a.ordinal - b.ordinal);
}

// Append-only, deterministic calendar: no repetition before the pool is used
// up, never the same constellation two days in a row. Existing days are kept.
export async function planMiniCalendar({ pool, start = MINI_SCHEDULE_START, days, existing = [] }) {
  if (!pool.length) throw Error('Empty mini-puzzle pool');
  const out = existing.map((e) => ({ ...e }));
  const rank = new Map();
  for (const q of pool) rank.set(q.id, await sha256Hex('lumen-mini-v1:' + q.id));
  const ordered = [...pool].sort((a, b) => (rank.get(a.id) < rank.get(b.id) ? -1 : 1));
  let day = out.length ? addDays(out[out.length - 1].day, 1) : start;
  while (out.length < days) {
    const window = out.slice(-(ordered.length - 1)).map((e) => e.questId);
    const used = new Set(window);
    const previous = out[out.length - 1]?.constellationId;
    const quest =
      ordered.find((q) => !used.has(q.id) && q.constellationId !== previous) ||
      ordered.find((q) => q.constellationId !== previous);
    const missing = missingCountFor(day);
    const rowRank = await sha256Hex('lumen-mini-rows-v1:' + day + ':' + quest.id);
    const rows = [...Array(quest.size).keys()].sort(
      (a, b) => parseInt(rowRank.slice(a * 2, a * 2 + 2), 16) - parseInt(rowRank.slice(b * 2, b * 2 + 2), 16) || a - b,
    );
    const missingRows = rows.slice(0, missing).sort((a, b) => a - b);
    out.push({ day, questId: quest.id, constellationId: quest.constellationId, missingRows });
    day = addDays(day, 1);
  }
  return out;
}

// Public puzzle for one calendar entry: territories and the given Guardians only.
export function miniPuzzle(entry, quest) {
  const missing = new Set(entry.missingRows);
  const given = quest.sol.map((c, r) => [r, c]).filter(([r]) => !missing.has(r));
  return { day: entry.day, questId: quest.id, size: quest.size, reg: quest.reg, given, missing: entry.missingRows.length };
}

export function miniEntry(calendar, day) {
  return calendar?.days?.find((e) => e.day === day) || null;
}

// Days a visitor may open: the calendar's past and present, never the future.
export function openDays(calendar, today) {
  if (!calendar?.enabled) return [];
  return (calendar.days || []).filter((e) => e.day <= today).map((e) => e.day);
}
