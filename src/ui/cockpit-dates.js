import {createTranslator} from './i18n.js';
const datesT=createTranslator().t;
// Administrative read model. A durable server commit is not a device ACK.
// #708 (24/11): the visual health now comes from player-health.js (last known state
// per device, freshness shown separately). The former 15-minute rule used the OLDEST
// observation of all devices, so any player with an old second device was « ? ».
export function playerDates(player,proof){
 const domains={};
 for(const name of ['canonical','legacy','wallet'])if(proof?.domains&&Object.hasOwn(proof.domains,name))domains[name]=proof.domains[name];
 // Game activity = last completed quest received (receipts), never Auth or analytics opens.
 return {activity:proof&&Object.hasOwn(proof,'game_at')?proof.game_at:undefined,auth:proof?.auth_at,domains,
  state:['pending','failure'].includes(proof?.state)?proof.state:proof?.state==='confirmed'?'observed':'unknown',
  observedAt:proof?.observed_at};
}
export function datePresentation(value,{now=Date.now(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone}={}){
 if(value===undefined)return {text:'Indisponible',title:'Source indisponible'};
 if(value===null)return {text:'Jamais observée',title:'Aucune date dans la source consultée'};
 const stamp=Date.parse(value);if(!Number.isFinite(stamp))return {text:'Indisponible',title:'Date invalide'};
 const text=new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'medium',timeZone}).format(stamp);
 return {text,title:new Date(stamp).toISOString()+' UTC · '+timeZone+' · âge '+Math.max(0,Math.floor((now-stamp)/60000))+' min'};
}
export function dateNode(document,value,options){
 const p=datePresentation(value,options),node=document.createElement('time');node.textContent=p.text;node.title=p.title;
 if(value&&Number.isFinite(Date.parse(value)))node.dateTime=new Date(value).toISOString();
 return node;
}
export const DATE_SOURCE_DESCRIPTION=datesT('admin.dates.description');
export function appendPlayerDates(host,player,proof,{explain=true}={}){
 const doc=host.ownerDocument,model=playerDates(player,proof);
 const add=(label,value)=>{const line=doc.createElement('div');line.append(label+' : ',dateNode(doc,value));host.append(line)};
 add(datesT('admin.dates.lastQuest'),model.activity);add('Dernière connexion Auth',model.auth);
 for(const [domain,label] of [['canonical','Quêtes'],['legacy','Historique'],['wallet','Portefeuille']])add('Dernière synchro réussie · '+label,model.domains[domain]);
 if(explain){const note=doc.createElement('small');note.textContent=DATE_SOURCE_DESCRIPTION;host.append(note)}
 const state=doc.createElement('div');state.textContent='État observé : '+({pending:'en attente',failure:'échec / revue',observed:'file observée sans attente',unknown:'inconnu'}[model.state]);host.append(state);add('Observation de la file',model.observedAt);
}
