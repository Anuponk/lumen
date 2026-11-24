// #1000 lot 2: a command read-back downloads a digest-verified delta, never trusts it blindly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProfileDelta, loadVerifiedProfileFromBase } from '../src/persistence/cloud-profile.js';
import { jsonbDigest } from '../src/persistence/jsonb-digest.js';

const base = { xp: 3, shards: 1, solved: { 1: 1, 2: 1 }, badges: {}, stars: {}, performances: { 1: { a: 1 }, 2: { b: 2 } }, canonicalQuestState: {}, gone: true };
const after = { xp: 28, shards: 1, solved: { 1: 1, 2: 1, 3: 1 }, badges: {}, stars: {}, performances: { 1: { a: 1 }, 3: { c: 3 } }, canonicalQuestState: {} };
const patch = [
  { op: 'remove', path: ['gone'] },
  { op: 'set', path: ['performances', '3'], value: { c: 3 } },
  { op: 'remove', path: ['performances', '2'] },
  { op: 'set', path: ['solved', '3'], value: 1 },
  { op: 'set', path: ['xp'], value: 28 },
];

test('the delta rebuilds the server profile without touching the base', () => {
  const copy = structuredClone(base);
  assert.deepEqual(applyProfileDelta(base, patch), after);
  assert.deepEqual(base, copy, 'base is not mutated');
  for (const bad of [null, [{ op: 'set', path: [] , value: 1 }], [{ op: 'move', path: ['xp'] }], [{ op: 'set', path: ['a', 'b', 'c'], value: 1 }], [{ op: 'set', path: ['xp'] }]])
    assert.throws(() => applyProfileDelta(base, bad));
});

function client(answer, { restore = after } = {}) {
  const calls = [];
  return { calls, rpc: async (name, args) => {
    calls.push(name);
    if (name === 'lumen_profile_delta') { assert.deepEqual(args.p_base, base); assert.equal(args.p_expected_user_id, 'u'); return typeof answer === 'function' ? answer() : answer; }
    assert.equal(name, 'lumen_restore_profile');
    return { data: structuredClone(restore) };
  } };
}

test('a matching digest installs the rebuilt profile with one small download', async () => {
  const c = client({ data: { version: 1, sha256: await jsonbDigest(after), patch } });
  assert.deepEqual(await loadVerifiedProfileFromBase(c, { userId: 'u', base }), after);
  assert.deepEqual(c.calls, ['lumen_profile_delta']);
});

test('a wrong digest, malformed delta, error or old server falls back to the full read', async () => {
  for (const answer of [
    async () => ({ data: { version: 1, sha256: '0'.repeat(64), patch } }),
    async () => ({ data: { version: 1, sha256: await jsonbDigest(after), patch: [{ op: 'move', path: ['xp'] }] } }),
    async () => ({ data: { version: 2, sha256: await jsonbDigest(after), patch } }),
    async () => ({ error: { code: '42501' }, status: 403 }),
    async () => { throw Error('offline'); },
  ]) {
    const c = client(answer);
    assert.deepEqual(await loadVerifiedProfileFromBase(c, { userId: 'u', base }), after);
    assert.deepEqual(c.calls, ['lumen_profile_delta', 'lumen_restore_profile']);
  }
  const old = client({ error: { code: 'PGRST202' }, status: 404 });
  await loadVerifiedProfileFromBase(old, { userId: 'u', base });
  await loadVerifiedProfileFromBase(old, { userId: 'u', base });
  assert.deepEqual(old.calls, ['lumen_profile_delta', 'lumen_restore_profile', 'lumen_restore_profile'], 'missing endpoint remembered');
  const none = client(null);
  await loadVerifiedProfileFromBase(none, { userId: 'u', base: null });
  assert.deepEqual(none.calls, ['lumen_restore_profile'], 'no base: plain read');
});

test('the legacy victory read-back uses the pre-command copy as delta base', async () => {
  const { readFileSync } = await import('node:fs');
  const screen = readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
  const legacy = readFileSync(new URL('../src/persistence/legacy-command.js', import.meta.url), 'utf8');
  assert.ok(screen.includes('{userId:ownerId,sessionValid:sameContext,base:cloudProfileBaseline}'));
  assert.ok(legacy.includes('base?await loadVerifiedProfileFromBase(client,{userId,base}):await loadVerifiedProfile(client,{userId})'));
});
