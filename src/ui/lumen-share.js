import {discoveryUrl, inviteShareUrl, playerShareUrl} from '../analytics/acquisition.js';
import {astronomicalIllumination} from './astronomical-reference-svg.js';

export {discoveryUrl, inviteShareUrl};
// Native result shares carry the Partager campaign; Inviter has its own code.
export const resultShareUrl = playerShareUrl;

export const inviteShareData = Object.freeze({
  title: 'Découvrir Lumen',
  text: "✨ J’ai découvert Lumen, un jeu de logique où tu rallumes les constellations. Tu veux essayer ?",
  url: discoveryUrl,
});

// #881 Lot 1: the wording follows the accomplishment the victory scene celebrated
// (quest, completed constellation or completed Adventure). Never a ranking.
const MILESTONES = {
  constellation: ({ ordinal, constellation }) => ({
    title: 'Constellation rallumée dans Lumen',
    headline: '✦ J’ai rallumé ' + constellation + ' dans Lumen (quête ' + ordinal + ')',
  }),
  adventure: ({ constellation, adventure }) => ({
    title: 'Aventure accomplie dans Lumen',
    headline: '✦ Aventure ' + (adventure ? '« ' + adventure + ' » ' : '') + 'accomplie dans Lumen · ' + constellation,
  }),
};

export function resultShareData({ ordinal, constellation, time, badges, milestone, adventure }) {
  const wording = MILESTONES[milestone]?.({ ordinal, constellation, adventure }) ??
    { title: 'Ma réussite dans Lumen', headline: '✦ Quête ' + ordinal + ' réussie dans Lumen · ' + constellation };
  return {
    title: wording.title,
    text: [
      wording.headline,
      time && 'Temps final ' + time,
      badges.join(' · '),
      'À toi de jouer !',
    ].filter(Boolean).join('\n'),
    url: discoveryUrl,
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

export function createShareDialog(document, navigator) {
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
    const state = { data, origin, image: null };
    current = state;
    title.textContent = invitation ? 'Inviter des amis' : data.title;
    preview.textContent = invitation ? '' : data.text;
    preview.hidden = invitation;
    native.hidden = invitation || !navigator.share;
    copy.textContent = invitation ? 'Copier le lien' : 'Copier le résultat';
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
      status.textContent = state.data === inviteShareData ? 'Lien copié !' : 'Résultat copié !';
      return;
    }
    manual.hidden = false;
    selection.focus();
    selection.select();
  };
  native.onclick = async () => {
    const state = current;
    const outcome = await tryNativeShare(navigator, { ...state.data, url: resultShareUrl }, state.image);
    if (current !== state || !dialog.open) return;
    if (outcome === 'shared') dialog.close();
    if (outcome === 'unavailable') {
      state.image = null;
      status.textContent = 'Partage indisponible. Tu peux copier le résultat.';
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
    async invite(origin) {
      const outcome = await tryNativeShare(navigator, { ...inviteShareData, url: inviteShareUrl });
      if (outcome === 'unavailable' && origin.getClientRects().length) {
        open(inviteShareData, { invitation: true, origin });
      }
    },
    result(model, origin) {
      const data = resultShareData(model);
      open(data, { origin, makeImage: () => shareCardCanvas(document, model, data.url) });
    },
  };
}

// Self-contained (helpers nested): tests evaluate this function on its own.
function shareCardCanvas(document, model, url) {
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
  line(CARD_KICKERS[milestone] ?? 'QUÊTE ' + ordinal + ' / ' + catalogueTotal + ' RÉUSSIE', 372, 'bold 26px sans-serif', '#68e7ff');
  line(milestone === 'adventure' && adventure ? adventure : constellation, 436, 'bold 46px sans-serif', '#f2fbff');
  if (milestone === 'adventure' && adventure) line(constellation, 482, 'bold 26px sans-serif', '#a9bfd0');
  if (time) line('Temps final ' + time, 532, 'bold 28px sans-serif', '#f2fbff');
  if (badges.length) line(badges.join(' · '), 580, 'bold 23px sans-serif', '#ffe3a1');
  line('À toi de jouer !', 650, 'bold 32px sans-serif', '#f2fbff');
  line(url.replace('https://', ''), 694, '22px sans-serif', '#a9bfd0');
  return new Promise(resolve => canvas.toBlob(blob => {
    resolve(blob && new File([blob], 'lumen-quete-' + ordinal + '.png', { type: 'image/png' }));
  }, 'image/png'));
}
