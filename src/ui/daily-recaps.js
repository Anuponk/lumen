import {escapeDaily,formatDailyDate,formatWeekRange,renderDailyBoard} from './daily-view.js';
import {addDays} from '../campaign/daily-challenge.js';

// The server claims one latest recap per account. Keep a received recap until
// the player returns to an idle sky, including when a request finishes late.
export function setupDailyRecaps({document,context,read,t,locale,formatDuration,openBoard,celebrate}) {
  let scope=null,attempted=null,busy=false,pending=null,overlay=null,opener=null;
  const close=()=>{
    overlay?.remove();overlay=null;
    if(opener?.isConnected)opener.focus({preventScroll:true});
  };
  function show(recap) {
    const weekly=recap.kind==='week',board=recap.board;
    const card=document.createElement('div');
    card.classList.add('daily-celebration','daily-recap');
    const place=Number(board.general?.me?.rank);
    if(place>0&&place<=3)card.classList.add('daily-recap-podium');
    card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
    card.setAttribute('aria-labelledby','dailyRecapTitle');
    const title=t(weekly?'daily.recapWeek':'daily.recapDay');
    const date=weekly?formatWeekRange(recap.day,addDays(recap.day,6),{t,locale:locale()}):formatDailyDate(recap.day,locale());
    card.innerHTML='<div class="daily-celebration-card"><div class="daily-celebration-glow" aria-hidden="true">✦</div>'+
      '<h2 id="dailyRecapTitle">'+escapeDaily(title)+'</h2><p>'+escapeDaily(date)+'</p>'+
      '<div class="daily-tabs" role="tablist" aria-label="'+escapeDaily(t('daily.boards'))+'">'+
      '<button type="button" role="tab" data-scope="general" aria-selected="true" aria-controls="dailyRecapBoard">'+escapeDaily(t('daily.general'))+'</button>'+
      '<button type="button" role="tab" data-scope="friends" aria-selected="false" aria-controls="dailyRecapBoard">'+escapeDaily(t('daily.friends'))+'</button></div>'+
      '<div id="dailyRecapBoard" role="tabpanel" aria-live="polite"></div><div class="social-actions">'+
      '<button type="button" data-action="board">'+escapeDaily(t('daily.recapBoard'))+'</button>'+
      '<button type="button" data-action="close">'+escapeDaily(t('daily.close'))+'</button></div></div>';
    const render=selected=>{
      for(const tab of card.querySelectorAll('[data-scope]'))tab.setAttribute('aria-selected',String(tab.dataset.scope===selected));
      card.querySelector('#dailyRecapBoard').innerHTML=renderDailyBoard(board[selected],{scope:selected,weekly,t,formatDuration});
    };
    card.addEventListener('click',event=>{
      const button=event.target.closest('button');
      if(button?.dataset.scope)render(button.dataset.scope);
      if(button?.dataset.action==='close')close();
      if(button?.dataset.action==='board'){close();void openBoard(recap)}
    });
    card.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}
      if(event.key==='Tab'){
        const buttons=[...card.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
        if(event.shiftKey&&index<=0){event.preventDefault();buttons.at(-1).focus()}
        else if(!event.shiftKey&&index===buttons.length-1){event.preventDefault();buttons[0].focus()}
      }
    });
    opener=document.activeElement;overlay=card;render('general');
    document.body.append(card);card.querySelector('[data-action="close"]').focus({preventScroll:true});
    celebrate?.();
  }
  async function wake() {
    const c=context(),key=c.owner?c.owner+':'+c.day:null;
    if(scope?.owner!==c.owner||scope?.client!==c.client){
      close();scope={owner:c.owner,client:c.client};attempted=null;pending=null;busy=false;
    }
    if(!key||!c.safe||overlay)return;
    if(pending){const recap=pending;pending=null;show(recap);return}
    if(busy||attempted===key)return;
    attempted=key;busy=true;
    const requestScope=scope;
    try {
      const recap=await read();
      if(scope!==requestScope)return;
      const latest=context();
      if(latest.owner!==c.owner||latest.client!==c.client)return;
      if(!recap||!['day','week'].includes(recap.kind)||!recap.board?.final)return;
      if(latest.safe)show(recap);else pending=recap;
    } catch {
      // Keep the once-per-account/day bound while an older server is deployed.
      // A transport retry never blocks a quest or introduces polling.
    } finally {if(scope===requestScope)busy=false}
  }
  return {wake};
}
