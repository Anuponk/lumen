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
