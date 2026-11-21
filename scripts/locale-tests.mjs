
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalePreference, createTranslator, locales } from '../src/ui/i18n.js';
import fr from '../src/ui/locales/fr/welcome.js';
import en from '../src/ui/locales/en/welcome.js';

const de = {
  nativeName: 'Deutsch',
  enabled: true,
  fallback: 'fr',
  messages: { 'welcome.skip': 'Überspringen' },
};
const registry = { ...locales, 'de-DE': de };
const names = {
  fr: { players: { one: '{count} joueur : {name}', other: '{count} joueurs : {name}' } },
  en: { players: { one: '{count} player: {name}', other: '{count} players: {name}' } },
};
const messages = {
  fr: { ...locales.fr, messages: names.fr },
  en: { ...locales.en, messages: names.en },
  'de-DE': { ...de, messages: {} },
};

test('automatic locale follows ordered preferences, exact tags, base languages and French fallback', () => {
  const preference = (languages, language, appLanguage) =>
    createLocalePreference({ languages, language, appLanguage }).locale;
  assert.equal(preference(['de-DE', 'en-GB', 'fr-FR']), 'en');
  assert.equal(preference(['fr-CA', 'en-US']), 'fr');
  assert.equal(preference(['de-DE'], 'en-US'), 'fr');
  assert.equal(preference([], 'en-US'), 'en');
  assert.equal(preference(['en-US'], 'en-US', 'fr-CA'), 'fr');
  assert.equal(preference(['en-US'], 'en-US', 'de-DE'), 'en');
  assert.equal(preference(['bad_tag']), 'fr');
  const thirdLocale = createLocalePreference({ registry, languages: ['DE-de'] });
  assert.equal(thirdLocale.locale, 'de-DE');
  assert.deepEqual(thirdLocale.options.at(-1), { code: 'de-DE', nativeName: 'Deutsch' });
  assert.equal(thirdLocale.translator().t('welcome.skip'), 'Überspringen');
  thirdLocale.setMode('en');
  assert.equal(thirdLocale.translator().t('welcome.skip'), en['welcome.skip']);
  assert.equal(createLocalePreference({ registry: { ...registry, 'de-DE': { ...de, enabled: false } }, languages: ['de-DE'] }).locale, 'fr');
});

test('explicit preferences survive reload while automatic mode is resolved per device', () => {
  const device = new Map([
    ['lumenProgressV1', 'progress'],
    ['lumenActiveAttemptV1', 'attempt'],
  ]);
  const storage = { getItem: key => device.get(key), setItem: (key, value) => device.set(key, value) };
  const first = createLocalePreference({ storage, languages: ['en-GB'] });
  assert.equal(first.mode, 'auto');
  assert.equal(device.size, 2, 'detection leaves storage untouched');
  assert.equal(first.setMode('fr'), true);
  const next = createLocalePreference({ storage, languages: ['en-US'], appLanguage: 'en-US' });
  assert.equal(next.mode, 'fr');
  assert.equal(next.locale, 'fr');
  assert.equal(next.setMode('de-DE'), false);
  assert.equal(next.locale, 'fr');
  assert.equal(next.setMode('auto'), true);
  assert.equal(next.locale, 'en');
  assert.equal(createLocalePreference({ storage, languages: ['fr'], appLanguage: 'fr' }).locale, 'fr');
  assert.deepEqual([...device.values()], ['progress', 'attempt', 'auto']);
  next.setMode('en');
  assert.equal(createLocalePreference({
    storage, registry: { ...locales, en: { ...locales.en, enabled: false } },
  }).locale, 'fr');
});

test('restricted preference storage keeps the running instance usable', () => {
  const denied = () => { throw Error('Storage unavailable'); };
  const preference = createLocalePreference({
    storage: { getItem: denied, setItem: denied },
    languages: ['en'],
  });
  assert.equal(preference.locale, 'en');
  assert.equal(preference.setMode('fr'), true);
  assert.equal(preference.locale, 'fr');
});

test('the welcome catalogues have matching semantic keys and placeholders', () => {
  const source = readFileSync(new URL('../src/ui/first-welcome.js', import.meta.url), 'utf8');
  const used = [...new Set(source.match(/welcome\.[a-zA-Z]+(?=')/g))].sort();
  assert.deepEqual(Object.keys(fr).sort(), used);
  assert.deepEqual(Object.keys(en).sort(), used);
  const tokens = text => (text.match(/\{\w+\}/g) ?? []).sort();
  for (const key of Object.keys(fr)) {
    assert.ok(fr[key].trim() && en[key].trim(), key);
    assert.deepEqual(tokens(fr[key]), tokens(en[key]), key);
  }
});

test('a partial third language falls back and reports missing copy without exposing keys', () => {
  const misses = [];
  const { t } = createTranslator({ registry, locale: 'de-DE', onMissing: (...args) => misses.push(args) });
  assert.equal(t('welcome.skip'), 'Überspringen');
  assert.equal(t('welcome.skipLabel'), fr['welcome.skipLabel']);
  assert.equal(t('welcome.unknown'), '');
  assert.equal(t('toString'), '');
  assert.deepEqual(misses, [
    ['de-DE', 'welcome.skipLabel'], ['de-DE', 'welcome.unknown'], ['de-DE', 'toString'],
  ]);
});

test('plural grammar follows the source of fallback copy and values are formatted in the requested locale', () => {
  const french = createTranslator({ registry: messages, locale: 'fr' });
  const english = createTranslator({ registry: messages, locale: 'en' });
  const german = createTranslator({ registry: messages, locale: 'de-DE', onMissing() {} });
  assert.equal(french.t('players', { count: 0, name: 'Guardian {count}' }), '0 joueur : Guardian {count}');
  assert.equal(english.t('players', { count: 0, name: 'Gardien' }), '0 players: Gardien');
  assert.equal(english.t('players', { count: 1234, name: 'Gardien' }), '1,234 players: Gardien');
  assert.equal(german.t('players', { count: 0, name: 'Gardien' }), '0 joueur : Gardien');
  assert.equal(german.t('players', { count: 1234, name: 'Gardien' }), '1.234 joueurs : Gardien');
  assert.equal(english.number(1.25, { style: 'currency', currency: 'EUR' }), '€1.25');
  assert.equal(english.number(2, { style: 'unit', unit: 'second', unitDisplay: 'long' }), '2 seconds');
  assert.equal(french.date(new Date('2026-11-20T12:00:00Z'), { month: 'long', timeZone: 'UTC' }), 'novembre');
});
