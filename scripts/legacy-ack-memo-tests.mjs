// #1010: an acknowledged legacy run is never captured, replayed and reloaded again on a cold start.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGACY_ACK_KEY, rememberLegacyAck, findLegacyAck } from '../src/persistence/legacy-ack-memo.js';

function memory() {
  const data = new Map();
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}
const facts = { seconds: 61, assistanceUsed: false, mistakeCommitted: false, qualifying: true, hintUsed: false, challengeFailed: false, qualifiedDay: '2026-11-23', qualifiedAt: '2026-11-23T19:40:52.287Z' };
const receipt = (op, quest = 'pack-real-adventure-04-q082') => ({ request: { version: 1, operationId: op, questId: quest, facts }, outcome: { firstCompletion: true, attempts: 1 }, recordedAt: '2026-11-23T19:55:35Z' });

test('only a server receipt is remembered, per account, operation and quest', () => {
  const s = memory();
  assert.equal(rememberLegacyAck(s, 'u1', receipt('op-1-reset-0')), true);
  const hit = findLegacyAck(s, 'u1', 'op-1-reset-0', 'pack-real-adventure-04-q082');
  assert.equal(hit.outcome.firstCompletion, true);
  assert.deepEqual(hit.facts, facts);
  assert.equal(findLegacyAck(s, 'u2', 'op-1-reset-0', 'pack-real-adventure-04-q082'), null, 'another account never matches');
  assert.equal(findLegacyAck(s, 'u1', 'op-1-reset-0', 'other-quest'), null, 'another quest never matches');
  assert.equal(findLegacyAck(s, 'u1', 'op-2-reset-0', 'pack-real-adventure-04-q082'), null, 'another run never matches');
  for (const bad of [null, {}, { request: {} }, { request: { operationId: 'x y', questId: 'q', facts }, outcome: { firstCompletion: true } }, { request: { operationId: 'ok', questId: 'q', facts }, outcome: {} }])
    assert.equal(rememberLegacyAck(s, 'u1', bad), false);
  assert.equal(rememberLegacyAck(s, '', receipt('op-3')), false);
});

test('bounded, idempotent and safe on unreadable or full storage', () => {
  const s = memory();
  for (let i = 0; i < 45; i++) rememberLegacyAck(s, 'u1', receipt('op-' + i));
  rememberLegacyAck(s, 'u1', receipt('op-44'));
  const all = JSON.parse(s.getItem(LEGACY_ACK_KEY));
  assert.equal(all.filter((x) => x.owner === 'u1').length, 30);
  assert.equal(all.filter((x) => x.operationId === 'op-44').length, 1);
  assert.equal(findLegacyAck(s, 'u1', 'op-0', 'pack-real-adventure-04-q082'), null, 'oldest runs age out');
  s.setItem(LEGACY_ACK_KEY, '{broken');
  assert.equal(findLegacyAck(s, 'u1', 'op-44', 'pack-real-adventure-04-q082'), null);
  const full = { getItem: () => null, setItem: () => { throw Error('quota'); } };
  assert.equal(rememberLegacyAck(full, 'u1', receipt('op-x')), false);
});

test('the victory flow records every server receipt and skips only an acknowledged cold-start capture', () => {
  const src = readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
  for (const site of [
    'rememberLegacyAck(localStorage,ownerId,committed.receipt);\n',
    'rememberLegacyAck(localStorage,ownerId,restored.receipt);',
    "commitLegacyVictoryCommand(hydrationClient,questId,facts,id,options).then(c=>{rememberLegacyAck(localStorage,accountId,c?.receipt);return c})",
    'commitLegacyVictoryCommand(client,id,facts,op,options).then(c=>{rememberLegacyAck(localStorage,ownerId,c?.receipt);return c})',
  ])
    assert.ok(src.replace(/\r\n/g, '\n').includes(site), site);
  const capture = src.slice(src.indexOf('async function captureLegacyCommandVictory'));
  const skip = capture.indexOf('const acknowledged=!prior&&findLegacyAck(localStorage,ownerId,operationId,quest.id);');
  const enqueue = capture.indexOf('intent=await legacyVictoryOutbox.enqueue(');
  assert.ok(skip > 0 && skip < enqueue, 'the acknowledged check runs before any durable capture');
});
