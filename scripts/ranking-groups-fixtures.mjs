// #974: source-owned seed of quest → constellation → adventure for the materialized
// constellation and adventure rankings. The catalogue owns the grouping; the server
// only receives it through append-only migration blocks. Never connects.
//   --write-seed <migration>  writes the rows missing from earlier migrations
//   --check                   the cumulative blocks must match the published catalogue
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { canonicalQuestList } from '../src/campaign/canonical-quests.js';

const START = '-- BEGIN RANKING GROUPS',
  END = '-- END RANKING GROUPS';
const sql = (v) => "'" + String(v).replaceAll("'", "''") + "'";
const groups = canonicalQuestList().map((q) => ({ quest: q.id, constellation: q.constellationId, adventure: q.packId }));
assert(groups.every((g) => g.quest && g.constellation && g.adventure), 'every quest has a constellation and an adventure');
const line = (g) => `(${sql(g.quest)},${sql(g.constellation)},${sql(g.adventure)})`;
const block = (rows) =>
  rows.length
    ? 'insert into lumen_commands.ranking_groups(quest_id,constellation_id,adventure_id) values\n' +
      rows.map(line).join(',\n') +
      '\non conflict (quest_id) do update set constellation_id=excluded.constellation_id,adventure_id=excluded.adventure_id;'
    : '';
const parse = (text) =>
  [...text.matchAll(/\('((?:[^']|'')+)','((?:[^']|'')+)','((?:[^']|'')+)'\)/g)].map((m) => ({
    quest: m[1].replaceAll("''", "'"),
    constellation: m[2].replaceAll("''", "'"),
    adventure: m[3].replaceAll("''", "'"),
  }));
const migrations = (except) =>
  fs
    .readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql') && 'supabase/migrations/' + f !== except)
    .sort()
    .map((f) => fs.readFileSync('supabase/migrations/' + f, 'utf8').replace(/\r\n/g, '\n'))
    .filter((s) => s.includes(START))
    .map((s) => s.slice(s.indexOf(START) + START.length, s.indexOf(END)));
const known = (texts) => {
  const map = new Map();
  for (const text of texts) for (const g of parse(text)) map.set(g.quest, g);
  return map;
};

if (process.argv.includes('--write-seed')) {
  const target = process.argv[process.argv.indexOf('--write-seed') + 1];
  assert.match(target || '', /^supabase\/migrations\/\d+_[a-z0-9_]+\.sql$/, 'Pass the migration path');
  const source = fs.readFileSync(target, 'utf8');
  assert(source.includes(START) && source.includes(END));
  const prior = known(migrations(target));
  const missing = groups.filter((g) => {
    const p = prior.get(g.quest);
    return !p || p.constellation !== g.constellation || p.adventure !== g.adventure;
  });
  fs.writeFileSync(target, source.slice(0, source.indexOf(START) + START.length) + '\n' + block(missing) + '\n' + source.slice(source.indexOf(END)));
  console.log(`Seeded ${missing.length} ranking groups; prior migrations unchanged`);
} else if (process.argv.includes('--check')) {
  const server = known(migrations(null));
  assert.equal(server.size, groups.length, 'every published quest is grouped on the server');
  for (const g of groups) assert.deepEqual(server.get(g.quest), g, 'server grouping of ' + g.quest);
  console.log(`${groups.length} ranking groups match the catalogue (${new Set(groups.map((g) => g.constellation)).size} constellations, ${new Set(groups.map((g) => g.adventure)).size} adventures)`);
} else {
  process.stdout.write(block(groups) + '\n');
}
