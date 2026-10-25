// Administrative read model. A durable server commit is not a device ACK.
export function playerSyncStatus(proof,{now=Date.now()}={}){
 const latest=Date.parse(proof?.observed_at),oldest=Date.parse(proof?.oldest_observation_at??proof?.observed_at);
 const valid=Number.isFinite(latest)&&Number.isFinite(oldest)&&latest<=now+60000&&oldest<=latest;
 const stale=valid&&now-oldest>15*60000;
 const state=valid&&!stale&&['confirmed','pending','failure'].includes(proof?.state)?proof.state:'unknown';
 const view={confirmed:['✓','Sans attente observée'],pending:['…','En attente'],failure:['!','Problème signalé'],unknown:['?',stale?'Signal ancien':'État inconnu']}[state];
 return {state,icon:view[0],label:view[1],description:stale?'Observation de plus de 15 min : état actuel à vérifier.':state==='confirmed'?'Aucune attente dans les files récemment observées ; synchronisation complète de tous les appareils non attestée.':state==='pending'?'Une file observée contient des opérations en attente.':state==='failure'?'Un échec ou une revue a été signalé dans une file observée.':'Aucune observation récente exploitable de la file.'};
}
export function playerDates(player,proof){
 const domains={};
 for(const name of ['canonical','legacy','wallet'])if(proof?.domains&&Object.hasOwn(proof.domains,name))domains[name]=proof.domains[name];
 return {activity:player.last_seen,auth:proof?.auth_at,domains,
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
export const DATE_SOURCE_DESCRIPTION='Synchro : dernier commit confirmé par reçu serveur, par domaine. Réception sur l’appareil et synchronisation complète non attestées. Activité : événements analytiques, pouvant inclure une ouverture automatique. Auth : dernière authentification connue, distincte d’une réouverture.';
export function appendPlayerDates(host,player,proof,{explain=true}={}){
 const doc=host.ownerDocument,model=playerDates(player,proof);
 const add=(label,value)=>{const line=doc.createElement('div');line.append(label+' : ',dateNode(doc,value));host.append(line)};
 add('Dernière activité enregistrée',model.activity);add('Dernière connexion Auth',model.auth);
 for(const [domain,label] of [['canonical','Quêtes'],['legacy','Historique'],['wallet','Portefeuille']])add('Dernière synchro réussie · '+label,model.domains[domain]);
 if(explain){const note=doc.createElement('small');note.textContent=DATE_SOURCE_DESCRIPTION;host.append(note)}
 const state=doc.createElement('div');state.textContent='État observé : '+({pending:'en attente',failure:'échec / revue',observed:'file observée sans attente',unknown:'inconnu'}[model.state]);host.append(state);add('Observation de la file',model.observedAt);
}
