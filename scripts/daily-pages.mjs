// Static dated landing pages: no board data, solution, account or write.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {dailyPresentation,validDay} from '../src/campaign/seasonal-events.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderDailyLinkPage(day){
 const p=dailyPresentation(day),title=p.title+' LUMEN'+(validDay(day)?' · '+day:'');
 const url='https://lumen.nopuna.fr/d/'+(validDay(day)?day+'/':'');
 const image='https://lumen.nopuna.fr/src/landing/'+(p.event?'advent-og.jpg':'og.jpg');
 const description='Une nouvelle grille LUMEN à résoudre. Joue gratuitement, sans compte ni installation.';
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${description}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${description}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escape(p.title)} LUMEN">
<link rel="stylesheet" href="/src/landing/landing.css"><link rel="stylesheet" href="/src/campaign/winter-stars.css"><script type="module" src="/src/acquisition/daily-link.js"></script></head>
<body><main id="daily-link" data-day="${validDay(day)?day:''}" data-seasonal="${p.event?.skin.id??''}"><section class="daily-landing-card" aria-labelledby="daily-link-title"><div class="winter-garland" aria-hidden="true"></div><div class="winter-starlight" aria-hidden="true"></div><p class="brand">✦ LUMEN</p><p class="daily-landing-day" data-day-label>${escape(p.dayLabel)}</p><h1 id="daily-link-title">${escape(p.title)}</h1><p class="lead" data-status>Le défi ouvre à sa date, heure de Paris.</p><p class="cta"><a class="play" data-play href="/?daily=1&amp;dailyLink=1">Relever le défi d’aujourd’hui</a></p><p class="cta-note" data-guest>Joue gratuitement, sans compte ni installation.</p></section></main></body></html>\n`;
}
export function dailyPages(){
 const schedule=JSON.parse(fs.readFileSync(path.join(root,'content/generated/daily-schedule.json'),'utf8'));
 return new Map([['d/index.html',renderDailyLinkPage(null)],...schedule.days.filter(e=>e.day>='2026-12-01'&&e.day<='2027-01-31').map(e=>['d/'+e.day+'/index.html',renderDailyLinkPage(e.day)])]);
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/daily-pages.mjs')){
 for(const [file,text] of dailyPages()){
  const target=path.join(root,file);
  if(process.argv.includes('--check')){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==text)throw Error('Stale '+file)}
  else{fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text)}
 }
 console.log('daily-pages: dated real-daily links checked/generated');
}
