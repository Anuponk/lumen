// #960: the snapshot of the moment of a report follows the server allowlist
// (lumen_commands.sanitize_feedback_snapshot) and reads nothing private.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReportSnapshot, encodeBoard, journalMilestones } from '../src/ui/report-snapshot.js';
import { reportStatusKey, newMessageRef } from '../src/ui/my-reports.js';

const KEY = /^[a-z][a-z0-9_]{0,31}$/;
const TEXT = /^[A-Za-z0-9_:.+ -]{0,64}$/;
function serverShape(value) {
  for (const [key, v] of Object.entries(value)) {
    assert.match(key, KEY, key);
    if (key === 'board') assert.match(v, /^[0-9]{1,20}(\/[0-9]{1,20}){0,19}$/);
    else if (typeof v === 'string') assert.match(v, TEXT, key);
    else if (v && typeof v === 'object') {
      for (const [sub, s] of Object.entries(v)) {
        assert.match(sub, KEY, key + '.' + sub);
        assert(['number', 'boolean'].includes(typeof s) || (typeof s === 'string' && TEXT.test(s)), key + '.' + sub);
      }
    } else assert(['number', 'boolean'].includes(typeof v), key);
  }
  assert(JSON.stringify(value).length <= 8192);
}

test('a bug during a quest carries the board, the attempt and the sync state of that moment', () => {
  const snapshot = buildReportSnapshot({
    now: Date.parse('2026-11-24T09:43:00Z'),
    surface: 'help',
    menu: 'rulesModal',
    online: true,
    hydration: { state: 'ready' },
    outbox: { state: 'confirmed', canonical: 0, legacy: 2, wallet: 0 },
    journal: [
      { at: '2026-11-24T09:28:16Z', event: 'flush_success' },
      { at: '2026-11-24T09:30:00Z', event: 'flush_failed', errorCode: 'CLOUD_CAS_CONFLICT' },
      { at: '2026-11-24T09:31:00Z', event: 'outbox_state_summary' },
    ],
    storage: { ratio: 12, error: null },
    quest: { id: 'base-q692', adventure: 'base', ordinal: 692 },
    attempt: { state: 'PAUSED', mode: 'campaign', activeDuration: 83400, qualifying: true, assistanceUsed: false, mistakeCommitted: false, resetCount: 1, helpUses: { hint: 2, verify: 1 }, board: [[1]], attemptId: 'secret-attempt' },
    board: [[0, 1, 2], [3, 0, 0], [0, 0, 2]],
  });
  serverShape(snapshot);
  assert.equal(snapshot.board, '012/300/002');
  assert.deepEqual(snapshot.attempt, { state: 'PAUSED', mode: 'campaign', elapsed_s: 83, qualifying: true, assistance: false, mistake: false, resets: 1, help_hint: 2, help_verify: 1 });
  assert.equal(snapshot.sync.pending_legacy, 2);
  assert.equal(snapshot.sync.last_success_at, '2026-11-24T09:28:16Z');
  assert.equal(snapshot.sync.last_error, 'CLOUD_CAS_CONFLICT');
  assert.equal(snapshot.taken_at, '2026-11-24T09:43:00.000Z', 'the moment of the report, not of the last journal event');
  assert.doesNotMatch(JSON.stringify(snapshot), /secret-attempt/, 'no attempt identifier');
});

test('outside a quest, guests and malformed inputs: nothing invented', () => {
  const snapshot = buildReportSnapshot({ surface: 'menu', online: false, hydration: { state: 'guest' }, board: [[1]] });
  serverShape(snapshot);
  assert.equal(snapshot.board, undefined, 'no board without a quest');
  assert.equal(snapshot.attempt, undefined);
  assert.equal(snapshot.online, false);
  assert.equal(encodeBoard([[0, 12]]), null);
  assert.equal(encodeBoard(Array.from({ length: 21 }, () => [0])), null);
  assert.equal(encodeBoard('0/1'), null);
  const odd = buildReportSnapshot({ surface: '<script>alert(1)</script>', hydration: { error: 'x'.repeat(200) } });
  serverShape(odd);
  assert.deepEqual(journalMilestones(null), { last_success: null, last_success_at: null, last_error: null, last_error_at: null });
});

test('« Mes signalements » statuses and message references', () => {
  assert.equal(reportStatusKey('fixed'), 'reports.status.closed', 'legacy « fixed » reads as resolved');
  assert.equal(reportStatusKey('answered'), 'reports.status.answered');
  assert.equal(reportStatusKey('weird'), 'reports.status.new');
  const ref = newMessageRef();
  assert.match(ref, /^[A-Za-z0-9_-]{8,64}$/, 'accepted by lumen_feedback_reply');
  assert.notEqual(newMessageRef(), ref);
});
