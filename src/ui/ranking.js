// A single mounted list travels between the ordinary and constellation results.
export function createRankingView({client,getContext,format,document=globalThis.document}={}){
 const root=document.createElement('section');root.className='ranking';root.hidden=true;root.setAttribute('aria-label','Classement de la grille');
 let generation=0,quest=null,timer=null,owner=null,connection=null,operation=null,improvedForView=false,animated=false;
 function clear(){generation++;clearTimeout(timer);root.hidden=true;root.replaceChildren();quest=null;improvedForView=false;animated=false}
 function status(text){root.replaceChildren();const p=document.createElement('p');p.setAttribute('role','status');p.textContent=text;root.append(p)}
 function rows(data){
  root.replaceChildren();const title=document.createElement('h3');title.textContent='Classement';root.append(title);
  const list=document.createElement('ol');list.className='ranking-list';list.setAttribute('aria-label','Pseudos et meilleurs temps');
  let previous=0,mine=null;
  for(const row of data.rows||[]){
   if(row.position>previous+1){const gap=document.createElement('li');gap.className='ranking-gap';gap.textContent='⋯';gap.setAttribute('aria-hidden','true');list.append(gap)}
   previous=row.position;const li=document.createElement('li');li.className='ranking-row'+(row.mine?' ranking-mine':'');li.dataset.position=row.position;
   for(const [kind,value] of [['place',row.place],['name',row.nickname],['time',format(row.score)]]){const span=document.createElement('span');span.className='ranking-'+kind;span.textContent=value;li.append(span)}
   if(row.virtual){const note=document.createElement('small');note.textContent='Virtuel';li.querySelector('.ranking-name').append(note)}
   if(row.mine&&data.improved){const note=document.createElement('small');note.textContent='Nouveau record';li.querySelector('.ranking-time').append(note)}
   if(row.mine&&row.penalty){li.title='Temps réel '+format(row.seconds)+' · pénalité +'+format(row.penalty)}
   list.append(li);if(row.mine)mine=li;
  }
  root.append(list);
  if(mine)list.scrollTop=Math.max(0,mine.offsetTop-(list.clientHeight-mine.offsetHeight)/2);
  if(data.improved&&mine&&!animated&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
   // Keep real final rows in the DOM; animate the player's line from the bottom.
   const distance=Math.max(0,list.getBoundingClientRect().bottom-mine.getBoundingClientRect().bottom);
   mine.animate?.([{transform:'translateY('+distance+'px)',opacity:.6},{transform:'translateY(0)',opacity:1}],{duration:2000,easing:'cubic-bezier(.2,.7,.2,1)'});
   animated=true;
  }
  if(!data.participating){
   const button=document.createElement('button');button.type='button';button.textContent='Participer avec mon pseudo';button.onclick=async()=>{
    const nickname=getContext().nickname;if(!nickname){status('Choisis un pseudo dans Compte pour participer.');return}
    button.disabled=true;const token=generation;
    try{await client.membership(true,nickname);const results=await client.flush();if(token===generation)await refresh(results)}catch{if(token===generation)status('Classement indisponible. Ta victoire est sauvegardée.')}
   };root.append(button);
  }else{
   const button=document.createElement('button');button.type='button';button.className='ranking-withdraw';button.textContent='Quitter le classement';button.onclick=async()=>{const token=generation;button.disabled=true;try{await client.membership(false);if(token===generation)await refresh()}catch{if(token===generation)status('Retrait non confirmé. Réessaie.')}};root.append(button);
  }
 }
 async function refresh(results=[]){const token=generation,q=quest;if(!q)return;try{const data=await client.board(q);if(token===generation&&quest===q&&getContext().owner===owner&&getContext().client===connection){const captured=operation?client.takeResult?.(operation):null;improvedForView=improvedForView||!!captured?.improved||results.some(r=>r?.questId===q.id&&r.improved);rows({...data,improved:improvedForView})}}catch{if(token===generation)status('Classement en attente de synchronisation.')}}
 function show(q,operationId=null){clear();quest=q;operation=operationId;owner=getContext().owner;connection=getContext().client;root.hidden=false;status('Classement en attente de synchronisation.');void client.flush().catch(()=>[]).then(refresh)}
 function mount(){if(owner&&getContext().owner!==owner){clear();return}const sky=document.getElementById('skyRevealResults'),normal=document.getElementById('successRecord');const visibleSky=sky&&!sky.hidden&&!document.getElementById('skyReveal')?.hidden;if(visibleSky)document.getElementById('skyRevealRecord')?.after(root);else normal?.after(root)}
 return {show,refresh,clear,mount,root};
}
