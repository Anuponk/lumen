import assert from 'node:assert/strict';
import {discoveryUrl, inviteShareData, inviteShareUrl, resultShareData, resultShareUrl, tryNativeShare, tryCopyShare} from '../src/ui/lumen-share.js';

assert.equal(discoveryUrl, 'https://lumen.nopuna.fr/decouvrir.html');
assert.deepEqual(inviteShareData, {
  title: 'Découvrir Lumen',
  text: "✨ J’ai découvert Lumen, un jeu de logique où tu rallumes les constellations. Tu veux essayer ?",
  url: discoveryUrl,
});
const result = resultShareData({ordinal: 3, constellation: 'Grande Ourse', time: '1:02', badges: ['Autonomie'], player: 'PRIVATE', score: 100});
assert.deepEqual(result, {
  title: 'Ma réussite dans Lumen',
  text: '✦ Quête 3 réussie dans Lumen · Grande Ourse\nTemps final 1:02\nAutonomie\nÀ toi de jouer !',
  url: discoveryUrl,
});
// #881 Lot 1: the shared text names the accomplishment actually celebrated.
assert.deepEqual(resultShareData({ordinal: 5, constellation: 'Grande Ourse', time: '2:10', badges: [], milestone: 'constellation'}), {
  title: 'Constellation rallumée dans Lumen',
  text: '✦ J’ai rallumé Grande Ourse dans Lumen (quête 5)\nTemps final 2:10\nÀ toi de jouer !',
  url: discoveryUrl,
});
assert.deepEqual(resultShareData({ordinal: 101, constellation: 'Orion', time: '', badges: ['Maîtrise'], milestone: 'adventure', adventure: 'Le Ciel boréal'}), {
  title: 'Aventure accomplie dans Lumen',
  text: '✦ Aventure « Le Ciel boréal » accomplie dans Lumen · Orion\nMaîtrise\nÀ toi de jouer !',
  url: discoveryUrl,
});
assert.equal(resultShareData({ordinal: 5, constellation: 'Lyre', time: '', badges: [], milestone: 'unknown'}).title, 'Ma réussite dans Lumen', 'Unknown milestones keep the quest wording');
assert.equal(resultShareData({ordinal: 5, constellation: 'Lyre', time: '', badges: [], milestone: 'adventure'}).text.split('\n')[0], '✦ Aventure accomplie dans Lumen · Lyre', 'Missing adventure name stays readable');
// Inviter and Partager stay distinguishable in the acquisition funnel.
assert.equal(inviteShareUrl, discoveryUrl + '?utm_source=player_invite&utm_medium=referral');
assert.equal(resultShareUrl, discoveryUrl + '?utm_source=player_share&utm_medium=referral');
let sent;
assert.equal(await tryNativeShare({share: async data => { sent = data; }}, inviteShareData), 'shared');
assert.deepEqual(sent, inviteShareData);
assert.equal(await tryNativeShare({share: async () => { throw {name: 'AbortError'}; }}, inviteShareData), 'cancelled');
assert.equal(await tryNativeShare({share: async () => { throw Error('Unavailable'); }}, inviteShareData), 'unavailable');
assert.equal(await tryNativeShare({}, inviteShareData), 'unavailable');
assert.equal(await tryNativeShare({
  canShare: () => false,
  share: async data => { sent = data; },
}, result, new Blob()), 'shared');
assert.deepEqual(sent, result);
const image = new Blob();
assert.equal(await tryNativeShare({
  canShare: () => true,
  share: async data => { sent = data; },
}, result, image), 'shared');
assert.deepEqual(sent, {...result, files: [image]});
assert.equal(await tryCopyShare({clipboard: {writeText: async text => { sent = text; }}}, discoveryUrl), true);
assert.equal(sent, discoveryUrl);
assert.equal(await tryCopyShare({}, discoveryUrl), false);
assert.equal(await tryCopyShare({clipboard: {writeText: async () => { throw Error('Denied'); }}}, discoveryUrl), false);
console.log('Invitation and result share contracts passed');
