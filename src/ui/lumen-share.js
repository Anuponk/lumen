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
  // #932: a fully mastered Adventure (every quest's Maîtrise, confirmed).
  adventureMastered: ({ constellation, adventure }, t) => ({
    title: t('share.masteredTitle'),
    headline: adventure ? t('share.masteredHeadline', { adventure }) : t('share.masteredHeadlinePlain', { constellation }),
  }),
};
// #932: what the Adventure card states, from confirmed counts only.
function achievementDetail({ milestone, constellations, quests }, t) {
  if (milestone === 'adventureMastered' && quests > 0) return t('share.masteredDetail', { count: quests });
  if (milestone === 'adventure' && constellations > 0) return t('share.adventureDetail', { count: constellations });
  return '';
}

export function resultShareData({ ordinal, constellation, time, badges, milestone, adventure, constellations = 0, quests = 0 }, t = french, locale = 'fr') {
  const wording = MILESTONES[milestone]?.({ ordinal, constellation, adventure }, t) ??
    { title: t('share.resultTitle'), headline: t('share.resultHeadline', { ordinal, constellation }) };
  return {
    title: wording.title,
    text: [
      wording.headline,
      achievementDetail({ milestone, constellations, quests }, t),
      time && t('share.finalTime', { time }),
      badges.join(' · '),
      t('share.yourTurn'),
    ].filter(Boolean).join('\n'),
    url: discoveryUrlFor(locale),
  };
}

// #932: « Partager ma réussite » is reserved for the victory that completes or
// fully masters an Adventure, read from the confirmed progression of its pack
// (canonicalScopeProgress), never from the scene. Mastered wins when both apply.
export function adventureShareMilestone(scope, { newlyCompleted = false, masteryNew = false } = {}) {
  if (scope?.mastered && masteryNew) return 'adventureMastered';
  return scope?.complete && newlyCompleted ? 'adventure' : null;
}

// Card copy (the canvas helper stays self-contained for its tests).
export function shareCardCopy(model, t = french) {
  return {
    kicker: model.milestone === 'constellation' ? t('share.cardConstellation') : model.milestone === 'adventure' ? t('share.cardAdventure')
      : model.milestone === 'adventureMastered' ? t('share.cardMastered')
      : t('share.cardQuest', { ordinal: model.ordinal, total: model.catalogueTotal }),
    detail: achievementDetail(model, t),
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

// #932 Lot C: the promotional picture of « Partager Lumen » is the discovery
// page's own social preview (same file as og:image, same language).
export function promoImagePath(locale) {
  return discoveryUrlFor(locale).endsWith('/discover.html') ? '/src/landing/og-en.jpg' : '/src/landing/og.jpg';
}
async function fetchPromoImage(path) {
  const response = await fetch(path, { cache: 'force-cache' });
  if (!response.ok) return null;
  const blob = await response.blob();
  return new File([blob], path.endsWith('og-en.jpg') ? 'lumen-en.jpg' : 'lumen.jpg', { type: blob.type || 'image/jpeg' });
}

// `locale` returns the language Lumen is displayed in (it can change at runtime).
export function createShareDialog(document, navigator, t = createTranslator().t, { locale = () => 'fr', loadImage = fetchPromoImage } = {}) {
  // The picture is fetched ahead of the click (warmPromo) and only attached
  // once ready: awaiting a download inside the click could lose the user
  // activation that navigator.share() requires. Not ready: text + link only.
  const promoImages = new Map();
  function warmPromo(lang = locale()) {
    const path = promoImagePath(lang);
    if (promoImages.has(path)) return promoImages.get(path).ready;
    const entry = { file: null, ready: null };
    entry.ready = Promise.resolve().then(() => loadImage(path)).then(file => { entry.file = file || null; return entry.file; })
      .catch(() => { promoImages.delete(path); return null; });
    promoImages.set(path, entry);
    return entry.ready;
  }
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
    warmPromo,
    async invite(origin) {
      const lang = locale();
      const data = inviteShare(t, lang);
      const image = promoImages.get(promoImagePath(lang))?.file ?? null;
      if (!image) void warmPromo(lang);
      // Text + link always; the picture too when the channel accepts files.
      const outcome = await tryNativeShare(navigator, { ...data, url: inviteShareUrlFor(lang) }, image);
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
  const adventureCard = (milestone === 'adventure' || milestone === 'adventureMastered') && adventure;
  const mastered = milestone === 'adventureMastered';
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 750;
  const context = canvas.getContext('2d');
  context.fillStyle = '#101d2e';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (mastered) {
    context.strokeStyle = '#ffd678';
    context.lineWidth = 6;
    context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  }
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
  line(copy?.kicker || (CARD_KICKERS[milestone] ?? 'QUÊTE ' + ordinal + ' / ' + catalogueTotal + ' RÉUSSIE'), 372, 'bold 26px sans-serif', mastered ? '#ffd678' : '#68e7ff');
  line(adventureCard ? adventure : constellation, 436, 'bold 46px sans-serif', '#f2fbff');
  if (adventureCard) line(copy?.detail || constellation, 482, 'bold 26px sans-serif', mastered ? '#ffe3a1' : '#a9bfd0');
  if (time) line(copy?.time || 'Temps final ' + time, 532, 'bold 28px sans-serif', '#f2fbff');
  if (badges.length) line(badges.join(' · '), 580, 'bold 23px sans-serif', '#ffe3a1');
  line(copy?.cta || 'À toi de jouer !', 650, 'bold 32px sans-serif', '#f2fbff');
  line(url.replace('https://', ''), 694, '22px sans-serif', '#a9bfd0');
  return new Promise(resolve => canvas.toBlob(blob => {
    resolve(blob && new File([blob], 'lumen-quete-' + ordinal + '.png', { type: 'image/png' }));
  }, 'image/png'));
}
