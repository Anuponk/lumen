import {createSupportSession} from '../persistence/support-session.js';
const labels={disabled:'Assistance désactivée',unavailable:'Assistance indisponible pour le moment',activating:'Activation en cours',ready:'Prêt à envoyer',preparing:'Préparation du diagnostic',review:'Diagnostic préparé · confirmation attendue',sending:'Envoi en cours',offline:'En attente de connexion',confirmed:'Reçu et confirmé par le support Lumen',failed:'Échec, réessayer',expired:'Assistance expirée',revoking:'Désactivation ou suppression en cours · confirmation serveur en attente',deleted:'Assistance désactivée · copies effacées côté serveur'};
export function mountSupportPanel(host,options){
 host.innerHTML=`<details class="support-panel"><summary>Assistance</summary>
 <p>L’assistance permet de transmettre temporairement des informations techniques et une copie filtrée de vos sauvegardes pour nous aider à résoudre un problème. Vos données de jeu ne seront pas modifiées.</p>
 <p>Copier le diagnostic ou le partager dans une autre application reste un export local. Utilisez l’envoi ci-dessous pour obtenir une confirmation de réception du support Lumen et une référence à lui communiquer. ChatGPT ne peut pas consulter ce dossier sans intégration autorisée.</p>
 <p>Activation : 24 heures. Conservation : sept jours maximum sous réserve du fonctionnement de la purge serveur. Seul le support habilité peut consulter les copies privées. Elles contiennent progression, badges, résultats, solde, codes d’incident et copies de récupération attribuables à ce compte. Les champs inconnus et archives sans propriétaire fiable restent sur cet appareil.</p>
 <p>La désactivation arrête les envois ici immédiatement et demande l’effacement des copies au serveur. Hors connexion, cet effacement reste en attente. Les fichiers déjà téléchargés par le support ne peuvent pas être rappelés automatiquement ; ils doivent être effacés selon la même durée.</p>
 <label><input type="checkbox" data-support-consent> J’autorise spécifiquement le partage de ces copies, manuellement et lors d’un incident, pendant 24 heures.</label>
 <p data-support-status role="status" aria-live="polite"></p><p data-support-info></p>
 <button type="button" data-support-activate>Activer l’assistance</button>
 <button type="button" data-support-send hidden>Envoyer un diagnostic au support</button>
 <div data-support-review hidden><p>Vérifiez les informations préparées avant de confirmer leur envoi au support habilité de Lumen.</p><details><summary>Voir les données transmises</summary><pre data-support-preview style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:15rem;overflow:auto"></pre></details><button type="button" data-support-confirm>Confirmer l’envoi au support Lumen</button><button type="button" data-support-cancel>Annuler la préparation</button></div>
 <button type="button" data-support-revoke hidden>Désactiver l’assistance et effacer les copies</button>
 <p>Une copie attend au maximum une heure dans la mémoire de cette page. Fermer la page l’annule ; les sauvegardes originales restent conservées. Maximum huit captures conservées par compte, une par minute.</p></details>`;
 const get=name=>host.querySelector('[data-support-'+name+']');
 let consentOwner=null;
 const session=createSupportSession({...options,onChange(v){
  const owner=options.context()?.userId;
  if(owner!==consentOwner||['deleted','expired'].includes(v.state)){get('consent').checked=false;consentOwner=owner}
  const active=v.dossier?.state==='active'&&Date.parse(v.dossier.expires_at)>Date.now();
  get('status').textContent=(active?'Assistance active · ':'')+labels[v.state];
  get('info').textContent=v.dossier?.id?'Référence : '+v.dossier.id+' · Expiration : '+new Date(v.dossier.expires_at).toLocaleString('fr-FR')+' · Dernier envoi confirmé : '+(v.dossier.last_received_at?new Date(v.dossier.last_received_at).toLocaleString('fr-FR'):'aucun'):'';
  get('review').hidden=v.state!=='review';get('preview').textContent=v.preview?JSON.stringify(v.preview,null,2):'';
  const locked=['activating','preparing','sending','revoking'].includes(v.state);
  get('activate').hidden=active;get('activate').disabled=locked||!get('consent').checked||!options.context()?.userId||['unavailable','revoking'].includes(v.state);
  get('consent').disabled=active||locked;get('send').hidden=!active||v.state==='review';get('send').disabled=locked;
  get('send').textContent=v.state==='failed'&&v.pending?'Réessayer l’envoi':'Envoyer un diagnostic au support';
  get('revoke').hidden=!active&&v.state!=='revoking';get('revoke').disabled=v.state==='activating';
  options.onChange?.(v);
 }});
 get('activate').onclick=()=>session.activate(get('consent').checked);
 get('consent').onchange=()=>{get('activate').disabled=!get('consent').checked||!options.context()?.userId||session.view().state==='unavailable'};
 get('send').onclick=()=>session.view().state==='failed'&&session.view().pending?session.retry():session.prepare();
 get('confirm').onclick=()=>session.confirm();get('cancel').onclick=()=>session.discard();
 get('revoke').onclick=()=>session.revoke();
 session.changed();return session;
}
export async function mountSupportDossier(host,{client,owner,target,reference=null,authorized}){
 const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
 summary.textContent='Dossier d’assistance';details.append(summary,body);host.append(details);
 let loaded=false;
 const allowed=()=>authorized()&&host.isConnected&&details.isConnected&&host.contains(details);
 async function rpc(action,more={}){if(!allowed())throw Error();const r=await client.rpc('lumen_support',{p_expected_user_id:owner,p_target_user_id:target??null,p_action:action,...(reference?{p_case_id:reference}:{}),...more});if(!allowed()||r.error)throw Error();return r.data}
 details.ontoggle=async()=>{
  if(!details.open||loaded||!allowed())return;loaded=true;body.textContent='Chargement…';
  try{
   const d=await rpc('list');if(!allowed())return;if(reference&&d.id!==reference)throw Error('SUPPORT_REFERENCE');
   body.replaceChildren();const text=document.createElement('p');text.textContent=d.id?'Référence : '+d.id+' · Statut : '+(labels[d.state]||d.state)+' · Activation : '+new Date(d.activated_at).toLocaleString('fr-FR')+' · Expiration : '+new Date(d.expires_at).toLocaleString('fr-FR')+' · '+d.captures.length+' captures · '+d.captures.reduce((n,c)=>n+c.bytes,0)+' octets · Dernière réception : '+(d.captures.at(-1)?.received_at||'aucune')+' · Dernière consultation : '+(d.last_viewed_at||'aucune'):'Aucun dossier.';body.append(text);
   if(!d.id||d.state==='deleted')return;
   const download=document.createElement('button');download.type='button';download.textContent='Télécharger le dossier privé';
   download.onclick=async()=>{if(!allowed())return;download.disabled=true;try{
    const data=await rpc('download',{p_case_id:d.id});if(!allowed())return;if(data?.reference!==d.id||!Array.isArray(data.captures))throw Error('SUPPORT_REFERENCE');
    for(const c of data.captures){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.content));const hash=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');if(hash!==c.sha256)throw Error()}
    if(!allowed())return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='lumen-assistance-'+d.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
   }catch{if(allowed())text.textContent='Téléchargement non confirmé. Réessayez.'}finally{if(allowed())download.disabled=false}};
   const purge=document.createElement('button');purge.type='button';purge.textContent='Effacer les copies de support';
   purge.onclick=async()=>{if(!allowed())return;purge.disabled=true;try{const r=await rpc('purge',{p_case_id:d.id});if(r.state!=='deleted')throw Error();if(allowed()){body.textContent='Copies de support effacées.'}}catch{if(allowed()){text.textContent='Effacement non confirmé.';purge.disabled=false}}};
   body.append(download,purge);
  }catch{if(allowed()){body.textContent='Dossier indisponible.';loaded=false}}
 };
}

// Reference lookup reuses the private dossier reader, hash check and live guards.
export function mountSupportLookup(host,options){
 host.replaceChildren();
 const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),button=document.createElement('button'),message=document.createElement('p'),result=document.createElement('div');
 label.textContent='Référence de diagnostic';input.type='text';input.required=true;input.maxLength=36;input.autocomplete='off';label.append(input);
 button.type='submit';button.textContent='Retrouver le diagnostic';message.setAttribute('role','status');
 form.append(label,button);host.append(form,message,result);
 form.onsubmit=async event=>{
  event.preventDefault();if(!options.authorized()||!host.isConnected)return;
  const reference=input.value.trim().toLowerCase();
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(reference)){message.textContent='Saisissez la référence complète fournie par Lumen.';return}
  message.textContent='';result.replaceChildren();
  await mountSupportDossier(result,{...options,target:null,reference});
  if(options.authorized()&&host.isConnected)result.querySelector('details').open=true;
 };
}
