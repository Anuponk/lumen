// #945 · Spanish catalogue: complete, faithful to the French reference
// (keys, placeholders, plurals), Spanish punctuation, no French leftovers, and
// French/English unchanged. Lot B (#945) enables it in the selector.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { locales, createTranslator } from '../src/ui/i18n.js';

const fr = locales.fr.messages,
  en = locales.en.messages,
  es = locales.es.messages;
const text = (v) => (typeof v === 'string' ? v : Object.values(v).join(' '));
const placeholders = (v) => [...new Set(text(v).match(/\{\w+\}/g) || [])].sort().join(',');
// Units, symbols and words spelled the same in both languages.
const SAME_AS_FRENCH = new Set([
  // Chantier E / #974: product names, units and a pure placeholder layout.
  'admin.players.column.web',
  'admin.players.column.android',
  'admin.summary.checkValue',
  'groupRanking.points',
  'daily.minutes',
  'daily.hoursMinutes',
  'results.victory.xp',
  'board.gridDifficulty',
  'duel.versus',
  'duel.secondsShort',
  'admin.engagement.qa',
  'admin.engagement.channel',
  'fact.areaValue',
  'fact.directorySourcesFor',
  'map.available',
  'sky.adventureStatus',
  'success.rateFrustrating',
]);

test('every French key has a Spanish translation, and nothing more', () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(fr).sort());
  assert(Object.keys(es).length >= 1387);
  for (const dir of ['fr', 'es'])
    assert.deepEqual(
      fs.readdirSync('src/ui/locales/es').sort(),
      fs.readdirSync('src/ui/locales/' + dir).sort(),
      'one Spanish file per domain',
    );
});

test('placeholders and plural shapes are preserved', () => {
  for (const key of Object.keys(fr)) {
    assert.equal(typeof es[key], typeof fr[key], key + ' shape');
    assert.equal(placeholders(es[key]), placeholders(fr[key]), key + ' placeholders');
    if (typeof fr[key] === 'object')
      assert(typeof es[key].other === 'string' && es[key].other.trim(), key + ' plural other');
    assert(text(es[key]).trim(), key + ' not empty');
  }
  // Plurals and ordinals render through Intl for Spanish.
  const { t } = createTranslator({
    registry: { ...locales, es: { ...locales.es, enabled: true } },
    locale: 'es',
  });
  assert.equal(t('duel.participants', { count: 1 }), '1 participante');
  assert.equal(t('duel.participants', { count: 3 }), '3 participantes');
  assert.equal(t('ranking.ordinal', { count: 1 }, { type: 'ordinal' }), '1.º');
  assert.equal(t('board.checkGuardians', { count: 2 }), '2 Guardianes mal colocados.');
});

test('Spanish punctuation and no French or technical leftovers', () => {
  for (const [key, value] of Object.entries(es)) {
    const v = text(value);
    if (v.includes('?')) assert(v.includes('¿'), key + ' needs ¿');
    if (v.includes('!')) assert(v.includes('¡'), key + ' needs ¡');
    assert.doesNotMatch(
      v,
      /\b(?:quête|quêtes|défi|défis|avec|pour|toujours|vous|ton|tes|réessaie|joueur|joueurs|grille|aujourd)\b/i,
      key + ' French leftover',
    );
    assert.doesNotMatch(v, /^[a-z]+(?:\.[a-zA-Z]+)+$/, key + ' looks like a raw key');
    if (!SAME_AS_FRENCH.has(key))
      assert.notEqual(text(value), text(fr[key]), key + ' left untranslated');
  }
});

test('glossary terms are used consistently', () => {
  const all = Object.values(es).map(text).join('\n');
  for (const word of [
    'Guardián',
    'Guardianes',
    'misión',
    'Mi cielo',
    'Reto del día',
    'Autonomía',
    'Rapidez',
    'Sin errores',
    'Maestría',
  ])
    assert(all.includes(word), 'glossary: ' + word);
  for (const wrong of ['Guardian ', 'Desafío del día', 'Insignia Velocidad'])
    assert(!all.includes(wrong), 'avoid: ' + wrong);
  // Protocol values are never translated (server expects them verbatim).
  assert.match(es['account.deleteType'], /SUPPRIMER/);
});

test('French and English are unchanged and Spanish is offered in the selector', () => {
  assert.equal(locales.es.enabled, true, 'Lot B: Spanish is selectable and auto-detected');
  assert.equal(locales.es.fallback, 'fr');
  assert.equal(locales.fr.messages['board.ready'], 'Touchez la grille pour commencer');
  assert.equal(en['board.ready'], 'Tap the board to begin');
});
