import assert from 'node:assert/strict';
import {discoveryUrl, inviteShareData, resultShareData, tryNativeShare, tryCopyShare} from '../src/ui/lumen-share.js';

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
