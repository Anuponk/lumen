import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setupAppUpdates as mount } from '../src/ui/app-updates.js';

const source = fs.readFileSync('src/ui/game-screen.js', 'utf8');
assert.match(
  source,
  /setupAppUpdates\(\{window,document,navigator,location,caches:window.caches,console,appVersion,canReload:canReloadForAppUpdate\}\)/,
  'Controller composes the module with live version and idle guards',
);
assert.doesNotMatch(
  source,
  /serviceWorker.addEventListener\("controllerchange"/,
  'Only one update dispatcher',
);

function fixture({
  controller = null,
  search = '',
  hash = '',
  registerFails = false,
  build = null,
  canReload = () => true,
} = {}) {
  const events = {},
    workerEvents = {},
    messages = [],
    removed = [],
    registrations = [],
    warnings = [],
    documentEvents = {},
    timeouts = new Map();
  let timerId = 0,
    buildReads = 0;
  const status = { textContent: '' },
    button = {};
  const location = {
    search,
    hash,
    reloads: 0,
    reload() {
      this.reloads++;
    },
  };
  const registration = {
    waiting: null,
    installing: null,
    updates: 0,
    async update() {
      this.updates++;
    },
  };
  const worker = {
    controller,
    addEventListener(name, fn) {
      workerEvents[name] = fn;
    },
    async register(url, options) {
      registrations.push({ url, options });
      if (registerFails) throw Error('offline fixture');
      return registration;
    },
  };
  const caches = {
    async keys() {
      return ['lumen-assets-old', 'lumen-assets-current', 'unrelated-cache'];
    },
    async delete(key) {
      removed.push(key);
    },
  };
  const environment = {
    navigator: { serviceWorker: worker },
    window: {
      caches,
      async fetch(url, options) {
        assert.equal(url, '/build-info.json');
        assert.equal(options.cache, 'no-store');
        buildReads++;
        return { ok: !!build, json: async () => build };
      },
      setInterval(fn, delay) {
        assert.equal(delay, 5 * 60_000);
        events.interval = fn;
      },
      setTimeout(fn) {
        timeouts.set(++timerId, fn);
        return timerId;
      },
      clearTimeout(id) {
        timeouts.delete(id);
      },
      addEventListener(name, fn) {
        events[name] = fn;
      },
    },
    document: {
      visibilityState: 'visible',
      readyState: 'loading',
      addEventListener(name, fn) {
        documentEvents[name] = fn;
      },
      getElementById(id) {
        return id === 'appUpdateStatus' ? status : id === 'forceAppUpdate' ? button : null;
      },
    },
    location,
    caches,
    console: {
      warn(...args) {
        warnings.push(args);
      },
    },
    URLSearchParams,
    appVersion: () => '1.11.1+790 \u00b7 1111111',
    canReload,
  };
  mount(environment);
  return {
    events,
    workerEvents,
    worker,
    registration,
    location,
    button,
    status,
    messages,
    removed,
    registrations,
    warnings,
    documentEvents,
    document: environment.document,
    timeouts,
    buildReads: () => buildReads,
  };
}

const first = fixture();
await first.events.load();
assert.equal(first.registrations[0].url, '/sw.js');
assert.equal(first.registrations[0].options.updateViaCache, 'none');
assert.equal(first.registration.updates, 1);
first.worker.controller = {};
first.workerEvents.controllerchange();
assert.equal(first.location.reloads, 0, 'First installation preserves the welcome');
first.worker.controller = {};
first.workerEvents.controllerchange();
first.workerEvents.controllerchange();
assert.equal(first.location.reloads, 1, 'An upgrade reloads exactly once');

for (const url of [{ search: '?code=fixture' }, { hash: '#access_token=fixture' }]) {
  const oauth = fixture({ controller: {}, ...url });
  oauth.worker.controller = {};
  oauth.workerEvents.controllerchange();
  assert.equal(oauth.location.reloads, 0, 'OAuth callback must finish before reload');
  oauth.location.search = oauth.location.hash = '';
  await oauth.documentEvents.visibilitychange();
  assert.equal(oauth.location.reloads, 1, 'The waiting update applies after OAuth finishes');
}

const waiting = fixture({ controller: {} });
waiting.registration.waiting = {
  postMessage(message) {
    waiting.messages.push(message.type);
  },
};
await waiting.button.onclick();
assert.deepEqual(waiting.removed, ['lumen-assets-old', 'lumen-assets-current']);
assert.equal(waiting.location.reloads, 0, 'Wait for worker activation');
assert.deepEqual(waiting.messages, ['SKIP_WAITING', 'SKIP_WAITING']);

const manual = fixture();
await manual.button.onclick();
assert.match(manual.status.textContent, /1\.11\.1\+790/);
assert.equal(manual.location.reloads, 1);
const failed = fixture({ registerFails: true });
await failed.events.load();
assert.equal(failed.warnings.length, 1);
assert.equal(failed.status.textContent, '', 'Background failure remains unobtrusive');
await failed.button.onclick();
assert.match(failed.status.textContent, /Impossible/);
assert.equal(failed.location.reloads, 1, 'Preserve existing manual reload fallback');

// An HTML/module deployment may leave sw.js byte-for-byte identical.
let safe = false;
const changedBuild = fixture({
  controller: {},
  build: { version: '1.11.1+791', sha: '2'.repeat(40) },
  canReload: () => safe,
});
await changedBuild.events.load();
assert.equal(changedBuild.buildReads(), 1, 'Read the installed build against live metadata');
assert.equal(changedBuild.location.reloads, 0, 'Do not reload a busy application');
changedBuild.document.visibilityState = 'hidden';
await changedBuild.documentEvents.visibilitychange();
await changedBuild.events.interval();
assert.equal(changedBuild.buildReads(), 1, 'Do not poll while hidden');
changedBuild.document.visibilityState = 'visible';
await changedBuild.documentEvents.visibilitychange();
assert.equal(
  changedBuild.location.reloads,
  0,
  'A foreground return cannot interrupt a paused attempt',
);
safe = true;
const [retry] = changedBuild.timeouts.values();
retry();
assert.equal(changedBuild.location.reloads, 1, 'Apply the downloaded release when the app is idle');
await changedBuild.events.interval();
assert.equal(changedBuild.location.reloads, 1, 'Apply only once');

// A slow worker update must not swallow a new foreground metadata check.
const release = { version: '1.11.1+790', sha: '1'.repeat(40) };
const slowWorker = fixture({ controller: {}, build: release });
let finishWorkerUpdate;
slowWorker.registration.update = () =>
  new Promise((resolve) => {
    finishWorkerUpdate = resolve;
  });
const startup = slowWorker.events.load();
for (let i = 0; i < 8; i++) await Promise.resolve();
release.version = '1.11.1+791';
release.sha = '2'.repeat(40);
const foreground = slowWorker.documentEvents.visibilitychange();
for (let i = 0; i < 8; i++) await Promise.resolve();
assert.equal(
  slowWorker.location.reloads,
  1,
  'Foreground checks the release while the worker is still updating',
);
finishWorkerUpdate();
await Promise.all([startup, foreground]);

for (const build of [
  { version: '1.11.1+790', sha: '1'.repeat(40) },
  { version: '1.11.1+791', sha: 'invalid' },
]) {
  const unchanged = fixture({ controller: {}, build });
  await unchanged.events.load();
  assert.equal(unchanged.location.reloads, 0, 'Ignore current or malformed build metadata');
}

// No service-worker support must leave the page usable without binding controls.
mount({ navigator: {} });
console.log(
  'App updates: first installation, background builds, deferred and exactly-once reload, OAuth, manual checks and offline fallback passed',
);
