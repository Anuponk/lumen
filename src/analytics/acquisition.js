export const discoveryUrl = 'https://lumen.nopuna.fr/decouvrir.html';
// Partager (result) and Inviter (discovery) keep distinct public campaign codes
// so the funnel can tell them apart (#881 Lot 1). Copy keeps the canonical URL.
export const playerShareUrl = discoveryUrl + '?utm_source=player_share&utm_medium=referral';
export const inviteShareUrl = discoveryUrl + '?utm_source=player_invite&utm_medium=referral';

const campaignMedia = new Map([
  ['player_share', 'referral'],
  ['player_invite', 'referral'],
  ['youtube_shorts', 'social'],
  ['instagram_reels', 'social'],
  ['tiktok', 'social'],
]);

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
    if (source.pathname !== '/decouvrir.html') return null;
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
