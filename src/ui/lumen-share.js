import {createTranslator} from './i18n.js';
import {campaignUrl, discoveryUrl, discoveryUrlFor, inviteShareUrl, inviteShareUrlFor, isDiscoveryUrl, playerShareUrl, playerShareUrlFor} from '../analytics/acquisition.js';
import {astronomicalIllumination} from './astronomical-reference-svg.js';

export {discoveryUrl, discoveryUrlFor, inviteShareUrl, inviteShareUrlFor, playerShareUrlFor};
// Native result shares carry the Partager campaign; Inviter has its own code.
export const resultShareUrl = playerShareUrl;

const french = createTranslator().t;
// #759: shared copy follows the player's language (#754); French stays the default.
// #933: so does the destination (discover.html in English).
export function inviteShare(t = french, locale = 'fr') {
  return { title: t('share.inviteTitle'), text: t('share.inviteText'), url: discoveryUrlFor(locale) };
}
export const inviteShareData = Object.freeze(inviteShare());

// #881 Lot 1: the wording follows the accomplishment the victory scene celebrated
// (quest, completed constellation or completed Adventure). Never a ranking.
const MILESTONES = {
  constellation: ({ ordinal, constellation }, t) => ({
    title: t('share.constellationTitle'),
    headline: t('share.constellationHeadline', { constellation, ordinal }),
  }),
  adventure: ({ constellation, adventure }, t) => ({
    title: t('share.adventureTitle'),
    headline: adventure ? t('share.adventureHeadline', { adventure, constellation }) : t('share.adventureHeadlinePlain', { constellation }),
  }),
};

export function resultShareData({ ordinal, constellation, time, badges, milestone, adventure }, t = french, locale = 'fr') {
  const wording = MILESTONES[milestone]?.({ ordinal, constellation, adventure }, t) ??
    { title: t('share.resultTitle'), headline: t('share.resultHeadline', { ordinal, constellation }) };
  return {
    title: wording.title,
    text: [
      wording.headline,
      time && t('share.finalTime', { time }),
      badges.join(' · '),
      t('share.yourTurn'),
    ].filter(Boolean).join('\n'),
    url: discoveryUrlFor(locale),
  };
}

// Card copy (the canvas helper stays self-contained for its tests).
export function shareCardCopy(model, t = french) {
  return {
    kicker: model.milestone === 'constellation' ? t('share.cardConstellation') : model.milestone === 'adventure' ? t('share.cardAdventure')
      : t('share.cardQuest', { ordinal: model.ordinal, total: model.catalogueTotal }),
    time: model.time ? t('share.finalTime', { time: model.time }) : '',
    cta: t('share.yourTurn'),
  };
}

export async function tryNativeShare(navigator, data, image) {
  if (!navigator.share) return 'unavailable';
  try {
    const files = image ? [image] : [];
    await navigator.share(files.length && navigator.canShare?.({ files }) ? { ...data, files } : data);
    return 'shared';
  } catch (error) {
    return error?.name === 'AbortError' ? 'cancelled' : 'unavailable';
  }
}

export async function tryCopyShare(navigator, text) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// `locale` returns the language Lumen is displayed in (it can change at runtime).
export function createShareDialog(document, navigator, t = createTranslator().t, { locale = () => 'fr' } = {}) {
  const dialog = document.getElementById('lumenShareDialog');
  const title = document.getElementById('lumenShareTitle');
  const preview = document.getElementById('lumenSharePreview');
  const native = document.getElementById('lumenShareNative');
  const copy = document.getElementById('lumenShareCopy');
  const manual = document.getElementById('lumenShareManual');
  const selection = document.getElementById('lumenShareSelection');
  const status = document.getElementById('lumenShareStatus');
  let current;

  function open(data, { invitation = false, origin, makeImage } = {}) {
    if (dialog.open) return;
    const state = { data, origin, image: null, invitation };
    current = state;
    title.textContent = invitation ? t('share.invite') : data.title;
    preview.textContent = invitation ? '' : data.text;
    preview.hidden = invitation;
    native.hidden = invitation || !navigator.share;
    copy.textContent = invitation ? t('share.copyLink') : t('share.copyResult');
    selection.value = invitation ? data.url : data.text + '\n' + data.url;
    manual.hidden = true;
    status.textContent = '';
    dialog.showModal();
    if (makeImage && !native.hidden) {
      Promise.resolve().then(makeImage).then(image => { state.image = image; }).catch(() => {});
    }
  }

  copy.onclick = async () => {
    const state = current;
    const copied = await tryCopyShare(navigator, selection.value);
    if (current !== state || !dialog.open) return;
    if (copied) {
      status.textContent = state.invitation ? t('share.linkCopied') : t('share.resultCopied');
      return;
    }
    manual.hidden = false;
    selection.focus();
    selection.select();
  };
  native.onclick = async () => {
    const state = current;
    // Only generic discovery links get the Partager campaign, on the same-language
    // page; a challenge or other specific link keeps its own destination (#759, #933).
    const url = isDiscoveryUrl(state.data.url) ? campaignUrl(state.data.url, 'player_share') : state.data.url;
    const outcome = await tryNativeShare(navigator, { ...state.data, url }, state.image);
    if (current !== state || !dialog.open) return;
    if (outcome === 'shared') dialog.close();
    if (outcome === 'unavailable') {
      state.image = null;
      status.textContent = t('share.unavailable');
    }
  };
  dialog.addEventListener('click', event => event.stopPropagation());
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    current?.origin?.focus({ preventScroll: true });
    current = null;
  });

  return {
    // #882: any prepared share payload (daily performance), same dialog.
    text(data, origin) {
      open(data, { origin });
    },
    // The discovery page in the current language, for any other generic share.
    discoveryUrl: () => discoveryUrlFor(locale()),
    async invite(origin) {
      const data = inviteShare(t, locale());
      const outcome = await tryNativeShare(navigator, { ...data, url: inviteShareUrlFor(locale()) });
      if (outcome === 'unavailable' && origin.getClientRects().length) {
        open(data, { invitation: true, origin });
      }
    },
    result(model, origin) {
      const data = resultShareData(model, t, locale());
      open(data, { origin, makeImage: () => shareCardCanvas(document, model, data.url, shareCardCopy(model, t)) });
    },
  };
}

// Self-contained (helpers nested): tests evaluate this function on its own.
function shareCardCanvas(document, model, url, copy = null) {
  const CARD_KICKERS = { constellation: 'CONSTELLATION RALLUMÉE', adventure: 'AVENTURE ACCOMPLIE' };

  // Real constellation figure (licensed astronomical source, #GRID_CATALOG), lit
  // with the same rule as the victory scene. No figure: the previous star mark.
  function drawConstellation(context, { constellationId, lit, count }) {
    const data = constellationId ? astronomicalIllumination({ id: constellationId }, lit, count) : null;
    if (!data) return false;
    const { figure, litIndices } = data;
    const scale = Math.min(510 / 290, 210 / 115);
    const point = ([x, y]) => [45 + x * scale, 108 + y * scale];
    context.lineWidth = 3;
    for (const [a, b] of figure.edges) {
      const on = litIndices.has(a) && litIndices.has(b);
      context.strokeStyle = on ? 'rgba(104,231,255,.85)' : 'rgba(169,191,208,.28)';
      context.beginPath();
      context.moveTo(...point(figure.pts[a]));
      context.lineTo(...point(figure.pts[b]));
      context.stroke();
    }
    figure.pts.forEach((pt, i) => {
      const on = litIndices.has(i);
      context.fillStyle = on ? '#ffe3a1' : '#4c6680';
      context.beginPath();
      context.arc(...point(pt), on ? 7 : 4.5, 0, 2 * Math.PI);
      context.fill();
    });
    return true;
  }

  const { ordinal, catalogueTotal, constellation, time, badges, milestone, adventure } = model;
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 750;
  const context = canvas.getContext('2d');
  context.fillStyle = '#101d2e';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  const line = (text, y, font, color) => {
    context.fillStyle = color;
    context.font = font;
    context.fillText(text, canvas.width / 2, y, 510);
  };
  line('L U M E N', 76, 'bold 26px sans-serif', '#68e7ff');
  if (!drawConstellation(context, model)) {
    context.fillStyle = '#182e4a';
    context.beginPath();
    context.arc(300, 214, 85, 0, 2 * Math.PI);
    context.fill();
    line('✦', 246, '96px sans-serif', '#ffe3a1');
  }
  line(copy?.kicker || (CARD_KICKERS[milestone] ?? 'QUÊTE ' + ordinal + ' / ' + catalogueTotal + ' RÉUSSIE'), 372, 'bold 26px sans-serif', '#68e7ff');
  line(milestone === 'adventure' && adventure ? adventure : constellation, 436, 'bold 46px sans-serif', '#f2fbff');
  if (milestone === 'adventure' && adventure) line(constellation, 482, 'bold 26px sans-serif', '#a9bfd0');
  if (time) line(copy?.time || 'Temps final ' + time, 532, 'bold 28px sans-serif', '#f2fbff');
  if (badges.length) line(badges.join(' · '), 580, 'bold 23px sans-serif', '#ffe3a1');
  line(copy?.cta || 'À toi de jouer !', 650, 'bold 32px sans-serif', '#f2fbff');
  line(url.replace('https://', ''), 694, '22px sans-serif', '#a9bfd0');
  return new Promise(resolve => canvas.toBlob(blob => {
    resolve(blob && new File([blob], 'lumen-quete-' + ordinal + '.png', { type: 'image/png' }));
  }, 'image/png'));
}
