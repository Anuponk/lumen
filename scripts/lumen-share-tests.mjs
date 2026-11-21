import assert from 'node:assert/strict';
import {discoveryUrl, inviteShare, inviteShareData, inviteShareUrl, resultShareData, resultShareUrl, shareCardCopy, createShareDialog, tryNativeShare, tryCopyShare} from '../src/ui/lumen-share.js';
import {createTranslator} from '../src/ui/i18n.js';

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

// #759: shared copy follows the player's language (#754); French stays the default.
const en = createTranslator({locale: 'en'}).t;
assert.deepEqual(inviteShare(en), {title: 'Discover Lumen', text: '✨ I found Lumen, a logic puzzle where you relight the constellations. Want to try?', url: discoveryUrl});
assert.deepEqual(inviteShare(), inviteShareData, 'French default unchanged');
assert.deepEqual(resultShareData({ordinal: 3, constellation: 'Great Bear', time: '1:02', badges: ['Autonomy']}, en), {
  title: 'My win in Lumen', text: '✦ Quest 3 solved in Lumen · Great Bear\nFinal time 1:02\nAutonomy\nYour turn!', url: discoveryUrl});
assert.equal(resultShareData({ordinal: 5, constellation: 'Orion', time: '', badges: [], milestone: 'adventure', adventure: 'Northern Sky'}, en).text.split('\n')[0], '✦ Adventure “Northern Sky” completed in Lumen · Orion');
assert.deepEqual(shareCardCopy({ordinal: 4, catalogueTotal: 880, time: '0:58'}, en), {kicker: 'QUEST 4 / 880 SOLVED', time: 'Final time 0:58', cta: 'Your turn!'});
assert.deepEqual(shareCardCopy({ordinal: 4, catalogueTotal: 880, time: '', milestone: 'constellation'}), {kicker: 'CONSTELLATION RALLUMÉE', time: '', cta: 'À toi de jouer !'});
assert.equal(JSON.stringify(resultShareData({ordinal: 1, constellation: 'Lyre', time: '0:30', badges: [], player: 'secret@mail', userId: 'uuid'}, en)).match(/secret|uuid/), null, 'no private field leaks');

// Native share from the dialog: generic links get the Partager campaign, a
// specific link (e.g. a challenge) keeps its own destination.
function fakeDocument() {
  const nodes = {};
  const node = () => ({textContent: '', hidden: false, value: '', open: false, listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    showModal() { this.open = true; }, close() { this.open = false; (this.listeners.close || []).forEach(fn => fn()); },
    focus() {}, select() {}, getClientRects() { return [1]; }});
  return {getElementById: id => (nodes[id] ||= node())};
}
const shared = [];
const nav = {share: async data => { shared.push(data); }};
const doc = fakeDocument();
const dialog = createShareDialog(doc, nav, en);
const challengeUrl = 'https://lumen.nopuna.fr/?challenge=00000000-0000-4000-8000-000000075901';
dialog.text({title: 'Challenge', text: '', url: challengeUrl}, doc.getElementById('origin'));
await doc.getElementById('lumenShareNative').onclick();
assert.equal(shared.at(-1).url, challengeUrl, 'a challenge link is never replaced by the discovery page');
dialog.text({title: 'Daily', text: 'x', url: discoveryUrl}, doc.getElementById('origin'));
await doc.getElementById('lumenShareNative').onclick();
assert.equal(shared.at(-1).url, resultShareUrl, 'generic discovery shares keep the Partager campaign');
await dialog.invite(doc.getElementById('origin'));
assert.deepEqual(shared.at(-1), {title: 'Discover Lumen', text: '✨ I found Lumen, a logic puzzle where you relight the constellations. Want to try?', url: inviteShareUrl}, 'English invitation with the Inviter campaign');
console.log('Invitation and result share contracts passed');
