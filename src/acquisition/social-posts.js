// One real daily challenge, one dated Facebook link. Metricool is an output.
import {campaignUrl} from '../analytics/acquisition.js';
import {dailyPresentation} from '../campaign/seasonal-events.js';
export const SITE='https://lumen.nopuna.fr';
export const PUBLISH_AT='08:00';
export const CHANNEL='facebook';
export function postKind(day,{officialDays}) {return officialDays.has(day)?'official':null}
export function officialLink(day){
 return campaignUrl(SITE+'/d/'+day+'/', 'facebook_daily', {campaign:dailyPresentation(day).campaign});
}
// Compatibility for old tooling: acquisition now always leads to the real daily.
export const miniLink=officialLink;
const ADVENT_HOOKS = [
 '24 jours, 24 défis pour faire briller les étoiles !',
 'Une nouvelle nuit étoilée, une nouvelle grille à résoudre.',
 'Offre-toi une pause au milieu des étoiles.',
 'Les Gardiens se cachent sous le ciel de Noël. Sauras-tu tous les trouver ?',
 'Allume les étoiles une à une et relève le défi du jour.',
 'Un casse-tête sous les guirlandes, ça te dit ?',
];
const DAILY_HOOKS = [
 'Une nouvelle grille t’attend. Sauras-tu trouver tous les Gardiens ?',
 'Une pause sous les étoiles ? À toi de résoudre la grille du jour.',
 'À chaque territoire son Gardien. Trouveras-tu leur place ?',
 'Les étoiles sont prêtes à briller. À toi de jouer !',
 'Quelques minutes, une grille et des Gardiens à retrouver.',
];
export function buildPost(day,{official,imageExists=()=>true,privateMedia=false}){
 if(!official||official.day!==day)return null;
 const p=dailyPresentation(day);
 const hooks=p.event?ADVENT_HOOKS:DAILY_HOOKS;
 const index=(Number(day.slice(-2))-1)%hooks.length;
 const link=officialLink(day),file='official-'+day+'.jpg',image='content/social/'+file;
 const hasImage=!privateMedia&&imageExists(image);
 return {key:CHANNEL+':'+day,channel:CHANNEL,day,publishAt:PUBLISH_AT,kind:'official',eventId:p.event?.id??null,
  message:[(p.event?'🎄 ':'✨ ')+p.title+' LUMEN'+(p.dayLabel?' · '+p.dayLabel:''),
   hooks[index]+' Une grille '+official.size+'×'+official.size+' à découvrir.',
   '🏆 Joue gratuitement, sans inscription, et tente de rejoindre le classement !',
   '👉 À toi de jouer : '+link,p.hashtags].join('\n\n'),
  link,image:hasImage?SITE+'/'+image:null,privateImage:privateMedia?file:null,
  imageAlt:hasImage||privateMedia?p.title+' LUMEN : grille initiale complète, territoires de couleur, aucun Gardien placé':null};
}
export function planPosts({from,to,schedule,addDays,sizeOf,imageExists,privateMedia=false}){
 const days=new Map(schedule.days.map(entry=>[entry.day,entry]));
 const posts=[];
 for(let day=from;day<=to;day=addDays(day,1)){
  const entry=days.get(day);if(!entry)continue;
  posts.push(buildPost(day,{official:{day,size:sizeOf(entry)},imageExists,privateMedia}));
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
    'Alt text picture 1': post.imageAlt || '',
    Shortener: false,
    'Facebook Post Type': 'POST',
    Tags: 'Lumen,' + (post.eventId ? 'DefiDeLAvent' : post.kind === 'official' ? 'DefiDuJour' : 'MiniPuzzle'),
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
