// #960/#1010: the sync journal goes with a report; consenting players send one automatically when stuck.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFeedbackJournal, createAutoIncidentReporter, JOURNAL_SOURCE_KEY, AUTO_INCIDENT_KEY } from '../src/persistence/feedback-journal.js';

function memory(seed = {}) {
  const data = new Map(Object.entries(seed));
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)) };
}

test('journal keeps codes and counters only, last 60 entries', () => {
  const events = [
    { at: '2026-11-23T19:55:19.763Z', event: 'legacy_victory_pending', durable: true, stage: 'baseline', errorCode: 'UNKNOWN' },
    { at: '2026-11-23T19:55:35.918Z', event: 'outbox_state_summary', wallet: { pending: 3, pausedReview: 3, deep: { x: 1 } }, issues: ['a'] },
    { event: 'flush_failed', email: 'player@example.com', note: 'x'.repeat(80), 'bad key': 1 },
    { no_event: true },
    'text',
  ];
  const journal = buildFeedbackJournal(memory({ [JOURNAL_SOURCE_KEY]: JSON.stringify(events) }));
  assert.deepEqual(journal, [
    events[0],
    { at: '2026-11-23T19:55:35.918Z', event: 'outbox_state_summary', wallet: { pending: 3, pausedReview: 3 } },
    { event: 'flush_failed' },
  ]);
  const many = Array.from({ length: 90 }, (_, i) => ({ event: 'e' + i }));
  const last = buildFeedbackJournal(memory({ [JOURNAL_SOURCE_KEY]: JSON.stringify(many) }));
  assert.equal(last.length, 60);
  assert.equal(last[0].event, 'e30');
  assert.deepEqual(buildFeedbackJournal(memory({ [JOURNAL_SOURCE_KEY]: '{broken' })), []);
  assert.deepEqual(buildFeedbackJournal(memory()), []);
});

function reporter({ enabled = () => true, start = 1_000_000, sendFails = false } = {}) {
  let clock = start;
  const storage = memory({ [JOURNAL_SOURCE_KEY]: JSON.stringify([{ event: 'hydration_failed', stage: 'daily_rpc' }]) }),
    sent = [],
    timers = [];
  const r = createAutoIncidentReporter({
    storage, enabled, now: () => clock, schedule: (fn) => timers.push(fn),
    send: async (report) => { if (sendFails) throw Error('offline'); sent.push(report); },
  });
  return { r, storage, sent, flush: async () => { while (timers.length) await timers.shift()(); }, tick: (ms) => { clock += ms; } };
}

test('a stuck player sends one automatic report with the journal, then waits 6 hours', async () => {
  const f = reporter();
  assert.equal(f.r.observe('legacy_victory_pending'), false, 'one pending victory is not an incident');
  assert.equal(f.r.observe('legacy_victory_pending'), true, 'a repeated pending victory is');
  await f.flush();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].code, 'legacy_victory_pending');
  assert.deepEqual(f.sent[0].journal, [{ event: 'hydration_failed', stage: 'daily_rpc' }]);
  assert.ok(JSON.parse(f.storage.getItem(AUTO_INCIDENT_KEY)).at);
  assert.equal(f.r.observe('hydration_failed'), false, 'cooldown');
  f.tick(6 * 3600e3 + 1);
  assert.equal(f.r.observe('hydration_failed'), true, 'a hydration failure alone qualifies after the window');
  await f.flush();
  assert.equal(f.sent.length, 2);
});

test('no report without diagnostic consent, for ordinary events, or outside the repetition window', async () => {
  const off = reporter({ enabled: () => false });
  off.r.observe('hydration_failed');
  await off.flush();
  assert.equal(off.sent.length, 0);
  const f = reporter();
  for (const e of ['flush_success', 'hydration_ready', 'auth_state_changed', 'outbox_state_summary']) assert.equal(f.r.observe(e), false);
  f.r.observe('flush_failed');
  f.r.observe('flush_failed');
  f.tick(16 * 60e3);
  assert.equal(f.r.observe('flush_failed'), false, 'three failures must happen within 15 minutes');
  await f.flush();
  assert.equal(f.sent.length, 0);
});

test('a failed automatic send does not start the cooldown', async () => {
  const f = reporter({ sendFails: true });
  f.r.observe('hydration_failed');
  await f.flush();
  assert.equal(f.storage.getItem(AUTO_INCIDENT_KEY), null);
});

test('the game wires the journal into reports and the automatic reporter to consent', () => {
  const src = readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
  assert.match(src, /lumen_send_feedback_v3/);
  assert.match(src, /journal:\(\)=>buildFeedbackJournal\(localStorage\)/);
  assert.match(src, /enabled:\(\)=>!!lumenUser&&!!lumenSupabase&&!qaActive&&diagnosticEnabled&&diagnosticOwner===lumenUser\?\.id/);
  assert.match(src, /try\{autoIncidentReporter\?\.observe\(event\)\}catch\{\}/);
});
