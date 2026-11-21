import { locales } from './i18n.js';

export function adventureDisplayName(pack, t) {
  const key = 'adventure.' + pack?.id;
  return Object.hasOwn(locales.fr.messages, key) ? t(key) : pack?.displayName;
}
