// #1056 · Daily 08:00 Europe/Paris Facebook post, planned in advance and
// published by the o2switch cron (scripts/lumen_social_post.py). Pure: no
// network. One post per day and channel (key `facebook:AAAA-MM-JJ`).
// Rhythm validated on 27/11/2026: 1–24 December = Advent mini-puzzle (with a
// reminder of the official challenge), then alternate official challenge / mini.
// The official visual shows the initial grid only (territories, no Guardian,
// owner decision of 27/11/2026); a mini-puzzle visual never shows its missing
// Guardians. Captions never contain coordinates or a solution.
import { adventDoor } from './mini-puzzle.js';
import { campaignUrl } from '../analytics/acquisition.js';

export const SITE = 'https://lumen.nopuna.fr';
export const PUBLISH_AT = '08:00';
export const CHANNEL = 'facebook';

const HASHTAGS = {
  mini: '#Lumen #JeuDeLogique #Puzzle #CasseTete',
  advent: '#Lumen #CalendrierDeLAvent #JeuDeLogique #Puzzle',
  official: '#Lumen #DefiDuJour #JeuDeLogique #Puzzle',
};

function frDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('fr', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function postKind(day, { miniDays, officialDays }) {
  if (adventDoor(day) && miniDays.has(day)) return 'mini';
  const parity = Number(day.slice(8, 10)) % 2;
  if (parity === 1 && officialDays.has(day)) return 'official';
  if (miniDays.has(day)) return 'mini';
  return officialDays.has(day) ? 'official' : null;
}

export function miniLink(day) {
  const campaign = adventDoor(day) ? 'avent_2026' : 'mini_' + day.slice(0, 7);
  return campaignUrl(SITE + '/mini/' + day + '.html', 'facebook_daily', { campaign });
}
export function officialLink(day) {
  return campaignUrl(SITE + '/?daily=1', 'facebook_daily', { campaign: 'daily_' + day, keep: ['daily'] });
}

export function buildPost(day, { mini, official, imageExists = () => true }) {
  const kinds = {
    miniDays: new Set(mini ? [mini.day] : []),
    officialDays: new Set(official ? [official.day] : []),
  };
  const kind = postKind(day, kinds);
  if (!kind) return null;
  const door = adventDoor(day);
  let link, message, image, alt;
  if (kind === 'mini') {
    link = miniLink(day);
    const missing = mini.missing;
    const ask =
      missing === 1
        ? 'Saurez-vous placer le dernier Gardien ?'
        : 'Saurez-vous placer les ' + missing + ' derniers Gardiens ?';
    message = [
      door ? '🎄 Calendrier de l’Avent LUMEN · case ' + door : '✦ Le mini-puzzle LUMEN du ' + frDate(day),
      ask + ' Un mini-puzzle de logique en une minute, sans compte ni installation.',
      '👉 ' + link,
      'Envie d’un vrai défi ? Le Défi du jour officiel vous attend aussi dans LUMEN.',
      door ? HASHTAGS.advent : HASHTAGS.mini,
    ].join('\n\n');
    image = 'content/social/mini-' + day + '.jpg';
    alt = 'Grille LUMEN presque terminée : territoires de couleur et Gardiens déjà placés';
  } else {
    link = officialLink(day);
    message = [
      '🏆 Défi du jour LUMEN · ' + frDate(day),
      'Une grille ' + official.size + '×' + official.size + ', une seule tentative officielle et un classement commun. Qui fera le meilleur temps aujourd’hui ?',
      '👉 ' + link,
      'Sans compte, vous pouvez vous entraîner sur la grille du jour (non classé).',
      HASHTAGS.official,
    ].join('\n\n');
    image = 'content/social/official-' + day + '.jpg';
    alt = 'Grille du Défi du jour LUMEN avant la première case : seulement les territoires de couleur';
  }
  // Fallback (#1056): without its visual the post is a plain link post; Facebook
  // then shows the page's Open Graph preview.
  const hasImage = imageExists(image);
  return {
    key: CHANNEL + ':' + day,
    channel: CHANNEL,
    day,
    publishAt: PUBLISH_AT,
    kind,
    message,
    link,
    image: hasImage ? SITE + '/' + image : null,
    imageAlt: hasImage ? alt : null,
  };
}

export function planPosts({ from, to, calendar, schedule, addDays, sizeOf, imageExists }) {
  const posts = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const entry = calendar.days.find((e) => e.day === day);
    const daily = schedule.days.find((e) => e.day === day);
    const post = buildPost(day, {
      mini: entry && calendar.enabled !== false ? { day, missing: entry.missingRows.length } : null,
      official: daily ? { day, size: sizeOf(daily) } : null,
      imageExists,
    });
    if (post) posts.push(post);
  }
  return posts;
}

// CSV for a manual or paid Metricool bulk import (date, time, text, link, image).
export function metricoolCsv(posts) {
  const cell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['Date', 'Time', 'Text', 'Link', 'Picture Url 1', 'Facebook']];
  for (const p of posts) rows.push([p.day, p.publishAt, p.message, p.link, p.image || '', 'TRUE']);
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
