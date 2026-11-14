// One compact view travels with the existing victory surface.
export function createRankingView({client,getContext,format,document=globalThis.document}={}){
 const root=document.createElement('section');root.className='ranking';root.hidden=true;root.setAttribute('aria-label','Classement de la grille');
 let generation=0,quest=null,owner=null,connection=null,operation=null,improvedForView=false,animated=false;
 function clear(){generation++;root.hidden=true;root.replaceChildren();quest=null;improvedForView=false;animated=false}
 function element(tag,className,text){const e=document.createElement(tag);e.className=className;e.textContent=text;return e}
 function status(text){root.replaceChildren(element('p','ranking-status',text));root.firstChild.setAttribute('role','status')}
 function rows(data){
  root.replaceChildren(element('h3','','Podium'));
  // Old backends return a window: never infer missing leaders or a total.
  const top=(data.top??data.rows??[]).filter(r=>r.position<=3),mine=data.personal??data.rows?.find(r=>r.mine),total=data.realParticipants;
  const list=element('ol','ranking-podium','');list.setAttribute('aria-label','Les trois meilleurs temps');
  for(const row of top){
   const li=element('li','ranking-row ranking-step-'+row.position+(row.mine?' ranking-mine':''),'');li.dataset.position=row.position;
   li.append(element('span','ranking-place',String(row.place)),element('span','ranking-name',row.nickname),element('span','ranking-time',format(row.score)));li.title=row.nickname;
   if(row.virtual)li.append(element('small','ranking-virtual','Virtuel'));
   if(row.mine)li.append(element('small','ranking-you','Toi'));
   list.append(li);
  }
  root.append(list);
  const card=element('div','ranking-personal','');
  if(mine&&mine.position>3){card.classList.add('ranking-mine');card.dataset.position=mine.position;card.append(element('strong','',`Ta place : ${mine.place}`),element('span','ranking-time',format(mine.score)));
   const third=top.find(r=>r.position===3);if(third&&mine.score>third.score)card.append(element('small','',format(mine.score-third.score)+' du podium'));
  }else if(!mine)card.append(element('span','','Aucun temps compétitif pour cette révision.'));
  if(Number.isInteger(total)){const count=element('small','ranking-participants',total+' joueur'+(total>1?'s':''));count.title=total+' participants réels, hors Échos';count.setAttribute('aria-label',count.title);card.append(count)}
  if(!data.participating)card.append(element('small','',data.withdrawn?'Participation désactivée. Réinscription depuis Compte.':'Ton pseudo et les règles de participation sont disponibles dans Compte.'));
  root.append(card);
  if(!animated&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   [...list.children,card].forEach((e,i)=>e.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:500,delay:i*450,easing:'ease-out',fill:'backwards'}));
   list.querySelector('.ranking-step-1')?.animate?.([{borderColor:'#a48d53'},{borderColor:'#ffe1a0'},{borderColor:'#a48d53'}],{duration:1800,delay:450});
   root.querySelector('.ranking-record')?.animate?.([{opacity:.6},{opacity:1}],{duration:500,delay:1800,fill:'backwards'});animated=true;
  }
 }
 async function refresh(results=[]){const token=generation,q=quest;if(!q)return;try{const data=await client.board(q);if(token===generation&&quest===q&&getContext().owner===owner&&getContext().client===connection){const captured=operation?client.takeResult?.(operation):null;improvedForView=improvedForView||!!captured?.improved||(!operation&&results.some(r=>r?.questId===q.id&&r.improved));rows({...data,improved:improvedForView})}}catch{if(token===generation)status('Classement en attente de synchronisation. Ta victoire est sauvegardée.')}}
 function show(q,operationId=null){clear();quest=q;operation=operationId;owner=getContext().owner;connection=getContext().client;root.hidden=false;status('Classement en attente de synchronisation. Ta victoire est sauvegardée.');void client.flush().catch(()=>[]).then(refresh)}
 function mount(){if(owner&&(getContext().owner!==owner||getContext().client!==connection)){clear();return}const sky=document.getElementById('skyRevealResults'),normal=document.getElementById('successRecord');const visibleSky=sky&&!sky.hidden&&!document.getElementById('skyReveal')?.hidden;if(visibleSky)document.getElementById('skyRevealRecord')?.after(root);else normal?.after(root)}
 return {show,refresh,clear,mount,root};
}
