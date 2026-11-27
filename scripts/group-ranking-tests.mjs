import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
const { rankingPoints, createGroupRanking } = await import(
  process.env.LUMEN_GROUP_RANKING_SOURCE || '../src/ui/group-ranking.js'
);
import { locales } from '../src/ui/i18n.js';

test('20/50/30: official completion, relative place and two durable badges, bounded to 100', () => {
  const both = { autonomy: true, noError: true };
  assert.equal(rankingPoints(1, 1), 70);
  assert.equal(rankingPoints(1, 1, both), 100);
  assert.equal(rankingPoints(1, 101), 70);
  assert.equal(rankingPoints(51, 101, both), 75);
  assert.equal(rankingPoints(101, 101, both), 50);
  assert.equal(rankingPoints(101, 101), 20);
  assert.equal(rankingPoints(1, 2, { autonomy: true }), 85);
  assert.equal(rankingPoints(2, 3), 45);
  assert.equal(rankingPoints(2, 3, both), 75);
  assert.equal(rankingPoints(2, 5), 58, 'positive halves round up, as numeric round in SQL');
  assert.equal(
    rankingPoints(2, 5, { speed: true, mastery: true }),
    58,
    'no speed or mastery bonus',
  );
  assert.equal(rankingPoints(1, 2_147_483_647, both), 100);
  for (const args of [
    [0, 10],
    [-1, 10],
    [11, 10],
    [1, 0],
    [1, null],
    [null, 5],
    [1.5, 8],
  ])
    assert.equal(rankingPoints(...args), 0);
  for (let n = 1; n <= 100; n++)
    for (let place = 1; place <= n; place++) {
      const plain = rankingPoints(place, n),
        badged = rankingPoints(place, n, both);
      assert(plain >= 20 && plain <= 70);
      assert.equal(badged, plain + 30);
    }
});
test('translated adventure-only copy explains the new score in all languages', () => {
  for (const lang of ['fr', 'en', 'es']) {
    const messages = locales[lang].messages;
    for (const key of [
      'title',
      'open',
      'scale',
      'yourPosition',
      'notRanked',
      'empty',
      'around',
      'rest',
      'before',
      'after',
      'less',
      'signIn',
    ])
      assert(messages['groupRanking.' + key], lang + ' ' + key);
    assert.match(messages['groupRanking.scale'], /20.*50.*15.*15/);
  }
  const html = fs.readFileSync('index.html', 'utf8');
  assert(
    !html.includes('data-ranking-kind='),
    'no constellation tab or quest list in general rankings',
  );
  assert(html.includes('id="groupRankingName"'));
});

class Node {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attrs = {};
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.isConnected = true;
    this.text = '';
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  set textContent(value) {
    this.text = String(value);
    this.children = [];
  }
  get textContent() {
    return this.text + this.children.map((n) => n.textContent).join('');
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  addEventListener() {}
  focus() {}
  querySelectorAll(selector) {
    return find(this, selector);
  }
}
function find(node, selector) {
  // Minimal descendant combinator: '.a .b' finds .b inside each .a.
  const parts = selector.trim().split(/\s+/);
  if (parts.length > 1) {
    const [first, ...rest] = parts;
    return [...new Set(find(node, first).flatMap((n) => find(n, rest.join(' '))))];
  }
  const match = (n) =>
    selector.startsWith('.') ? n.className.split(' ').includes(selector.slice(1)) : false;
  return node.children.flatMap((child) => [
    ...(match(child) ? [child] : []),
    ...find(child, selector),
  ]);
}
function fixture({
  participants = 30,
  own = 20,
  version = 2,
  delayPage = false,
  failPage = false,
} = {}) {
  const ids = new Map(
    [
      'groupRankingModal',
      'groupRankingBody',
      'groupRankingStatus',
      'groupRankingName',
      'groupRankingClose',
    ].map((id) => [id, new Node()]),
  );
  ids.get('groupRankingModal').append(ids.get('groupRankingBody'));
  const document = {
    getElementById: (id) => ids.get(id),
    createElement: (tag) => new Node(tag),
    defaultView: { navigator: { onLine: true } },
  };
  const calls = [],
    owner = { signed: true },
    delayed = [];
  let failed = false;
  const rows = Array.from({ length: participants }, (_, i) => ({
    place: i + 1,
    nickname: 'Player ' + (i + 1),
    points: 100 - i,
    quests: 1,
    mine: i + 1 === own,
  }));
  const rpc = async (name, args) => {
    calls.push({ name, ...args });
    if (args.p_limit && delayPage) await new Promise((resolve) => delayed.push(resolve));
    if (args.p_limit && failPage && !failed) {
      failed = true;
      return { error: Error('temporary') };
    }
    return {
      data: {
        scoringVersion: version,
        maxPoints: 10000,
        questTotal: 100,
        participants,
        participating: true,
        top: rows.slice(0, 3),
        personal: rows[own - 1] || null,
        rows: args.p_limit ? rows.slice(args.p_offset, args.p_offset + args.p_limit) : [],
        more: args.p_offset + args.p_limit < participants,
      },
    };
  };
  const view = createGroupRanking({
    document,
    t: (k, p) => k + (p ? JSON.stringify(p) : ''),
    rpc,
    signedIn: () => owner.signed,
    nickname: () => 'Moi',
  });
  const open = async (options = {}) => {
    view.open({
      constellationId: 'real-01',
      adventureId: 'base-real-sky',
      adventureName: 'Ciel réel',
      ...options,
    });
    await new Promise((resolve) => setImmediate(resolve));
  };
  const nodes = (selector) => find(ids.get('groupRankingBody'), selector);
  return { view, ids, calls, open, nodes, owner, delayed };
}
const places = (nodes) => nodes.map((li) => Number(li.dataset.place));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const open4 = async (f) => {
  await f.open();
  return {
    toggle: f.nodes('.group-ranking-more')[0],
    before: f.nodes('.group-ranking-before')[0],
    after: f.nodes('.group-ranking-next')[0],
    fold: f.nodes('.lumen-rank-fold')[0],
    list: f.nodes('.lumen-rank-list')[0],
  };
};

test('mock-up state 1: podium 2–1–3 and my cyan position only, no quota of text', async () => {
  const f = fixture();
  await f.open({ constellationId: null });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].p_kind, 'adventure');
  assert(!f.calls[0].p_limit, 'the opening read never fetches rows');
  const steps = f.nodes('.lumen-step');
  assert.deepEqual(steps.map((s) => s.dataset.position), ['2', '1', '3'], 'podium order 2 – 1 – 3');
  assert.equal(f.nodes('.lumen-medal').length, 3, 'celestial medallions');
  const mine = f.nodes('.lumen-my-position');
  assert.equal(mine.length, 1);
  assert.match(mine[0].textContent, /groupRanking\.yourPosition.*20.*Moi/);
  assert.equal(f.nodes('.lumen-rank-row').length, 0);
  const text = f.ids.get('groupRankingBody').textContent;
  assert.doesNotMatch(text, /groupRanking\.cap|questsShort|maxPoints/, 'no « 100 quêtes · 10 000 points » line');
  assert.match(f.nodes('.group-ranking-more')[0].textContent, /groupRanking\.around/);
  assert.equal(f.ids.get('groupRankingName').textContent, 'Ciel réel');
});

test('mock-up state 2: 20th opens on ranks 15–25, then blocks of 10 before/after to the bounds', async () => {
  const f = fixture();
  const ui = await open4(f);
  await ui.toggle.onclick();
  assert.deepEqual([f.calls[1].p_offset, f.calls[1].p_limit], [14, 11]);
  assert.deepEqual(places(ui.list.children), range(15, 25), 'exactly ranks 15 to 25');
  assert.equal(find(ui.list, '.is-mine').length, 1);
  assert.equal(f.nodes('.lumen-my-position')[0].hidden, true, 'no second personal card');
  assert.equal(ui.before.hidden, false);
  assert.equal(ui.after.hidden, false);
  await ui.before.onclick();
  assert.deepEqual([f.calls[2].p_offset, f.calls[2].p_limit], [4, 10]);
  assert.deepEqual(places(ui.list.children).slice(0, 2), [5, 6], 'previous rows added above');
  await ui.before.onclick();
  assert.deepEqual([f.calls[3].p_offset, f.calls[3].p_limit], [3, 1]);
  assert.equal(ui.before.hidden, true, 'rank 4 reached: no « Voir avant »');
  await ui.after.onclick();
  assert.deepEqual([f.calls[4].p_offset, f.calls[4].p_limit], [25, 10]);
  assert.equal(ui.after.hidden, true, 'last rank reached: no « Voir après »');
  assert.deepEqual(places(ui.list.children), range(4, 30), 'contiguous, no gap, no duplicate');
  const names = [...f.nodes('.lumen-step .ranking-name'), ...find(ui.list, '.lumen-rank-name')].map((n) => n.textContent);
  assert.equal(new Set(names).size, 30);
  await ui.fold.onclick();
  assert.equal(ui.list.hidden, true);
  assert.equal(f.nodes('.lumen-my-position')[0].hidden, false, 'found again after folding');
  await ui.toggle.onclick();
  assert.equal(f.calls.length, 5, 'folding and reopening never re-read');
});

test('podium player and unranked player explore from rank 4; near the end the window adapts', async () => {
  for (const own of [1, 2, 3, 99]) {
    const f = fixture({ own });
    const ui = await open4(f);
    assert.equal(f.nodes('.lumen-my-position').length, 0, 'never repeat a podium line');
    assert.match(ui.toggle.textContent, /groupRanking\.rest/);
    if (own === 99) assert.equal(f.nodes('.lumen-rank-note').length, 1, 'unranked is explained once');
    await ui.toggle.onclick();
    assert.deepEqual(places(ui.list.children), range(4, 13));
    assert.equal(ui.before.hidden, true);
  }
  const last = fixture({ own: 29 });
  const ui = await open4(last);
  await ui.toggle.onclick();
  assert.deepEqual(places(ui.list.children), range(20, 30), 'window shifted up at the end, no fictional row');
  assert.equal(ui.after.hidden, true);
  const fourth = fixture({ own: 4 });
  const ui4 = await open4(fourth);
  await ui4.toggle.onclick();
  assert.deepEqual(places(ui4.list.children), range(4, 14));
});

test('small, empty and old-backend boards stay honest', async () => {
  for (const participants of [1, 3]) {
    const f = fixture({ participants, own: 1 });
    await f.open();
    assert.equal(f.nodes('.lumen-step').length, participants, 'no fictional podium step');
    assert.equal(f.nodes('.group-ranking-more').length, 0);
    assert.equal(f.calls.length, 1);
  }
  const empty = fixture({ participants: 0, own: 1 });
  await empty.open();
  assert.equal(empty.nodes('.lumen-ranking-empty').length, 1);
  const guest = fixture();
  guest.owner.signed = false;
  await guest.open();
  assert.equal(guest.calls.length, 0);
  assert.equal(guest.ids.get('groupRankingStatus').textContent, 'groupRanking.signIn');
  const legacy = fixture({ version: 1 });
  await legacy.open();
  assert.equal(legacy.nodes('.lumen-step').length, 0);
  assert.equal(legacy.ids.get('groupRankingStatus').textContent, 'ranking.unavailable');
});

test('failures offer a retry and a late page never lands in another adventure', async () => {
  const retry = fixture({ failPage: true });
  const ui = await open4(retry);
  await ui.toggle.onclick();
  assert.equal(ui.after.hidden, false);
  assert.match(ui.after.textContent, /groupRanking\.retry/);
  await ui.after.onclick();
  assert.deepEqual(places(ui.list.children), range(15, 25));
  const f = fixture({ delayPage: true });
  const ui2 = await open4(f);
  const pending = ui2.toggle.onclick();
  f.view.close();
  await f.open();
  f.delayed.shift()();
  await pending;
  assert.equal(f.nodes('.lumen-rank-row').length, 0, 'the stale page was dropped');
});
