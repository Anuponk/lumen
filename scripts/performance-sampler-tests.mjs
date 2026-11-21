import assert from 'node:assert/strict';
import { createPerformanceSampler } from '../src/analytics/performance-sampler.js';

const observers = new Map();
const timers = new Map();
const frames = new Map();
const sent = [];
let time = 100;
let sequence = 0;
let owner = { enabled: false, userId: 'player', client: {}, version: '1.11.1+743 · aabbccd' };
const env = {
  document: { hidden: false },
  performance: { now: () => time, getEntriesByType: () => [{ domInteractive: 902 }] },
  PerformanceObserver: class {
    constructor(callback) { this.callback = callback; }
    observe({ type }) { this.type = type; observers.set(type, this); }
    disconnect() { observers.delete(this.type); }
  },
  setTimeout(callback, ms) {
    assert.equal(ms, 120_000);
    timers.set(++sequence, callback);
    return sequence;
  },
  clearTimeout(id) { timers.delete(id); },
  requestAnimationFrame(callback) { frames.set(++sequence, callback); return sequence; },
  cancelAnimationFrame(id) { frames.delete(id); },
};
const sampler = createPerformanceSampler({
  env, context: () => owner, send: (...args) => sent.push(args), origin: 'https://backend.example', random: () => 0,
});
sampler.refresh();
assert.equal(observers.size, 0);
owner = { ...owner, enabled: true };
sampler.refresh();
sampler.refresh();
assert.equal(observers.size, 3);
assert.equal(timers.size, 1);
const runMark = sampler.start();
time += 27;
sampler.end(runMark, 'grid_render');
function emit(type, entries) {
  observers.get(type).callback({ getEntries: () => entries });
}
emit('resource', [
  { name: 'https://backend.example/rest/v1/rpc/lumen_cas_profile?secret=1', duration: 54 },
  { name: 'https://other.example/rest/v1/rpc/lumen_cas_profile', duration: 900 },
  { name: 'https://backend.example/rest/v1/private', duration: 200 },
]);
emit('event', [
  { target: { closest: () => null }, duration: 200 },
  { target: { closest: selector => selector === '#board' }, duration: 17 },
]);
env.document.hidden = true;
emit('longtask', [{ duration: 900 }]);
env.document.hidden = false;
sampler.victory();
sampler.victory();
let tickCount = 0;
while (frames.size) {
  const [id, frame] = frames.entries().next().value;
  frames.delete(id);
  assert.ok(++tickCount <= 21);
  frame(tickCount * 18);
}
assert.equal(tickCount, 21);
timers.values().next().value();
await Promise.resolve();
assert.deepEqual(sent[0].slice(1), ['1.11.1+743', {
  load: 900, grid_render: 25, sync_rpc: 55, grid_input: 15, victory_gap: 20,
}]);
sampler.refresh();
assert.equal(sent.length, 1);
assert.equal(observers.size, 0);
assert.equal(timers.size, 0);
const switched = createPerformanceSampler({
  env, context: () => owner, send: () => assert.fail('old owner submitted'), random: () => 0,
});
switched.refresh();
switched.victory();
owner = { ...owner, userId: 'other-player', enabled: false };
switched.refresh();
assert.equal(observers.size, 0);
assert.equal(timers.size, 0);
assert.equal(frames.size, 0);
console.log('Performance sampler contracts passed');
