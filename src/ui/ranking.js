import { createTranslator } from './i18n.js';

const fr = createTranslator().t;

// One compact podium travels with the existing victory surface (#682).
// Its slot is reserved from the first frame: loading, empty, offline and ready
// states share one geometry, so the late board never moves other zones.
// #851: the status of the current run, with its proven cause only.
export function rankingVerdict(reason,excluded,t=fr){
 if(reason==='cooldown')return t('ranking.verdictCooldown');
 if(reason==='not_qualifying')return t('ranking.verdictNotQualifying');
 if(reason==='not_better')return t('ranking.verdictNotBetter');
 if(reason==='improved')return t('ranking.verdictImproved');
 if(excluded||reason==='unknown')return t('ranking.verdictExcluded');
 return null;
}
export function createRankingView({client,getContext,format,document=globalThis.document,onUpdate=()=>{},t=fr}={}){
 const root=document.createElement('section');root.className='ranking';root.hidden=true;root.setAttribute('aria-label',t('ranking.board'));
 let generation=0,quest=null,owner=null,connection=null,operation=null,improvedForView=false,excludedForView=false,reasonForView=null,personalBest=null,animated=false,review=false;
 const reduced=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 function clear(){generation++;root.hidden=true;root.replaceChildren();delete root.dataset.state;quest=null;improvedForView=false;excludedForView=false;reasonForView=null;personalBest=null;animated=false;review=false}
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
  const list=element('ol','ranking-podium','');list.setAttribute('aria-label',t('ranking.top'));
  for(const row of top){
   const li=element('li','ranking-row ranking-step-'+row.position+(row.mine?' ranking-mine':''),'');li.dataset.position=row.position;
   li.append(element('span','ranking-crown','♛'),element('span','ranking-place',String(row.place)),element('span','ranking-name',row.nickname),element('span','ranking-time',format(row.score)));li.title=row.nickname;
   if(row.virtual)li.append(element('small','ranking-virtual',t('ranking.echo')));
   if(row.mine)li.append(element('small','ranking-you',t('ranking.you')));
   list.append(li);
  }
  root.append(list);
  const card=element('div','ranking-personal','');
  if(mine&&mine.position>3){card.classList.add('ranking-mine');card.dataset.position=mine.position;card.append(element('strong','',t('ranking.yourPlace',{place:t('ranking.ordinal',{count:mine.place},{type:'ordinal'})})),element('span','ranking-time',format(mine.score)));
   const third=top.find(r=>r.position===3);if(third&&mine.score>third.score)card.append(element('small','',t('ranking.toPodium',{time:format(mine.score-third.score)})));
  }else if(!mine)card.append(element('span','',t('ranking.noCompetitiveTime')));
  // #761: a victory the server refused is never shown as if the podium were its result.
  if(card.childNodes.length)root.append(card);
  // #851: the private record and the best ranked time are different facts.
  if(Number.isSafeInteger(personalBest)&&mine&&Number.isSafeInteger(mine.score)&&personalBest!==mine.score){
   const compare=element('p','ranking-compare','');compare.dataset.personal=String(personalBest);compare.dataset.ranked=String(mine.score);
   compare.append(element('span','',t('ranking.personalRecord',{time:format(personalBest)})),element('span','',t('ranking.bestRanked',{time:format(mine.score)})));
   root.append(compare);
  }
  const verdict=rankingVerdict(data.reason,data.excluded,t);
  if(verdict){const p=element('p','ranking-excluded',verdict);p.dataset.reason=data.reason||'excluded';root.append(p)}
  if(!data.participating)root.append(element('p','ranking-note',data.withdrawn?t('ranking.withdrawing'):t('ranking.account')));
  if(!animated&&!reduced()){
   [...list.children].forEach((e,i)=>e.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:450,delay:i*300,easing:'ease-out',fill:'backwards'}));
   list.querySelector('.ranking-mine')?.animate?.([{boxShadow:'0 0 0 0 rgba(255,225,160,0)'},{boxShadow:'0 0 22px 4px rgba(255,225,160,.75)'},{boxShadow:'0 0 12px 2px rgba(255,225,160,.45)'}],{duration:1400,delay:900,fill:'forwards'});
   animated=true;
  }
  onUpdate({state:'ready',quest,data});
 }
 async function refresh(results=[],{background=false}={}){
  const token=generation,q=quest;if(!q||getContext().owner!==owner||getContext().client!==connection)return;
  // #995 Free-first: the 30 s wake re-reads a ready podium only when a capture settled.
  if(background&&root.dataset.state==='ready'&&!results?.length)return;
  try{
   // Reconnect/timer updates must not replace a still-pending result with an old board.
   if(!review&&operation&&client.entries?.(owner).some(e=>e.operationId===operation)){
    status(t('ranking.awaitingConfirmation'),'pending');return;
   }
   const data=await client.board(q);
   if(token===generation&&quest===q&&getContext().owner===owner&&getContext().client===connection){
    const captured=operation?client.takeResult?.(operation):null;
    improvedForView=improvedForView||!!captured?.improved||(!operation&&results.some(r=>r?.questId===q.id&&r.improved));
    excludedForView=excludedForView||captured?.status==='ineligible'||captured?.status==='refused'||captured?.status==='membership_required'; // #962
    reasonForView=captured?.reason??reasonForView;
    rows({...data,improved:improvedForView,excluded:excludedForView,reason:reasonForView});
   }
  }catch{if(token===generation)status(globalThis.navigator?.onLine===false?(review?t('ranking.offline'):t('ranking.offlineSaved')):(review?t('ranking.unavailable'):t('ranking.syncPending')),globalThis.navigator?.onLine===false?'offline':review?'error':'pending')}
 }
 function show(q,operationId=null,options={}){clear();root.setAttribute('aria-label',t('ranking.board'));quest=q;operation=operationId;personalBest=Number.isSafeInteger(options.personalBest)?options.personalBest:null;owner=getContext().owner;connection=getContext().client;root.hidden=false;const token=generation;
  // #695 review: read the board only; nothing is flushed or animated.
  if(options.review){review=true;animated=true;status(t('ranking.loading'));void refresh();return}
  status(t('ranking.loading'));
  // Do not silently show an old confirmed podium when this victory failed to sync.
  void client.flush().then(async results=>{
   if(operation&&typeof client.entries==='function'&&client.entries(owner).some(e=>e.operationId===operation)){
    if(quest===q&&generation===token)status(t('ranking.awaitingConfirmation'),'pending');
    return;
   }
   await refresh(results);
  }).catch(error=>{
   if(quest!==q||generation!==token)return;
   // An unrelated failed capture cannot hide this operation's terminal receipt.
   if(operation&&error?.results?.some(r=>r.operationId===operation&&['confirmed','ineligible','refused','membership_required'].includes(r.status))){void refresh(error.results);return}
   if(quest===q&&generation===token)status(t('ranking.syncError'),'pending');
  })}
 function mount(){if(owner&&(getContext().owner!==owner||getContext().client!==connection)){clear();return}const slot=document.getElementById('skyRevealPodium'),sky=document.getElementById('skyRevealResults'),normal=document.getElementById('successRecord');const visibleSky=sky&&!sky.hidden&&!document.getElementById('skyReveal')?.hidden;if(visibleSky&&slot)slot.prepend(root);else if(visibleSky)document.getElementById('skyRevealRecord')?.after(root);else normal?.after(root)}
 return {show,refresh,clear,mount,root};
}
