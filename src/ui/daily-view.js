// Défi du jour (#882) — pure presentation helpers (escaped strings only).
// The screen wiring lives in game-screen.js; data comes from the server
// contracts (one result row feeds both rankings).

export function escapeDaily(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}

export function formatDailyDate(day){
 const [y,m,d]=String(day).split('-').map(Number);
 return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d,12)));
}
export function formatRemaining(ms){
 const minutes=Math.floor(Math.max(0,Number(ms)||0)/60000);
 if(minutes<1)return 'moins d’une minute';
 const h=Math.floor(minutes/60),m=minutes%60;
 return h?h+' h '+String(m).padStart(2,'0'):m+' min';
}
export function formatRank(rank){return rank===1?'1er':rank+'e'}

const ERRORS=Object.freeze({
 account_required:'Connecte-toi pour être classé. Tu peux jouer cette grille en entraînement non classé.',
 nickname_required:'Choisis ton pseudonyme public pour être classé.',
 daily_disabled:'Le défi du jour n’est pas encore ouvert.',
 daily_unavailable:'Le défi du jour n’est pas disponible pour le moment.',
 cloud_unavailable:'Connexion nécessaire pour la tentative classée. L’entraînement reste possible.'
});
export function dailyErrorMessage(error){return ERRORS[String(error?.message||error||'')]||'Défi du jour indisponible pour le moment. Réessaie plus tard.'}

// Top 3 (ties share a rank) + my position when outside the top, real
// participant count, explicit empty states. Never invents a player.
export function renderDailyBoard(part,{scope='general',formatDuration=s=>s+' s'}={}){
 const top=Array.isArray(part?.top)?part.top:[],total=Number(part?.participants)||0,me=part?.me;
 if(!total||!top.length){
  return '<p class="daily-board-empty">'+(scope==='friends'?'Aucun de tes amis n’a encore relevé le défi du jour.':'Personne n’est encore classé aujourd’hui.')+'</p>';
 }
 const row=(rank,nickname,score,mine)=>'<li class="daily-board-row'+(mine?' mine':'')+'"><span class="daily-board-rank">'+escapeDaily(formatRank(rank))+'</span><span class="daily-board-name">'+escapeDaily(mine?nickname+' (toi)':nickname)+'</span><span class="daily-board-time">'+escapeDaily(formatDuration(score))+'</span></li>';
 const inTop=top.some(r=>r.mine);
 let html='<ol class="daily-board-list">'+top.map(r=>row(r.rank,r.nickname,r.score,r.mine)).join('')+'</ol>';
 if(me&&!inTop)html+=me.rank?'<p class="daily-board-me">Ta position : <strong>'+escapeDaily(formatRank(me.rank))+'</strong> · '+escapeDaily(formatDuration(me.score))+'</p>':'<p class="daily-board-me">Ton temps : '+escapeDaily(formatDuration(me.score))+' · hors classement général (désinscription)</p>';
 if(scope==='friends'&&total===1&&top[0]?.mine)html+='<p class="daily-board-empty">Aucun de tes amis n’a encore joué aujourd’hui.</p>';
 return html+'<p class="daily-board-count">'+total+' participant'+(total>1?'s':'')+(scope==='friends'?' parmi toi et tes amis':'')+'</p>';
}

// Weekly summary (#882 PR C): the player's own week only.
const DAY_LABELS={completed:'réussi',abandoned:'abandonné',started:'en cours',missed:'non joué',future:'à venir'};
function shortDay(day){const [y,m,d]=String(day).split('-').map(Number);return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d,12)))}
export function formatWeekRange(monday,sunday){return 'Semaine du '+shortDay(monday)+' au '+shortDay(sunday)}
export function renderDailyWeek(summary,{formatDuration=s=>s+' s'}={}){
 const cell=d=>{
  const mark=d.state==='completed'?(d.podium?'★':'✓'):d.state==='abandoned'?'✕':d.state==='started'?'…':d.state==='missed'?'·':'';
  const detail=[formatDailyDate(d.day),DAY_LABELS[d.state],d.score!==null?formatDuration(d.score):null,d.generalRank?formatRank(d.generalRank)+' général':null,d.state==='completed'&&!d.final?'provisoire':null].filter(Boolean).join(' · ');
  return '<li class="daily-week-day '+d.state+(d.podium?' podium':'')+(d.state==='completed'&&!d.final?' provisional':'')+'" title="'+escapeDaily(detail)+'"><span class="daily-week-letter">'+d.letter+'</span><span class="daily-week-mark" aria-hidden="true">'+mark+'</span><span class="daily-sr">'+escapeDaily(detail)+'</span></li>';
 };
 const stat=(label,value)=>'<div class="daily-week-stat"><dt>'+label+'</dt><dd>'+value+'</dd></div>';
 const rank=b=>b?'<strong>'+formatRank(b.rank)+'</strong>'+(b.total?' sur '+b.total:'')+' · '+escapeDaily(formatDailyDate(b.day)):'—';
 const highlights=summary.days.filter(d=>d.podium||d.friendsWin).map(d=>'<li>'+escapeDaily(formatDailyDate(d.day))+' : '+[d.podium?'podium général ('+formatRank(d.generalRank)+')':null,d.friendsWin?'1er parmi tes amis':null].filter(Boolean).join(' et ')+(d.final?'':' (provisoire)')+'</li>');
 const empty=summary.participations?'':'<p class="daily-empty">'+(summary.openDays?'Aucun défi du jour joué cette semaine.':'Cette semaine commence : le premier défi t’attend.')+'</p>';
 return '<ol class="daily-week-days" aria-label="Jours de la semaine">'+summary.days.map(cell).join('')+'</ol>'+empty
  +'<dl class="daily-week-stats">'+stat('Participations','<strong>'+summary.participations+'/7</strong>')
  +stat('Meilleur rang général',rank(summary.bestGeneral))+stat('Meilleur rang entre amis',rank(summary.bestFriends))
  +stat('Podiums',String(summary.podiums))+stat('1ères places entre amis',String(summary.friendsWins))
  +stat('Meilleur temps',summary.bestTime?'<strong>'+formatDuration(summary.bestTime.score)+'</strong> · '+escapeDaily(formatDailyDate(summary.bestTime.day)):'—')+'</dl>'
  +(highlights.length?'<ul class="daily-week-highlights">'+highlights.join('')+'</ul>':'')
  +'<p class="daily-week-state">'+(summary.frozen?'Semaine terminée : classements figés.':summary.provisional?'Classements provisoires : chaque jour est figé 6 h après sa fin.':'Semaine en cours.')+'</p>';
}
