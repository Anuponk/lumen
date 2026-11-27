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

// Metricool calendar import (Planner → ⋮ → Import CSV), exact column set of the
// template downloaded on 27/11/2026 (Mtr_modele_calendrier.csv): UTF-8 with BOM,
// strings quoted, booleans bare, Date AAAA-MM-JJ, Time HH:MM:SS (Paris).
// Facebook only (#1056), a photo post with the day's visual; the caption keeps
// the full UTM link, so the link shortener stays off.
export const METRICOOL_COLUMNS = Object.freeze([
  'Text',
  'Date',
  'Time',
  'Draft',
  'Facebook',
  'Twitter/X',
  'LinkedIn',
  'GBP',
  'Instagram',
  'Pinterest',
  'TikTok',
  'Youtube',
  'Threads',
  'Bluesky',
  'Picture Url 1',
  'Picture Url 2',
  'Picture Url 3',
  'Picture Url 4',
  'Picture Url 5',
  'Picture Url 6',
  'Picture Url 7',
  'Picture Url 8',
  'Picture Url 9',
  'Picture Url 10',
  'Alt text picture 1',
  'Alt text picture 2',
  'Alt text picture 3',
  'Alt text picture 4',
  'Alt text picture 5',
  'Alt text picture 6',
  'Alt text picture 7',
  'Alt text picture 8',
  'Alt text picture 9',
  'Alt text picture 10',
  'Document title',
  'Shortener',
  'Video Thumbnail Url',
  'Video Cover Frame',
  'Twitter/X Can reply',
  'Twitter/X Type',
  'Twitter/X Poll Duration minutes',
  'Twitter/X Poll Option 1',
  'Twitter/X Poll Option 2',
  'Twitter/X Poll Option 3',
  'Twitter/X Poll Option 4',
  'Pinterest Board',
  'Pinterest Pin Title',
  'Pinterest Pin Link',
  'Pinterest Pin New Format',
  'Pinterest AI generated content',
  'Pinterest AI generated person',
  'Instagram Post Type',
  'Instagram Show Reel On Feed',
  'Instagram Trial Reel Share Automatically',
  'Instagram Paid Partnership',
  'Instagram Paid Partnership Brands',
  'Youtube Video Title',
  'Youtube Video Type',
  'Youtube Video Privacy',
  'Youtube video for kids',
  'Youtube AI generated content',
  'Youtube notify subscribers',
  'Youtube Video Category',
  'Youtube Video Tags',
  'Youtube playlist',
  'GBP Post Type',
  'Facebook Post Type',
  'Facebook Title',
  'First Comment Text',
  'TikTok Title',
  'TikTok disable comments',
  'TikTok disable duet',
  'TikTok disable stitch',
  'TikTok Post Privacy',
  'TikTok Branded Content',
  'TikTok Your Brand',
  'TikTok Auto Add Music',
  'TikTok Photo Cover Index',
  'TikTok musicId',
  'TikTok music title',
  'TikTok music author',
  'TikTok music previewUrl',
  'TikTok music thumbnailUrl',
  'TikTok music soundVolume',
  'TikTok music originalVolume',
  'TikTok music startMillis',
  'TikTok music endMillis',
  'TikTok Ai generated content',
  'LinkedIn Type',
  'LinkedIn Poll Question',
  'LinkedIn Poll Option 1',
  'LinkedIn Poll Option 2',
  'LinkedIn Poll Option 3',
  'LinkedIn Poll Option 4',
  'LinkedIn Poll Duration',
  'LinkedIn Show link preview',
  'LinkedIn Images as Carousel',
  'Threads Reply Control',
  'Threads Is Spoiler',
  'Threads Post Type',
  'Brand name',
  'Tags',
]);
const METRICOOL_NETWORKS = ['Twitter/X', 'LinkedIn', 'GBP', 'Instagram', 'Pinterest', 'TikTok', 'Youtube', 'Threads', 'Bluesky'];

export function metricoolRow(post, { draft = false } = {}) {
  const row = Object.fromEntries(METRICOOL_COLUMNS.map((c) => [c, '']));
  Object.assign(row, {
    Text: post.message,
    Date: post.day,
    Time: post.publishAt + ':00',
    Draft: draft,
    Facebook: true,
    'Picture Url 1': post.image || '',
    'Alt text picture 1': post.image ? post.imageAlt || '' : '',
    Shortener: false,
    'Facebook Post Type': 'POST',
    Tags: 'Lumen,' + (post.kind === 'official' ? 'DefiDuJour' : 'MiniPuzzle'),
  });
  for (const network of METRICOOL_NETWORKS) row[network] = false;
  return row;
}

export function metricoolCsv(posts, options = {}) {
  const cell = (v) => (typeof v === 'boolean' ? String(v) : '"' + String(v ?? '').replace(/"/g, '""') + '"');
  const lines = [METRICOOL_COLUMNS.join(',')];
  for (const post of posts) {
    const row = metricoolRow(post, options);
    lines.push(METRICOOL_COLUMNS.map((c) => (row[c] === '' ? '""' : cell(row[c]))).join(','));
  }
  return '﻿' + lines.join('\n') + '\n';
}
