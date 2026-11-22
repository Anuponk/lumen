import {playerSyncStatus} from './cockpit-dates.js';
import {buildIncidentInvestigation} from './incident-investigation.js';
import {registeredPlayers} from './cockpit-sessions.js';

const states=new WeakMap();
const rows=value=>Array.isArray(value)?value:[];
const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const records=value=>rows(value).filter(record);
// #962: bounded device storage health carried by outbox alerts (buckets and category only).
export function storageAlertLine(alert){
 const kb=Number(alert?.storage_kb),ratio=Number(alert?.storage_ratio),error=alert?.storage_error;
 const parts=[];
 if(alert?.storage_kb!=null&&Number.isFinite(kb))parts.push('Stockage local ≈ '+(kb>=1024?(kb/1024).toFixed(1).replace('.',',')+' Mo':kb+' Ko')+(Number.isFinite(ratio)&&alert?.storage_ratio!=null?' ('+ratio+' %)':''));
 if(error==='quota')parts.push('écriture refusée : stockage plein');else if(error==='storage')parts.push('écriture locale en échec');
 return parts.join(' · ');
}
export function observedCount(value){
 if(!['number','string'].includes(typeof value)||(typeof value==='string'&&!value.trim()))return null;
 const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;
}
const number=value=>value===null?'—':new Intl.NumberFormat('fr-FR').format(value);
const version=value=>String(value??'').match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}\b/)?.[0]||'Version inconnue';
const reasons={network:'Réseau',storage_quota:'Stockage saturé',storage_unavailable:'Stockage indisponible',backup_unverified:'Copie locale non vérifiée',local_install_unverified:'Installation locale non vérifiée',local_divergence:'Divergence locale',cloud_local_divergence:'Divergence local/cloud',mutable_balance:'Solde à vérifier',mutable_ledger:'Historique à vérifier',reward_conflict:'Conflit de récompense',canonical_reward_conflict:'Conflit de récompense',legacy_command_required:'Reprise de commande nécessaire',unknown:'Cause non précisée'};

// Reuse the already authorised Lumen account response, including accounts without
// optional product events. Never invent activity, session counts or progression.
export function analyticsPlayers(recent,accounts){
 const observed=registeredPlayers(recent,accounts),byKey=new Map(observed.map(player=>[player.player_key,player])),merged=[];
 for(const account of rows(accounts)){
  if(typeof account?.user_id!=='string'||!account.user_id)continue;
  const key='u:'+account.user_id,existing=byKey.get(key);
  if(merged.some(player=>player.player_key===key))continue;
  merged.push(existing||{player_key:key,player_type:'authenticated',last_seen:account.last_activity??undefined,sessions:null,current_quest:null});byKey.delete(key);
 }
 return registeredPlayers([...merged,...byKey.values()],accounts).slice(0,250);
}

export function buildAnalyticsDashboard({product=null,quests=null,health=null,players=[],observations=null,catalogue=[],days=7,now=Date.now()}={}){
 product=record(product)?product:null;quests=record(quests)?quests:null;health=record(health)?health:null;
 const byId=new Map(),byOrdinal=new Map();
 for(const pack of rows(catalogue))for(const constellation of rows(pack.constellations))for(const quest of rows(constellation.quests)){
  const entry={id:quest.id,ordinal:quest.number,packId:pack.id,pack:pack.name,constellation:constellation.name};
  byId.set(entry.id,entry);byOrdinal.set(entry.ordinal,entry);
 }
 let rejectedQuests=0;const seen=new Set(),journey=[];
 for(const row of rows(quests?.friction)){
  if(!record(row)){rejectedQuests++;continue}
  const ordinal=observedCount(row.quest_ordinal),known=row.stable_quest_id?byId.get(row.stable_quest_id):byOrdinal.get(ordinal);
  const key=row.stable_quest_id||'ordinal:'+ordinal;
  if(!ordinal||seen.has(key)||(known&&known.ordinal!==ordinal)){rejectedQuests++;continue}
  seen.add(key);
  const started=observedCount(row.started),completed=observedCount(row.completed),hints=observedCount(row.hints),resets=observedCount(row.resets);
  const signals=[];
  if(started!==null&&started>=5){
   if(completed!==null&&completed<started*.6)signals.push('Peu de fins observées');
   if(hints!==null&&hints>=started*.8)signals.push('Indices fréquents');
   if(resets!==null&&resets>=started)signals.push('Réinitialisations fréquentes');
  }
  const value=row.median_seconds,duration=['number','string'].includes(typeof value)&&String(value).trim()!==''?Number(value):NaN;
  journey.push({key,ordinal,packId:known?.packId||'unknown',pack:known?.pack||'Catalogue non rapproché',constellation:known?.constellation||'',
   started,completed,hints,resets,verifies:observedCount(row.verifies),abandons:observedCount(row.abandons),
   seconds:observedCount(row.observed_grid_revision)!==null&&Number.isFinite(duration)&&duration>=0?duration:null,
   durationSamples:observedCount(row.duration_samples),gridRevision:observedCount(row.observed_grid_revision),signals,
   smallSample:started===null||started<5,windowMismatch:started!==null&&completed!==null&&completed>started});
 }
 journey.sort((a,b)=>b.signals.length-a.signals.length||(b.started??-1)-(a.started??-1)||a.ordinal-b.ordinal);
 const population=rows(players).filter(p=>p?.player_type==='authenticated'&&typeof p.player_key==='string'&&p.player_key.startsWith('u:'));
 const playerStates=population.map(player=>{const status=playerSyncStatus(observations?.players?.[player.player_key],{now});return {key:player.player_key,label:player.display_name||player.player_label||'Joueur inscrit',state:status.state,icon:status.icon,statusLabel:status.label}});
 const priority=playerStates.filter(p=>['failure','pending'].includes(p.state)).sort((a,b)=>(a.state==='failure'?0:1)-(b.state==='failure'?0:1));
 const incidentModel=buildIncidentInvestigation(health?.diagnostics);
 return {
  days,healthDays:Math.min(90,Math.max(1,observedCount(days)??7)),now,productAvailable:!!product,questsAvailable:!!quests,healthAvailable:!!health,
  uniquePlayers:null,sessions:null,
  serviceAvailable:record(product?.service_activity),service:product?.service_activity||null,
  journey,rejectedQuests,
  milestones:records(quests?.funnel).map(row=>({label:String(row.label||'Jalon'),players:observedCount(row.players),uninstrumented:/tutoriel|apprentissage/i.test(row.label||'')})),
  daily:records(product?.daily).map(row=>({date:String(row.activity_date||''),players:observedCount(row.players)})).filter(row=>/^\d{4}-\d{2}-\d{2}$/.test(row.date)).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30),
  technical:{affected:observedCount(health?.affected_players),stalled:observedCount(health?.stalled_players),pending:observedCount(health?.outbox?.pending_players),
   critical:observedCount(health?.outbox?.critical_players),storagePressure:observedCount(health?.outbox?.storage_pressure_players),freshPending:observedCount(health?.outbox?.fresh_pending_players),freshCritical:observedCount(health?.outbox?.fresh_critical_players),failures:observedCount(health?.failures),conflicts:observedCount(health?.blocked),
   reasons:records(health?.by_reason).map(r=>({label:Object.hasOwn(reasons,r.reason)?reasons[r.reason]:'Autre cause',count:observedCount(r.count)})),
   versions:[...records(health?.by_version).reduce((map,r)=>{const label=version(r.version),count=observedCount(r.count);if(count!==null)map.set(label,(map.get(label)||0)+count);return map},new Map())].map(([label,count])=>({label,count})),
   signatures:incidentModel.signatures.slice().sort((a,b)=>b.occurrences-a.occurrences),priority,
   observedPlayers:population.length,playerStates,unknownPlayers:playerStates.filter(p=>p.state==='unknown').length,
   observationsAvailable:record(observations),alerts:records(health?.outbox?.alerts).slice(0,20)}
 };
}

function element(doc,tag,text,className){const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
function heading(host,kicker,title,copy){const doc=host.ownerDocument,header=element(doc,'div',undefined,'analytics-heading');header.append(element(doc,'p',kicker,'analytics-eyebrow'),element(doc,'h3',title),element(doc,'p',copy,'analytics-muted'));host.append(header)}
function card(host,label,value,copy){const doc=host.ownerDocument,node=element(doc,'div',undefined,'analytics-metric');node.append(element(doc,'span',label),element(doc,'strong',number(value)),element(doc,'small',copy));host.append(node)}
function notice(host,text,tone=''){host.append(element(host.ownerDocument,'p',text,'analytics-notice '+tone))}
function action(host,label,payload,options){const button=element(host.ownerDocument,'button',label,'analytics-action');button.type='button';button.dataset.dashboardAction=payload.type;button.onclick=()=>{if(options.authorized()&&host.isConnected&&host.contains(button))options.onAction(payload)};host.append(button);return button}
function group(host,title){const doc=host.ownerDocument,node=element(doc,'div',undefined,'analytics-block');node.append(element(doc,'h4',title));host.append(node);return node}
function bars(host,data,empty){
 const doc=host.ownerDocument,valid=data.filter(r=>r.count!==null),max=Math.max(1,...valid.map(r=>r.count));
 if(!valid.length){notice(host,empty);return}
 for(const row of valid){const line=element(doc,'div',undefined,'analytics-bar-row'),meter=element(doc,'meter');meter.min=0;meter.max=max;meter.value=row.count;meter.setAttribute('aria-label',row.label+' : '+number(row.count));line.append(element(doc,'span',row.label),meter,element(doc,'strong',number(row.count)));host.append(line)}
}
function questList(host,quests,options){
 if(!quests.length){notice(host,'Aucune observation de quête disponible pour cette période.');return}
 for(const quest of quests){const row=element(host.ownerDocument,'div',undefined,'analytics-list-row');row.append(element(host.ownerDocument,'strong','Q'+quest.ordinal+' · '+quest.pack),element(host.ownerDocument,'span',quest.signals.join(' · ')||(quest.smallSample?'Échantillon limité : à contextualiser':'Débuts et fins à comparer')));host.append(row);action(row,'Examiner la quête',{type:'quest',key:quest.key},options)}
}

function renderServiceQuests(host,model){
 const doc=host.ownerDocument,section=group(host,'Réussites confirmées par quête');
 if(!model.serviceAvailable){notice(section,'Source serveur indisponible ; aucune absence de jeu ne peut être conclue.');return}
 notice(section,'Reçus de jeu sur la période sélectionnée, comptes de test inclus. Les replays comptent comme réussites. Ces chiffres ne fournissent pas les débuts, les abandons ni un taux de réussite.');
 const search=element(doc,'input');search.type='search';search.placeholder='Rechercher une quête';search.setAttribute('aria-label','Filtrer les réussites serveur par quête');section.append(search);
 const list=element(doc,'div');section.append(list);
 const render=()=>{
  list.replaceChildren();let matches=0;
  for(const row of records(model.service.quests)){
   const ordinal=observedCount(row.quest_ordinal);if(!ordinal)continue;
   const label='Q'+ordinal;if(search.value&&!label.toLowerCase().includes(search.value.toLowerCase().trim()))continue;
   const item=element(doc,'div',undefined,'analytics-list-row');
   item.append(element(doc,'strong',label),element(doc,'span',number(observedCount(row.players))+' compte(s) · '+number(observedCount(row.completions))+' réussite(s) · '+number(observedCount(row.first_completions))+' première(s) réussite(s)'));
   list.append(item);matches++;
  }
  if(!matches)notice(list,'Aucune réussite reçue pour cette recherche et cette période.');
 };
 search.oninput=render;render();
}

export function renderAnalyticsDashboard(hosts,model,{authorized=()=>false,onAction=()=>{},scope=''}={}){
 const options={authorized,onAction};
 for(const host of Object.values(hosts))if(host)host.replaceChildren();
 if(!authorized())return;
 const {overview,journeys,technical}=hosts;
 if(overview){
  heading(overview,'VUE GÉNÉRALE','Que faut-il examiner ?','Deux lectures complémentaires : le parcours dans le jeu et les problèmes techniques observés.');
  const grid=element(overview.ownerDocument,'div',undefined,'analytics-columns');overview.append(grid);
  const product=group(grid,'Comprendre les parcours');
  const metrics=element(overview.ownerDocument,'div',undefined,'analytics-metrics');product.append(metrics);
  card(metrics,'Joueurs avec une réussite reçue',observedCount(model.service?.summary?.players),'Comptes distincts avec une opération de jeu confirmée sur la période.');
  card(metrics,'Quêtes avec une réussite reçue',observedCount(model.service?.summary?.quests),'Quêtes distinctes, rejouées ou terminées pour la première fois.');
  card(metrics,'Réussites reçues',observedCount(model.service?.summary?.completions),'Opérations confirmées et dédoublonnées, replays inclus.');
  card(metrics,'Premières réussites reçues',observedCount(model.service?.summary?.first_completions),'Couples compte/quête déclarés première réussite par le serveur.');
  notice(product,model.serviceAvailable?'Source : reçus du service. Date de réception serveur en UTC ; une partie hors ligne peut être reçue plus tard. Comptes de test inclus : ce chiffre ne mesure pas les joueurs humains actifs.':'Les statistiques serveur sont indisponibles. La migration de lecture doit être activée ; aucun zéro n’est supposé.',model.serviceAvailable?'':'warning');
  notice(product,'Collecte de parcours actuellement désactivée : ces données décrivent uniquement l’historique enregistré.','warning');
  if(!model.questsAvailable)notice(product,'Les statistiques de parcours sont indisponibles. La vue technique reste consultable.');
  else questList(product,model.journey.slice(0,3),options);
  action(product,'Analyser les parcours et les quêtes',{type:'section',section:'journeys'},options);
  const health=group(grid,'Identifier les problèmes techniques'),techMetrics=element(overview.ownerDocument,'div',undefined,'analytics-metrics');health.append(techMetrics);
  card(techMetrics,'Joueurs touchés',model.technical.affected,'Échecs d’hydratation ou réconciliations bloquées · '+model.healthDays+' jour(s).');
  card(techMetrics,'Joueurs avec une file en attente',model.technical.pending,'Dernier état connu, indépendamment de la période.');
  card(techMetrics,'Attente signalée récemment',model.technical.freshPending,'Signal reçu depuis moins de 15 minutes ; appareils silencieux non couverts.');
  if(!model.healthAvailable)notice(health,'La source technique est indisponible : aucun état de santé ne peut être conclu.','warning');
  else if(model.technical.stalled>0)notice(health,number(model.technical.stalled)+' joueur(s) avec un incident d’hydratation non résolu depuis plus de 15 minutes.','warning');
  else notice(health,'Une file en attente ou un échec temporaire ne prouve pas une perte de progression.');
  for(const player of model.technical.priority.slice(0,3))action(health,player.label+' · '+player.statusLabel,{type:'player',key:player.key},options);
  action(health,'Examiner la synchronisation et les incidents',{type:'section',section:'sync'},options);
  const activity=group(overview,'Activité enregistrée — dernières dates disponibles');
  activity.classList.add('analytics-activity');
  if(!model.serviceAvailable)notice(activity,'Source d’activité serveur indisponible.');else bars(activity,records(model.service.daily).slice(-30).map(r=>({label:String(r.activity_date),count:observedCount(r.players)})),'Aucune réussite reçue dans cette fenêtre.');
  notice(activity,'Jusqu’à 30 dates de réception UTC. Comptes avec une réussite reçue ce jour-là ; la date de jeu hors ligne n’est pas reconstruite.');
  const players=group(overview,'Dernières réussites — accès aux fiches');
  const known=new Map(model.technical.playerStates.map(p=>[p.key,p]));
  for(const row of records(model.service?.players).filter(p=>known.has(p.player_key)).slice(0,3)){
   const player=known.get(row.player_key);if(!player)continue;
   const item=element(players.ownerDocument,'div',undefined,'analytics-list-row');
   item.append(element(players.ownerDocument,'span',player.label+' · '+number(observedCount(row.completions))+' réussite(s) · '+number(observedCount(row.quests))+' quête(s)'));
   players.append(item);action(item,'Examiner '+player.label,{type:'player',key:player.key},options);
  }
  action(players,'Ouvrir l’annuaire des joueurs',{type:'section',section:'players'},options);
  notice(players,'Trois accès récents parmi les 250 comptes de cette source et l’annuaire chargé. Les dates de commit par domaine restent consultables dans la fiche joueur.');
 }
 if(journeys){
  heading(journeys,'PARCOURS JOUEURS','Où les joueurs avancent-ils moins facilement ?','Compare les débuts, les fins, les aides et les réinitialisations avant d’ouvrir le détail d’une quête.');
  notice(journeys,'Historique uniquement. Moins de cinq joueurs ayant commencé : échantillon limité. Débuts et fins dans une même période ne constituent pas une cohorte de tentatives.','warning');
  renderServiceQuests(journeys,model);
  const milestones=group(journeys,'Jalons observés');
  if(!model.questsAvailable)notice(milestones,'Statistiques de parcours indisponibles.');
  else bars(milestones,model.milestones.filter(r=>!r.uninstrumented).map(r=>({label:r.label,count:r.players})),'Aucun jalon observé.');
  notice(milestones,'Comptages indépendants de joueurs : l’ordre du parcours et les conversions entre étapes ne sont pas reconstruits. La fin du tutoriel n’est pas instrumentée actuellement.');
  renderJourneys(journeys,model,{...options,scope});
 }
 if(technical){
  heading(technical,'SANTÉ TECHNIQUE','Quels problèmes touchent les joueurs ?','Commence par les situations à vérifier, puis ouvre les sessions et les diagnostics pour établir la cause.');
  const metrics=element(technical.ownerDocument,'div',undefined,'analytics-metrics');technical.append(metrics);
  card(metrics,'Joueurs touchés',model.technical.affected,'Sur les '+model.healthDays+' derniers jours glissants.');
  card(metrics,'Joueurs avec hydratation non résolue > 15 min',model.technical.stalled,'État non résolu connu, même si son début est plus ancien.');
  card(metrics,'Joueurs signalant un risque local',model.technical.critical,'Signal critique de conservation locale ; perte non établie.');
  card(metrics,'Risques locaux signalés récemment',model.technical.freshCritical,'Dernier signal critique reçu depuis moins de 15 minutes.');
  card(metrics,'Joueurs au stockage local saturé',model.technical.storagePressure,'Stockage local ≥ 80 % (environ 10 Mo) ou écriture refusée depuis moins de 7 jours (#962).');
  if(!model.healthAvailable)notice(technical,'Source technique indisponible : les zéros ne peuvent pas être supposés.','warning');
  notice(technical,'Hydratation : '+model.healthDays+' jour(s) glissants. Files : état connu hors filtre de période. Diagnostics facultatifs : '+Math.min(7,model.healthDays)+' jour(s) maximum, échantillon incomplet. Les populations se recoupent et ne s’additionnent pas.');
  const queues=group(technical,'Files nécessitant une vérification');
  if(!model.technical.alerts.length)notice(queues,model.healthAvailable?'Aucune alerte de file dans la réponse disponible.':'Les alertes de file sont indisponibles.');
  for(const alert of model.technical.alerts){
   const row=element(technical.ownerDocument,'div',undefined,'analytics-list-row');
   const label={critical:'Conservation locale à risque',review:'Revue nécessaire',auth:'Connexion à vérifier',pending:'Attente observée'}[alert.state]||'État à vérifier';
   row.append(element(technical.ownerDocument,'small',alert.fresh===true?'Signal de moins de 15 minutes':'Signal ancien ou fraîcheur inconnue'));
   row.append(element(technical.ownerDocument,'strong',label+' · '+number(observedCount(alert.pending))+' opération(s)'),element(technical.ownerDocument,'span',version(alert.version)));
   const stamp=Date.parse(alert.since);
   const storageLine=storageAlertLine(alert);if(storageLine)row.append(element(technical.ownerDocument,'span',storageLine));
   if(Number.isFinite(stamp)){const date=element(technical.ownerDocument,'time','Plus ancienne opération signalée : '+new Date(stamp).toLocaleString('fr-FR'));date.dateTime=new Date(stamp).toISOString();date.title=date.dateTime;row.append(date)}
   queues.append(row);
  }
  notice(queues,'État envoyé par les appareils, pouvant être ancien. Ces alertes ne donnent pas l’identité du compte ; aucun rapprochement avec un joueur n’est inventé.');
  const players=group(technical,'Joueurs à examiner');
  if(!model.technical.observationsAvailable)notice(players,'Les observations individuelles sont indisponibles.');
  else if(!model.technical.priority.length)notice(players,'Aucun problème récent ou attente récente dans cet annuaire borné. Ce constat ne couvre pas tous les joueurs ni les appareils hors ligne.');
  for(const player of model.technical.priority.slice(0,12))action(players,player.label+' · '+player.icon+' '+player.statusLabel,{type:'player',key:player.key},options);
  notice(players,number(model.technical.observedPlayers)+' inscrit(s) dans l’annuaire chargé · '+number(model.technical.unknownPlayers)+' état(s) ancien(s) ou inconnu(s).');
  action(players,'Voir les joueurs en attente',{type:'players',state:'pending'},options);
  action(players,'Voir les problèmes signalés',{type:'players',state:'failure'},options);
  const split=element(technical.ownerDocument,'div',undefined,'analytics-columns');technical.append(split);
  bars(group(split,'Causes d’échec enregistrées'),model.technical.reasons,model.healthAvailable?'Aucune cause enregistrée dans la réponse disponible.':'Causes indisponibles.');
  bars(group(split,'Échecs enregistrés par version'),model.technical.versions,model.healthAvailable?'Aucune version renseignée dans la réponse disponible.':'Versions indisponibles.');
  notice(technical,'Volumes d’échecs, pas taux d’erreur : la population exposée à chaque version n’est pas mesurée.');
  const signatures=group(technical,'Signatures les plus fréquentes');
  if(!model.technical.signatures.length)notice(signatures,model.healthAvailable?'Aucune signature dans l’échantillon de diagnostics. Un consentement absent ou un détail expiré reste possible.':'Diagnostics indisponibles.');
  for(const signature of model.technical.signatures.slice(0,5)){
   const row=element(technical.ownerDocument,'div',undefined,'analytics-list-row');row.append(element(technical.ownerDocument,'strong',signature.code+' · '+signature.stage),element(technical.ownerDocument,'span',number(signature.occurrences)+' occurrence(s) · '+number(signature.sessions)+' session(s) · '+signature.app_version));signatures.append(row);
   action(row,'Ouvrir les diagnostics',{type:'diagnostics',version:signature.app_version},options);
  }
 }
}

function renderJourneys(host,model,options){
 const doc=host.ownerDocument,previous=states.get(host);
 const state=previous?.scope===options.scope?previous:{scope:options.scope,pack:'all',query:'',minimum:'0',selected:null};states.set(host,state);
 const block=group(host,'Quêtes à examiner'),controls=element(doc,'div',undefined,'analytics-controls');block.append(controls);
 const search=element(doc,'input');search.type='search';search.placeholder='Quête ou constellation';search.setAttribute('aria-label','Rechercher une quête ou une constellation');search.value=state.query;
 const pack=element(doc,'select');pack.setAttribute('aria-label','Filtrer par aventure');
 for(const [value,label] of [['all','Toutes les aventures'],...[...new Map(model.journey.map(q=>[q.packId,q.pack]))]]){const option=element(doc,'option',label);option.value=value;pack.append(option)}
 pack.value=[...pack.options].some(o=>o.value===state.pack)?state.pack:'all';state.pack=pack.value;
 const minimum=element(doc,'select');minimum.setAttribute('aria-label','Minimum de joueurs ayant commencé');
 for(const [value,label] of [['0','Tous les échantillons'],['5','Au moins 5 joueurs'],['10','Au moins 10 joueurs']]){const option=element(doc,'option',label);option.value=value;minimum.append(option)}minimum.value=state.minimum;
 controls.append(search,pack,minimum);
 const list=element(doc,'div'),detail=element(doc,'div');block.append(list,detail);
 const focusDetail=()=>{const title=detail.querySelector('h4');if(title){title.tabIndex=-1;title.focus({preventScroll:true})}detail.scrollIntoView?.({block:'nearest'})};
 const draw=()=>{
  if(!options.authorized()||!host.isConnected)return;
  state.query=search.value;state.pack=pack.value;state.minimum=minimum.value;list.replaceChildren();detail.replaceChildren();
  const needle=state.query.toLocaleLowerCase('fr-FR').trim();
  const selected=model.journey.filter(q=>(state.pack==='all'||q.packId===state.pack)&&(q.started??0)>=Number(state.minimum)&&('q'+q.ordinal+' '+q.constellation+' '+q.pack).toLocaleLowerCase('fr-FR').includes(needle));
  if(!model.questsAvailable){notice(list,'Les observations de quêtes sont indisponibles.');return}
  if(!selected.length){notice(list,'Aucune quête pour ces filtres. Les données manquantes ne permettent pas de conclure à une absence de difficulté.');return}
  const wrap=element(doc,'div',undefined,'admin-table-wrap'),table=element(doc,'table'),head=element(doc,'thead'),header=element(doc,'tr');
  for(const label of ['Quête / constellation','Débuts · joueurs','Fins · joueurs','Indices · événements','Temps actif médian','Lecture'])header.append(element(doc,'th',label));head.append(header);table.append(head);
  const body=element(doc,'tbody');
  for(const quest of selected){
   const row=element(doc,'tr'),label=element(doc,'td');
   const button=action(label,'Q'+quest.ordinal,{type:'quest',key:quest.key},{...options,onAction:payload=>{state.selected=payload.key;draw();focusDetail()}});
   button.setAttribute('aria-label','Examiner la quête '+quest.ordinal);label.append(element(doc,'small',quest.constellation||quest.pack));row.append(label);
   for(const value of [number(quest.started),number(quest.completed),number(quest.hints),quest.seconds===null?'—':Math.round(quest.seconds)+' s',quest.windowMismatch?'Fins sans début dans la fenêtre':quest.signals.join(' · ')||(quest.smallSample?'Échantillon limité':'À contextualiser')])row.append(element(doc,'td',value));
   body.append(row);
  }
  table.append(body);wrap.append(table);list.append(wrap);
  const quest=selected.find(q=>q.key===state.selected);
  if(quest){
   detail.className='analytics-quest-detail';detail.append(element(doc,'h4','Quête '+quest.ordinal+' · '+quest.pack));
   bars(detail,[{label:'Joueurs avec un début observé',count:quest.started},{label:'Joueurs avec une fin observée',count:quest.completed}],'Débuts et fins indisponibles.');
   notice(detail,number(quest.resets)+' réinitialisation(s) · '+number(quest.abandons)+' abandon(s) explicite(s) · '+number(quest.verifies)+' vérification(s).');
   notice(detail,'Ces observations n’établissent ni un taux de réussite par tentative ni un abandon après fermeture. Temps actif hors pénalités : '+(quest.seconds===null?'indisponible sans révision de grille comparable':quest.seconds+' s · '+number(quest.durationSamples)+' durée(s) valide(s) · révision observée '+quest.gridRevision)+'.');
  }
  if(model.rejectedQuests)notice(list,number(model.rejectedQuests)+' ligne(s) sans identité de quête cohérente, exclue(s).');
 };
 search.oninput=draw;pack.onchange=draw;minimum.onchange=draw;draw();
 state.reveal=key=>{if(!options.authorized()||!host.isConnected)return;state.selected=key;pack.value='all';minimum.value='0';search.value='';draw();focusDetail()};
}

export function revealAnalyticsQuest(host,key){states.get(host)?.reveal?.(key)}
