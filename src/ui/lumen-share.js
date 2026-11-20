export const discoveryUrl = 'https://lumen.nopuna.fr/decouvrir.html';

export const inviteShareData = Object.freeze({
  title: 'Découvrir Lumen',
  text: "✨ J’ai découvert Lumen, un jeu de logique où tu rallumes les constellations. Tu veux essayer ?",
  url: discoveryUrl,
});

export function resultShareData({ ordinal, constellation, time, badges }) {
  return {
    title: 'Ma réussite dans Lumen',
    text: [
      '✦ Quête ' + ordinal + ' réussie dans Lumen · ' + constellation,
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
    const outcome = await tryNativeShare(navigator, state.data, state.image);
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
    async invite(origin) {
      const outcome = await tryNativeShare(navigator, inviteShareData);
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

function shareCardCanvas(document, { ordinal, constellation, time, badges }, url) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 750;
  const context = canvas.getContext('2d');
  context.fillStyle = '#101d2e';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#182e4a';
  context.beginPath();
  context.arc(300, 206, 85, 0, 2 * Math.PI);
  context.fill();
  context.textAlign = 'center';
  const line = (text, y, font, color) => {
    context.fillStyle = color;
    context.font = font;
    context.fillText(text, canvas.width / 2, y, 510);
  };
  line('L U M E N', 100, 'bold 26px sans-serif', '#68e7ff');
  line('✦', 238, '96px sans-serif', '#ffe3a1');
  line('QUÊTE ' + ordinal + ' RÉUSSIE', 315, 'bold 26px sans-serif', '#68e7ff');
  line(constellation, 384, 'bold 48px sans-serif', '#f2fbff');
  if (time) line('Temps final ' + time, 454, 'bold 28px sans-serif', '#f2fbff');
  if (badges.length) line(badges.join(' · '), 512, 'bold 23px sans-serif', '#ffe3a1');
  line('À toi de jouer !', 638, 'bold 32px sans-serif', '#f2fbff');
  line(url.replace('https://', ''), 684, '22px sans-serif', '#a9bfd0');
  return new Promise(resolve => canvas.toBlob(blob => {
    resolve(blob && new File([blob], 'lumen-quete-' + ordinal + '.png', { type: 'image/png' }));
  }, 'image/png'));
}
