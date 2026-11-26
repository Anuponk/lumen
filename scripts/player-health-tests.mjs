// #708 (recette 24/11): health = last known state of each device; freshness apart.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { playerHealth, healthCounts, freshnessLabel } from '../src/ui/player-health.js';

const now = Date.parse('2026-11-24T09:43:00Z');
const device = (extra = {}) => ({ platform: 'android-pwa', state: 'confirmed', pending: 0, failures: 0, observed_at: '2026-11-24T09:28:16Z', version: '1.11.1+790 5138e16', ...extra });

test('the 24/11 case: active, healthy, with an old second device — not « ? Signal ancien »', () => {
  const h = playerHealth({ game_at: '2026-11-24T08:18:37Z', devices: [device(), device({ observed_at: '2026-11-04T15:22:32Z', version: 'unknown' })] }, { now });
  assert.equal(h.state, 'healthy');
  assert.equal(h.label, 'Sain');
  assert.equal(h.observedAt, '2026-11-24T09:28:16.000Z', 'freshness = latest check');
  assert.equal(h.freshness, 'il y a 14 min');
  assert.equal(h.gameAt, '2026-11-24T08:18:37.000Z');
  assert.deepEqual(h.web, { version: '1.11.1+790 5138e16', at: '2026-11-24T09:28:16.000Z' });
  assert.equal(h.android, null, 'no native version invented');
});

test('an inactive player stays healthy; the age is only freshness', () => {
  const h = playerHealth({ devices: [device({ observed_at: '2026-11-10T10:00:00Z' })] }, { now });
  assert.equal(h.state, 'healthy');
  assert.equal(h.freshness, 'il y a 13 j');
});

test('pending operations without durable failure are « En attente »', () => {
  const h = playerHealth({ devices: [device({ state: 'pending', pending: 3, failures: 1, oldest_pending_at: '2026-11-24T09:00:00Z' })] }, { now });
  assert.equal(h.state, 'pending');
  assert.equal(h.pending, 3);
  assert.match(h.reasons[0], /3 opération/);
});

test('a persistent error stays visible however old; hydration failures and storage count', () => {
  const old = playerHealth({ devices: [device({ state: 'critical', observed_at: '2026-11-01T10:00:00Z' })] }, { now });
  assert.equal(old.state, 'trouble');
  assert.equal(old.freshness, 'il y a 22 j');
  assert.equal(playerHealth({ devices: [device({ state: 'pending', pending: 2, failures: 3 })] }, { now }).state, 'trouble');
  assert.equal(playerHealth({ devices: [device({ state: 'auth', pending: 1 })] }, { now }).state, 'trouble');
  assert.equal(playerHealth({ devices: [device({ storage_error: 'quota' })] }, { now }).reasons[0], 'Stockage local saturé');
  const hydration = playerHealth({ devices: [], hydration: { at: '2026-11-20T10:00:00Z', reason: 'cas' } }, { now });
  assert.equal(hydration.state, 'trouble', 'no device row, but an unresolved hydration failure');
});

test('no observation: « Non évalué », never a guess; counts per state', () => {
  const none = playerHealth(undefined, { now });
  assert.equal(none.state, 'unknown');
  assert.equal(none.freshness, 'aucune observation');
  const receiptsOnly = playerHealth({ game_at: '2026-11-24T08:00:00Z', devices: [] }, { now });
  assert.equal(receiptsOnly.state, 'unknown', 'a receipt proves play, not technical health');
  assert.equal(receiptsOnly.gameAt, '2026-11-24T08:00:00.000Z');
  assert.deepEqual(healthCounts([none, receiptsOnly, playerHealth({ devices: [device()] }, { now })]), { all: 3, trouble: 0, pending: 0, healthy: 1, unknown: 2 });
  assert.equal(freshnessLabel(now - 30e3, now), 'à l’instant');
});

test('versions: latest Web per observation time, Android only from the native channel', () => {
  const h = playerHealth({ devices: [
    device({ platform: 'desktop', observed_at: '2026-11-24T09:30:00Z', version: '1.11.1+791 abcdef0' }),
    device({ observed_at: '2026-11-23T20:00:00Z', version: '1.11.1+785 f101c59', native_version: '1.0.1+2', native_observed_at: '2026-11-23T20:00:00Z' }),
    device({ native_version: 'Chrome 120', native_observed_at: '2026-11-24T09:00:00Z' }),
  ] }, { now });
  assert.equal(h.web.version, '1.11.1+791 abcdef0', 'a PC session updates Web only');
  assert.deepEqual(h.android, { version: '1.0.1+2', at: '2026-11-23T20:00:00.000Z' }, 'a PC session never erases Android; malformed values ignored');
});
