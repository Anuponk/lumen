// #974: the scale shown to players matches the owner decision (24/11) and the SQL.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { rankingPoints } from '../src/ui/group-ranking.js';
import { locales } from '../src/ui/i18n.js';

test('owner scale: 100 80 65 55 50, then -2 per place, floor 10; unplayed 0', () => {
  const expected = { 1: 100, 2: 80, 3: 65, 4: 55, 5: 50, 6: 48, 7: 46, 8: 44, 9: 42, 10: 40, 11: 38, 24: 12, 25: 10, 26: 10, 1000: 10 };
  for (const [place, points] of Object.entries(expected)) assert.equal(rankingPoints(Number(place)), points, 'place ' + place);
  assert.equal(rankingPoints(0), 0);
  assert.equal(rankingPoints(null), 0);
  const sql = fs.readFileSync('supabase/migrations/20261126100000_constellation_rankings_974.sql', 'utf8');
  assert.match(sql, /when p_place = 1 then 100 when p_place = 2 then 80 when p_place = 3 then 65/);
  assert.match(sql, /when p_place = 4 then 55 when p_place = 5 then 50/);
  assert.match(sql, /else greatest\(10, 50 - 2 \* \(p_place - 5\)\) end/);
});

test('rankings are translated in FR, EN and ES and the tooltip states the scale', () => {
  for (const lang of ['fr', 'en', 'es']) {
    for (const key of ['title', 'open', 'scale', 'mine', 'notRanked', 'empty', 'all', 'next', 'signIn', 'points', 'questsShort'])
      assert(locales[lang].messages['groupRanking.' + key], lang + ' ' + key);
    assert.match(locales[lang].messages['groupRanking.scale'], /100.*80.*65.*55.*50.*10/);
  }
});
