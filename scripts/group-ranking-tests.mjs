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
      'mine',
      'notRanked',
      'empty',
      'all',
      'next',
      'less',
      'cap',
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
  const match = (n) =>
    selector.startsWith('.') ? n.className.split(' ').includes(selector.slice(1)) : false;
  return node.children.flatMap((child) => [
    ...(match(child) ? [child] : []),
    ...find(child, selector),
  ]);
}
function fixture({
  participants = 18,
  own = 14,
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
test('adventure opens without a constellation and only reads top three plus my position', async () => {
  const f = fixture();
  await f.open({ constellationId: null });
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].p_kind, 'adventure');
  assert(!f.calls[0].p_limit);
  assert.equal(f.nodes('.group-ranking-row').length, 3);
  assert.equal(f.nodes('.group-ranking-me')[0].className, 'group-ranking-me ranking-mine');
  assert.match(f.nodes('.group-ranking-me')[0].textContent, /"place":14/);
  assert.equal(f.nodes('.group-ranking-list')[0].hidden, true);
  assert.equal(f.ids.get('groupRankingName').textContent, 'Ciel réel');
});
test('expansion starts at offset three, pages without duplicate podium rows and collapses without reads', async () => {
  const f = fixture();
  await f.open();
  const toggle = f.nodes('.group-ranking-more')[0],
    list = f.nodes('.group-ranking-list')[0],
    next = f.nodes('.group-ranking-next')[0];
  await toggle.onclick();
  assert.equal(f.calls[1].p_offset, 3);
  assert.equal(f.calls[1].p_limit, 10);
  assert.equal(list.children.length, 10);
  assert.equal(f.nodes('.group-ranking-row').length, 13);
  assert.equal(list.children[0].children[1].textContent, 'Player 4');
  await next.onclick();
  assert.equal(f.calls[2].p_offset, 13);
  assert.equal(list.children.length, 15);
  assert.equal(next.hidden, true);
  assert.equal(f.nodes('.group-ranking-row').length, 18);
  assert.equal(find(list, '.ranking-mine').length, 1);
  await toggle.onclick();
  assert.equal(list.hidden, true);
  assert.equal(toggle.attrs['aria-expanded'], 'false');
  await toggle.onclick();
  assert.equal(list.hidden, false);
  assert.equal(f.calls.length, 3, 'cached pages reopen without requests');
});
test('zero, one and three participants need no expansion; own podium row stays highlighted', async () => {
  for (const participants of [0, 1, 3]) {
    const f = fixture({ participants, own: 1 });
    await f.open();
    assert.equal(f.nodes('.group-ranking-row').length, participants);
    assert.equal(f.nodes('.group-ranking-more').length, 0);
    assert.equal(f.calls.length, 1);
    if (participants)
      assert.equal(f.nodes('.ranking-mine').length, 2, 'one podium row and the personal summary');
  }
});
test('a pending page stays collapsed, stale pages do not replace another adventure, and failures retry', async () => {
  const f = fixture({ delayPage: true });
  await f.open();
  const toggle = f.nodes('.group-ranking-more')[0],
    list = f.nodes('.group-ranking-list')[0];
  const pending = toggle.onclick();
  await toggle.onclick();
  f.delayed.shift()();
  await pending;
  assert.equal(list.hidden, true);
  await toggle.onclick();
  assert.equal(f.calls.length, 2);
  const more = f.nodes('.group-ranking-next')[0];
  const stale = more.onclick();
  f.view.close();
  await f.open();
  f.delayed.shift()();
  await stale;
  assert.equal(f.nodes('.group-ranking-row').length, 3);
  const retry = fixture({ failPage: true });
  await retry.open();
  await retry.nodes('.group-ranking-more')[0].onclick();
  const next = retry.nodes('.group-ranking-next')[0];
  assert.equal(next.textContent, 'groupRanking.retry');
  await next.onclick();
  assert.equal(retry.nodes('.group-ranking-list')[0].children.length, 10);
});
test('guests and old scoring backends cannot show a misleading new scale', async () => {
  const guest = fixture();
  guest.owner.signed = false;
  await guest.open();
  assert.equal(guest.calls.length, 0);
  assert.equal(guest.ids.get('groupRankingStatus').textContent, 'groupRanking.signIn');
  const legacy = fixture({ version: 1 });
  await legacy.open();
  assert.equal(legacy.nodes('.group-ranking-row').length, 0);
  assert.equal(legacy.ids.get('groupRankingStatus').textContent, 'ranking.unavailable');
});
