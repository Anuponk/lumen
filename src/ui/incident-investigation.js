// Read-only projection of #534's already authorised, bounded cockpit response.
// Export uses a second closed-schema boundary and never includes UUIDs/raw data.
import {DIAGNOSTIC_CODES,DIAGNOSTIC_STAGES,DIAGNOSTIC_KINDS,DIAGNOSTIC_PLATFORMS,DIAGNOSTIC_BROWSERS} from '../persistence/diagnostic-reporter.js';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const pick=(values,value,fallback='unknown')=>values.includes(value)?value:fallback;
const version=value=>typeof value==='string'&&/^\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}$/.test(value)?value:'unknown';
function cleanEvent(row){
 if(!row||!DIAGNOSTIC_CODES.includes(row.code)||typeof row.session_id!=='string'||typeof row.trace_id!=='string'||!uuid.test(row.session_id)||!uuid.test(row.trace_id)||!Number.isInteger(row.sequence)||row.sequence<1||row.sequence>10000)return null;
 return {session_id:row.session_id.toLowerCase(),trace_id:row.trace_id.toLowerCase(),sequence:row.sequence,code:row.code,
  stage:pick(DIAGNOSTIC_STAGES,row.stage),kind:pick(DIAGNOSTIC_KINDS,row.kind),
  app_version:version(row.app_version),
  platform:pick(DIAGNOSTIC_PLATFORMS,row.platform,'other'),browser:pick(DIAGNOSTIC_BROWSERS,row.browser,'other'),
  before_state:pick(['ready','blocked','unknown'],row.before_state),after_state:pick(['ready','blocked','unknown'],row.after_state)};
}
function observedState(events){
 const guided=events.filter(e=>e.code==='guided_input_blocked'||e.code==='guided_input_released');
 if(!guided.length)return 'unknown';
 return guided.at(-1).code==='guided_input_released'?'released':'blocked';
}
function observedVersions(episodes,signatures){
 const rows=new Map(),row=value=>{if(!rows.has(value))rows.set(value,{version:value,occurrences:0,signatures:0,episodes:0});return rows.get(value)};
 for(const signature of signatures){const current=row(signature.app_version);current.occurrences+=signature.occurrences;current.signatures++}
 for(const episode of episodes)for(const value of new Set(episode.events.map(e=>e.app_version)))row(value).episodes++;
 return [...rows.values()].sort((a,b)=>{
  if(a.version==='unknown')return b.version==='unknown'?0:1;
  if(b.version==='unknown')return -1;
  const left=a.version.split(/[.+]/).map(Number),right=b.version.split(/[.+]/).map(Number);
  for(let i=0;i<4;i++)if(left[i]!==right[i])return right[i]-left[i];
  return 0;
 });
}
export function buildIncidentInvestigation(data){
 const groups=new Map(),seen=new Set();
 for(const raw of (Array.isArray(data?.timeline)?data.timeline:[]).slice(-100)){
  const row=cleanEvent(raw);if(!row)continue;
  const key=row.session_id+':'+row.trace_id,identity=key+':'+row.sequence+':'+row.code;
  if(seen.has(identity))continue;seen.add(identity);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
 }
 const episodes=[...groups.values()].map(events=>{
  events.sort((a,b)=>a.sequence-b.sequence);
  return {events,state:observedState(events),partial:true};
 });
 const count=value=>Number.isInteger(value)&&value>=0&&value<=35000?value:0;
 const signatures=(Array.isArray(data?.signatures)?data.signatures:[]).slice(0,30).filter(row=>row&&DIAGNOSTIC_CODES.includes(row.code)).map(row=>({
  code:row.code,stage:pick(DIAGNOSTIC_STAGES,row.stage),app_version:version(row.app_version),
  platform:pick(DIAGNOSTIC_PLATFORMS,row.platform,'other'),browser:pick(DIAGNOSTIC_BROWSERS,row.browser,'other'),occurrences:count(row.occurrences),sessions:count(row.sessions)
 }));
 return {episodes,signatures,versions:observedVersions(episodes,signatures),sample:'opt-in, incomplete'};
}
function guidance(events){
 if(events.some(e=>e.code.startsWith('guided_')))return ['Transition guidée à vérifier ; cause non établie.','Sur un compte de test : provoquer une erreur guidée, annuler plusieurs fois et vérifier le retour des interactions. Comparer les transitions observées à #533.'];
 if(events.some(e=>e.kind==='quota'||e.kind==='storage'))return ['Stockage local à vérifier ; saturation du téléphone non démontrée.','Sur un compte de test : simuler le quota, vérifier les copies préservées puis réessayer. Ne pas effacer les données du joueur.'];
 if(events.some(e=>e.code.startsWith('outbox_')||e.code.startsWith('sync_')||e.code.startsWith('hydration_')))return ['Échange cloud à vérifier ; perte de sauvegarde non démontrée.','Sur un compte de test : couper le réseau, provoquer un échec puis reconnecter ; comparer réessai et accusé de réception. Consulter les indicateurs #398.'];
 return ['Exception observée ; cause inconnue sans reproduction.','Sur un compte de test : reproduire sur la même version et famille de navigateur ; vérifier les interactions. Aucun message ni stack collecté.'];
}
const stateLabel=state=>({blocked:'bloqué',released:'libéré',unknown:'indéterminé'})[state]||'indéterminé';
export function incidentReport(input,maxEvents=20){
 // Revalidate even when called independently from the renderer.
 const episode=buildIncidentInvestigation({timeline:input?.events}).episodes[0];
 if(!episode)return '';
 const events=episode.events,first=events[0],guide=guidance(events);
 const lines=['LUMEN — rapport technique #534',
  'Échantillon facultatif et partiel ; aucun statut de sauvegarde déduit.',
  `Version ${first.app_version} · ${first.platform} · ${first.browser}`,
  'Dernière transition guidée observée : '+stateLabel(episode.state),guide[0],guide[1],
  'Chronologie observée (ordre de session, sans identifiants ni dates) :'];
 for(const row of events.slice(0,Math.max(0,Math.min(20,maxEvents))))lines.push(`${row.code} · ${row.stage} · ${row.kind} · ${row.before_state} → ${row.after_state}`);
 if(events.length>maxEvents)lines.push('Suite omise ; consulter le rapport complet dans le cockpit.');
 lines.push('Reproduction à confirmer par un administrateur. Aucune réparation automatique.');
 return lines.join('\n');
}
export function githubIssueDraft(episode){
 if(!incidentReport(episode))return '';
 // Small enough for the GitHub URL/query boundary, even with URL encoding.
 for(let count=7;count>=0;count--){
  const url=new URL('https://github.com/Anuponk/lumen/issues/new');
  url.searchParams.set('title','[Diagnostic] Incident technique à examiner (#534)');
  url.searchParams.set('body',incidentReport(episode,count));
  if(url.href.length<=2000)return url.href;
 }
 return '';
}
export function incidentAlerts(model){
 const alerts=[],blocked=model.episodes.filter(e=>e.state==='blocked').length;
 if(blocked)alerts.push({key:'details_guided_blocked',text:`Guidage : ${blocked} épisode(s) dont la dernière transition observée est bloquée · échantillon partiel`});
 const runtime=new Set();
 for(const episode of model.episodes)for(const e of episode.events)if(['runtime_exception','unhandled_rejection','resource_failed'].includes(e.code))runtime.add(e.session_id);
 if(runtime.size>=3)alerts.push({key:'details_runtime_recurrent',text:`Exceptions : ${runtime.size} sessions observées · examiner les rapports techniques`});
 return alerts;
}
export function renderIncidentInvestigation(host,data,{authorized=()=>false}={}){
 if(!host)return;
 host.replaceChildren();
 if(!authorized())return;
 const doc=host.ownerDocument,model=buildIncidentInvestigation(data);
 const element=(tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node};
 host.append(element('p','Échantillon facultatif et partiel · au plus 100 événements récents. Une transition libérée ne prouve pas une sauvegarde.'));
 if(model.versions.length){
  const comparison=element('details'),table=element('table'),head=element('thead'),header=element('tr'),body=element('tbody');
  comparison.append(element('summary','Observations par version'));
  comparison.append(element('p','Volumes de cet échantillon facultatif et partiel. Sans population exposée ni durée comparable, ces nombres ne mesurent pas un taux d’erreur et ne prouvent pas une régression. Un épisode contenant plusieurs versions figure pour chacune.'));
  for(const label of ['Version','Occurrences agrégées','Groupes agrégés','Épisodes contenant cette version'])header.append(element('th',label));
  head.append(header);table.append(head,body);
  for(const row of model.versions){const tr=element('tr');for(const value of [row.version,row.occurrences,row.signatures,row.episodes])tr.append(element('td',String(value)));body.append(tr)}
  const wrap=element('div');wrap.className='admin-table-wrap';wrap.append(table);comparison.append(wrap);host.append(comparison);
 }
 if(model.signatures.length){
  const signatures=element('details');signatures.append(element('summary','Signatures agrégées · fenêtre choisie, sept jours maximum'));
  for(const row of model.signatures)signatures.append(element('p',`${row.code} · ${row.stage} · ${row.app_version} · ${row.platform}/${row.browser} · ${row.occurrences} occurrence(s) · ${row.sessions} session(s)`));
  host.append(signatures);
 }
 if(!model.episodes.length){host.append(element('p',data?'Aucun épisode dans cette fenêtre.':'Diagnostics détaillés indisponibles.'));return}
 const filter=element('select');filter.setAttribute('aria-label','Filtrer les épisodes techniques');
 for(const [value,label] of [['all','Tous les épisodes'],['blocked','Dernière transition bloquée'],['released','Dernière transition libérée'],['unknown','État indéterminé']]){const option=element('option',label);option.value=value;filter.append(option)}
 const versionFilter=element('select');versionFilter.setAttribute('aria-label','Filtrer les épisodes contenant une version de LUMEN');
 for(const [value,label] of [['all','Toutes les versions observées'],...model.versions.map(row=>[row.version,row.version==='unknown'?'Version indéterminée':row.version])]){const option=element('option',label);option.value=value;versionFilter.append(option)}
 const list=element('div');host.append(filter,versionFilter,list);
 let revision=0,reviews=[];
 function render(){
  const current=++revision;
  for(const {confirm,draft} of reviews){confirm.checked=false;draft.hidden=true;draft.removeAttribute('href')}
  reviews=[];
  list.replaceChildren();if(!authorized())return;
  for(const [index,episode] of model.episodes.entries()){
   if(filter.value!=='all'&&filter.value!==episode.state)continue;
   if(versionFilter.value!=='all'&&!episode.events.some(e=>e.app_version===versionFilter.value))continue;
   const versions=[...new Set(episode.events.map(e=>e.app_version))].join(', ');
   const card=element('details'),summary=element('summary',`Épisode ${index+1} · ${versions} · ${episode.events.length} événement(s) · ${stateLabel(episode.state)}`);
   const valid=()=>authorized()&&revision===current&&host.contains(card);
   const report=incidentReport(episode),preview=element('textarea');preview.readOnly=true;preview.rows=9;preview.value=report;preview.setAttribute('aria-label','Rapport technique assaini');
   const label=element('label'),confirm=element('input');confirm.type='checkbox';
   label.append(confirm,doc.createTextNode(' J’ai relu ce rapport et vérifié les issues existantes.'));
   const search=element('a','Chercher une issue existante');search.href='https://github.com/Anuponk/lumen/issues?q='+encodeURIComponent('is:issue '+episode.events[0].code);search.target='_blank';search.rel='noopener noreferrer';
   const draft=element('a','Préparer une issue sur GitHub');draft.hidden=true;draft.target='_blank';draft.rel='noopener noreferrer';
   const download=element('button','Exporter ce rapport');download.type='button';
   confirm.onchange=()=>{draft.hidden=!valid()||!confirm.checked;if(!draft.hidden)draft.href=githubIssueDraft(episode);else draft.removeAttribute('href')};
   draft.onclick=e=>{if(!valid()||!confirm.checked)e.preventDefault()};
   search.onclick=e=>{if(!valid())e.preventDefault()};
   download.onclick=()=>{
    if(!valid())return;
    const url=URL.createObjectURL(new Blob([report],{type:'text/plain;charset=utf-8'}));
    const a=element('a');a.href=url;a.download='lumen-diagnostic.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   };
   card.append(summary,preview,search,label,draft,download,element('p','GitHub ouvrira un brouillon. Relis-le puis valide sa publication sur GitHub.'));
   reviews.push({confirm,draft});
   list.append(card);
  }
 }
 filter.onchange=render;versionFilter.onchange=render;render();
}
