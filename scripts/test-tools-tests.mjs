// Test aids and diagnostics: #705 admin mastery preview, #711 hydration telemetry.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { functionSource } from './source-tools.mjs';

const source = fs.readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
function previewContext(overrides = {}) {
  const nodes = new Map(), node = (id) => { if (!nodes.has(id)) nodes.set(id, { id, hidden: false, focus() {} }); return nodes.get(id); };
  const seen = [];
  const ctx = {
    activeQuest: () => ({ id: 'q-last', packId: 'pack-1' }), celebrated: false, pendingVictoryView: null, lumenUser: { id: 'u' }, lumenProgress: { xp: 1 },
    celestialPending: null, captureCelestialProgress: () => ({ adventure: { completed: 10, total: 10 } }), canonicalQuestList: () => [],
    showCelestialVictory: () => { seen.push({ pending: ctx.celestialPending, shareHidden: node('successShare').hidden }); return true; },
    celestialCelebration: { clear() {} }, console, document: { getElementById: node }, ...overrides,
  };
  vm.createContext(ctx);
  vm.runInContext(functionSource(source, 'previewAdventureMastery'), ctx);
  return { ctx, node, seen };
}

test('#705: the admin preview opens the real adventure-mastery celebration without offering a challenge', () => {
  const { ctx, node, seen } = previewContext();
  assert.equal(ctx.previewAdventureMastery(), true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].pending.kind, 'adventure-mastery');
  assert.equal(seen[0].pending.quest.id, 'q-last');
  assert.equal(seen[0].shareHidden, true, 'No challenge is offered from a preview');
  assert.equal(node('successShare').hidden, false, 'The share button state is restored');
  assert.equal(node('skyReveal').hidden, false);
  assert.equal(JSON.stringify(ctx.lumenProgress), '{"xp":1}', 'Nothing is written');
});

test('#705: no preview during a victory, a pending victory or outside an adventure', () => {
  for (const overrides of [{ celebrated: true }, { pendingVictoryView: { operationId: 'x' } }, { activeQuest: () => ({ id: 'q' }) }]) {
    const { ctx, seen } = previewContext(overrides);
    assert.equal(ctx.previewAdventureMastery(), false, JSON.stringify(overrides));
    assert.equal(seen.length, 0);
  }
});

test('#705: the preview is reachable only from the admin cockpit capability', () => {
  assert.match(source, /if\(!hasInternalCapability\('analytics_cockpit'\)\)return;\s*const status=document\.getElementById\('adminPreviewStatus'\)/);
});

test('#711: a failed hydration reports its fine reason and stage, never free text', () => {
  assert.match(source, /const reason=failed&&typeof details\.detail==="string"&&details\.detail!=="unknown"\?details\.detail\.slice\(0,64\)/);
  assert.match(source, /failed&&typeof details\.stage==="string"\?details\.stage\.slice\(0,48\)/);
});
