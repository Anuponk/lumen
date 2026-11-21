// #925 · Menus pause the live attempt through the existing attempt engine: one
// pause, one resume, no time counted while a menu is open, no time lost.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMenuPause, MENU_PAUSE_GRACE_MS } from '../src/ui/menu-pause.js';
import { createAttemptEngine, ATTEMPT_STATES } from '../src/game/attempt-engine.js';

function harness({ start = true } = {}) {
  let clock = 0;
  const store = new Map(),
    storage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
  const engine = createAttemptEngine({
    storage,
    now: () => 1_700_000_000_000 + clock,
    perfNow: () => clock,
  });
  engine.create({ questId: 'q', mode: 'campaign', qualifying: true });
  if (start) engine.start();
  const elements = Object.fromEntries(
    ['social', 'account', 'rules'].map((id) => [id, { tagName: 'DIV', hidden: true }]),
  );
  elements.share = { tagName: 'DIALOG', open: false };
  const timers = [],
    calls = { pause: 0, resume: 0 };
  const menu = createMenuPause({
    document: { getElementById: (id) => elements[id] ?? null, defaultView: {} },
    ids: ['social', 'account', 'rules', 'share', 'missing'],
    running: () => engine.snapshot()?.state === ATTEMPT_STATES.RUNNING,
    paused: () => engine.snapshot()?.state === ATTEMPT_STATES.PAUSED,
    attemptId: () => engine.snapshot()?.attemptId ?? null,
    pause: () => {
      calls.pause++;
      engine.pause();
    },
    resume: () => {
      calls.resume++;
      engine.resume();
    },
    setTimer: (fn, ms) => timers.push({ fn, ms }) - 1,
    clearTimer: (id) => {
      if (timers[id]) timers[id].fn = () => {};
    },
  });
  const set = (id, open) => {
    if (elements[id].tagName === 'DIALOG') elements[id].open = open;
    else elements[id].hidden = !open;
    menu.sync();
  };
  const flush = () => {
    while (timers.length) timers.shift().fn();
  };
  return {
    engine,
    menu,
    set,
    flush,
    timers,
    calls,
    tick: (ms) => (clock += ms),
    state: () => engine.snapshot().state,
  };
}

test('opening a menu pauses once; closing the last one resumes once after the grace period', () => {
  const h = harness();
  h.tick(10_000);
  h.set('social', true);
  assert.equal(h.state(), 'PAUSED');
  h.tick(60_000);
  assert.equal(h.engine.activeMs(), 10_000, 'no time counted while the menu is open');
  h.set('social', false);
  assert.equal(h.state(), 'PAUSED', 'the grid stays masked during the grace period');
  assert.equal(h.timers[0].ms, MENU_PAUSE_GRACE_MS);
  h.flush();
  assert.equal(h.state(), 'RUNNING');
  h.tick(5_000);
  assert.equal(h.engine.activeMs(), 15_000, 'no time lost, none counted twice');
  assert.deepEqual(h.calls, { pause: 1, resume: 1 });
});

test('chained menus keep one pause and resume only after the real return to the game', () => {
  const h = harness();
  h.set('account', true);
  h.set('account', false);
  h.set('share', true); // opened from the account menu before the grace period ends
  h.flush();
  assert.equal(h.state(), 'PAUSED');
  h.set('rules', true);
  h.set('share', false);
  h.flush();
  assert.equal(h.state(), 'PAUSED', 'a menu is still open');
  h.set('rules', false);
  h.flush();
  assert.equal(h.state(), 'RUNNING');
  assert.deepEqual(h.calls, { pause: 1, resume: 1 });
  // Repeated open/close cycles stay balanced.
  for (let i = 0; i < 5; i++) {
    h.set('social', true);
    h.set('social', false);
    h.flush();
  }
  assert.deepEqual(h.calls, { pause: 6, resume: 6 });
  assert.equal(h.state(), 'RUNNING');
});

test('a grid already paused by the player stays paused after the menu closes', () => {
  const h = harness();
  h.engine.pause();
  h.set('social', true);
  h.set('social', false);
  h.flush();
  assert.equal(h.state(), 'PAUSED');
  assert.deepEqual(h.calls, { pause: 0, resume: 0 });
});

test('backgrounding while a menu is open never silently resumes the attempt', () => {
  const h = harness();
  h.set('rules', true);
  h.menu.release();
  h.set('rules', false);
  h.flush();
  assert.equal(h.state(), 'PAUSED');
  assert.equal(h.calls.resume, 0);
});

test('a not-yet-started board, or another attempt after the menu, is never started or resumed', () => {
  const ready = harness({ start: false });
  ready.set('social', true);
  ready.set('social', false);
  ready.flush();
  assert.equal(ready.state(), 'READY', 'the first gesture still starts the clock');
  const other = harness();
  other.set('social', true);
  other.engine.create({ questId: 'other', mode: 'campaign' });
  other.engine.start();
  other.engine.pause();
  other.set('social', false);
  other.flush();
  assert.equal(other.state(), 'PAUSED', 'only the attempt paused by the menu can resume');
});

test('a menu still loading holds the pause until it is visible', () => {
  const h = harness();
  h.set('social', true);
  const loaded = h.menu.hold();
  h.set('social', false); // the hub steps aside while « Mes défis » loads
  h.flush();
  assert.equal(h.state(), 'PAUSED');
  h.set('rules', true);
  loaded();
  loaded();
  h.set('rules', false);
  h.flush();
  assert.equal(h.state(), 'RUNNING');
  assert.deepEqual(h.calls, { pause: 1, resume: 1 });
});

test('wiring: the existing pause path, every top menu and dialog, background release', () => {
  const source = fs.readFileSync('src/ui/game-screen.js', 'utf8');
  assert.match(source, /pause:pauseGameClock,resume:resumeGameClock\}\)/);
  for (const id of [
    'socialHub',
    'mobileAuthPopover',
    'rulesModal',
    'feedbackModal',
    'lumenShareDialog',
    'lumenConfirm',
    'abandonConfirm',
  ])
    assert.match(source, new RegExp("ids:\\[[^\\]]*'" + id + "'"), id);
  assert.doesNotMatch(source, /ids:\[[^\]]*'mapModal'/, 'Mon ciel keeps its navigation behaviour');
  assert.match(source, /visibilityState==="hidden"\)\{pauseGameClock\(\);menuPause\.release\(\)\}/);
  assert.match(
    source,
    /addEventListener\("pagehide",\(\)=>\{pauseGameClock\(\);menuPause\.release\(\)\}\)/,
  );
  assert.match(source, /const loaded=menuPause\.hold\(\);/);
  assert.match(source, /grid\.inert=paused;/);
  const css = fs.readFileSync('src/ui/styles.css', 'utf8');
  assert.match(css, /\.attempt-mask\{[^}]*background:#07111d;/, 'the mask is opaque');
});
