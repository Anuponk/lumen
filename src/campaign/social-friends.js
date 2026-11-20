// #35 (EPIC #881 Lot 2): optional friends and direct challenges for accounts.
// The public handle is the existing unique nickname; no email or technical ID
// is ever sent or displayed. Direct challenges reuse existing challenges (#18,
// #889 qualifying-run writer): there is no second challenge or qualification engine.

const ERRORS=Object.freeze({
 account_required:'Les amis demandent un compte. Les défis par lien restent ouverts à tous.',
 nickname_required:'Choisis d’abord ton pseudonyme public.',
 player_not_found:'Aucun joueur avec ce pseudonyme exact.',
 cannot_add_self:'C’est ton propre pseudonyme.',
 request_cooldown:'Cette demande ne peut pas être renvoyée pour le moment.',
 too_many_pending:'Trop de demandes en attente : patiente qu’elles soient acceptées.',
 rate_limited:'Trop de demandes aujourd’hui. Réessaie demain.',
 no_pending_request:'Cette demande n’est plus en attente.',
 not_related:'Ce joueur ne fait pas partie de tes amis.',
 not_friends:'Vous n’êtes pas (ou plus) amis.',
 not_challenge_owner:'Ce défi ne t’appartient pas.'
});
export function friendErrorMessage(error){
 const code=String(error?.message||error||'');
 return ERRORS[code]||'Action impossible pour le moment. Réessaie plus tard.';
}

export const CHALLENGE_STATUS_LABELS=Object.freeze({pending:'En attente',started:'Commencé',completed:'Terminé',abandoned:'Abandonné'});
export function challengeStatusLabel(status){return CHALLENGE_STATUS_LABELS[String(status||'pending').toLowerCase()]||CHALLENGE_STATUS_LABELS.pending}

export const FRIEND_STATE_LABELS=Object.freeze({friends:'Ami',incoming:'Demande reçue',outgoing:'Demande envoyée'});

export function normalizeNickname(value){return String(value||'').trim().replace(/\s+/g,' ').slice(0,20)}
export function validNickname(value){const v=normalizeNickname(value);return v.length>=3&&/^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u.test(v)}

export function createFriendsClient(supabase){
 async function rpc(name,args={}){
  if(!supabase)throw new Error('account_required');
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw new Error(error.message||'unavailable');
  return data;
 }
 return {
  search:nickname=>rpc('lumen_friend_search',{p_nickname:normalizeNickname(nickname)}),
  request:nickname=>rpc('lumen_friend_request',{p_nickname:normalizeNickname(nickname)}),
  respond:(nickname,accept)=>rpc('lumen_friend_respond',{p_nickname:normalizeNickname(nickname),p_accept:!!accept}),
  remove:nickname=>rpc('lumen_friend_remove',{p_nickname:normalizeNickname(nickname)}),
  list:async()=>(await rpc('lumen_friend_list'))||[],
  sendChallenge:(challengeId,nickname)=>rpc('lumen_challenge_send_to_friend',{p_challenge_id:challengeId,p_nickname:normalizeNickname(nickname)}),
  inbox:async()=>{const data=await rpc('lumen_challenge_inbox');return {received:data?.received||[],sent:data?.sent||[]}}
 };
}

// Pure renderers (escaped). Buttons carry data attributes; the screen binds
// them by delegation. Only nicknames, quest numbers and statuses are shown.
export function escapeSocialHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
const button=(action,label,attr)=>'<button type="button" '+attr+'="'+action+'">'+label+'</button>';
export function renderFriendRows(list=[]){
 if(!list.length)return '<p class="social-note">Aucun ami pour le moment. Ajoute un joueur avec son pseudonyme exact.</p>';
 return list.map(row=>{
  const name=escapeSocialHtml(row.nickname),actions=row.state==='incoming'?button('accept','Accepter','data-friend-action')+button('decline','Refuser','data-friend-action'):row.state==='friends'?button('remove','Retirer','data-friend-action'):button('remove','Annuler','data-friend-action');
  return '<div class="friend-row" data-nickname="'+name+'"><span class="friend-name">'+name+'</span><span class="friend-state">'+escapeSocialHtml(FRIEND_STATE_LABELS[row.state]||'')+'</span><span class="friend-actions">'+actions+'</span></div>';
 }).join('');
}
export function renderReceivedChallenges(list=[],questLabel=()=>'Quête'){
 if(!list.length)return '<p class="social-note">Aucun défi reçu d’un ami.</p>';
 return list.map(row=>{
  const closed=['completed','abandoned'].includes(row.status),provenance=row.source_first_play===false?' · rejeu qualifiant':'';
  return '<div class="friend-row friend-challenge" data-challenge-id="'+escapeSocialHtml(row.challenge_id)+'"><span class="friend-name">'+escapeSocialHtml(row.sender||'Joueur')+'</span><span class="friend-state">'+escapeSocialHtml(questLabel(row))+provenance+' · '+escapeSocialHtml(challengeStatusLabel(row.status))+'</span><span class="friend-actions">'+button(closed?'result':'play',closed?'Voir le résultat':row.status==='started'?'Reprendre':'Jouer','data-challenge-action')+'</span></div>';
 }).join('');
}
export function renderSentChallenges(list=[],questLabel=()=>'Quête',formatDuration=s=>s+' s'){
 if(!list.length)return '<p class="social-note">Aucun défi envoyé à un ami.</p>';
 return list.map(row=>'<div class="friend-row"><span class="friend-name">'+escapeSocialHtml(row.recipient||'Joueur')+'</span><span class="friend-state">'+escapeSocialHtml(questLabel(row))+' · '+escapeSocialHtml(challengeStatusLabel(row.status))+(row.status==='completed'&&Number.isFinite(Number(row.duration_seconds))?' · '+escapeSocialHtml(formatDuration(Number(row.duration_seconds))):'')+'</span></div>').join('');
}
export function friendsOnly(list=[]){return list.filter(row=>row.state==='friends')}
