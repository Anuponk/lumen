// #682: shared victory celebration model (badges, rank messages, graded effects).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CELEBRATION_CONFIG,
  rewardSlots,
  remarkableRewards,
  rankSummary,
  celebrationLevel,
  createCelebration,
} from '../src/ui/victory-celebration.js';

test('five stable reward slots in a fixed order, whatever was earned', () => {
  for (const facts of [
    {},
    { stars: 1, badges: { autonomy: true, speed: true, noError: true, mastery: true }, qualifying: true },
    { stars: 0, badges: { speed: true }, prior: { speed: true } },
  ]) {
    assert.deepEqual(
      rewardSlots(facts).map((slot) => slot.key),
      ['star', 'autonomy', 'speed', 'noError', 'mastery'],
    );
  }
  const slots = rewardSlots({ stars: 1, badges: { autonomy: true, speed: true }, qualifying: true, prior: { speed: true } });
  assert.deepEqual(
    slots.map((slot) => [slot.key, slot.state]),
    [
      ['star', 'new'],
      ['autonomy', 'new'],
      ['speed', 'owned'],
      ['noError', 'missing'],
      ['mastery', 'missing'],
    ],
  );
  assert.equal(slots[0].label, '+1 étoile');
  assert.equal(rewardSlots({ stars: 2 })[0].label, '+2 étoiles');
  assert.equal(rewardSlots({ stars: 0 })[0].state, 'missing', 'A replay never shows a new star');
  assert.equal(
    rewardSlots({ badges: { mastery: true }, qualifying: false }).at(-1).state,
    'missing',
    'A non-qualifying run never presents a badge as newly earned',
  );
});

test('remarkable rewards: new Mastery or two new badges', () => {
  assert.equal(remarkableRewards(rewardSlots({ badges: { mastery: true }, qualifying: true })), true);
  assert.equal(remarkableRewards(rewardSlots({ badges: { autonomy: true, speed: true }, qualifying: true })), true);
  assert.equal(remarkableRewards(rewardSlots({ stars: 1, badges: { speed: true }, qualifying: true })), false);
  assert.equal(remarkableRewards(rewardSlots({ badges: { mastery: true }, prior: { mastery: true } })), false);
});

const row = (position, extra = {}) => ({ position, place: position, nickname: 'J' + position, score: position * 10, ...extra });
test('rank messages only for a confirmed position, never a fake real lead', () => {
  assert.deepEqual(rankSummary(null), { rank: null, label: '', lead: '' });
  assert.deepEqual(rankSummary({ state: 'pending' }), { rank: null, label: '', lead: '' });
  assert.equal(rankSummary({ state: 'ready', top: [row(1), row(2), row(3)], personal: null }).label, '');
  const realFirst = rankSummary({ state: 'ready', top: [row(1, { mine: true }), row(2), row(3)], personal: row(1, { mine: true }) });
  assert.equal(realFirst.label, '1re place !');
  assert.equal(realFirst.lead, 'Tu prends la tête du classement !');
  const echoFirst = rankSummary({
    state: 'ready',
    top: [row(1, { mine: true }), row(2, { virtual: true }), row(3, { virtual: true })],
    personal: row(1, { mine: true }),
  });
  assert.equal(echoFirst.label, '1re place !');
  assert.equal(echoFirst.lead, '', 'A podium with virtual Échos never claims the lead of the ranking');
  assert.equal(echoFirst.rank.withEchoes, true);
  for (const position of [2, 3]) {
    const summary = rankSummary({ state: 'ready', top: [row(1), row(2), row(3)], personal: row(position) });
    assert.equal(summary.label, (position === 2 ? '2e' : '3e') + ' place !');
    assert.equal(summary.lead, 'Bravo, tu montes sur le podium !');
  }
  const fifth = rankSummary({ state: 'ready', top: [row(1), row(2), row(3)], personal: row(5) });
  assert.equal(fifth.label, 'Classement : 5e place');
  assert.equal(fifth.lead, '');
  assert.doesNotMatch(JSON.stringify(fifth), /joueur|sur \d/, 'No participant counter');
  const tie = rankSummary({ state: 'ready', top: [row(1), row(2, { place: 1 }), row(3)], personal: row(2, { place: 1 }) });
  assert.equal(tie.label, '1re place !', 'A tie reports the shared place');
});

test('celebration intensity grows with the confirmed achievement and composes events', () => {
  const level = (facts) => celebrationLevel(facts).level;
  assert.equal(level({}), 1);
  assert.equal(level({ newRecord: true }), 2);
  assert.equal(level({ remarkableBadges: true }), 2);
  const confirmed = (position, withEchoes = false) => ({ position, place: position, withEchoes, confirmed: true });
  assert.equal(level({ rank: confirmed(3) }), 3);
  assert.equal(level({ rank: confirmed(2) }), 3);
  assert.equal(level({ rank: confirmed(1) }), 4);
  assert.equal(level({ rank: confirmed(1, true) }), 3, 'A first place among Échos is strong but not exceptional');
  assert.equal(level({ rank: confirmed(3, true) }), 2);
  assert.equal(level({ rank: confirmed(7) }), 1);
  assert.equal(level({ rank: { position: 1, place: 1, confirmed: false } }), 1, 'Unconfirmed rank never celebrates');
  assert.equal(level({ newRecord: true, rank: confirmed(1) }), 4);
  assert.deepEqual(celebrationLevel({ constellationCompleted: true, rank: confirmed(1) }), { level: 4, special: 'constellation' });
  for (let l = 1; l < 4; l++) {
    const a = CELEBRATION_CONFIG.levels[l],
      b = CELEBRATION_CONFIG.levels[l + 1];
    assert(b.particles > a.particles && b.palette.length >= a.palette.length, 'Level ' + (l + 1) + ' is perceptibly stronger');
  }
});

function fakeDocument() {
  const make = (tag) => {
    const node = {
      tag,
      children: [],
      className: '',
      dataset: {},
      style: { setProperty(key, value) { this[key] = value; } },
      attributes: {},
      isConnected: true,
      parent: null,
      classList: { set: new Set(), toggle(name, on) { on ? this.set.add(name) : this.set.delete(name); } },
      setAttribute(name, value) { this.attributes[name] = value; },
      append(...items) { for (const item of items) { if (item.fragment) { for (const child of item.children) { child.parent = node; node.children.push(child); } } else { item.parent = node; node.children.push(item); } } },
      prepend(item) { item.parent = node; node.children.unshift(item); },
      remove() { if (node.parent) node.parent.children = node.parent.children.filter((child) => child !== node); node.isConnected = false; },
      addEventListener() {},
    };
    return node;
  };
  return { createElement: make, createDocumentFragment: () => ({ ...make('#fragment'), fragment: true }), root: make('card') };
}
const particles = (host) => host.children[0]?.children.length ?? 0;

test('one engine: start, amplify without restart or downgrade, clear, reduced motion', () => {
  const doc = fakeDocument();
  const celebration = createCelebration(doc.root, { document: doc, reducedMotion: () => false, smallScreen: () => false });
  assert.equal(celebration.start({ level: 2 }), 2);
  assert.equal(particles(doc.root), CELEBRATION_CONFIG.levels[2].particles);
  assert.equal(celebration.amplify(1), 2, 'A late lower level never downgrades');
  assert.equal(particles(doc.root), CELEBRATION_CONFIG.levels[2].particles);
  assert.equal(celebration.amplify(4), 4);
  assert.equal(doc.root.children.length, 1, 'One layer: the late rank adds a burst instead of a second rain');
  assert.equal(particles(doc.root), CELEBRATION_CONFIG.levels[2].particles + CELEBRATION_CONFIG.levels[4].particles);
  assert.equal(doc.root.children[0].classList.set.has('victory-halo'), true);
  celebration.clear();
  assert.equal(doc.root.children.length, 0);
  const special = createCelebration(doc.root, { document: doc, reducedMotion: () => false, smallScreen: () => true });
  special.start({ level: 1, special: 'constellation' });
  assert.equal(
    particles(doc.root),
    Math.round((CELEBRATION_CONFIG.levels[1].particles + CELEBRATION_CONFIG.special.extraParticles) * CELEBRATION_CONFIG.smallScreenFactor),
  );
  special.clear();
  const reduced = createCelebration(doc.root, { document: doc, reducedMotion: () => true });
  assert.equal(reduced.start({ level: 4 }), 4);
  assert.equal(doc.root.children.length, 0, 'Reduced motion: no particles at all');
  assert.equal(reduced.amplify(4), 4);
});

test('the victory surface uses the shared engine with no quest-number conditions', () => {
  const ui = fs.readFileSync('src/ui/game-screen.js', 'utf8');
  assert.doesNotMatch(ui, /clearVictoryConfetti|victoryConfetti/, 'The board confetti cleared before display is gone');
  const start = ui.indexOf('victoryCelebration.start(');
  assert(start > 0, 'The final victory surface starts the shared celebration');
  const line = ui.slice(ui.lastIndexOf('\n', start), ui.indexOf('\n', start));
  assert.doesNotMatch(line, /ordinal|levelIndex|questOrdinal/, 'No quest-number condition decides the celebration');
  assert.match(ui, /victoryCelebration\.amplify\(celebrationLevel\(\{\.\.\.victoryFacts,rank:summary\.rank\}\)\.level\)/);
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(ui, /sky-reveal-progress">◔ '\+p\.lit\+' \/ '\+p\.count\+' étoiles/, 'One star-progress line under the constellation');
  assert.doesNotMatch(html, /skyRevealProgress/, 'No duplicate progress line');
  const order = ['skyRevealCanvas', 'skyRevealRewards', 'skyRevealPerformance', 'skyRevealTime', 'skyRevealRank', 'skyRevealPodium', 'skyRevealNext', 'skyRevealSky', 'skyRevealShare', 'skyRevealRetry'];
  const positions = order.map((id) => html.indexOf('id="' + id + '"'));
  assert(positions.every((p) => p > 0), 'All victory zones exist');
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'Constellation, badges, performance, navigation');
  const ranking = fs.readFileSync('src/ui/ranking.js', 'utf8');
  assert.doesNotMatch(ranking, /realParticipants|ranking-participants|joueur/, 'No participant counter anywhere');
});
