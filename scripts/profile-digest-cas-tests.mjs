// Digest profile CAS (#697 follow-up): exact digest → usual CAS with half the
// upload; any mismatch, missing endpoint or unexpected answer → the full CAS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { compareAndSwapCloudProfile } from '../src/persistence/cloud-profile.js';
import { jsonbText, jsonbDigest, jsonbNumber } from '../src/persistence/jsonb-digest.js';

test('jsonb text follows PostgreSQL output rules', () => {
  assert.equal(jsonbText({ bb: 1, a: [1, 'x'], ab: {}, é: null, b: true }), '{"a": [1, "x"], "b": true, "ab": {}, "bb": 1, "é": null}');
  assert.equal(jsonbText({ s: 'a"b\\c\n\u0001\u007f😀' }), '{"s": "a\\"b\\\\c\\n\\u0001\u007f😀"}');
  assert.deepEqual([1e21, 1.2e21, 1e-7, 1.5e-7, -2.5e-8, -0, 0.1].map(jsonbNumber), ['1000000000000000000000', '1200000000000000000000', '0.0000001', '0.00000015', '-0.000000025', '0', '0.1']);
  assert.throws(() => jsonbText({ n: NaN }));
});

test('digest is SHA-256 of the jsonb text', async () => {
  const value = { z: 1, a: [1, 2] };
  assert.equal(await jsonbDigest(value), createHash('sha256').update(jsonbText(value)).digest('hex'));
});

const baseline = { xp: 1, shards: 0, solved: {}, badges: {}, catalogueOrigin: 4 },
  next = { ...baseline, xp: 2 };
function client(handler) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push(name);
      return handler(name, args);
    },
  };
}

test('an exact digest writes with the profile only once (no expected profile uploaded)', async () => {
  const c = client(async (name, args) => {
    assert.equal(name, 'lumen_cas_profile_digest');
    assert.equal(args.p_expected_sha256, await jsonbDigest(baseline));
    assert.equal(args.p_expected, undefined, 'The expected profile is not uploaded');
    return { data: { version: 1, matched: true, applied: true } };
  });
  assert.equal((await compareAndSwapCloudProfile(c, next, baseline, { userId: 'u' })).xp, 2);
  assert.deepEqual(c.calls, ['lumen_cas_profile_digest']);
});

test('a digest mismatch falls back to the full CAS and keeps its exact outcome', async () => {
  for (const full of [true, false]) {
    const c = client(async (name) =>
      name === 'lumen_cas_profile_digest' ? { data: { version: 1, matched: false, applied: false } } : { data: full },
    );
    if (full) assert.equal((await compareAndSwapCloudProfile(c, next, baseline, { userId: 'u' })).xp, 2);
    else await assert.rejects(compareAndSwapCloudProfile(c, next, baseline, { userId: 'u' }), (error) => error.code === 'CLOUD_CAS_CONFLICT');
    assert.deepEqual(c.calls, ['lumen_cas_profile_digest', 'lumen_cas_profile']);
  }
});

test('a matched digest that the guarded CAS does not apply is a conflict, never a fallback write', async () => {
  const c = client(async () => ({ data: { version: 1, matched: true, applied: false } }));
  await assert.rejects(compareAndSwapCloudProfile(c, next, baseline, { userId: 'u' }), (error) => error.code === 'CLOUD_CAS_CONFLICT');
  assert.deepEqual(c.calls, ['lumen_cas_profile_digest']);
});

test('server refusals keep the existing diagnostic codes', async () => {
  const c = client(async () => ({ error: { message: 'earned XP cannot decrease' } }));
  await assert.rejects(compareAndSwapCloudProfile(c, next, baseline, { userId: 'u' }), (error) => error.code === 'LEGACY_XP_REGRESSION');
  const offline = client(async () => ({ error: { message: 'TypeError: Failed to fetch' } }));
  await assert.rejects(compareAndSwapCloudProfile(offline, next, baseline, { userId: 'u' }), (error) => error.code === 'CLOUD_NETWORK');
  assert.deepEqual(offline.calls, ['lumen_cas_profile_digest'], 'A transport failure is not retried as a second write');
});

test('an older server (missing endpoint) uses the full CAS and is not probed again', async () => {
  const c = client(async (name) => (name === 'lumen_cas_profile_digest' ? { data: null, error: { code: 'PGRST202' }, status: 404 } : { data: true }));
  await compareAndSwapCloudProfile(c, next, baseline, { userId: 'u' });
  await compareAndSwapCloudProfile(c, next, baseline, { userId: 'u' });
  assert.deepEqual(c.calls, ['lumen_cas_profile_digest', 'lumen_cas_profile', 'lumen_cas_profile']);
});

test('unexpected answers and calls without an account guard use the full CAS', async () => {
  for (const data of [[], null, { version: 2, matched: true, applied: true }, { version: 1 }]) {
    const c = client(async (name) => (name === 'lumen_cas_profile_digest' ? { data } : { data: true }));
    await compareAndSwapCloudProfile(c, next, baseline, { userId: 'u' });
    assert.deepEqual(c.calls, ['lumen_cas_profile_digest', 'lumen_cas_profile'], JSON.stringify(data));
  }
  const c = client(async () => ({ data: true }));
  await compareAndSwapCloudProfile(c, next, baseline);
  assert.deepEqual(c.calls, ['lumen_cas_profile']);
});
