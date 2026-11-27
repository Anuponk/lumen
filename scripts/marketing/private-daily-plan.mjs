import { createHash, randomInt } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { addDays, dailyQuest, parisDay } from '../../src/campaign/daily-challenge.js';

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
  const originals = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const entry = current.get(day);
    if (!entry) throw Error('Schedule gap at ' + day);
    originals.push({ entry, quest: dailyQuest(entry) });
  }
  // Permute the same grids within the private window so adjacent months retain
  // their existing catalogue cycle. Restart if a random allocation dead-ends.
  const before = current.get(addDays(from, -1))?.constellationId;
  const after = current.get(addDays(to, 1))?.constellationId;
  let replaced = [];
  for (let attempt = 0; attempt < 256; attempt++) {
    const available = [...originals];
    replaced = [];
    for (const [index, { entry: old, quest: original }] of originals.entries()) {
      const prior = replaced.at(-1)?.constellationId ?? before;
      const next = index === originals.length - 1 ? after : null;
      const options = available.filter(({ entry, quest }) => (
        entry.questId !== old.questId && entry.constellationId !== prior && entry.constellationId !== next &&
        quest.size === original.size && quest.difficulty.label === original.difficulty.label
      ));
      if (!options.length) break;
      const selected = options[choose(options.length)];
      available.splice(available.indexOf(selected), 1);
      replaced.push({ ...selected.entry, day: old.day, previousQuestId: old.questId, previousGridRevision: old.gridRevision });
    }
    if (replaced.length === originals.length) break;
  }
  if (replaced.length !== originals.length) throw Error('Could not permute this private window without a repeated or incompatible grid');
  return { schema: 'lumen-private-daily-v1', timeZone: 'Europe/Paris', from, to, days: replaced };
}

export function activationSql(plan) {
  if (plan.schema !== 'lumen-private-daily-v1' || plan.timeZone !== 'Europe/Paris' || !plan.days.length) {
    throw Error('Expected a nonempty private plan');
  }
  const tuple = entry => {
    const { day, questId, gridRevision, previousQuestId, previousGridRevision } = entry;
    if (![questId, previousQuestId].every(id => /^[A-Za-z0-9_-]+$/.test(id)) ||
      ![gridRevision, previousGridRevision].every(rev => Number.isSafeInteger(rev) && rev >= 0)) throw Error('Invalid private assignment');
    addDays(day, 0);
    const solution = dailyQuest(entry).sol;
    const hash = createHash('sha256').update([day, questId, gridRevision, solution.join(',')].join(':')).digest('hex');
    return `('${day}','${questId}',${gridRevision},'${previousQuestId}',${previousGridRevision},decode('${hash}','hex'))`;
  };
  return `begin;
create temporary table private_daily_plan(day date primary key, quest_id text, revision integer,
  prior_quest text, prior_revision integer, proof bytea) on commit drop;
insert into private_daily_plan values
${plan.days.map(tuple).join(',\n')};
do $apply$
declare changed integer;
begin
  perform from lumen_commands.daily_puzzles p join private_daily_plan t using (day) order by p.day for update of p;
  if exists(select 1 from private_daily_plan where day <= lumen_commands.daily_today())
    or exists(select 1 from lumen_commands.daily_runs r join private_daily_plan t using(day))
    or exists(select 1 from lumen_commands.daily_guest_runs r join private_daily_plan t using(day)) then
    raise exception 'A target date is open or has attempts';
  end if;
  update lumen_commands.daily_puzzles p
     set quest_id = t.quest_id, grid_revision = t.revision, guest_solution_hash = t.proof,
         source = 'override', published_at = clock_timestamp()
    from private_daily_plan t
   where p.day = t.day and p.quest_id = t.prior_quest and p.grid_revision = t.prior_revision;
  get diagnostics changed = row_count;
  if changed <> (select count(*) from private_daily_plan) then
    raise exception 'Schedule changed since preparation';
  end if;
end $apply$;
commit;
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { from: { type: 'string' }, to: { type: 'string' }, output: { type: 'string' }, activate: { type: 'string' } } });
  if (values.activate && values.output) {
    const plan = JSON.parse(readFileSync(outsideCheckout(values.activate), 'utf8'));
    writeFileSync(outsideCheckout(values.output), activationSql(plan), { flag: 'wx', mode: 0o600 });
    console.log('Prepared a guarded SQL transaction. No database connection was made.');
    process.exit(0);
  }
  if (!values.from || !values.to || !values.output) throw Error('Use --from YYYY-MM-DD --to YYYY-MM-DD --output PRIVATE_FILE');
  const original = JSON.parse(readFileSync(resolve(root, 'content/generated/daily-schedule.json'), 'utf8'));
  const plan = replanDays(original, values);
  writeFileSync(outsideCheckout(values.output), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(`Prepared ${plan.days.length} future assignments. Board identities saved to the private file.`);
}
