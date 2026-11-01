import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Static safety checks only: they do not substitute for a database integration test.
const sql = readFileSync(new URL('../supabase/migrations/20261022160212_lumen_account_erasure.sql', import.meta.url), 'utf8');
const normalize = value => value.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').toLowerCase();

test('erasure remains private and scoped to Lumen', () => {
  const text = normalize(sql);
  assert.match(text, /create schema lumen_privacy/);
  assert.match(text, /revoke all on schema lumen_privacy from public, anon, authenticated, service_role/);
  assert.match(text, /revoke all on all functions in schema lumen_privacy from public,anon,authenticated,service_role/);
  assert.doesNotMatch(text, /\bdelete\s+from\s+auth\.users\b/);
  assert.doesNotMatch(text, /\btruncate\s+(?:table\s+)?auth\.users\b/);
  assert.match(text, /create function lumen_privacy\.review_erasure/);
  assert.match(text, /create function lumen_privacy\.erase_account/);
  assert.match(text, /explicit scope confirmation required/);
});

test('guard and erasure tombstones are part of the same migration', () => {
  const text = normalize(sql);
  assert.match(text, /create table lumen_privacy\.erased_identifiers/);
  assert.match(text, /create function lumen_privacy\.guard_write/);
  assert.match(text, /create function lumen_privacy\.install_guards/);
  assert.match(text, /select lumen_privacy\.install_guards\(\)/);
  assert.match(text, /lumen_account_erased/);
  assert.match(text, /on conflict do nothing/);
});

test('social challenges are anonymized, not indiscriminately removed', () => {
  const text = normalize(sql);
  assert.match(text, /'lumen','social_challenges','sender_user_id','sender_anonymous_id',null,'anonymize'/);
  assert.match(text, /'lumen','social_challenge_participations','participant_user_id','participant_anonymous_id','participant_key','delete'/);
  assert.match(text, /set sender_user_id=null,sender_anonymous_id=null,sender_display_name='compte supprimé'/);
});

test('support records are included and ownership is backfilled', () => {
  const text = normalize(sql);
  for (const table of ['support_cases', 'support_captures', 'support_contents', 'support_access']) {
    assert.ok(text.includes("'"+table+"'"), table+' missing from policy');
  }
  assert.match(text, /add column if not exists privacy_owner_id uuid/);
  assert.match(text, /set privacy_owner_id=c\.user_id/);
  assert.match(text, /lumen_erasure_support_schema_review_required/);
});

test('migration is deliberately not exposed as a public RPC', () => {
  const text = normalize(sql);
  assert.match(text, /operator database session required/);
  assert.match(text, /if auth\.uid\(\) is not null then/);
  assert.doesNotMatch(text, /grant execute on (?:all functions|function lumen_privacy\.)[^;]*to (?:anon|authenticated|service_role)/);
});
