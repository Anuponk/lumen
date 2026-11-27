// #848: the Android native version comes only from the launcher fragment, is kept
// for the session (never localStorage, shared with Chrome), and travels with the
// existing outbox observation only when known (a change re-sends, a repeat does not).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseNativeLaunch, captureNativeVersion, readNativeVersion, NATIVE_VERSION_KEY } from '../src/persistence/native-version.js';
import { createOutboxHealthReporter } from '../src/persistence/outbox-health.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), data };
};

test('only a well-formed launcher fragment is a native version', () => {
  assert.equal(parseNativeLaunch('#lumen-native=1.0.1+2'), '1.0.1+2');
  assert.equal(parseNativeLaunch('#a=1&lumen-native=1.2+10'), '1.2+10');
  for (const bad of ['', '#', '#lumen-native=Chrome%20120', '#lumen-native=1.0.1', '#lumen-native=1.0.1+2<script>', '#access_token=x', null])
    assert.equal(parseNativeLaunch(bad), null, String(bad));
});

test('the fragment is removed from the URL, other fragments are kept, the session remembers it', () => {
  const storage = memory();
  const replaced = [];
  const history = { state: null, replaceState: (_s, _t, url) => replaced.push(url) };
  assert.equal(captureNativeVersion({ location: { hash: '#lumen-native=1.0.1+2', pathname: '/', search: '' }, history, storage }), '1.0.1+2');
  assert.deepEqual(replaced, ['/']);
  assert.equal(storage.getItem(NATIVE_VERSION_KEY), '1.0.1+2');
  // A reload of the same session (no fragment) keeps it; a browser tab has none.
  assert.equal(captureNativeVersion({ location: { hash: '', pathname: '/', search: '' }, history, storage }), '1.0.1+2');
  assert.equal(captureNativeVersion({ location: { hash: '', pathname: '/', search: '' }, history, storage: memory() }), null);
  captureNativeVersion({ location: { hash: '#x=1&lumen-native=1.0.1+3', pathname: '/admin/analytics', search: '?a=1' }, history, storage });
  assert.equal(replaced.at(-1), '/admin/analytics?a=1#x=1');
  assert.equal(readNativeVersion(storage), '1.0.1+3', 'a newer launch replaces it');
  assert.equal(readNativeVersion({ getItem: () => { throw Error('blocked'); } }), null);
});

test('the native version joins the existing observation and is written only on change', async () => {
  const calls = [];
  const reporter = createOutboxHealthReporter({ storage: { getItem: () => null, setItem() {} }, newId: () => '00000000-0000-0000-0000-000000000848', now: () => '2026-11-24T10:00:00Z', send: async (_c, p) => calls.push(p) });
  const base = { userId: 'synthetic', client: {}, version: '1.11.1+790 5138e16', state: 'confirmed' };
  await reporter.report(base);
  assert.equal(Object.hasOwn(calls[0], 'p_native_version'), false, 'browser: no native field at all');
  await reporter.report({ ...base, nativeVersion: '1.0.1+2' });
  await reporter.report({ ...base, nativeVersion: '1.0.1+2' });
  assert.equal(calls.length, 2, 'a repeat sends nothing');
  assert.equal(calls[1].p_native_version, '1.0.1+2');
  await reporter.report({ ...base, nativeVersion: 'Mozilla/5.0 (Linux; Android 14)' });
  assert.equal(Object.hasOwn(calls[2], 'p_native_version'), false, 'never inferred from a user agent');
});
