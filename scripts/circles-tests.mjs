// #929 (EPIC #928 V1): private circles client — RPC contract, links, ranking
// view model and copy. The rules themselves are proven by the SQL fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  circleErrorKey,
  createCircleClient,
  circleLinkUrl,
  readCircleToken,
  circleBoardModel,
  renderCircleBoard,
} from '../src/ui/circles.js';
import { createTranslator } from '../src/ui/i18n.js';

const fr = createTranslator({ locale: 'fr' }).t,
  en = createTranslator({ locale: 'en' }).t;
const token = 'a'.repeat(64);

test('every RPC goes to an account-only server function with the expected arguments', async () => {
  const calls = [];
  const client = createCircleClient({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { ok: true }, error: null };
    },
  });
  await client.list();
  await client.create('Famille');
  await client.rename('c', 'Amis');
  await client.remove('c');
  await client.leave('c');
  await client.removeMember('c', 'Ben');
  await client.detail('c');
  await client.inviteFriend('c', 'Ben');
  await client.respond('i', 1);
  await client.createLink('c');
  await client.revokeLink('c', 'l');
  await client.previewLink(token);
  await client.joinLink(token);
  await client.board('c', 'base-q012', 1);
  assert.deepEqual(
    calls.map((c) => c.name),
    [
      'lumen_circle_list',
      'lumen_circle_create',
      'lumen_circle_rename',
      'lumen_circle_delete',
      'lumen_circle_leave',
      'lumen_circle_remove_member',
      'lumen_circle_detail',
      'lumen_circle_invite_friend',
      'lumen_circle_respond',
      'lumen_circle_link_create',
      'lumen_circle_link_revoke',
      'lumen_circle_link_preview',
      'lumen_circle_link_join',
      'lumen_circle_board',
    ],
  );
  assert.deepEqual(calls[8].args, { p_invite: 'i', p_accept: true });
  assert.deepEqual(calls.at(-1).args, {
    p_circle: 'c',
    p_quest_id: 'base-q012',
    p_grid_revision: 1,
  });
  // Every function the client calls exists in the migration and is granted to accounts only.
  const sql = fs.readFileSync('supabase/migrations/20261122130000_private_circles_929.sql', 'utf8');
  for (const { name } of calls)
    assert.match(sql, new RegExp('create or replace function public\\.' + name + '\\('), name);
  assert.match(sql, /revoke all on function %s from public,anon/);
  assert.match(sql, /grant execute on function %s to authenticated/);
});

test('server errors become human messages, offline included, in French and English', async () => {
  const failing = createCircleClient({
    rpc: async () => ({ data: null, error: { message: 'circle_link_invalid' } }),
  });
  await assert.rejects(failing.joinLink(token), { message: 'circle_link_invalid' });
  assert.equal(
    circleErrorKey({ message: 'circle_link_invalid' }),
    'circles.error.circle_link_invalid',
  );
  assert.equal(circleErrorKey(new TypeError('Failed to fetch')), 'circles.error.offline');
  assert.equal(circleErrorKey('weird'), 'circles.error.generic');
  await assert.rejects(createCircleClient(null).list(), /cloud_unavailable/);
  const migration = fs.readFileSync(
    'supabase/migrations/20261122130000_private_circles_929.sql',
    'utf8',
  );
  for (const code of new Set(
    migration.match(/message='(circle_[a-z_]+)'/g).map((m) => m.slice(9, -1)),
  )) {
    for (const t of [fr, en])
      assert.notEqual(t('circles.error.' + code), 'circles.error.' + code, code + ' is explained');
  }
  assert.doesNotMatch(
    fr('circles.error.circle_link_invalid') + fr('circles.error.circle_not_found'),
    /membre[s]? :|@/,
    'no member revealed',
  );
});

test('private links carry only the circle token', () => {
  const url = circleLinkUrl(token, 'https://lumen.nopuna.fr/?challenge=x&lang=en#sky');
  assert.equal(url, 'https://lumen.nopuna.fr/?circle=' + token);
  assert.equal(readCircleToken(url), token);
  for (const bad of [
    'https://x/?circle=short',
    'https://x/?circle=' + 'G'.repeat(64),
    'https://x/',
    'not a url',
  ])
    assert.equal(readCircleToken(bad), null, bad);
});

test('the private ranking shows real performances only, with ties and members without a time', () => {
  const board = {
    members: 5,
    ranked: 3,
    top: [
      { nickname: 'Ben', score: 80, place: 1, mine: false },
      { nickname: 'Ana', score: 80, place: 1, mine: true },
      { nickname: 'Cléo', score: 95, place: 3, mine: false },
    ],
    personal: { nickname: 'Ana', score: 80, place: 1, mine: true },
  };
  const model = circleBoardModel(board);
  assert.equal(model.withoutTime, 2);
  assert.equal(model.personalShown, true);
  const html = renderCircleBoard(board, { t: fr, formatDuration: (s) => s + ' s' });
  assert.match(html, /Place 1.*Ben.*80 s.*Place 1.*Ana.*\(toi\).*Place 3.*Cléo/s);
  assert.match(html, /2 membres sans temps sur cette quête/);
  assert.doesNotMatch(html, /Ta place/, 'personal row already in the podium');
  const outside = renderCircleBoard(
    {
      ...board,
      top: board.top.filter((r) => !r.mine),
      personal: { nickname: 'Ana', score: 120, place: 4, mine: true },
    },
    { t: en, formatDuration: (s) => s + ' s' },
  );
  assert.match(outside, /Your place: #4 · 120 s/);
  assert.match(
    renderCircleBoard({ members: 2, ranked: 0, top: [] }, { t: fr, formatDuration: String }),
    /Personne n(?:'|&#39;)a encore de temps officiel/,
  );
  // Markup-safe nicknames.
  assert.doesNotMatch(
    renderCircleBoard(
      { ranked: 1, members: 1, top: [{ nickname: '<b>x</b>', score: 1, place: 1 }] },
      { t: fr, formatDuration: String },
    ),
    /<b>x/,
  );
});

test('wiring: social hub entry, pause, learning filter, confirmations, deep link', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(
    html,
    /<button id="openCircles" class="social-hub-item" type="button" data-social-leave>/,
  );
  assert.match(
    html,
    /<div id="circlesModal" class="social-overlay circles-modal" hidden role="dialog" aria-modal="true" aria-labelledby="circlesTitle">/,
  );
  const game = fs.readFileSync('src/ui/game-screen.js', 'utf8');
  assert.match(
    game,
    /ids:\['socialHub','friendsModal','friendPickerModal','myChallengesModal','circlesModal',/,
    '#925: circles pause the quest',
  );
  assert.match(game, /#circlesModal,#openCircles"\)\)return;/);
  assert.match(
    game,
    /confirm:options=>lumenConfirm\(\)\.open\(options\)/,
    '#921 dialog for destructive actions',
  );
  assert.match(
    game,
    /const link=readCircleToken\(location\.href\);if\(link\)void circles\?\.open\(\{link\}\)/,
  );
  assert.match(fs.readFileSync('src/ui/social-hub.js', 'utf8'), /\$\('circlesBadge'\)\]/);
});
