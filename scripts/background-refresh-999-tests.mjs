// #999: focus/auth events no longer re-read assistance, diagnostic preference and social every minute.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { functionSource } from './source-tools.mjs';

const source = readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');

function sandbox() {
  let now = 1_000_000;
  const calls = [];
  const ctx = {
    lumenUser: { id: 'a' },
    Date: { now: () => now },
    setTimeout: (fn) => fn(),
    supportSession: { changed: () => calls.push('changed'), refresh: async () => calls.push('support') },
    refreshDiagnosticPreference: async (force) => calls.push(force ? 'pref!' : 'pref'),
    loadMyChallenges: () => calls.push('social'),
    DIAGNOSTIC_REFRESH_MS: 15 * 60e3, lastDiagnosticRefresh: { owner: undefined, at: 0 },
    SOCIAL_FOCUS_REFRESH_MS: 3 * 60e3, lastSocialFocusRefresh: { owner: undefined, at: 0 },
  };
  vm.createContext(ctx);
  vm.runInContext(functionSource(source, 'queueDiagnosticPreferenceRefresh'), ctx);
  vm.runInContext(functionSource(source, 'refreshSocialOnFocus'), ctx);
  return { ctx, calls, tick: (ms) => { now += ms; } };
}

test('assistance and diagnostic preference: once per account, then at most every 15 minutes', () => {
  const f = sandbox();
  f.ctx.queueDiagnosticPreferenceRefresh();
  assert.deepEqual(f.calls, ['changed', 'support', 'pref']);
  for (let i = 0; i < 10; i++) { f.tick(60e3); f.ctx.queueDiagnosticPreferenceRefresh(); }
  assert.equal(f.calls.filter((c) => c === 'support').length, 1, 'ten SIGNED_IN events in ten minutes: no extra read');
  assert.equal(f.calls.filter((c) => c === 'changed').length, 11, 'local view still updated each time');
  f.tick(6 * 60e3); f.ctx.queueDiagnosticPreferenceRefresh();
  assert.equal(f.calls.filter((c) => c === 'support').length, 2, 'after 15 minutes it reads again');
  f.ctx.queueDiagnosticPreferenceRefresh(true);
  assert.equal(f.calls.at(-1), 'pref!', 'a forced refresh (reconnection, panel opened) always reads');
  f.ctx.lumenUser = { id: 'b' }; f.ctx.queueDiagnosticPreferenceRefresh();
  assert.equal(f.calls.filter((c) => c === 'support').length, 4, 'an account change always reads');
});

test('returning to the app refreshes social at most every 3 minutes per account', () => {
  const f = sandbox();
  f.ctx.refreshSocialOnFocus(); f.tick(30e3); f.ctx.refreshSocialOnFocus(); f.tick(60e3); f.ctx.refreshSocialOnFocus();
  assert.deepEqual(f.calls, ['social']);
  f.tick(3 * 60e3); f.ctx.refreshSocialOnFocus();
  assert.deepEqual(f.calls, ['social', 'social']);
  f.ctx.lumenUser = { id: 'b' }; f.ctx.refreshSocialOnFocus();
  assert.equal(f.calls.length, 3, 'another account reads immediately');
  assert.match(source, /document\.addEventListener\("visibilitychange",\(\)=>\{if\(document\.visibilityState==="hidden"\)\{pauseGameClock\(\);menuPause\.release\(\)\}else refreshSocialOnFocus\(\)\}\);/);
  assert.match(source, /onOpen:\(\)=>\{void refreshFriendsBadge\(\);void loadMyChallenges\(/, 'opening Social still reads immediately');
});
