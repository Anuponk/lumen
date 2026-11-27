import {civilDay, dailyPresentation, validDay} from '../campaign/seasonal-events.js';

const COPY={
 fr:{future:'Ce défi ouvre le {date}. Une autre grille t’attend aujourd’hui.',expired:'Ce défi est terminé. Une nouvelle grille t’attend aujourd’hui.',invalid:'Cette date de défi est invalide.',play:'Relever le défi d’aujourd’hui',guest:'Joue gratuitement, sans compte ni installation.'},
 en:{future:'This challenge opens on {date}. There’s another puzzle to play today.',expired:'This challenge has ended. A new puzzle awaits today.',invalid:'This challenge date is invalid.',play:'Play today’s challenge',guest:'Play for free, with no account or installation.'},
 es:{future:'Este reto abre el {date}. Hoy te espera otra cuadrícula.',expired:'Este reto ha terminado. Hoy te espera una nueva cuadrícula.',invalid:'La fecha de este reto no es válida.',play:'Jugar al reto de hoy',guest:'Juega gratis, sin cuenta ni instalación.'},
};
export function dailyDestination(day,{today=civilDay(),search=''}={}){
 const state=!validDay(day)?'invalid':day>today?'future':day<today?'expired':'today';
 const url=new URL('/?daily=1&dailyLink=1','https://lumen.nopuna.fr');
 const params=new URLSearchParams(search);
 // Public attribution only. Never carry future dates, training, test, auth tokens
 // or arbitrary URL flags into the real game.
 for(const key of ['utm_source','utm_medium','utm_campaign']){
  const value=params.get(key);if(value&&/^[a-zA-Z0-9_.-]{1,64}$/.test(value))url.searchParams.set(key,value);
 }
 return {state,href:url.pathname+url.search};
}
export function mountDailyLink(root,{day=root.dataset.day,now=()=>new Date(),win=window,redirect=true}={}){
 let preferred;try{preferred=win.localStorage.getItem('lumen.locale')}catch{}
 const locale=[new URLSearchParams(win.location.search).get('lang'),preferred,win.navigator.language].map(v=>v?.split('-')[0]).find(v=>COPY[v])??'fr';
 const copy=COPY[locale],result=dailyDestination(day,{today:civilDay(now()),search:win.location.search});
 const p=dailyPresentation(validDay(day)?day:civilDay(now()),locale);
 root.ownerDocument.documentElement.lang=locale;
 root.dataset.state=result.state;
 root.dataset.seasonal=p.event?.skin.id??'';
 root.querySelector('h1').textContent=p.title;
 root.querySelector('[data-day-label]').textContent=p.dayLabel;
 const date=validDay(day)?new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z')):'';
 root.querySelector('[data-status]').textContent=copy[result.state]?.replace('{date}',date)??'';
 const link=root.querySelector('[data-play]');link.href=result.href;link.textContent=copy.play;
 root.querySelector('[data-guest]').textContent=copy.guest;
 if(result.state==='today'&&redirect)win.location.replace(result.href);
 return result;
}
if(typeof document!=='undefined'){
 const root=document.getElementById('daily-link');if(root)mountDailyLink(root);
}
