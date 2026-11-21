
import frDaily from './locales/fr/daily.js';
import enDaily from './locales/en/daily.js';
import frResults from './locales/fr/results.js';
import enResults from './locales/en/results.js';
import frBoard from './locales/fr/board.js';
import enBoard from './locales/en/board.js';
import frWelcome from './locales/fr/welcome.js';
import enWelcome from './locales/en/welcome.js';
import frLearning from './locales/fr/learning.js';
import enLearning from './locales/en/learning.js';
import frPwaWelcome from './locales/fr/pwa-welcome.js';
import enPwaWelcome from './locales/en/pwa-welcome.js';
import frSocial from './locales/fr/social.js';
import enSocial from './locales/en/social.js';

const DEFAULT_LOCALE = 'fr';
const PREFERENCE_KEY = 'lumen.locale';

export const locales = Object.freeze({
  fr: Object.freeze({ nativeName: 'Français', enabled: true, fallback: null, messages: Object.freeze({ ...frDaily, ...frResults, ...frBoard, ...frWelcome, ...frLearning, ...frPwaWelcome, ...frSocial }) }),
  en: Object.freeze({ nativeName: 'English', enabled: true, fallback: 'fr', messages: Object.freeze({ ...enDaily, ...enResults, ...enBoard, ...enWelcome, ...enLearning, ...enPwaWelcome, ...enSocial }) }),
});

function lookup(registry, locale) {
  return Object.hasOwn(registry, locale) ? registry[locale] : undefined;
}

function matchLanguage(registry, language) {
  if (typeof language !== 'string') return undefined;
  try {
    const locale = new Intl.Locale(language);
    return [locale.baseName, locale.language].find(candidate => lookup(registry, candidate)?.enabled);
  } catch {
    return undefined;
  }
}

export function createLocalePreference({
  registry = locales, storage, languages = [], language, appLanguage,
} = {}) {
  let mode = 'auto';
  try {
    const saved = storage?.getItem(PREFERENCE_KEY);
    if (typeof saved === 'string' && saved) mode = saved;
  } catch {
    // Storage access can be unavailable in private browsing.
  }
  const automatic = [appLanguage, ...(languages.length ? languages : [language])]
    .map(candidate => matchLanguage(registry, candidate)).find(Boolean) ?? DEFAULT_LOCALE;

  function currentLocale() {
    if (mode === 'auto') return automatic;
    return lookup(registry, mode)?.enabled ? mode : DEFAULT_LOCALE;
  }

  return {
    get mode() { return mode; },
    get locale() { return currentLocale(); },
    get options() {
      return Object.entries(registry).filter(([, entry]) => entry.enabled)
        .map(([code, { nativeName }]) => ({ code, nativeName }));
    },
    translator: () => createTranslator({ registry, locale: currentLocale() }),
    setMode(next) {
      if (next !== 'auto' && !lookup(registry, next)?.enabled) return false;
      mode = next;
      try {
        storage?.setItem(PREFERENCE_KEY, mode);
      } catch {
        // Keep the choice for the current session even when persistence fails.
      }
      return true;
    },
  };
}

export function createTranslator({
  registry = locales, locale = DEFAULT_LOCALE,
  onMissing = (code, key) => console.warn('Missing Lumen translation', code, key),
} = {}) {
  const selected = matchLanguage(registry, locale) ?? DEFAULT_LOCALE;
  const formats = new Intl.NumberFormat(selected);
  const fallbackChain = new Set();
  for (let code = selected; code && !fallbackChain.has(code); code = lookup(registry, code)?.fallback) {
    fallbackChain.add(code);
  }
  fallbackChain.add(DEFAULT_LOCALE);

  function t(key, params = {}, { type = "cardinal" } = {}) {
    for (const code of fallbackChain) {
      const messages = lookup(registry, code)?.messages;
      if (!messages || !Object.hasOwn(messages, key)) continue;
      const entry = messages[key];
      const pattern = typeof entry === 'string' ? entry :
        (entry[new Intl.PluralRules(code, { type }).select(params.count)] ?? entry.other);
      if (!pattern) continue;
      if (code !== selected) onMissing(selected, key);
      return pattern.replace(/\{(\w+)\}/g, (_, name) => {
        if (!Object.hasOwn(params, name)) return '';
        const value = params[name];
        return typeof value === 'number' ? formats.format(value) : String(value ?? '');
      });
    }
    onMissing(selected, key);
    return '';
  }

  return {
    t,
    number: (value, options) => new Intl.NumberFormat(selected, options).format(value),
    date: (value, options) => new Intl.DateTimeFormat(selected, options).format(value),
  };
}
