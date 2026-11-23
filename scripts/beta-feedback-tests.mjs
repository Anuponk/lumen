// #960 · Beta reports: minimal context, error classes, kept drafts and references
// that the server accepts (lumen_send_feedback_v2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildFeedbackContext,
  browserFamily,
  classifyFeedbackError,
  newClientRef,
  readDraft,
  saveDraft,
  clearDraft,
  feedbackSessionId,
  FEEDBACK_KINDS,
} from '../src/ui/beta-feedback.js';
import { locales } from '../src/ui/i18n.js';

const memory = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
};
const migration = fs.readFileSync(
  'supabase/migrations/20261122240000_beta_feedback_v2_960.sql',
  'utf8',
);

test('context keeps only what helps reproduce, within the server allowlist', () => {
  const ctx = buildFeedbackContext({
    appVersion: '1.11.1+760',
    locale: 'es',
    platform: 'android-twa',
    screen: '360x640',
    standalone: true,
    online: false,
    userAgent:
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
    quest: { id: 'base-q012', ordinal: 12, puzzleId: 12, inProgress: true },
    adventure: 'Primeras luces',
    surface: 'help',
    errorCode: 'sync_critical',
    sessionId: 's-abc12345',
  });
  assert.deepEqual(ctx, {
    app_version: '1.11.1+760',
    platform: 'android-twa',
    browser: 'Chrome · Android',
    screen: '360x640',
    locale: 'es',
    standalone: true,
    offline: true,
    surface: 'help',
    session_id: 's-abc12345',
    quest_id: 'base-q012',
    quest_ordinal: 12,
    puzzle_id: 12,
    in_quest: true,
    adventure: 'Primeras luces',
    error_code: 'sync_critical',
  });
  const allow = migration
    .match(/v_key in \(([\s\S]*?)\)\n/)[1]
    .match(/'([a-z_]+)'/g)
    .map((k) => k.slice(1, -1));
  for (const key of Object.keys(ctx)) assert(allow.includes(key), 'server keeps ' + key);
  const guest = buildFeedbackContext({ appVersion: 'v', userAgent: '' });
  assert.equal(guest.surface, 'menu');
  assert(
    !('quest_id' in guest) && !('session_id' in guest) && !('error_code' in guest),
    'nothing invented',
  );
  assert.doesNotMatch(JSON.stringify(ctx), /Mozilla|AppleWebKit/, 'never the raw user agent');
});

test('browser family only, never the raw user agent', () => {
  assert.equal(
    browserFamily(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1',
    ),
    'Safari · iOS',
  );
  assert.equal(
    browserFamily(
      'Mozilla/5.0 (Linux; Android 13; SM-S911B) SamsungBrowser/23.0 Chrome/115.0 Mobile Safari/537.36',
    ),
    'Samsung · Android',
  );
  assert.equal(
    browserFamily(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    ),
    'Firefox',
  );
  assert.equal(
    browserFamily('Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0'),
    'Edge',
  );
});

test('errors: offline and network keep the draft, rate limit is explicit', () => {
  assert.equal(classifyFeedbackError(new Error('Failed to fetch')), 'offline');
  assert.equal(classifyFeedbackError(new Error('anything'), false), 'offline');
  assert.equal(classifyFeedbackError({ message: 'rate_limited' }), 'rateLimited');
  assert.equal(classifyFeedbackError({ message: 'message_required' }), 'messageRequired');
  assert.equal(classifyFeedbackError({ message: 'invalid_kind' }), 'failed');
  for (const lang of ['fr', 'en', 'es'])
    for (const key of ['offline', 'rateLimited', 'messageRequired', 'failed'])
      assert(locales[lang].messages['feedback.error.' + key], lang + ' ' + key);
});

test('drafts survive closing and reloading; references match the server rule', () => {
  const storage = memory();
  assert.equal(readDraft(storage), null);
  const ref = newClientRef();
  assert.match(ref, /^[A-Za-z0-9_-]{8,64}$/, 'server accepts the reference');
  assert.notEqual(newClientRef(), ref);
  saveDraft(storage, { kind: 'question', message: 'Comment marche la Maîtrise ?', ref });
  assert.deepEqual(
    readDraft(storage),
    { kind: 'question', message: 'Comment marche la Maîtrise ?', ref },
    'same reference after reload: a retry is idempotent',
  );
  saveDraft(storage, { kind: 'bug', message: '   ', ref });
  assert.equal(readDraft(storage), null, 'an empty draft is not kept');
  storage.setItem('lumenFeedbackDraftV1', JSON.stringify({ kind: 'rule', message: 'x' }));
  assert.equal(readDraft(storage), null, 'unknown kinds are ignored');
  saveDraft(storage, { kind: 'idea', message: 'Idée', ref });
  clearDraft(storage);
  assert.equal(readDraft(storage), null);
  assert.deepEqual(FEEDBACK_KINDS, ['bug', 'question', 'idea']);
  assert.match(
    migration,
    /p_kind not in \('bug', 'question', 'idea'\)/,
    'client and server kinds agree',
  );
});

test('session id is random, short and per tab', () => {
  const storage = memory();
  const id = feedbackSessionId(storage);
  assert.match(id, /^s-[a-z0-9]{8}$/);
  assert.equal(feedbackSessionId(storage), id);
  assert.notEqual(feedbackSessionId(memory()), id);
});

test('blocking errors offer « report this problem » with their error code', () => {
  const ui = fs.readFileSync('src/ui/game-screen.js', 'utf8');
  const sync = ui.slice(
    ui.indexOf('function renderSyncStatus('),
    ui.indexOf('function renderSyncStatus(') + 2000,
  );
  assert.match(
    sync,
    /reportProblemButton\('sync_'\+view\.status,'sync'\)/,
    'critical and persistent sync alerts',
  );
  assert.match(
    ui,
    /reportProblemButton\(intent\?'victory_pending_sync':'victory_local_unconfirmed','victory'\)/,
    'victory that could not be saved',
  );
  assert.match(ui, /helpReportProblem/, 'quest help');
  assert.match(ui, /getElementById\("betaFeedbackBtn"\)\.onclick=/, 'Mon espace');
  assert.doesNotMatch(
    fs.readFileSync('index.html', 'utf8'),
    /class="[^"]*feedback-float/,
    'no permanent floating bubble (V1)',
  );
});

test('migration is additive, idempotent and closes direct access', () => {
  assert.doesNotMatch(migration, /\bdrop table\b|\bdrop column\b|\btruncate\b|\bdelete from\b/i);
  assert.match(migration, /add column if not exists context jsonb/);
  assert.match(
    migration,
    /array\['bug','rule','difficulty','other','question','idea'\]/,
    'existing kinds stay valid',
  );
  assert.match(
    migration,
    /revoke all on function public\.lumen_admin_feedback_v2\(integer\) from public, anon;/,
  );
  assert.match(
    migration,
    /revoke all on function public\.lumen_admin_feedback_set_status\(bigint, text\) from public, anon;/,
  );
  assert.match(migration, /security definer set search_path=''/);
});
