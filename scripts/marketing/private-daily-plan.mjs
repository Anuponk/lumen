import { randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { canonicalQuestList } from '../../src/campaign/canonical-quests.js';
import { addDays, dailyPool, dailyQuest, parisDay } from '../../src/campaign/daily-challenge.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

export function outsideCheckout(path) {
  const target = resolve(path);
  const fromRoot = relative(root, target);
  if (!(isAbsolute(fromRoot) || fromRoot.startsWith('..\\') || fromRoot.startsWith('../')) || target === dirname(root)) {
    throw Error('The private schedule and visuals must stay outside the public checkout.');
  }
  return target;
}

export function replanDays(schedule, { from, to, today = parisDay(), choose = randomInt }) {
  const current = new Map(schedule.days.map(entry => [entry.day, entry]));
  if (!current.has(from) || !current.has(to) || from > to || from <= today) throw Error('Expected an entirely future date range already in the schedule.');
  const candidates = dailyPool(canonicalQuestList()).map(entry => ({ entry, quest: dailyQuest(entry) }));
  const used = new Set(schedule.days.filter(entry => entry.day < from).map(entry => entry.questId));
  const replaced = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const old = current.get(day);
    if (!old) throw Error('Schedule gap at ' + day);
    const prior = replaced.at(-1) ?? current.get(addDays(day, -1));
    const next = day === to ? current.get(addDays(day, 1)) : null;
    const original = dailyQuest(old);
    const options = candidates.filter(({ entry, quest }) => (
      entry.questId !== old.questId && !used.has(entry.questId) &&
      entry.constellationId !== prior?.constellationId && entry.constellationId !== next?.constellationId &&
      quest.size === original.size && quest.difficulty.label === original.difficulty.label
    ));
    if (!options.length) throw Error('No compatible unused replacement at ' + day);
    const { entry } = options[choose(options.length)];
    replaced.push({ day, ...entry, previousQuestId: old.questId, previousGridRevision: old.gridRevision });
    used.add(entry.questId);
  }
  return { schema: 'lumen-private-daily-v1', timeZone: 'Europe/Paris', from, to, days: replaced };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { from: { type: 'string' }, to: { type: 'string' }, output: { type: 'string' } } });
  if (!values.from || !values.to || !values.output) throw Error('Use --from YYYY-MM-DD --to YYYY-MM-DD --output PRIVATE_FILE');
  const original = JSON.parse(readFileSync(resolve(root, 'content/generated/daily-schedule.json'), 'utf8'));
  const plan = replanDays(original, values);
  writeFileSync(outsideCheckout(values.output), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Prepared ${plan.days.length} future assignments. Board identities saved to the private file.`);
}
