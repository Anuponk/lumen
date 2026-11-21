import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import { readFileSync } from 'node:fs';

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTranslator, locales } from '../src/ui/i18n.js';
import { learningStep, learningAllows, dragLearningStep } from '../src/game/learning.js';
import { learningIntro, learningCopy } from '../src/ui/learning-copy.js';

const englishMissing = [];
const { t } = createTranslator({ locale: 'en', onMissing: (_, key) => englishMissing.push(key) });

test('English pre-action lessons preserve the teaching sequence and four rules', () => {
  const steps = learningIntro(t);
  assert.deepEqual(steps.map(step => step.title), [
    'Look at the board', 'Your goal', 'One per territory', 'One per row and per column',
    'Keep them apart', 'How to play',
  ]);
  assert.match(steps[2].copy, /exactly one Guardian/);
  assert.match(steps[3].copy, /each row.+each column/i);
  assert.match(steps[4].copy, /even diagonally/);
  assert.match(steps[5].copy, /first tap.+second tap/i);
  assert.deepEqual(englishMissing, []);
});

test('English coach describes the actual allowed Guardian and drag targets', () => {
  const puzzle = { learnOrder: [[1, 1]], reg: [[0, 0], [0, 1]] };
  const board = [[0, 0], [0, 0]];
  let step = learningStep(puzzle, board);
  assert.equal(learningAllows(step, 1, 1), true);
  assert.equal(learningAllows(step, 0, 0), false);
  assert.match(learningCopy(step, board, true, t).copy, /tap it twice/i);
  board[1][1] = 1;
  assert.match(learningCopy(step, board, true, t).copy, /tap it again/i);
  board[1][1] = 2;
  step = learningStep(puzzle, board);
  assert.equal(step.phase, 'row');
  assert.match(learningCopy(step, board, true, t).title, /per row/);
  const dragBoard = [[2, 0], [0, 0]];
  const drag = dragLearningStep(puzzle, dragBoard);
  assert.deepEqual(drag.cells, [[0, 1]]);
  assert.match(learningCopy(drag, dragBoard, true, t).copy, /finger/i);
  assert.match(learningCopy(drag, dragBoard, false, t).copy, /mouse button/i);
  assert.deepEqual(board, [[0, 0], [0, 2]]);
  assert.deepEqual(englishMissing, []);
});

test('onboarding domains have French and English parity', () => {
  const keys = catalog => Object.keys(catalog).filter(key => /^(learning|pwaWelcome)\./.test(key)).sort();
  const fr = keys(locales.fr.messages), en = keys(locales.en.messages);
  assert(fr.length > 0);
  assert.deepEqual(fr, en);
  const tokens = text => (text.match(/\{\w+\}/g) ?? []).sort();
  for (const key of fr) {
    assert(locales.fr.messages[key].trim() && locales.en.messages[key].trim(), key);
    assert.deepEqual(tokens(locales.fr.messages[key]), tokens(locales.en.messages[key]), key);
  }
});

test('board controls and help share French fallback text and English coverage', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
  const keys = catalog => Object.keys(catalog).filter(key => /^(board|rules)\./.test(key)).sort();
  const renderedKeys = new Set([...html.matchAll(/data-game-(?:text|label|title)="([^"]+)"/g),
    ...source.matchAll(/"(board\.[\w]+)"/g)].map(match => match[1]));
  assert.deepEqual(keys(locales.fr.messages), [...renderedKeys].sort());
  assert.deepEqual(keys(locales.en.messages), keys(locales.fr.messages));
  const tokens = text => (text.match(/\{\w+\}/g) ?? []).sort();
  for (const key of renderedKeys) {
    const fr = locales.fr.messages[key], en = locales.en.messages[key];
    const reference = typeof fr === 'string' ? fr : fr.other;
    for (const entry of [fr, en]) {
      for (const copy of typeof entry === 'string' ? [entry] : Object.values(entry)) {
        assert(copy.trim(), key);
        assert.deepEqual(tokens(copy), tokens(reference), key);
      }
    }
  }
  assert.equal(t('board.territory', { number: 3 }), 'Territory 3');
  assert.match(t('rules.time'), /15 seconds per hint and 5 seconds per check/);
  assert.deepEqual(englishMissing, []);
});

test('verification explains a mixed set of mistakes with locale-aware plurals', () => {
  const source = readFileSync(new URL('../src/ui/game-screen.js', import.meta.url), 'utf8');
  const check = functionSource(source, 'verificationErrorCopy');
  const errors = [{kind:'guardian'}, {kind:'exclusion'}, {kind:'exclusion'}];
  const english = vm.runInNewContext(check + '\nverificationErrorCopy(errors)', {t, errors});
  const french = vm.runInNewContext(check + '\nverificationErrorCopy(errors)', {t:createTranslator().t, errors});
  assert.equal(english, '3 incorrect marks found. 1 misplaced Guardian. 2 cells incorrectly ruled out.');
  assert.equal(french, '3 choix incorrects détectés. 1 Gardien mal placé. 2 cases écartées à tort.');
});
