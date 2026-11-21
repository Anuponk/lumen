// #921 · Player decisions use the in-game Lumen dialog, never the browser's
// native alert/confirm/prompt (« lumen.nopuna.fr indique »), in French and English.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createTranslator } from '../src/ui/i18n.js';

const sources = ['src/ui', 'src/game', 'src/campaign', 'src/persistence']
  .flatMap((dir) =>
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => path.join(dir, f)),
  )
  .concat(['index.html']);

test('no native alert, confirm or prompt dialog remains in the game', () => {
  const native = /(?:^|[^.\w])(?:window\.|globalThis\.)?(?:alert|confirm|prompt)\s*\(/;
  for (const file of sources) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '');
      // Method definitions/calls such as session.confirm() or p.prompt() are not dialogs.
      if (/(?:async\s+)?function\s+confirm\s*\(/.test(code)) return;
      assert.doesNotMatch(code, native, file + ':' + (i + 1));
    });
  }
});

test('every confirmation is wired to the shared Lumen dialog', () => {
  const source = fs.readFileSync('src/ui/game-screen.js', 'utf8');
  assert.match(source, /import \{createLumenDialog\} from '\.\/lumen-dialog\.js';/);
  assert.match(source, /lumenConfirm\(\)\.open\(\{title:t\("board\.resetTitle"\)/, 'grid reset');
  assert.match(
    source,
    /lumenConfirm\(\)\.open\(\{title:t\('social\.removeFriendTitle'/,
    'friend removal',
  );
  assert.match(source, /lumenConfirm\(\)\.open\(\{title:t\("admin\.qaResetTitle"\)/, 'QA reset');
  assert.match(source, /abandonDialog\.open\(\{title:model\.title/, 'abandon keeps its #908 model');
  // The reset applies only to the attempt that was on screen when it was asked.
  assert.match(
    source,
    /activeQuest\(\)\?\.id!==shownQuest\|\|attemptEngine\.snapshot\(\)\?\.attemptId!==shownAttempt\)return;resetBoardMarks\(\)/,
  );
  // Dialog buttons stay usable during the scripted lesson.
  assert.match(source, /#learningSkip,#lumenConfirm,#abandonConfirm[^"]*"\)\)return;/);
});

test('dialog copy is warm, explicit and translated in French and English', () => {
  const fr = createTranslator({ locale: 'fr' }).t,
    en = createTranslator({ locale: 'en' }).t;
  const keys = [
    'board.resetTitle',
    'board.resetCopy',
    'board.resetKeep',
    'board.resetYes',
    'social.removeFriendTitle',
    'social.removeFriendCopy',
    'social.removeFriendKeep',
    'social.removeFriendYes',
    'admin.qaResetTitle',
    'admin.qaResetCopy',
    'admin.qaResetKeep',
    'admin.qaResetYes',
  ];
  for (const key of keys) {
    assert.notEqual(fr(key), key, key + ' FR');
    assert.notEqual(en(key), key, key + ' EN');
    assert.notEqual(fr(key), en(key), key + ' is really translated');
  }
  assert.equal(fr('board.resetTitle'), 'Recommencer la grille ?');
  assert.equal(fr('board.resetKeep'), 'Continuer à jouer');
  assert.equal(fr('board.resetYes'), 'Recommencer');
  // The consequence is never hidden: time, aids and mistakes keep counting.
  assert.match(fr('board.resetCopy'), /chrono continuera.*aides ou erreurs déjà comptées/);
  assert.match(en('board.resetCopy'), /timer keeps running.*hints or mistakes already counted/);
  assert.equal(fr('social.removeFriendTitle', { name: 'Véga' }), 'Retirer Véga de tes amis ?');
  assert.equal(en('social.removeFriendTitle', { name: 'Vega' }), 'Remove Vega from your friends?');
  assert.doesNotMatch(
    fr('board.resetCopy') + fr('social.removeFriendCopy'),
    /indique|Error|Erreur/,
  );
});

test('the shared dialog keeps the safe choice by default and is reachable by keyboard and Back', () => {
  const component = fs.readFileSync('src/ui/lumen-dialog.js', 'utf8');
  assert.match(component, /no\.focus\(\{ preventScroll: true \}\);/, 'cancel has initial focus');
  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /event\.key !== 'Tab'/);
  assert.match(component, /history\.pushState\(\{ \.\.\.state, lumenDialog: token \}/);
  assert.match(component, /addEventListener\('popstate'/);
  const html = fs.readFileSync('index.html', 'utf8');
  for (const id of ['lumenConfirm', 'abandonConfirm']) {
    const tag = html.match(new RegExp('<div id="' + id + '"[^>]*>'))?.[0] || '';
    assert.match(tag, /role="alertdialog"/, id);
    assert.match(tag, /aria-modal="true"/, id);
    assert.match(tag, /aria-labelledby="\w+Title"/, id);
    assert.match(tag, /aria-describedby="\w+Copy"/, id);
  }
});
