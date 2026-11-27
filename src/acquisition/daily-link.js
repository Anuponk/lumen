import {civilDay, dailyPresentation, validDay} from '../campaign/seasonal-events.js';

const COPY={
 fr:{future:'Ce défi n’est pas encore ouvert.',expired:'Ce défi est terminé. Le lien ci-dessous ouvre le véritable défi d’aujourd’hui.',invalid:'Cette date de défi est invalide.',play:'Jouer au défi d’aujourd’hui',guest:'Sans compte : entraînement non classé, sans installation.'},
 en:{future:'This challenge is not open yet.',expired:'This challenge has ended. The link below opens today’s real challenge.',invalid:'This challenge date is invalid.',play:'Play today’s challenge',guest:'No account: unranked training, no installation.'},
 es:{future:'Este reto aún no está abierto.',expired:'Este reto ha terminado. El enlace abre el reto real de hoy.',invalid:'La fecha de este reto no es válida.',play:'Jugar al reto de hoy',guest:'Sin cuenta: entrenamiento sin clasificación ni instalación.'},
};
export function dailyDestination(day,{today=civilDay(),search=''}={}){
 const state=!validDay(day)?'invalid':day>today?'future':day<today?'expired':'today';
 const url=new URL('/?daily=1','https://lumen.nopuna.fr');
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
 root.querySelector('h1').textContent=p.title;
 root.querySelector('[data-status]').textContent=copy[result.state]??copy.guest;
 const link=root.querySelector('[data-play]');link.href=result.href;link.textContent=copy.play;
 root.querySelector('[data-guest]').textContent=copy.guest;
 if(result.state==='today'&&redirect)win.location.replace(result.href);
 return result;
}
if(typeof document!=='undefined'){
 const root=document.getElementById('daily-link');if(root)mountDailyLink(root);
}
