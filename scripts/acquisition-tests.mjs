import assert from 'node:assert/strict';
import {createAnalytics} from '../src/analytics/events.js';
import {discoveryUrl, playerShareUrl, readDiscoveryCampaign} from '../src/analytics/acquisition.js';

const location = new URL('/', discoveryUrl);
assert.equal(readDiscoveryCampaign(location, playerShareUrl), 'player_share');
assert.equal(readDiscoveryCampaign(location, discoveryUrl + '?utm_source=tiktok&utm_medium=social&arbitrary=secret'), 'tiktok');
for (const referrer of [
  '', 'malformed', discoveryUrl, playerShareUrl.replace('lumen.nopuna.fr', 'example.org'),
  playerShareUrl.replace('decouvrir.html', 'comment-jouer.html'),
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
  referrer: playerShareUrl + '&attacker_value=PRIVATE',
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
