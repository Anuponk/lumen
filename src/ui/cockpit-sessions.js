import {buildIncidentInvestigation,renderIncidentInvestigation} from './incident-investigation.js';
import {appendPlayerDates,dateNode,playerSyncStatus,DATE_SOURCE_DESCRIPTION} from './cockpit-dates.js';
const labels={session_start:'Ouverture enregistrée',attempt_started:'Quête commencée',puzzle_start:'Quête commencée',attempt_completed:'Quête réussie',puzzle_complete:'Quête réussie',attempt_reset:'Réinitialisation',attempt_abandoned:'Abandon',hint_used:'Indice utilisé',verify_used:'Vérification',guided_intervention:'Contrôle guidé',tutorial_complete:'Apprentissage terminé'};
const validDate=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const version=value=>typeof value==='string'&&/^\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}$/.test(value)?value:'unknown';
const views=new WeakMap();
export function rememberSessionExpansion(host){
 const previous=views.get(host);if(previous)for(const node of host.querySelectorAll('details[data-session-key]'))previous.expanded.set(node.dataset.sessionKey,node.open);
}
export function buildPlayerSessions(data){
 const groups=new Map();
 const group=(key,kind,identified=true)=>{if(!groups.has(key))groups.set(key,{key,kind,identified,events:[],episodes:[],state:'unknown',versions:[]});return groups.get(key)};
 for(const [i,row] of (Array.isArray(data?.analytics)?data.analytics:[]).slice(0,100).entries()){
  if(!row||!Object.hasOwn(labels,row.event_name))continue;
  const identified=typeof row.session_id==='string'&&/^(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9]{13}-[a-z0-9]{1,20})$/i.test(row.session_id);
  const current=group('analytics:'+(identified?row.session_id:'unknown-'+i),'analytics',identified);
  current.events.push({code:row.event_name,at:validDate(row.occurred_at),version:version(row.app_version),
   quest:Number.isInteger(row.quest_ordinal)&&row.quest_ordinal>0?row.quest_ordinal:null});
 }
 const diagnostics=(Array.isArray(data?.diagnostics)?data.diagnostics:[]).slice(0,100);
 for(const episode of buildIncidentInvestigation({timeline:diagnostics}).episodes){
  const current=group('diagnostic:'+episode.events[0].session_id,'diagnostic');current.episodes.push(episode);
  for(const event of episode.events){
   const raw=diagnostics.find(row=>row.session_id?.toLowerCase()===event.session_id&&row.trace_id?.toLowerCase()===event.trace_id&&row.sequence===event.sequence);
   current.events.push({code:event.code,at:validDate(raw?.occurred_at),version:event.app_version,sequence:event.sequence});
  }
  current.state=current.episodes.some(e=>e.state==='blocked')?'blocked':current.episodes.every(e=>e.state==='released')?'released':'unknown';
 }
 for(const current of groups.values()){
  current.events.sort((a,b)=>(a.at||'').localeCompare(b.at||'')||(a.sequence||0)-(b.sequence||0));
  current.start=current.events.find(e=>e.at)?.at??null;current.end=current.events.findLast(e=>e.at)?.at??null;
  current.versions=[...new Set(current.events.map(e=>e.version))];
 }
 return [...groups.values()].sort((a,b)=>(b.end||'').localeCompare(a.end||'')||a.key.localeCompare(b.key));
}
function element(doc,tag,text){const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node}
function select(doc,label,values){const node=element(doc,'select');node.setAttribute('aria-label',label);for(const [value,text] of values){const option=element(doc,'option',text);option.value=value;node.append(option)}return node}

export function registeredPlayers(players,accounts=[]){
 const identities=new Map((Array.isArray(accounts)?accounts:[]).filter(a=>typeof a?.user_id==='string').map(a=>['u:'+a.user_id,a]));
 return (Array.isArray(players)?players:[]).filter(p=>p?.player_type==='authenticated'&&typeof p.player_key==='string'&&p.player_key.startsWith('u:')).slice(0,250).map(p=>{
  const account=identities.get(p.player_key);if(!account)return p;
  const email=String(account.email||'').trim(),nickname=String(account.nickname||'').trim();
  return {...p,email,display_name:nickname||email||p.display_name||p.player_label||'Compte inscrit'};
 });
}

const searchText=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr').trim();
export function playerMatchesSearch(player,query){
 const needle=searchText(query);return [player.display_name,player.email,player.player_label].some(value=>searchText(value).includes(needle));
}

export function renderPlayerDirectory(host,players,observations,{authorized=()=>false,onSelect=()=>{},now=Date.now()}={}){
 if(!host)return;host.replaceChildren();if(!authorized())return;
 const doc=host.ownerDocument,search=element(doc,'input');search.type='search';search.placeholder='Pseudo ou email';search.setAttribute('aria-label','Rechercher par pseudo ou email');
 const sort=select(doc,'Trier les joueurs',[['activity','Activité récente'],['auth','Connexion Auth récente'],['wallet','Dernier reçu portefeuille']]);
 const filter=select(doc,'Filtrer l’état observé',[['all','Tous les états'],['pending','En attente'],['failure','Problème signalé'],['unknown','Inconnu / ancien'],['confirmed','Sans attente observée']]);
 const controls=element(doc,'div');controls.className='admin-player-controls';controls.append(search,sort,filter);
 const sources=element(doc,'details');sources.dataset.dateSources='';sources.append(element(doc,'summary','Comprendre les statuts et les dates'),element(doc,'p','✓ Vert : sans attente observée. … Orange : en attente. ! Rouge : problème signalé. ? Gris : état inconnu ou signal de plus de 15 min. Un signal ancien ne prouve pas un problème actuel. '+DATE_SOURCE_DESCRIPTION));
 const list=element(doc,'div');list.className='admin-player-list';host.append(controls,sources,list);
 const draw=()=>{
  list.replaceChildren();if(!authorized())return;
  const rows=registeredPlayers(players).filter(p=>playerMatchesSearch(p,search.value)&&
   (filter.value==='all'||playerSyncStatus(observations?.players?.[p.player_key],{now}).state===filter.value));
  const date=p=>{const proof=observations?.players?.[p.player_key];return Date.parse(sort.value==='auth'?proof?.auth_at:sort.value==='wallet'?proof?.domains?.wallet:p.last_seen)||0};
  rows.sort((a,b)=>date(b)-date(a)||String(a.player_key).localeCompare(String(b.player_key)));
  if(!rows.length)list.append(element(doc,'p','Aucun joueur pour ces filtres.'));
  for(const p of rows){
   const proof=observations?.players?.[p.player_key],status=playerSyncStatus(proof,{now});
   const card=element(doc,'article');card.className='admin-player';card.dataset.syncState=status.state;
   const header=element(doc,'div');header.className='admin-player-head';
   const button=element(doc,'button',String(p.display_name||p.player_label||p.player_type||'Joueur'));button.type='button';button.setAttribute('aria-label','Consulter les sessions de '+button.textContent);
   button.setAttribute('aria-controls','adminTimeline');
   button.onclick=()=>{if(authorized()&&host.contains(button))onSelect(p.player_key)};
   const badge=element(doc,'span',status.icon+' '+status.label);badge.className='admin-sync-badge';badge.title=status.description;
   header.append(button,badge);card.append(header,element(doc,'p',`Q${p.current_quest||'—'} · ${Number(p.sessions)||0} session(s)`));
   const details=element(doc,'details');details.className='admin-player-proof';details.append(element(doc,'summary','Détails de synchronisation'));
   details.append(element(doc,'p',status.description));
   const dates=element(doc,'div');dates.className='admin-player-dates';appendPlayerDates(dates,p,proof,{explain:false});details.append(dates);card.append(details);list.append(card);
  }
 };
 search.oninput=draw;sort.onchange=draw;filter.onchange=draw;draw();
}

export function renderPlayerSessions(host,data,{authorized=()=>false,scope='',targetSession=null}={}){
 if(!host)return;
 const previous=views.get(host);
 if(previous?.scope===scope)for(const node of host.querySelectorAll('details[data-session-key]'))previous.expanded.set(node.dataset.sessionKey,node.open);
 const state=previous?.scope===scope?previous:{scope,expanded:new Map(),version:'all',status:'all'};
 views.set(host,state);host.replaceChildren();if(!authorized()){views.delete(host);return}
 const doc=host.ownerDocument,sessions=buildPlayerSessions(data),versions=[...new Set(sessions.flatMap(s=>s.versions))].sort();
 const note=element(doc,'p','Sessions applicatives et épisodes techniques observés · échantillon borné à 100 événements par source. Les horodatages et durées décrivent la portion visible. Une session analytique est réutilisée après rechargement pendant 30 min d’inactivité et peut être partagée entre onglets ; ce n’est ni une connexion Auth ni une preuve d’appareil. Les sessions de diagnostic utilisent une identité distincte et ne sont pas fusionnées.');
 const help=element(doc,'details');help.append(element(doc,'summary','Comprendre les sessions et les limites de cet échantillon'),note);host.append(help);
 const versionFilter=select(doc,'Filtrer les sessions par version',[['all','Toutes les versions'],...versions.map(v=>[v,v])]);
 const filter=select(doc,'Filtrer les sessions par état',[['all','Tous les états'],['blocked','Blocage observé'],['released','Libération observée'],['unknown','État indéterminé']]);
 versionFilter.value=versions.includes(state.version)?state.version:'all';filter.value=state.status;
 const list=element(doc,'div');host.append(versionFilter,filter,list);
 function draw(){
  for(const node of list.querySelectorAll('details[data-session-key]'))state.expanded.set(node.dataset.sessionKey,node.open);
  list.replaceChildren();if(!authorized())return;
  state.version=versionFilter.value;state.status=filter.value;
  const visible=sessions.filter(s=>(state.version==='all'||s.versions.includes(state.version))&&(state.status==='all'||s.state===state.status));
  if(!visible.length)list.append(element(doc,'p','Aucune session pour ces filtres.'));
  for(const [i,session] of visible.entries()){
   const card=element(doc,'details');card.dataset.sessionKey=session.key;card.open=state.expanded.get(session.key)??session.key===targetSession;
   const title=element(doc,'summary');title.append(`${session.kind==='diagnostic'?'Session de diagnostic':'Session analytique'} ${i+1}${session.identified?'':' · identité indisponible'} · ${session.events.length} événement(s) · ${session.state==='blocked'?'blocage observé':session.state==='released'?'libération observée':'état inconnu'} · `,dateNode(doc,session.start),' → ',dateNode(doc,session.end));
   title.setAttribute('aria-expanded',String(card.open));card.ontoggle=()=>{title.setAttribute('aria-expanded',String(card.open));if(authorized()&&host.contains(card))state.expanded.set(session.key,card.open)};card.append(title);
   const seconds=session.start&&session.end?Math.max(0,(Date.parse(session.end)-Date.parse(session.start))/1000):null;
   card.append(element(doc,'p',`Version : ${session.versions.join(', ')} · Appareil : indisponible${seconds!==null?' · Intervalle observé : '+seconds+' s':''}`));
   const timeline=element(doc,'ol');timeline.className='admin-session-events';
   for(const event of session.events){const item=element(doc,'li');item.append(dateNode(doc,event.at),' · '+(labels[event.code]||event.code)+(event.quest?' · Q'+event.quest:''));timeline.append(item)}
   card.append(timeline);
   list.append(card);
   if(session.kind==='diagnostic'){
    const incidents=element(doc,'div');incidents.className='diagnostic-incidents';
    const rows=data.diagnostics.filter(e=>'diagnostic:'+String(e.session_id).toLowerCase()===session.key);
    card.append(incidents);renderIncidentInvestigation(incidents,{timeline:rows},{authorized:()=>authorized()&&host.contains(card)});
   }
  }
 }
 versionFilter.onchange=draw;filter.onchange=draw;draw();
}
