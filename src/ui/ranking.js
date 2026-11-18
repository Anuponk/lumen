// One compact podium travels with the existing victory surface (#682).
// Its slot is reserved from the first frame: loading, empty, offline and ready
// states share one geometry, so the late board never moves other zones.
export function createRankingView({client,getContext,format,document=globalThis.document,onUpdate=()=>{}}={}){
 const root=document.createElement('section');root.className='ranking';root.hidden=true;root.setAttribute('aria-label','Classement de la grille');
 let generation=0,quest=null,owner=null,connection=null,operation=null,improvedForView=false,excludedForView=false,animated=false,review=false;
 const reduced=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function clear(){generation++;root.hidden=true;root.replaceChildren();delete root.dataset.state;quest=null;improvedForView=false;excludedForView=false;animated=false;review=false}
 function element(tag,className,text){const e=document.createElement(tag);e.className=className;e.textContent=text;return e}
 function skeleton(){
  const list=element('ol','ranking-podium ranking-podium-skeleton','');list.setAttribute('aria-hidden','true');
  for(const position of [1,2,3])list.append(element('li','ranking-step-skeleton ranking-step-'+position,''));
  return list;
 }
 // Pending/offline/error: same podium footprint, neutral message, no rank claim.
 function status(text,state='pending'){
  root.dataset.state=state;
  const message=element('p','ranking-status',text);message.setAttribute('role','status');
  root.replaceChildren(skeleton(),message);
  onUpdate({state,quest});
 }
 function rows(data){
  root.dataset.state='ready';root.replaceChildren();
  // Old backends return a window: never infer missing leaders or a total.
  const top=(data.top??data.rows??[]).filter(r=>r.position<=3),mine=data.personal??data.rows?.find(r=>r.mine);
  const list=element('ol','ranking-podium','');list.setAttribute('aria-label','Les trois meilleurs temps');
  for(const row of top){
   const li=element('li','ranking-row ranking-step-'+row.position+(row.mine?' ranking-mine':''),'');li.dataset.position=row.position;
   li.append(element('span','ranking-crown','♛'),element('span','ranking-place',String(row.place)),element('span','ranking-name',row.nickname),element('span','ranking-time',format(row.score)));li.title=row.nickname;
   if(row.virtual)li.append(element('small','ranking-virtual','Écho virtuel'));
   if(row.mine)li.append(element('small','ranking-you','Toi'));
   list.append(li);
  }
  root.append(list);
  const card=element('div','ranking-personal','');
  if(mine&&mine.position>3){card.classList.add('ranking-mine');card.dataset.position=mine.position;card.append(element('strong','',`Toi : ${mine.place}e`),element('span','ranking-time',format(mine.score)));
   const third=top.find(r=>r.position===3);if(third&&mine.score>third.score)card.append(element('small','',format(mine.score-third.score)+' du podium'));
  }else if(!mine)card.append(element('span','','Aucun temps compétitif pour cette révision.'));
  // #761: a victory the server refused is never shown as if the podium were its result.
  if(data.excluded)card.append(element('small','ranking-excluded','Ce temps n’est pas retenu au classement (15 min minimum entre deux essais classés). Ton record personnel est bien enregistré.'));
  if(!data.participating)card.append(element('small','',data.withdrawn?'Participation désactivée. Réinscription depuis Compte.':'Ton pseudo et les règles de participation sont disponibles dans Compte.'));
  if(card.childNodes.length)root.append(card);
  if(!animated&&!reduced()){
   [...list.children].forEach((e,i)=>e.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,delay:i*300,easing:'ease-out',fill:'backwards'}));
   list.querySelector('.ranking-mine')?.animate?.([{boxShadow:'0 0 0 0 rgba(255,225,160,0)'},{boxShadow:'0 0 22px 4px rgba(255,225,160,.75)'},{boxShadow:'0 0 12px 2px rgba(255,225,160,.45)'}],{duration:1400,delay:900,fill:'forwards'});
   animated=true;
  }
  onUpdate({state:'ready',quest,data});
 }
 async function refresh(results=[]){
  const token=generation,q=quest;if(!q||getContext().owner!==owner||getContext().client!==connection)return;
  try{
   // Reconnect/timer updates must not replace a still-pending result with an old board.
   if(!review&&operation&&client.entries?.(owner).some(e=>e.operationId===operation)){
    status('Ton temps est sauvegardé, mais son classement attend la confirmation du serveur.','pending');return;
   }
   const data=await client.board(q);
   if(token===generation&&quest===q&&getContext().owner===owner&&getContext().client===connection){
    const captured=operation?client.takeResult?.(operation):null;
    improvedForView=improvedForView||!!captured?.improved||(!operation&&results.some(r=>r?.questId===q.id&&r.improved));
    excludedForView=excludedForView||captured?.status==='ineligible';
    rows({...data,improved:improvedForView,excluded:excludedForView});
   }
  }catch{if(token===generation)status(globalThis.navigator?.onLine===false?(review?'Hors ligne : le classement s’affichera au retour du réseau.':'Hors ligne : le classement s’affichera au retour du réseau. Ta victoire est sauvegardée.'):(review?'Classement indisponible pour le moment.':'Classement en attente de synchronisation. Ta victoire est sauvegardée.'),globalThis.navigator?.onLine===false?'offline':review?'error':'pending')}
 }
 function show(q,operationId=null,options={}){clear();quest=q;operation=operationId;owner=getContext().owner;connection=getContext().client;root.hidden=false;const token=generation;
  // #695 review: read the board only; nothing is flushed or animated.
  if(options.review){review=true;animated=true;status('Chargement du classement…');void refresh();return}
  status('Chargement du classement…');
  // Do not silently show an old confirmed podium when this victory failed to sync.
  void client.flush().then(async results=>{
   if(operation&&typeof client.entries==='function'&&client.entries(owner).some(e=>e.operationId===operation)){
    if(quest===q&&generation===token)status('Ton temps est sauvegardé, mais son classement attend la confirmation du serveur.','pending');
    return;
   }
   await refresh(results);
  }).catch(error=>{
   if(quest!==q||generation!==token)return;
   // An unrelated failed capture cannot hide this operation's terminal receipt.
   if(operation&&error?.results?.some(r=>r.operationId===operation&&['confirmed','ineligible'].includes(r.status))){void refresh(error.results);return}
   if(quest===q&&generation===token)status('Ton temps est sauvegardé, mais sa synchronisation a échoué. Réessaie en ligne.','pending');
  })}
 function mount(){if(owner&&(getContext().owner!==owner||getContext().client!==connection)){clear();return}const slot=document.getElementById('skyRevealPodium'),sky=document.getElementById('skyRevealResults'),normal=document.getElementById('successRecord');const visibleSky=sky&&!sky.hidden&&!document.getElementById('skyReveal')?.hidden;if(visibleSky&&slot)slot.prepend(root);else if(visibleSky)document.getElementById('skyRevealRecord')?.after(root);else normal?.after(root)}
 return {show,refresh,clear,mount,root};
}
