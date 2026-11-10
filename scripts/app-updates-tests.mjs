import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setupAppUpdates as mount } from '../src/ui/app-updates.js';

const source = fs.readFileSync('src/ui/game-screen.js', 'utf8');
assert.match(
  source,
  /setupAppUpdates\(\{window,document,navigator,location,caches:window.caches,console,appVersion\}\)/,
  'Controller composes the module with live version getter',
);
assert.doesNotMatch(
  source,
  /serviceWorker.addEventListener\("controllerchange"/,
  'Only one update dispatcher',
);

function fixture({ controller = null, search = '', hash = '', registerFails = false } = {}) {
  const events = {},
    workerEvents = {},
    messages = [],
    removed = [],
    registrations = [],
    warnings = [];
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
      addEventListener(name, fn) {
        events[name] = fn;
      },
    },
    document: {
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
    appVersion: () => 'fixture-version',
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
  oauth.workerEvents.controllerchange();
  assert.equal(oauth.location.reloads, 0, 'OAuth callback must finish before reload');
  oauth.location.search = oauth.location.hash = '';
  oauth.workerEvents.controllerchange();
  assert.equal(oauth.location.reloads, 1, 'A later update still works');
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
assert.match(manual.status.textContent, /fixture-version/);
assert.equal(manual.location.reloads, 1);
const failed = fixture({ registerFails: true });
await failed.events.load();
assert.equal(failed.warnings.length, 1);
assert.equal(failed.status.textContent, '', 'Background failure remains unobtrusive');
await failed.button.onclick();
assert.match(failed.status.textContent, /Impossible/);
assert.equal(failed.location.reloads, 1, 'Preserve existing manual reload fallback');

// No service-worker support must leave the page usable without binding controls.
mount({ navigator: {} });
console.log(
  'App updates: first installation, exactly-once upgrade, OAuth, manual checks, scoped cache cleanup and offline fallback passed',
);
