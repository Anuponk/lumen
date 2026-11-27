import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogueIssues, inventoryHashes, newlyVisible, translationDigest, visibleCandidates,seasonalCatalogueIssues } from './i18n-audit.mjs';
import {SEASONAL_EVENTS,DAILY_NAMES} from '../src/campaign/seasonal-events.js';

test('native seasonal catalogue requires FR/EN/ES, exact keys and placeholder parity',()=>{
 assert.deepEqual(seasonalCatalogueIssues(),[]);
 const missing=structuredClone(SEASONAL_EVENTS);delete missing[0].labels.es;
 assert.match(seasonalCatalogueIssues(missing).join(','),/incomplete es/);
 const bad=structuredClone(SEASONAL_EVENTS);bad[0].labels.en.day='Day {wrong}';
 assert.match(seasonalCatalogueIssues(bad).join(','),/invalid en.day/);
 assert.ok(seasonalCatalogueIssues(SEASONAL_EVENTS,{fr:DAILY_NAMES.fr,en:DAILY_NAMES.en}).length);
});

test('the game shell catches copy and accessible labels while allowing keyed HTML fallbacks', () => {
  const source = '<button title="Fermer">OK</button><span data-game-text="menu.save">Enregistrer</span><img alt="Board marker"><p aria-label="Raw name" data-game-label="menu.label">✦</p>';
  assert.deepEqual(visibleCandidates(source, 'index.html'), ['Fermer', 'OK', 'Board marker']);
});

test('new text and repeated debt both require migration', () => {
  const before = 'node.textContent = "Fermer"; node.textContent = t("shell.close"); console.debug("Technical detail");';
  const after = before + ' node.title = "Fermer"; node.innerHTML = "<button aria-label=\'Close help\'>Close</button>";';
  const baseline = inventoryHashes({ 'src/ui/test.js': visibleCandidates(before, 'test.js') });
  assert.deepEqual(newlyVisible({ 'src/ui/test.js': visibleCandidates(after, 'test.js') }, baseline).map(x => x.copy), ['Fermer', 'Close help', 'Close']);
});

test('text candidates keep their owning function even inside an HTML assignment', () => {
  const source = `function migrated() {
    const result = { title: "Même ligne" };
    element.innerHTML = '<span aria-label="Gardien tenté"></span>';
    element.textContent = t("guided.rowCopy");
  }
  function legacy() { element.textContent = "Même ligne"; }`;
  const located = [];
  const references = [];
  visibleCandidates(source, 'test.js', key => references.push(key), (copy, scope) => located.push([scope, copy]));
  assert.deepEqual(located, [
    ['migrated', 'Même ligne'], ['migrated', 'Gardien tenté'], ['legacy', 'Même ligne'],
  ]);
  assert.deepEqual(references, ['guided.rowCopy']);
});

test('a French edit requires review and each plural preserves its parameters', () => {
  const fr = { reward: { one: '{count} étoile', other: '{count} étoiles' } };
  const en = { reward: { one: '{count} star', other: '{count} stars' } };
  const revision = { reward: translationDigest(fr.reward, en.reward) };
  assert.deepEqual(catalogueIssues(fr, en, revision), []);
  const changed = { reward: { ...fr.reward, one: '{count} nouvelle étoile' } };
  assert.deepEqual(catalogueIssues(changed, en, revision), ['reward · traduction à relire']);
  assert(catalogueIssues(fr, { reward: { other: '{total} stars' } }, revision).includes('reward · variables incompatibles'));
  assert(catalogueIssues(fr, {}, revision).includes('reward · clé manquante dans un catalogue'));
});

test('message references can be verified independently of the language of fallback copy', () => {
  const references = [];
  for (const [file, source] of [
    ['index.html', '<p data-game-text="board.start" title="Play" data-game-title="board.play">Jouer</p><input placeholder="Ton pseudo" data-game-placeholder="account.nickname">'],
    ['test.js', 'el.textContent = t("board.start");'],
  ]) assert.deepEqual(visibleCandidates(source, file, key => references.push(key)), []);
  assert.deepEqual(references, ['board.start', 'board.play', 'account.nickname', 'board.start']);
});
