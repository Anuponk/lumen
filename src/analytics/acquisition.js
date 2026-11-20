export const discoveryUrl = 'https://lumen.nopuna.fr/decouvrir.html';
export const playerShareUrl = discoveryUrl + '?utm_source=player_share&utm_medium=referral';

const campaignMedia = new Map([
  ['player_share', 'referral'],
  ['youtube_shorts', 'social'],
  ['instagram_reels', 'social'],
  ['tiktok', 'social'],
]);

export function readDiscoveryCampaign(location, referrer) {
  if (location?.pathname !== '/' || !referrer) return null;
  try {
    const source = new URL(referrer);
    if (source.origin !== location.origin || source.pathname !== '/decouvrir.html') return null;
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
