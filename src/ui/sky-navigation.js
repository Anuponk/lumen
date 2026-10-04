// One responsive component: browsing state never writes campaign progression.
export const CONSTELLATIONS_PER_PAGE=6;
export function skySelection(model,selection={},questIndex=0){
 const skies=model.skies||[],activeSky=skies.find(s=>s.packs.some(p=>questIndex>=p.legacyQuestStart&&questIndex<p.legacyQuestStart+p.questCount))||skies[0];
 const sky=skies.find(s=>s.id===selection.skyId)||activeSky;
 const candidate=activeSky?.packs.find(p=>questIndex>=p.legacyQuestStart&&questIndex<p.legacyQuestStart+p.questCount);
 const active=candidate?.accessible?candidate:activeSky?.packs.filter(p=>p.accessible&&p.legacyQuestStart<=questIndex).at(-1);
 const adventure=sky?.packs.find(p=>p.id===selection.packId&&p.accessible)||sky?.packs.find(p=>p.id===active?.id&&p.accessible)||sky?.packs.find(p=>p.accessible)||null;
 const pages=Math.max(1,Math.ceil((adventure?.constellations.length||0)/CONSTELLATIONS_PER_PAGE));
 const page=Math.max(0,Math.min(Number.isInteger(selection.page)?selection.page:0,pages-1));
 return {sky,adventure,active,page,pages,entries:adventure?.constellations.slice(page*CONSTELLATIONS_PER_PAGE,(page+1)*CONSTELLATIONS_PER_PAGE)||[]};
}

export function createSkyNavigation({document,getModel,getQuest,getSolved,getLit,getShape,getMastered,getBadgeCounts=()=>({}),onConstellation}){
 const sheet=document.querySelector('#mapModal .map-sheet'),tabs=document.getElementById('sectorTabs');
 sheet.querySelector('h2').textContent='Mon ciel';sheet.querySelector('h2').id='monCielTitle';
 const modal=document.getElementById('mapModal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','monCielTitle');
 modal.addEventListener('keydown',e=>{if(e.defaultPrevented)return;if(e.key==='Escape'){e.preventDefault();element('closeMap').click()}if(e.key==='Tab'){const controls=[...modal.querySelectorAll('button,select,[tabindex]')].filter(c=>!c.disabled&&c.tabIndex>=0&&c.getClientRects().length);if(!controls.length)return;const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
 const context=document.createElement('div');context.id='skyNavigation';context.className='sky-navigation';
 context.innerHTML='<label class="sky-picker">Ciel <select id="skyPicker" aria-label="Choisir un Ciel"></select></label><div id="adventureRail" class="adventure-rail" role="group" aria-label="Aventures"></div><div id="adventureSummary" class="adventure-summary"></div>';
 tabs.before(context);
 const pages=document.createElement('div');pages.id='constellationPages';pages.className='constellation-pages';
 pages.innerHTML='<button id="constellationPrevious" aria-label="Constellations précédentes">‹</button><span id="constellationPage" aria-live="polite"></span><button id="constellationNext" aria-label="Constellations suivantes">›</button>';
 tabs.after(pages);
 const detail=document.createElement('section');detail.id='mapDetail';detail.className='map-detail';
 detail.innerHTML='<button id="constellationBack" class="constellation-back">‹ Toutes les constellations</button>';
 pages.after(detail);
 for(const id of ['puzzleGrid','performanceLegend','skyCard'])detail.appendChild(document.getElementById(id));
 detail.after(document.getElementById('openMyChallenges'));
 const oldHeading=sheet.querySelector('h3');if(oldHeading)oldHeading.remove();
 const notice=document.createElement('div');notice.id='adventureNotice';notice.className='adventure-notice';notice.hidden=true;notice.setAttribute('role','dialog');notice.setAttribute('aria-modal','true');notice.setAttribute('aria-label','Aventure verrouillée');
 notice.innerHTML='<div><strong id="adventureNoticeTitle"></strong><p id="adventureNoticeCopy"></p><button id="adventureNext" hidden>Découvrir l’Aventure suivante</button><button id="adventureNoticeClose">Compris</button></div>';sheet.appendChild(notice);
 let selection={},view='overview',selectedConstellation=null,noticeOrigin=null;
 const element=id=>document.getElementById(id);
 const completed=c=>Array.from({length:c.questCount},(_,i)=>getSolved(c.questStart+i)).every(Boolean);
 function state(pack){const done=pack.constellations.filter(completed).length;return !pack.accessible?'Verrouillée':done===pack.constellations.length?'Terminée':pack.id===current.active?.id?'En cours':'À découvrir'}
 let current=skySelection(getModel(),selection,getQuest());
 function setView(next){view=next;tabs.hidden=next==='detail';pages.hidden=next==='detail'||current.pages<=1;detail.hidden=next!=='detail'}
 function showLocked(pack,origin){noticeOrigin=origin||document.activeElement;element('adventureNext').hidden=true;element('adventureNoticeClose').textContent='Compris';element('adventureNoticeTitle').textContent=pack.displayName||'Aventure';element('adventureNoticeCopy').textContent=pack.lockReason||'Cette Aventure est verrouillée. Son mode de déverrouillage sera annoncé plus tard.';notice.hidden=false;element('adventureNoticeClose').focus()}
 function showCompletion(pack){const badges=getBadgeCounts(pack);const sky=getModel().skies.find(s=>s.id===pack.skyId),entry=sky?.packs.find(p=>p.id===pack.id);if(!entry)return;const next=sky.packs[sky.packs.indexOf(entry)+1];element('adventureNoticeTitle').textContent='✦ Aventure terminée !';element('adventureNoticeCopy').textContent=`${entry.displayName} · ${entry.constellations.length} constellations · ${entry.constellations.reduce((sum,c)=>sum+(getShape(c)?.count||0),0)} étoiles · ${badges.autonomy||0} Autonomie · ${badges.speed||0} Rapidité · ${badges.noError||0} Sans erreur · ${badges.mastery||0} Maîtrises`;element('adventureNoticeClose').textContent='Retour à Mon ciel';const button=element('adventureNext');button.hidden=!next;button.onclick=()=>{closeNotice();if(!next.accessible){showLocked(next,button);return}selection={skyId:sky.id,packId:next.id,page:0};selectedConstellation=null;view='overview';render()};noticeOrigin=document.activeElement;notice.hidden=false;(next?button:element('adventureNoticeClose')).focus()}
 function closeNotice(){notice.hidden=true;const origin=noticeOrigin?.isConnected&&!noticeOrigin.hidden&&noticeOrigin.getClientRects().length?noticeOrigin:element('adventureRail').querySelector('.selected');origin?.focus?.()}
 function render(){
  const model=getModel();current=skySelection(model,selection,getQuest());selection={skyId:current.sky?.id,packId:current.adventure?.id,page:current.page};
  const picker=element('skyPicker');picker.replaceChildren();for(const sky of model.skies){const option=document.createElement('option');option.value=sky.id;option.textContent=sky.label;picker.appendChild(option)}picker.value=current.sky?.id||'';
  const rail=element('adventureRail'),scroll=rail.scrollLeft;rail.replaceChildren();
  for(const pack of current.sky?.packs||[]){const b=document.createElement('button');b.className='adventure-chip'+(pack.id===current.adventure?.id?' selected':'')+(!pack.accessible?' locked':'');b.dataset.packId=pack.id;b.setAttribute('aria-pressed',String(pack.id===current.adventure?.id));b.textContent=(!pack.accessible?'🔒 ':state(pack)==='Terminée'?'✓ ':'')+(pack.displayName||'Aventure '+(pack.order+1));b.title=state(pack);b.onclick=()=>{if(!pack.accessible){showLocked(pack,b);return}selection={skyId:current.sky.id,packId:pack.id,page:0};selectedConstellation=null;view='overview';render()};rail.appendChild(b)}rail.scrollLeft=scroll;
  const pack=current.adventure,done=pack?.constellations.filter(completed).length||0;
  element('adventureSummary').textContent=pack?`${pack.displayName||'Aventure'} · ${done}/${pack.constellations.length} constellations · ${state(pack)}`:'Les Aventures de ce Ciel sont verrouillées';
  tabs.replaceChildren();
  for(const entry of current.entries){const b=document.createElement('button'),shape=getShape(entry),lit=getLit(entry),unlocked=entry.accessible&&(getSolved(entry.questStart)||entry.questStart<=getQuest()),done=completed(entry);b.className='sector-tab constellation-card'+(entry.id===selectedConstellation?.id?' active':'')+(unlocked?'':' locked');b.dataset.contentId=entry.id;b.dataset.packId=entry.packId;b.setAttribute('aria-label',`${entry.label} · ${lit}/${shape?.count||0} étoiles · ${done?'Terminée':unlocked?'En cours':'Verrouillée'}`);
   if(shape){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 290 115');svg.setAttribute('aria-hidden','true');for(const [a,z] of shape.edges||[]){const line=document.createElementNS(svg.namespaceURI,'line');line.setAttribute('x1',shape.pts[a][0]);line.setAttribute('y1',shape.pts[a][1]);line.setAttribute('x2',shape.pts[z][0]);line.setAttribute('y2',shape.pts[z][1]);line.setAttribute('class','sky-line'+(a<lit&&z<lit?' on':''));svg.appendChild(line)}for(const [i,point] of (shape.pts||[]).entries()){const circle=document.createElementNS(svg.namespaceURI,'circle');circle.setAttribute('cx',point[0]);circle.setAttribute('cy',point[1]);circle.setAttribute('r','4');circle.setAttribute('class','sky-star'+(i<lit?' on':''));svg.appendChild(circle)}b.appendChild(svg)}
   b.setAttribute('aria-disabled',String(!unlocked));const name=document.createElement('strong');name.textContent=entry.label.replace(' · Grand Chariot','');b.appendChild(name);const info=document.createElement('small');info.textContent=`${lit}/${shape?.count||0} ★ · ${done?'Terminée':unlocked?'En cours':'🔒'}${getMastered(entry)?' · ✦':''}`;b.appendChild(info);
   b.onclick=()=>{if(!unlocked)return;selectedConstellation=entry;setView('detail');onConstellation(entry)};tabs.appendChild(b);
  }
  element('constellationPage').textContent=`${current.page+1} / ${current.pages}`;element('constellationPrevious').disabled=current.page===0;element('constellationNext').disabled=current.page===current.pages-1;
  // Access refresh can invalidate a viewed Adventure; return to a valid overview.
  if(selectedConstellation&&!pack?.constellations.some(c=>c.id===selectedConstellation.id)){selectedConstellation=null;view='overview'}
  setView(view);
 }
 function turn(delta){selection.page=current.page+delta;render()}
 element('skyPicker').onchange=e=>{selection={skyId:e.target.value,page:0};selectedConstellation=null;view='overview';render()};
 element('constellationPrevious').onclick=()=>turn(-1);element('constellationNext').onclick=()=>turn(1);element('constellationBack').onclick=()=>setView('overview');element('adventureNoticeClose').onclick=closeNotice;
 notice.onclick=e=>{if(e.target===notice)closeNotice()};notice.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeNotice()}if(e.key==='Tab'){const buttons=[element('adventureNext'),element('adventureNoticeClose')].filter(b=>!b.hidden);const index=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus()}});
 let pointer=null,swiped=false;tabs.style.touchAction='pan-y';tabs.addEventListener('pointerdown',e=>{swiped=false;pointer={x:e.clientX,y:e.clientY,id:e.pointerId}});tabs.addEventListener('pointerup',e=>{if(!pointer||e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5){swiped=true;const delta=dx<0?1:-1;if(current.page+delta>=0&&current.page+delta<current.pages)turn(delta)}});tabs.addEventListener('pointercancel',()=>pointer=null);tabs.addEventListener('click',e=>{if(swiped){e.preventDefault();e.stopImmediatePropagation();swiped=false}},true);
 tabs.addEventListener('keydown',()=>swiped=false);
 return {render,setView,showLocked,showCompletion,open({detail:showDetail=false}={}){selection={};current=skySelection(getModel(),{},getQuest());const entry=current.adventure?.constellations.find(c=>getQuest()>=c.questStart&&getQuest()<c.questStart+c.questCount)||current.adventure?.constellations[0];if(entry){selection.page=Math.floor(current.adventure.constellations.indexOf(entry)/CONSTELLATIONS_PER_PAGE);selectedConstellation=entry;onConstellation(entry)}view=showDetail?'detail':'overview';notice.hidden=true;render();element('adventureRail').querySelector('.selected')?.scrollIntoView({block:'nearest',inline:'center'})},snapshot:()=>({view,selection:{...selection},activeAdventure:current.active?.id,viewedAdventure:current.adventure?.id,page:current.page,pages:current.pages})};
}
