// #898 (EPIC #881 Lot 4, PR A): the single "Espace social" entry point.
// Pure navigation: every destination is an existing screen, bound by its own
// code through stable ids (#18/#35 « Mes défis », « Mes amis », invitation
// #779, Défi du jour #882). The two #35 counters (#friendsBadge,
// #challengeUnreadBadge) live inside this panel unchanged; the global badge
// only adds what they display, so nothing is counted twice or recomputed.

// Number shown by an existing counter element (0 when hidden or empty).
export function badgeCount(element){
 if(!element||element.hidden)return 0;
 const value=Number.parseInt(String(element.textContent||'').trim(),10);
 return Number.isFinite(value)&&value>0?value:0;
}

// Global badge: the sum of the existing counters plus optional extra
// sources (PR B). Capped for display, never negative.
export function socialBadgeText(total){
 const n=Math.max(0,Math.floor(Number(total)||0));
 return n?n>99?'99+':String(n):'';
}

export function setupSocialHub({doc=document,t=key=>key,isSignedIn=()=>false,extraCount=()=>0,onOpen=()=>{},onSignIn=null,notifications=null}={}){
 const $=id=>doc.getElementById(id);
 const trigger=$('openSocial'),hub=$('socialHub');
 if(!trigger||!hub)return null;
 const badge=$('socialBadge'),menu=$('socialHubMenu'),close=$('socialHubClose');
 const views={menu,rankings:$('socialRankingsView'),notifications:$('socialNotificationsView')};
 const counters=[$('friendsBadge'),$('challengeUnreadBadge')];
 let returnFocus=null;

 function total(){return counters.reduce((sum,el)=>sum+badgeCount(el),0)+Math.max(0,Number(notifications?notifications.extraCount():extraCount())||0)}
 function refreshBadge(){
  const n=total(),text=socialBadgeText(n);
  if(badge){badge.hidden=!n;badge.textContent=text}
  trigger.setAttribute('aria-label',n?t('social.openWithCount',{count:n}):t('social.open'));
  const notif=$('socialNotificationsCount');if(notif){notif.hidden=!n;notif.textContent=text}
 }
 // Mirror the Défi du jour entry of « Mes quêtes » (#882 owns availability).
 function refreshDaily(){
  const entry=$('openDaily'),row=$('socialDaily'),state=$('dailyEntryState');
  const available=!!entry&&!entry.hidden;
  if(row){row.hidden=!available;const small=$('socialDailyState');if(small&&state)small.textContent=state.textContent}
  const week=$('openDailyWeek');
  const dailyRanking=$('socialDailyRanking');if(dailyRanking)dailyRanking.hidden=!available;
  const weekButton=$('socialDailyWeek');if(weekButton)weekButton.hidden=!available||!week||week.hidden;
 }
 function refreshAccount(){
  const signed=!!isSignedIn();
  const note=$('socialGuestNote');if(note)note.hidden=signed;
  for(const id of ['socialNotificationsGuest'])if($(id))$(id).hidden=signed;
  const signIn=$('socialSignIn');if(signIn)signIn.hidden=signed||!onSignIn;
 }
 function renderNotifications(){
  const list=$('socialNotificationsList');if(!list)return;
  // PR B: the derived feed (#898) when available; counters summary otherwise.
  if(notifications&&isSignedIn()){notifications.render(list,{empty:$('socialNotificationsEmpty'),error:$('socialNotificationsError')});return}
  const error=$('socialNotificationsError');if(error)error.hidden=true;
  const friends=badgeCount(counters[0]),results=badgeCount(counters[1]);
  const rows=[];
  if(friends)rows.push({target:'openFriends',icon:'👥',text:t('social.summaryFriends',{count:friends})});
  if(results)rows.push({target:'openMyChallenges',icon:'⚔',text:t('social.summaryResults',{count:results})});
  list.replaceChildren(...rows.map(row=>{
   const b=doc.createElement('button');b.type='button';b.className='social-hub-item';b.dataset.socialTarget=row.target;
   const icon=doc.createElement('span');icon.className='social-hub-icon';icon.setAttribute('aria-hidden','true');icon.textContent=row.icon;
   const label=doc.createElement('span');label.className='social-hub-label';label.textContent=row.text;
   b.append(icon,label);return b;
  }));
  const empty=$('socialNotificationsEmpty');if(empty)empty.hidden=!!rows.length||!isSignedIn();
 }
 function show(name){
  for(const [key,view] of Object.entries(views))if(view)view.hidden=key!==name;
  if(name==='notifications'){
   renderNotifications();
   if(notifications&&isSignedIn()){notifications.markAllSeen();void notifications.refresh({force:true}).then(()=>{if(!views.notifications.hidden)renderNotifications()})}
  }
  const back=$('socialHubBack');if(back)back.hidden=name==='menu';
  const title=$('socialHubTitle');if(title)title.textContent=t(name==='rankings'?'social.rankings':name==='notifications'?'social.notifications':'social.title');
  const first=(views[name]||menu)?.querySelector('button:not([hidden])');
  first?.focus({preventScroll:true});
 }
 function open(){
  if(!hub.hidden)return;
  returnFocus=doc.activeElement;
  refreshDaily();refreshAccount();refreshBadge();
  hub.hidden=false;trigger.setAttribute('aria-expanded','true');
  show('menu');onOpen();
  if(notifications&&isSignedIn())void notifications.refresh().then(refreshBadge);
 }
 function hide({restore=true}={}){
  if(hub.hidden)return;
  hub.hidden=true;trigger.setAttribute('aria-expanded','false');
  if(restore)(returnFocus&&doc.contains(returnFocus)?returnFocus:trigger).focus?.({preventScroll:true});
  returnFocus=null;
 }

 trigger.addEventListener('click',()=>hub.hidden?open():hide());
 close?.addEventListener('click',()=>hide());
 $('socialHubBack')?.addEventListener('click',()=>show('menu'));
 $('socialRankings')?.addEventListener('click',()=>show('rankings'));
 $('socialNotifications')?.addEventListener('click',()=>show('notifications'));
 // Destinations owned by existing screens: proxy to their own entry points.
 const proxy=(id,target)=>$(id)?.addEventListener('click',()=>{hide({restore:false});$(target)?.click()});
 proxy('socialDaily','openDaily');
 proxy('socialDailyRanking','openDaily');
 proxy('socialDailyWeek','openDailyWeek');
 proxy('socialOpenSky','openSky');
 $('socialSignIn')?.addEventListener('click',()=>{hide({restore:false});onSignIn?.()});
 // Real entries (#openFriends, #openMyChallenges, #inviteLumenFriends) keep
 // their original handlers; the panel only steps aside afterwards.
 menu?.addEventListener('click',event=>{if(event.target.closest('[data-social-leave]'))hide({restore:false})});
 views.notifications?.addEventListener('click',event=>{
  if(event.target.closest('.social-notification')){hide({restore:false});return}
  const row=event.target.closest('[data-social-target]');if(!row)return;
  hide({restore:false});$(row.dataset.socialTarget)?.click();
 });
 hub.addEventListener('click',event=>{if(event.target===hub)hide()});
 hub.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.stopPropagation();hide();return}
  if(event.key!=='Tab')return;
  const focusable=[...hub.querySelectorAll('button,[href],input')].filter(el=>!el.disabled&&el.offsetParent!==null);
  if(!focusable.length)return;
  const first=focusable[0],last=focusable[focusable.length-1];
  if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus()}
  else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus()}
 });

 const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{refreshBadge();refreshDaily();if(!views.notifications?.hidden)renderNotifications()}):null;
 for(const el of [...counters,$('openDaily'),$('dailyEntryState'),$('openDailyWeek')])
  if(el&&observer)observer.observe(el,{attributes:true,attributeFilter:['hidden'],childList:true,characterData:true,subtree:true});
 refreshBadge();refreshDaily();
 return {open,close:hide,refresh(){refreshBadge();refreshDaily();refreshAccount();if(!views.notifications?.hidden)renderNotifications()},total};
}
