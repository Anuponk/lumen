import {buildIncidentInvestigation,renderIncidentInvestigation} from './incident-investigation.js';
import {dateNode} from './cockpit-dates.js';
import {playerHealth,healthCounts} from './player-health.js';
import {createTranslator} from './i18n.js';
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

// #708 (recette 24/11): one dense, sortable and filterable table answers « which
// players really have a problem? » at a glance. Health (last known state) and
// freshness (last technical check) are separate columns; technical evidence stays
// in the player's folded detail. Filters, sort and search survive a refresh.
const tableViews=new WeakMap();
const SEVERITY={trouble:0,pending:1,unknown:2,healthy:3};
const FILTER_KEYS={all:'admin.players.filter.all',trouble:'admin.players.filter.trouble',pending:'admin.players.filter.pending',unknown:'admin.players.filter.unknown',healthy:'admin.players.filter.healthy'};
const COLUMN_KEYS={name:'admin.players.column.name',health:'admin.players.column.health',game:'admin.players.column.game',quest:'admin.players.column.quest',pending:'admin.players.column.pending',web:'admin.players.column.web',android:'admin.players.column.android',check:'admin.players.column.check',reports:'admin.players.column.reports'};
const defaultT=createTranslator().t;
export function renderPlayerDirectory(host,players,healthData,{authorized=()=>false,onSelect=()=>{},onReports=()=>{},now=Date.now(),t=defaultT}={}){
 if(!host)return;host.replaceChildren();if(!authorized())return;
 const locale=t('admin.dateLocale'),full=value=>new Date(value).toLocaleString(locale);
 const shortDate=value=>{const at=Date.parse(value);return Number.isFinite(at)?new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(at):null};
 const dateCell=(value,empty)=>{
  const td=element(doc,'td'),text=shortDate(value);
  if(!text){td.textContent=empty;td.className='admin-cell-muted';return td}
  const time=element(doc,'time',text);time.dateTime=new Date(value).toISOString();time.title=full(value);td.append(time);return td;
 };
 const doc=host.ownerDocument,view=tableViews.get(host)||{filter:'all',sort:'health',dir:1,search:'',reports:false};tableViews.set(host,view);
 const rows=registeredPlayers(players).map(p=>{const model=playerHealth(healthData?.players?.[p.player_key],{now,t});return {p,model,name:String(p.display_name||p.player_label||t('admin.players.player'))}});
 const counts=healthCounts(rows.map(r=>r.model));
 const search=element(doc,'input');search.type='search';search.placeholder=t('admin.players.search');search.setAttribute('aria-label',t('admin.players.searchLabel'));search.value=view.search;
 const chips=element(doc,'div');chips.className='admin-health-filters';chips.setAttribute('role','group');chips.setAttribute('aria-label',t('admin.players.filterLabel'));
 for(const value of ['all','trouble','pending','unknown','healthy']){
  const chip=element(doc,'button',t(FILTER_KEYS[value],{count:counts[value]}));chip.type='button';chip.dataset.healthFilter=value;chip.setAttribute('aria-pressed',String(view.filter===value));
  chip.onclick=()=>{view.filter=value;for(const c of chips.children)c.setAttribute('aria-pressed',String(c===chip));draw()};chips.append(chip);
 }
 const reports=element(doc,'label');const reportsBox=element(doc,'input');reportsBox.type='checkbox';reportsBox.checked=view.reports;reports.append(reportsBox,' '+t('admin.players.openReports'));reports.className='admin-health-reports';
 const controls=element(doc,'div');controls.className='admin-player-controls';controls.append(search,reports);
 const help=element(doc,'details');help.dataset.dateSources='';help.append(element(doc,'summary',t('admin.players.helpTitle')),element(doc,'p',t('admin.players.helpHealth')),element(doc,'p',t('admin.players.helpDates')));
 const wrap=element(doc,'div');wrap.className='admin-player-table-wrap';
 const table=element(doc,'table');table.className='admin-player-table';
 const columns=['name','health','game','quest','pending','web','android','check','reports',null];
 const head=element(doc,'tr');
 for(const key of columns){
  const th=element(doc,'th');th.scope='col';
  if(key){const b=element(doc,'button',t(COLUMN_KEYS[key]));b.type='button';b.dataset.sort=key;b.onclick=()=>{view.dir=view.sort===key?-view.dir:1;view.sort=key;draw()};th.append(b);th.setAttribute('aria-sort',view.sort===key?(view.dir>0?'ascending':'descending'):'none')}
  else th.append(element(doc,'span',t('admin.players.column.action')));
  head.append(th);
 }
 const thead=element(doc,'thead');thead.append(head);const tbody=element(doc,'tbody');table.append(thead,tbody);wrap.append(table);
 const empty=element(doc,'p',t('admin.players.empty'));
 host.append(chips,controls,help,wrap,empty);
 const value={name:r=>r.name.toLocaleLowerCase(locale),health:r=>SEVERITY[r.model.state]*1e13-(Date.parse(r.model.gameAt)||0)/1e3,
  game:r=>-(Date.parse(r.model.gameAt)||0),quest:r=>-(Number(r.p.current_quest)||0),pending:r=>-r.model.pending,
  web:r=>r.model.web?.version||'~',android:r=>r.model.android?.version||'~',check:r=>-(Date.parse(r.model.observedAt)||0),reports:r=>-r.model.reports.open};
 function draw(){
  tbody.replaceChildren();if(!authorized())return;
  view.search=search.value;view.reports=reportsBox.checked;
  for(const th of head.children){const key=th.querySelector('button')?.dataset.sort;if(key)th.setAttribute('aria-sort',view.sort===key?(view.dir>0?'ascending':'descending'):'none')}
  const visible=rows.filter(r=>playerMatchesSearch(r.p,search.value)&&(view.filter==='all'||r.model.state===view.filter)&&(!view.reports||r.model.reports.open>0));
  const key=value[view.sort]||value.health;
  visible.sort((a,b)=>{const x=key(a),y=key(b);return (x<y?-1:x>y?1:0)*view.dir||a.name.localeCompare(b.name,locale)});
  empty.hidden=visible.length>0;
  for(const {p,model,name} of visible){
   const tr=element(doc,'tr');tr.dataset.health=model.state;tr.dataset.playerKey=p.player_key;
   const who=element(doc,'th');who.scope='row';who.append(element(doc,'span',name));tr.append(who);
   const health=element(doc,'td');const badge=element(doc,'span',model.icon+' '+model.label);badge.className='admin-health-badge';badge.title=model.reasons.join(' · ');
   health.append(badge);if(model.state!=='healthy')health.append(element(doc,'small',model.reasons[0]));tr.append(health);
   tr.append(dateCell(model.gameAt,t('admin.players.noQuest')));
   tr.append(element(doc,'td',p.current_quest?'Q'+p.current_quest:'—'));
   tr.append(element(doc,'td',model.devices?String(model.pending):'—'));
   const web=element(doc,'td',model.web?model.web.version.split(' ')[0]:t('admin.players.unknownVersion'));if(model.web)web.title=t('admin.players.webSeen',{version:model.web.version,date:full(model.web.at)});tr.append(web);
   const android=element(doc,'td',model.android?model.android.version:'—');android.title=model.android?t('admin.players.androidSeen',{date:full(model.android.at)}):t('admin.players.androidNone');tr.append(android);
   const check=dateCell(model.observedAt,t('admin.players.never'));if(model.observedAt)check.append(element(doc,'small',model.freshness));tr.append(check);
   const rep=element(doc,'td');
   if(model.reports.total){const b=element(doc,'button',model.reports.open?t('admin.players.reportsOpen',{count:model.reports.open}):t('admin.players.reportsDone',{count:model.reports.total}));b.type='button';b.onclick=()=>{if(authorized()&&host.contains(b))onReports(p.player_key,name)};rep.append(b)}
   else rep.textContent='—';
   tr.append(rep);
   const act=element(doc,'td'),button=element(doc,'button',t('admin.players.diagnostic'));button.type='button';button.setAttribute('aria-label',t('admin.players.diagnosticOf',{name}));button.setAttribute('aria-controls','adminTimeline');
   button.onclick=()=>{if(authorized()&&host.contains(button))onSelect(p.player_key)};act.append(button);tr.append(act);
   tbody.append(tr);
  }
 }
 search.oninput=draw;reportsBox.onchange=draw;draw();
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
