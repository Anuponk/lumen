// #1000 lot 1: confirm a known profile by digest; any doubt is the full read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { confirmVerifiedProfile } from '../src/persistence/cloud-profile.js';
import { jsonbDigest } from '../src/persistence/jsonb-digest.js';

const server = { xp: 4, shards: 1, solved: { 1: 1 }, badges: {}, stars: {}, performances: {}, canonicalQuestState: {}, é: '😀' };
const other = { ...server, xp: 5 };
function client(digest, { restore = server } = {}) {
  const calls = [];
  return {
    calls,
    rpc: async (name, args) => {
      calls.push(name);
      if (name === 'lumen_profile_digest') {
        assert.deepEqual(args, { p_expected_user_id: 'u' });
        return typeof digest === 'function' ? digest() : { data: { version: 1, sha256: digest } };
      }
      assert.equal(name, 'lumen_restore_profile');
      return { data: structuredClone(restore) };
    },
  };
}

test('a matching digest returns the known profile without downloading it', async () => {
  const c = client(await jsonbDigest(server));
  const got = await confirmVerifiedProfile(c, { userId: 'u', candidates: [other, server] });
  assert.deepEqual(got, server);
  assert.deepEqual(c.calls, ['lumen_profile_digest']);
  const candidate = structuredClone(server);
  const again = await confirmVerifiedProfile(client(await jsonbDigest(server)), { userId: 'u', candidates: [candidate] });
  assert.notEqual(again, candidate, 'a copy is returned, never the caller object');
});

test('a mismatch, a malformed answer or an error is the full verified read', async () => {
  for (const digest of [
    '0'.repeat(64),
    () => ({ data: { version: 2, sha256: '0'.repeat(64) } }),
    () => ({ data: { version: 1, sha256: 'nope' } }),
    () => ({ data: null }),
    () => ({ error: { code: '42501', message: 'profile account changed' }, status: 403 }),
    () => { throw Error('network'); },
  ]) {
    const c = client(digest);
    assert.deepEqual(await confirmVerifiedProfile(c, { userId: 'u', candidates: [other] }), server);
    assert.deepEqual(c.calls, ['lumen_profile_digest', 'lumen_restore_profile']);
  }
});

test('no profile on the server keeps the full read outcome (null)', async () => {
  const c = client(() => ({ data: { version: 1, sha256: null } }), { restore: null });
  assert.equal(await confirmVerifiedProfile(c, { userId: 'u', candidates: [server] }), null);
  assert.deepEqual(c.calls, ['lumen_profile_digest', 'lumen_restore_profile']);
});

test('without userId or candidate there is no extra round trip', async () => {
  for (const options of [{ candidates: [server] }, { userId: 'u', candidates: [] }, { userId: 'u', candidates: [null, 'x', []] }]) {
    const c = client(await jsonbDigest(server));
    await confirmVerifiedProfile(c, options);
    assert.deepEqual(c.calls, ['lumen_restore_profile']);
  }
});

test('an older server without the endpoint is remembered and skipped', async () => {
  const c = client(() => ({ error: { code: 'PGRST202' }, status: 404 }));
  await confirmVerifiedProfile(c, { userId: 'u', candidates: [server] });
  await confirmVerifiedProfile(c, { userId: 'u', candidates: [server] });
  assert.deepEqual(c.calls, ['lumen_profile_digest', 'lumen_restore_profile', 'lumen_restore_profile']);
});

test('verification sites use the digest confirmation; commands still read fully', () => {
  const screen = readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
  const profile = readFileSync(new URL('../src/persistence/cloud-profile.js', import.meta.url), 'utf8');
  assert.ok(screen.includes('confirmVerifiedProfile(hydrationClient,{userId:accountId,candidates:[cached]})'), 'hydration confirms the device cache');
  assert.ok(screen.includes('candidates:[current,cloudProfileBaseline]'), 'failed save checks both known profiles');
  for (const site of ['candidates:[saved]', 'candidates:[written]', 'candidates:[updated]', 'candidates:[profile]'])
    assert.ok(profile.includes(site), site);
});
