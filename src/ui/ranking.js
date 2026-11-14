// One compact podium travels with the existing victory surface (#682).
// Its slot is reserved from the first frame: loading, empty, offline and ready
// states share one geometry, so the late board never moves other zones.
export function createRankingView({client,getContext,format,document=globalThis.document,onUpdate=()=>{}}={}){
 const root=document.createElement('section');root.className='ranking';root.hidden=true;root.setAttribute('aria-label','Classement de la grille');
 let generation=0,quest=null,owner=null,connection=null,operation=null,improvedForView=false,animated=false;
 const reduced=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function clear(){generation++;root.hidden=true;root.replaceChildren();delete root.dataset.state;quest=null;improvedForView=false;animated=false}
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
  if(!data.participating)card.append(element('small','',data.withdrawn?'Participation désactivée. Réinscription depuis Compte.':'Ton pseudo et les règles de participation sont disponibles dans Compte.'));
  if(card.childNodes.length)root.append(card);
  if(!animated&&!reduced()){
   [...list.children].forEach((e,i)=>e.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,delay:i*300,easing:'ease-out',fill:'backwards'}));
   list.querySelector('.ranking-mine')?.animate?.([{boxShadow:'0 0 0 0 rgba(255,225,160,0)'},{boxShadow:'0 0 22px 4px rgba(255,225,160,.75)'},{boxShadow:'0 0 12px 2px rgba(255,225,160,.45)'}],{duration:1400,delay:900,fill:'forwards'});
   animated=true;
  }
  onUpdate({state:'ready',quest,data});
 }
 async function refresh(results=[]){const token=generation,q=quest;if(!q)return;try{const data=await client.board(q);if(token===generation&&quest===q&&getContext().owner===owner&&getContext().client===connection){const captured=operation?client.takeResult?.(operation):null;improvedForView=improvedForView||!!captured?.improved||(!operation&&results.some(r=>r?.questId===q.id&&r.improved));rows({...data,improved:improvedForView})}}catch{if(token===generation)status(globalThis.navigator?.onLine===false?'Hors ligne : le classement s’affichera au retour du réseau. Ta victoire est sauvegardée.':'Classement en attente de synchronisation. Ta victoire est sauvegardée.',globalThis.navigator?.onLine===false?'offline':'pending')}}
 function show(q,operationId=null){clear();quest=q;operation=operationId;owner=getContext().owner;connection=getContext().client;root.hidden=false;status('Classement en attente de synchronisation. Ta victoire est sauvegardée.');void client.flush().catch(()=>[]).then(refresh)}
 function mount(){if(owner&&(getContext().owner!==owner||getContext().client!==connection)){clear();return}const slot=document.getElementById('skyRevealPodium'),sky=document.getElementById('skyRevealResults'),normal=document.getElementById('successRecord');const visibleSky=sky&&!sky.hidden&&!document.getElementById('skyReveal')?.hidden;if(visibleSky&&slot)slot.prepend(root);else if(visibleSky)document.getElementById('skyRevealRecord')?.after(root);else normal?.after(root)}
 return {show,refresh,clear,mount,root};
}
