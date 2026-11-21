// #898 (EPIC #881 Lot 4, PR B): sober in-app social notifications.
// Events are DERIVED from the existing server reads of #35/#18 (friend list,
// friend inbox, "Mes défis"); nothing new is stored on the server and no push
// is sent. The only local state, per account and per device, is the read state
// and the list of outgoing friend requests (to notice an acceptance).
// Counting rule (no double count): requests, received challenges and unread
// results are already counted by the validated #35 counters; this module only
// adds the acceptances not yet seen.

export const SOCIAL_NOTIFICATIONS_KEY='lumenSocialNotificationsV1';
export const ACCEPTED_TTL_MS=30*24*3600*1000;
const norm=value=>String(value??'').trim().toLowerCase();

export function emptyNotificationState(){return {version:1,baseline:false,outgoing:[],accepted:[],seen:[]}}

export function readNotificationState(storage,owner){
 if(!owner)return emptyNotificationState();
 try{
  const raw=JSON.parse(storage?.getItem(SOCIAL_NOTIFICATIONS_KEY+':'+owner)||'null');
  if(!raw||raw.version!==1)return emptyNotificationState();
  const list=(value,check)=>Array.isArray(value)?value.filter(check):[];
  return {version:1,baseline:raw.baseline===true,
   outgoing:list(raw.outgoing,x=>typeof x==='string').slice(0,500),
   accepted:list(raw.accepted,x=>x&&typeof x.nickname==='string'&&Number.isFinite(x.at)).slice(0,100),
   seen:list(raw.seen,x=>typeof x==='string').slice(0,500)};
 }catch{return emptyNotificationState()}
}
export function writeNotificationState(storage,owner,state){
 if(!owner)return;
 try{storage?.setItem(SOCIAL_NOTIFICATIONS_KEY+':'+owner,JSON.stringify(state))}catch{}
}

// Pure: next local state from the current friend list. The first observation is
// a silent baseline (no flood of old acceptances after an update or a new device).
export function trackFriendships(state,friends=[],now=Date.now()){
 const byName=new Map(friends.map(f=>[norm(f.nickname),f]));
 const accepted=state.baseline?state.outgoing
  .filter(name=>byName.get(name)?.state==='friends')
  .map(name=>({nickname:byName.get(name).nickname,at:Date.parse(byName.get(name).since)||now})):[];
 const kept=[...state.accepted,...accepted]
  .filter(a=>byName.get(norm(a.nickname))?.state==='friends'&&now-a.at<ACCEPTED_TTL_MS);
 const unique=[...new Map(kept.map(a=>[norm(a.nickname),a])).values()];
 return {...state,baseline:true,
  outgoing:friends.filter(f=>f.state==='outgoing').map(f=>norm(f.nickname)),
  accepted:unique};
}

// Pure: the notification list, newest first, deduplicated by id.
export function deriveSocialEvents({friends=[],received=[],sent=[],accepted=[],questLabel=row=>'',t=key=>key,now=Date.now()}={}){
 const events=[];
 for(const f of friends)if(f?.state==='incoming')events.push({
  id:'friend-request:'+norm(f.nickname)+':'+(f.since||''),kind:'friend-request',actionable:true,at:Date.parse(f.since)||0,
  text:t('social.event.friendRequest',{name:f.nickname}),target:{type:'friends'}});
 for(const r of received)if(r?.challenge_id&&(r.status||'pending')==='pending')events.push({
  id:'challenge-received:'+r.challenge_id,kind:'challenge-received',actionable:true,at:Date.parse(r.created_at)||0,
  text:t('social.event.challengeReceived',{name:r.sender||t('social.event.someone')})+(questLabel(r)?' · '+questLabel(r):''),target:{type:'challenge',id:r.challenge_id}});
 for(const s of sent){
  const unread=Number(s?.unread_count)||0;
  if(!s?.challenge_id||unread<=0)continue;
  const done=(Array.isArray(s.participants)?s.participants:[]).filter(p=>['completed','abandoned'].includes(p?.status));
  const who=done.length===1&&done[0].display_name?t('social.event.resultBy',{name:done[0].display_name}):t('social.event.results',{count:unread});
  events.push({id:'challenge-result:'+s.challenge_id+':'+unread,kind:'challenge-result',actionable:true,
   at:Math.max(0,...done.map(p=>Date.parse(p.finished_at||p.updated_at)||0),Date.parse(s.created_at)||0),
   text:who+(questLabel(s)?' · '+questLabel(s):''),target:{type:'my-challenges',id:s.challenge_id}});
 }
 for(const a of accepted)if(now-a.at<ACCEPTED_TTL_MS)events.push({
  id:'friend-accepted:'+norm(a.nickname)+':'+a.at,kind:'friend-accepted',actionable:false,at:a.at,
  text:t('social.event.accepted',{name:a.nickname}),target:{type:'friends'}});
 return [...new Map(events.map(e=>[e.id,e])).values()].sort((x,y)=>y.at-x.at||x.id.localeCompare(y.id));
}

// Extra badge units: acceptances not seen yet (everything else is #35's).
export function unseenAcceptedCount(events,seen=[]){
 const read=new Set(seen);
 return events.filter(e=>e.kind==='friend-accepted'&&!read.has(e.id)).length;
}
// Mark the given events read; forget ids that no longer exist (bounded store).
export function markSeen(state,events,ids=events.map(e=>e.id)){
 const live=new Set(events.map(e=>e.id));
 return {...state,seen:[...new Set([...state.seen.filter(id=>live.has(id)),...ids])].slice(-500)};
}

export function relativeTime(at,now=Date.now(),t=key=>key){
 if(!at)return '';
 const minutes=Math.max(0,Math.floor((now-at)/60000));
 if(minutes<1)return t('social.time.now');
 if(minutes<60)return t('social.time.minutes',{count:minutes});
 const hours=Math.round(minutes/60);if(hours<24)return t('social.time.hours',{count:hours});
 const days=Math.round(hours/24);return days<=1?t('social.time.yesterday'):t('social.time.days',{count:days});
}

// Screen controller: fetches through the existing clients, renders the panel
// list, keeps the read state and refreshes on reconnection. Never shows a toast.
export function createSocialNotifications({doc=globalThis.document,t=key=>key,storage=globalThis.localStorage,getOwner=()=>null,
 fetchFriends,fetchInbox,fetchSent,questLabel=()=>'',open=()=>{},onChange=()=>{},now=()=>Date.now(),minInterval=30000}={}){
 let events=[],status='idle',lastFetch=0,pending=null,owner=null,highlight=new Set();
 const state=()=>readNotificationState(storage,owner);
 async function refresh({force=false}={}){
  owner=getOwner();
  if(!owner){events=[];highlight=new Set();status='guest';onChange();return events}
  if(pending)return pending;
  if(!force&&now()-lastFetch<minInterval)return events;
  pending=(async()=>{
   try{
    const [friends,inbox,sent]=await Promise.all([fetchFriends(),fetchInbox(),fetchSent()]);
    if(getOwner()!==owner)return events;
    const next=trackFriendships(state(),friends||[],now());
    events=deriveSocialEvents({friends:friends||[],received:inbox?.received||[],sent:sent||[],accepted:next.accepted,questLabel,t,now:now()});
    writeNotificationState(storage,owner,markSeen(next,events,[]));
    status='ready';lastFetch=now();
   }catch{status=events.length?'stale':'error'}
   finally{pending=null;onChange()}
   return events;
  })();
  return pending;
 }
 function extraCount(){return owner&&owner===getOwner()?unseenAcceptedCount(events,state().seen):0}
 function render(list,{empty,error}={}){
  if(!list)return;
  const read=new Set(state().seen),stamp=now();
  list.replaceChildren(...events.map(event=>{
   const b=doc.createElement('button');b.type='button';b.classList.add('social-hub-item','social-notification');
   b.dataset.notificationId=event.id;b.dataset.kind=event.kind;b.setAttribute('role','listitem');
   const fresh=!read.has(event.id)||highlight.has(event.id);if(fresh)b.classList.add('unread');
   const icon=doc.createElement('span');icon.className='social-hub-icon';icon.setAttribute('aria-hidden','true');
   icon.textContent={'friend-request':'👥','challenge-received':'⚔','challenge-result':'🏁','friend-accepted':'🤝'}[event.kind]||'✦';
   const label=doc.createElement('span');label.className='social-hub-label';
   const strong=doc.createElement('strong');strong.textContent=event.text;
   const small=doc.createElement('small');small.textContent=[event.actionable?t('social.toDo'):null,relativeTime(event.at,stamp,t)].filter(Boolean).join(' · ');
   label.append(strong,small);b.append(icon,label);
   if(fresh){const chip=doc.createElement('span');chip.className='social-new';chip.textContent=t('social.new');b.append(chip)}
   b.addEventListener('click',()=>open(event));
   return b;
  }));
  if(empty)empty.hidden=!!events.length||status==='guest'||status==='error';
  if(error){error.hidden=!(status==='error'||status==='stale');error.textContent=t(status==='stale'?'social.stale':'social.error')}
 }
 // Opening the list reads it; opening « Mes amis » reads acceptances too.
 // Unread items stay highlighted during the current viewing, then read.
 function markAllSeen(){if(!owner)return;const read=new Set(state().seen);highlight=new Set(events.filter(e=>!read.has(e.id)).map(e=>e.id));writeNotificationState(storage,owner,markSeen(state(),events));onChange()}
 function markKindSeen(kind){if(!owner)return;writeNotificationState(storage,owner,markSeen(state(),events,events.filter(e=>e.kind===kind).map(e=>e.id)));onChange()}
 return {refresh,extraCount,render,markAllSeen,markKindSeen,events:()=>events,status:()=>status};
}
