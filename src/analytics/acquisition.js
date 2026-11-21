// #933: the discovery page follows the language Lumen is displayed in (the
// player's manual choice or its automatic resolution, never the raw browser
// language). English → discover.html; French and any other language → the
// French page, French being the app's default locale (DEFAULT_LOCALE, #754).
export const DISCOVERY_PAGES = Object.freeze({
  fr: 'https://lumen.nopuna.fr/decouvrir.html',
  en: 'https://lumen.nopuna.fr/discover.html',
});
export function discoveryUrlFor(locale) {
  const language = String(locale || '').toLowerCase().split(/[-_]/)[0];
  return Object.hasOwn(DISCOVERY_PAGES, language) ? DISCOVERY_PAGES[language] : DISCOVERY_PAGES.fr;
}
export function isDiscoveryUrl(url) {
  try {
    const { origin, pathname } = new URL(url);
    return Object.values(DISCOVERY_PAGES).some(page => {
      const known = new URL(page);
      return known.origin === origin && known.pathname === pathname;
    });
  } catch {
    return false;
  }
}

const campaignMedia = new Map([
  ['player_share', 'referral'],
  ['player_invite', 'referral'],
  ['youtube_shorts', 'social'],
  ['instagram_reels', 'social'],
  ['tiktok', 'social'],
]);

// Partager (result) and Inviter (discovery) keep distinct public campaign codes
// so the funnel can tell them apart (#881 Lot 1). Copy keeps the canonical URL.
// The campaign always replaces any query: one utm_source, one utm_medium.
export function campaignUrl(page, source) {
  const url = new URL(page);
  url.search = '';
  url.hash = '';
  url.searchParams.set('utm_source', source);
  url.searchParams.set('utm_medium', campaignMedia.get(source));
  return url.href;
}
export const playerShareUrlFor = locale => campaignUrl(discoveryUrlFor(locale), 'player_share');
export const inviteShareUrlFor = locale => campaignUrl(discoveryUrlFor(locale), 'player_invite');
// French defaults, kept for existing callers and tests.
export const discoveryUrl = DISCOVERY_PAGES.fr;
export const playerShareUrl = playerShareUrlFor('fr');
export const inviteShareUrl = inviteShareUrlFor('fr');

// Défier: a recipient leaving the challenge ("Continuer sur Lumen" / "Retour à
// Lumen") opens the game with the same-origin challenge link as referrer. Only
// the channel name is reported, never the opaque challenge ID.
function challengeReferrer(location, source) {
  return source.pathname === '/' && source.searchParams.has('challenge') &&
    !new URLSearchParams(location.search || '').has('challenge');
}

export function readDiscoveryCampaign(location, referrer) {
  if (location?.pathname !== '/' || !referrer) return null;
  try {
    const source = new URL(referrer);
    if (source.origin !== location.origin) return null;
    if (challengeReferrer(location, source)) return 'challenge_link';
    if (source.pathname !== '/decouvrir.html' && source.pathname !== '/discover.html') return null;
    const [channel, ...otherChannels] = source.searchParams.getAll('utm_source');
    const [medium, ...otherMedia] = source.searchParams.getAll('utm_medium');
    if (!campaignMedia.has(channel) || campaignMedia.get(channel) !== medium) return null;
    return otherChannels.length || otherMedia.length ? null : channel;
  } catch {
    return null;
  }
}

export function isAcquisitionQuestEvent(name, properties) {
  if (properties.quest_ordinal !== 1 || properties.attempt_mode !== 'campaign') return false;
  return name === 'attempt_started' ||
    (name === 'attempt_completed' && properties.outcome === 'success' && properties.first_completion === true);
}
