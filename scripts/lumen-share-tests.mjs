import assert from 'node:assert/strict';
import {discoveryUrl, discoveryUrlFor, inviteShareUrlFor, playerShareUrlFor, inviteShare, inviteShareData, inviteShareUrl, resultShareData, resultShareUrl, shareCardCopy, createShareDialog, tryNativeShare, tryCopyShare} from '../src/ui/lumen-share.js';
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
// #933: the destination follows the language too (the English page exists).
const discover = 'https://lumen.nopuna.fr/discover.html';
assert.deepEqual(inviteShare(en, 'en'), {title: 'Discover Lumen', text: '✨ I found Lumen, a logic puzzle where you relight the constellations. Want to try?', url: discover});
assert.equal(inviteShare(createTranslator({locale: 'fr'}).t, 'fr').url, discoveryUrl, 'French invitation → decouvrir.html');
assert.deepEqual(inviteShare(), inviteShareData, 'French default unchanged');
assert.deepEqual(resultShareData({ordinal: 3, constellation: 'Great Bear', time: '1:02', badges: ['Autonomy']}, en), {
  title: 'My win in Lumen', text: '✦ Quest 3 solved in Lumen · Great Bear\nFinal time 1:02\nAutonomy\nYour turn!', url: discoveryUrl}, 'no locale given: French page (explicit default)');
assert.equal(resultShareData({ordinal: 3, constellation: 'Great Bear', time: '1:02', badges: []}, en, 'en').url, discover, 'English result → discover.html');
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
let lang = 'en';
const dialog = createShareDialog(doc, nav, en, {locale: () => lang});
const challengeUrl = 'https://lumen.nopuna.fr/?challenge=00000000-0000-4000-8000-000000075901';
dialog.text({title: 'Challenge', text: '', url: challengeUrl}, doc.getElementById('origin'));
await doc.getElementById('lumenShareNative').onclick();
assert.equal(shared.at(-1).url, challengeUrl, 'a challenge link is never replaced by the discovery page');
assert.equal(dialog.discoveryUrl(), discover, 'generic shares (Défi du jour) use the page of the current language');
doc.getElementById('lumenShareDialog').close();
dialog.text({title: 'Daily', text: 'x', url: dialog.discoveryUrl()}, doc.getElementById('origin'));
assert.equal(doc.getElementById('lumenShareSelection').value, 'x\n' + discover, 'copy keeps the canonical same-language URL');
await doc.getElementById('lumenShareNative').onclick();
assert.equal(shared.at(-1).url, discover + '?utm_source=player_share&utm_medium=referral', 'generic discovery shares keep the Partager campaign, on the English page');
doc.getElementById('lumenShareDialog').close();
dialog.text({title: 'Daily', text: 'x', url: discoveryUrl}, doc.getElementById('origin'));
await doc.getElementById('lumenShareNative').onclick();
assert.equal(shared.at(-1).url, resultShareUrl, 'a French discovery link keeps the French page');
doc.getElementById('lumenShareDialog').close();
await dialog.invite(doc.getElementById('origin'));
assert.deepEqual(shared.at(-1), {title: 'Discover Lumen', text: '✨ I found Lumen, a logic puzzle where you relight the constellations. Want to try?', url: discover + '?utm_source=player_invite&utm_medium=referral'}, 'English invitation → discover.html with the Inviter campaign');
// The language can change at runtime (manual choice in Lumen): the next share follows it.
const frDialog = createShareDialog(fakeDocument(), nav, createTranslator({locale: 'fr'}).t, {locale: () => lang});
const origin = {getClientRects: () => [1], focus() {}};
lang = 'fr';
await frDialog.invite(origin);
assert.equal(shared.at(-1).url, inviteShareUrl, 'French invitation → decouvrir.html with the Inviter campaign');
lang = 'en';
await frDialog.invite(origin);
assert.equal(shared.at(-1).url, discover + '?utm_source=player_invite&utm_medium=referral', 'a later switch to English is honoured');
// Result card: the copy and the native share carry the same-language page.
const resultDoc = fakeDocument();
const resultDialog = createShareDialog(resultDoc, nav, en, {locale: () => 'en'});
resultDialog.result({ordinal: 3, constellation: 'Lyra', time: '', badges: [], milestone: 'adventure', adventure: 'Northern Sky'}, resultDoc.getElementById('origin'));
assert.ok(resultDoc.getElementById('lumenShareSelection').value.endsWith('\n' + discover));
await resultDoc.getElementById('lumenShareNative').onclick();
assert.equal(shared.at(-1).url, discover + '?utm_source=player_share&utm_medium=referral');
// Cancelling the native sheet is not a success and leaves the dialog open.
const cancelDoc = fakeDocument();
const cancelDialog = createShareDialog(cancelDoc, {share: async () => { throw {name: 'AbortError'}; }}, en, {locale: () => 'en'});
cancelDialog.text({title: 'Daily', text: 'x', url: discover}, cancelDoc.getElementById('origin'));
await cancelDoc.getElementById('lumenShareNative').onclick();
assert.equal(cancelDoc.getElementById('lumenShareDialog').open, true);
assert.equal(cancelDoc.getElementById('lumenShareStatus').textContent, '', 'no fake success, no error on cancel');

// Destinations and campaigns (#933): one function, deterministic fallback, no duplicated UTM.
assert.equal(discoveryUrlFor('fr'), discoveryUrl);
assert.equal(discoveryUrlFor('en'), discover);
for (const other of ['en-GB', 'EN_us']) assert.equal(discoveryUrlFor(other), discover, other);
for (const other of ['de', 'es', '', null, undefined, 'xx-invalid']) assert.equal(discoveryUrlFor(other), discoveryUrl, 'French default for ' + other);
for (const [locale, page] of [['fr', discoveryUrl], ['en', discover]]) {
  for (const [url, source] of [[inviteShareUrlFor(locale), 'player_invite'], [playerShareUrlFor(locale), 'player_share']]) {
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, page);
    assert.deepEqual([...parsed.searchParams], [['utm_source', source], ['utm_medium', 'referral']], 'exactly one campaign: ' + url);
  }
}
console.log('Invitation and result share contracts passed');
