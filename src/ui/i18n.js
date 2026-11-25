
import frPrivacy from './locales/fr/privacy.js';
import enPrivacy from './locales/en/privacy.js';
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
import frShell from './locales/fr/shell.js';
import enShell from './locales/en/shell.js';
import frSky from './locales/fr/sky.js';
import enSky from './locales/en/sky.js';
import frAccountFlow from './locales/fr/account-flow.js';
import enAccountFlow from './locales/en/account-flow.js';
import frStatus from './locales/fr/status.js';
import enStatus from './locales/en/status.js';
import frStore from './locales/fr/store.js';
import enStore from './locales/en/store.js';
import frMap from './locales/fr/map.js';
import enMap from './locales/en/map.js';
import frHints from './locales/fr/hints.js';
import enHints from './locales/en/hints.js';
import frDuel from './locales/fr/duel.js';
import enDuel from './locales/en/duel.js';
import frAdmin from './locales/fr/admin.js';
import enAdmin from './locales/en/admin.js';
import frCircles from './locales/fr/circles.js';
import frPlay from './locales/fr/play.js';
import enCircles from './locales/en/circles.js';
import enPlay from './locales/en/play.js';

import frConstellations from './locales/fr/constellations.js';
import enConstellations from './locales/en/constellations.js';

// #945: Spanish catalogue (fallback French). Disabled until the activation lot.
import esPrivacy from './locales/es/privacy.js';
import esDaily from './locales/es/daily.js';
import esResults from './locales/es/results.js';
import esBoard from './locales/es/board.js';
import esWelcome from './locales/es/welcome.js';
import esLearning from './locales/es/learning.js';
import esPwaWelcome from './locales/es/pwa-welcome.js';
import esSocial from './locales/es/social.js';
import esShell from './locales/es/shell.js';
import esSky from './locales/es/sky.js';
import esAccountFlow from './locales/es/account-flow.js';
import esStatus from './locales/es/status.js';
import esStore from './locales/es/store.js';
import esMap from './locales/es/map.js';
import esHints from './locales/es/hints.js';
import esDuel from './locales/es/duel.js';
import esAdmin from './locales/es/admin.js';
import esCircles from './locales/es/circles.js';
import esPlay from './locales/es/play.js';
import esConstellations from './locales/es/constellations.js';

const DEFAULT_LOCALE = 'fr';
const PREFERENCE_KEY = 'lumen.locale';
export const ACCOUNT_LOCALE_FIELD = 'lumen_locale';

export const locales = Object.freeze({
  fr: Object.freeze({ nativeName: 'Français', enabled: true, fallback: null, messages: Object.freeze({ ...frPrivacy, ...frDaily, ...frResults, ...frBoard, ...frWelcome, ...frLearning, ...frPwaWelcome, ...frSocial, ...frDuel, ...frAdmin, ...frCircles, ...frPlay, ...frHints, ...frConstellations, ...frMap, ...frStore, ...frStatus, ...frAccountFlow, ...frSky, ...frShell }) }),
  en: Object.freeze({ nativeName: 'English', enabled: true, fallback: 'fr', messages: Object.freeze({ ...enPrivacy, ...enDaily, ...enResults, ...enBoard, ...enWelcome, ...enLearning, ...enPwaWelcome, ...enSocial, ...enDuel, ...enAdmin, ...enCircles, ...enPlay, ...enHints, ...enConstellations, ...enMap, ...enStore, ...enStatus, ...enAccountFlow, ...enSky, ...enShell }) }),
  es: Object.freeze({ nativeName: 'Español', enabled: true, fallback: 'fr', messages: Object.freeze({ ...esPrivacy, ...esDaily, ...esResults, ...esBoard, ...esWelcome, ...esLearning, ...esPwaWelcome, ...esSocial, ...esDuel, ...esAdmin, ...esCircles, ...esPlay, ...esHints, ...esConstellations, ...esMap, ...esStore, ...esStatus, ...esAccountFlow, ...esSky, ...esShell }) }),
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
  registry = locales, storage, languages = [], language, appLanguage, initialOwner, clock = Date.now,
} = {}) {
  let guestMode = 'auto';
  let owner = initialOwner || null;
  const accounts = new Map();
  try {
    const saved = storage?.getItem(PREFERENCE_KEY);
    if (typeof saved === 'string' && saved) guestMode = saved;
  } catch {
    // Storage access can be unavailable in private browsing.
  }
  const automatic = [appLanguage, ...(languages.length ? languages : [language])]
    .map(candidate => matchLanguage(registry, candidate)).find(Boolean) ?? DEFAULT_LOCALE;

  function validMode(mode) {
    return typeof mode === 'string' && (mode === 'auto' || !!lookup(registry, mode)?.enabled);
  }

  function verifiedChoice(choice) {
    return validMode(choice?.mode) && Number.isSafeInteger(choice.at) && choice.at > 0
      ? { mode: choice.mode, at: choice.at }
      : null;
  }

  function account() {
    if (!accounts.has(owner)) {
      let stored;
      try { stored = JSON.parse(storage?.getItem(PREFERENCE_KEY + ':' + owner) ?? 'null'); } catch {}
      accounts.set(owner, { choice: verifiedChoice(stored?.choice), pending: stored?.pending === true });
    }
    return accounts.get(owner);
  }

  function save(entry) {
    try { storage?.setItem(PREFERENCE_KEY + ':' + owner, JSON.stringify(entry)); } catch {}
  }

  function currentMode() {
    return owner ? account().choice?.mode ?? guestMode : guestMode;
  }

  function currentLocale() {
    const mode = currentMode();
    if (mode === 'auto') return automatic;
    return lookup(registry, mode)?.enabled ? mode : DEFAULT_LOCALE;
  }

  return {
    get mode() { return currentMode(); },
    setAccount(user) {
      owner = user?.id ?? null;
      if (!owner || !user.user_metadata) return;
      const remote = verifiedChoice(user.user_metadata[ACCOUNT_LOCALE_FIELD]);
      const entry = account();
      if (!remote || remote.at < (entry.choice?.at ?? 0)) return;
      if (entry.pending || remote.at !== entry.choice?.at || remote.mode !== entry.choice?.mode) {
        entry.choice = remote;
        entry.pending = false;
        save(entry);
      }
    },
    pendingFor(ownerId) {
      if (!owner || owner !== ownerId) return null;
      const entry = account();
      return entry.pending ? entry.choice : null;
    },
    acknowledge(ownerId, choice) {
      if (owner !== ownerId || account().choice !== choice) return;
      const entry = account();
      if (!entry.pending) return;
      entry.pending = false;
      save(entry);
    },
    get locale() { return currentLocale(); },
    get options() {
      return Object.entries(registry).filter(([, entry]) => entry.enabled)
        .map(([code, { nativeName }]) => ({ code, nativeName }));
    },
    translator: () => createTranslator({ registry, locale: currentLocale() }),
    setMode(next) {
      if (!validMode(next)) return false;
      if (next === (owner ? account().choice?.mode : guestMode)) return true;
      if (owner) {
        const entry = account();
        entry.choice = { mode: next, at: Math.max(clock(), (entry.choice?.at ?? 0) + 1) };
        entry.pending = true;
        save(entry);
        return true;
      }
      guestMode = next;
      try {
        storage?.setItem(PREFERENCE_KEY, guestMode);
      } catch {
        // Keep the choice for the current session even when persistence fails.
      }
      return true;
    },
  };
}

export function browserLocalePreference({ storage, navigator, location, sessionStorage }) {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);
  const authReturn = ['lumen_confirm', 'code', 'token_hash'].some(key => query.has(key)) ||
    fragment.has('access_token');
  let appLanguage, initialOwner;
  try {
    if (fragment.has('lumen-app-language')) {
      appLanguage = fragment.get('lumen-app-language');
      sessionStorage?.setItem('lumenAppLanguage', appLanguage);
    } else {
      appLanguage = sessionStorage?.getItem('lumenAppLanguage');
    }
  } catch {}
  try {
    if (!authReturn && !query.has('qa') && sessionStorage?.getItem('lumenAccountSwitchHoldV1') !== '1') {
      const session = JSON.parse(storage?.getItem('sb-tjdjlavmusmncuszhsuw-auth-token') ?? 'null');
      const cachedOwner = storage?.getItem('lumenCloudOwnerId');
      if (cachedOwner && session?.user?.id === cachedOwner) initialOwner = cachedOwner;
    }
  } catch {}
  return createLocalePreference({
    storage, languages: navigator.languages, language: navigator.language, appLanguage, initialOwner,
  });
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
