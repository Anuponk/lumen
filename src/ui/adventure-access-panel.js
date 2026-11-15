// #724: an internal administrator grants or revokes a locked Adventure for one player.
// The server checks the capability, the player and the Adventure and returns the
// authoritative state; this panel only lists the catalogue's locked packs and never
// shows a change the server did not confirm.
const REASON_MIN=3,REASON_MAX=200;

export function lockedAdventures(packs){
 return (packs||[]).filter(p=>p.access==='locked').map(p=>({id:p.id,label:'Aventure '+(Number(p.order)+1)+' · '+(p.displayName||p.id)}));
}
export function adventureAccessRows(packs,data){
 const owned=new Map((data?.adventures||[]).map(a=>[a.adventure,a]));
 return lockedAdventures(packs).map(p=>{const e=owned.get(p.id);return {...p,active:e?.active===true,source:e?.source||null,grantedAt:e?.granted_at||null,expiresAt:e?.expires_at||null}});
}
export function validReason(text){const t=String(text??'').trim();return t.length>=REASON_MIN&&t.length<=REASON_MAX}
const when=v=>v?new Date(v).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'';
function stateText(row){
 if(row.active)return 'Débloquée'+(row.source?' ('+row.source+')':'')+(row.grantedAt?' · '+when(row.grantedAt):'');
 return row.expiresAt?'Retirée · '+when(row.expiresAt):'Verrouillée';
}

export async function mountAdventureAccess(host,{client,owner,target,authorized,packs}){
 const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
 details.className='adventure-access';summary.textContent='Aventures débloquées';details.append(summary,body);host.append(details);
 const allowed=()=>authorized()&&host.isConnected&&details.isConnected&&host.contains(details);
 let loaded=false,busy=false;
 async function rpc(action,more={}){
  if(!allowed())throw Error('stale');
  const r=await client.rpc('lumen_admin_adventure_access',{p_expected_user_id:owner,p_target_user_id:target,p_action:action,...more});
  if(!allowed())throw Error('stale');
  if(r.error||!r.data)throw Error('rpc');
  return r.data;
 }
 const reason=document.createElement('input'),status=document.createElement('p'),list=document.createElement('ul'),history=document.createElement('ul');
 reason.type='text';reason.maxLength=REASON_MAX;reason.placeholder='Motif (obligatoire, ex. bêta-test)';reason.setAttribute('aria-label','Motif du déblocage ou du retrait');reason.dataset.adventureReason='';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.adventureStatus='';
 list.className='adventure-access-list';history.className='adventure-access-history';
 function render(data){
  list.replaceChildren();
  for(const row of adventureAccessRows(packs,data)){
   const item=document.createElement('li'),text=document.createElement('span'),button=document.createElement('button');
   item.dataset.adventure=row.id;text.textContent=row.label+' — '+stateText(row);
   button.type='button';button.textContent=row.active?'Retirer':'Débloquer';button.dataset.adventureAction=row.active?'revoke':'grant';
   button.onclick=()=>void change(row,row.active?'revoke':'grant');
   item.append(text,button);list.append(item);
  }
  history.replaceChildren();
  for(const h of data?.history||[]){
   const item=document.createElement('li'),label=lockedAdventures(packs).find(p=>p.id===h.adventure)?.label||h.adventure;
   item.textContent=when(h.occurred_at)+' · '+(h.action==='grant'?'Débloquée':'Retirée')+' · '+label+' · '+h.reason;history.append(item);
  }
 }
 function setBusy(value){busy=value;for(const b of list.querySelectorAll('button'))b.disabled=value}
 async function change(row,action){
  if(busy||!allowed())return;
  if(!validReason(reason.value)){status.textContent='Indique un motif ('+REASON_MIN+' à '+REASON_MAX+' caractères).';reason.focus();return}
  setBusy(true);status.textContent=action==='grant'?'Déblocage en cours…':'Retrait en cours…';
  try{
   const data=await rpc(action,{p_adventure:row.id,p_reason:reason.value.trim()});
   render(data);reason.value='';
   const done=action==='grant'?'débloquée':'retirée';
   status.textContent=data.changed?row.label+' '+done+'. Le joueur la verra au prochain lancement de l’app.':row.label+' était déjà '+done+'.';
  }catch(error){if(allowed())status.textContent='Action non confirmée par le serveur. Réessaie.'}
  finally{if(allowed())setBusy(false)}
 }
 details.ontoggle=async()=>{
  if(!details.open||loaded||!allowed())return;loaded=true;body.textContent='Chargement…';
  try{
   const data=await rpc('list');
   const historyTitle=document.createElement('p');historyTitle.textContent='Historique (20 dernières actions)';
   const note=document.createElement('p');note.textContent='Un retrait ne supprime jamais la progression ; une aventure déjà commencée reste jouable.';
   body.replaceChildren(reason,status,list,note,historyTitle,history);render(data);
  }catch(error){if(allowed()){body.textContent='Aventures indisponibles.';loaded=false}}
 };
}
