import assert from 'node:assert/strict';
import {createAnalytics} from '../src/analytics/events.js';
import {discoveryUrl, inviteShareUrl, playerShareUrl, readDiscoveryCampaign} from '../src/analytics/acquisition.js';

const location = new URL('/', discoveryUrl);
assert.equal(readDiscoveryCampaign(location, playerShareUrl), 'player_share');
assert.equal(readDiscoveryCampaign(location, discoveryUrl + '?utm_source=tiktok&utm_medium=social&arbitrary=secret'), 'tiktok');
assert.equal(readDiscoveryCampaign(location, inviteShareUrl), 'player_invite');
// #945 Lot C: the Spanish discovery page is a known campaign source.
assert.equal(readDiscoveryCampaign(location, new URL('/descubrir.html?utm_source=player_invite&utm_medium=referral', discoveryUrl).href), 'player_invite');
const englishDiscovery = new URL('/discover.html', discoveryUrl);
assert.equal(readDiscoveryCampaign(location, englishDiscovery.href), null, 'Plain English discovery has no campaign');
for (const [source, medium] of [['player_share', 'referral'], ['player_invite', 'referral'], ['tiktok', 'social']]) {
  const referrer = new URL(englishDiscovery);
  referrer.search = new URLSearchParams({utm_source: source, utm_medium: medium, unrelated: 'PRIVATE'});
  assert.equal(readDiscoveryCampaign(location, referrer.href), source);
  referrer.searchParams.append('utm_source', source);
  assert.equal(readDiscoveryCampaign(location, referrer.href), null, 'Duplicate campaign fields remain invalid');
}
// #881 Lot 1: leaving a challenge link ("Continuer sur Lumen" / "Retour à Lumen") opens the game
// with that same-origin link as referrer; only the channel name is kept, never the challenge ID.
assert.equal(readDiscoveryCampaign(location, new URL('/?challenge=00000000-0000-4000-8000-000000000001', location).href), 'challenge_link');
assert.equal(readDiscoveryCampaign(new URL('/?challenge=00000000-0000-4000-8000-000000000001', location), new URL('/?challenge=00000000-0000-4000-8000-000000000001', location).href), null, 'The challenge attempt itself is not an acquisition opening');
assert.equal(readDiscoveryCampaign(location, 'https://example.org/?challenge=x'), null, 'Foreign challenge-like referrer');
assert.equal(readDiscoveryCampaign(location, new URL('/', location).href), null, 'Plain same-origin reload');
for (const referrer of [
  '', 'malformed', discoveryUrl, playerShareUrl.replace('lumen.nopuna.fr', 'example.org'),
  playerShareUrl.replace('decouvrir.html', 'comment-jouer.html'),
  'https://example.org/discover.html?utm_source=player_share&utm_medium=referral',
  new URL('/discover.html/?utm_source=player_share&utm_medium=referral', discoveryUrl).href,
  playerShareUrl + '&utm_source=tiktok', playerShareUrl + '&utm_medium=referral',
  discoveryUrl + '?utm_source=private&' + 'utm_medium=referral',
  discoveryUrl + '?utm_source=player_share&utm_medium=social',
]) assert.equal(readDiscoveryCampaign(location, referrer), null, referrer);
assert.equal(readDiscoveryCampaign(new URL('/admin/analytics', location), playerShareUrl), null);

const memory = new Map();
const sent = [];
let allowed = false;
const environment = {
  location,
  referrer: new URL('/discover.html?utm_source=player_share&utm_medium=referral&attacker_value=PRIVATE', discoveryUrl).href,
  analyticsAllowed: () => allowed,
  localStorage: {getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value)},
  crypto,
  console,
};
let failTransport = false;
const api = createAnalytics(() => ({
  async rpc(name, data) {
    if (failTransport) throw Error('fixture offline');
    sent.push({name, ...data});
  },
}), {...environment, console: {warn() {}}});
const start = {quest_ordinal: 1, attempt_mode: 'campaign'};
await api.trackDiscoveryOpen();
await api.trackInviteClick();
await api.trackLumenEvent('attempt_started', 1, start);
assert.equal(sent.length, 0);
assert.deepEqual([...memory.keys()], ['lumenAnonymousIdV1']);
allowed = true;
await api.trackInviteClick();
await api.trackDiscoveryOpen();
await api.trackLumenEvent('attempt_started', 1, start);
await api.trackLumenEvent('attempt_completed', 1, {...start, outcome: 'success', first_completion: true});
await api.trackLumenEvent('puzzle_start', 1, start);
await api.trackLumenEvent('attempt_started', 1, {...start, attempt_mode: 'challenge'});
await api.trackLumenEvent('attempt_started', 1, {...start, attempt_mode: 'replay'});
await api.trackLumenEvent('attempt_started', 2, {...start, quest_ordinal: 2});
await api.trackLumenEvent('attempt_completed', 1, {...start, outcome: 'success', first_completion: false});
assert.deepEqual(sent.map(e => e.p_event_name), [
  'share_result', 'app_opened', 'attempt_started', 'attempt_completed',
  'puzzle_start', 'attempt_started', 'attempt_started', 'attempt_started', 'attempt_completed',
]);
assert.deepEqual(sent[0].p_properties, {share_action: 'invite_clicked', traffic_type: 'human'});
assert.deepEqual(sent.map(e => e.p_properties.acquisition_channel), [
  undefined, 'player_share', 'player_share', 'player_share',
  undefined, undefined, undefined, undefined, undefined,
]);
assert.equal(new Set(sent.map(e => e.p_session_id)).size, 1);
assert(sent.every(e => e.name === 'lumen_track_event'));
assert.doesNotMatch(JSON.stringify(sent), /PRIVATE|utm_source/);
assert.equal(memory.has('lumenReferral'), false);
allowed = false;
await api.trackInviteClick();
await api.trackDiscoveryOpen();
assert.equal(sent.length, 9);
allowed = true;
failTransport = true;
await api.trackInviteClick();
await api.trackDiscoveryOpen();
assert.equal(sent.length, 9);
console.log('Acquisition: consent, first quest attribution, clean payloads and offline failure passed');
