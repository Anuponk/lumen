// #896 (EPIC #881): readable friend duels. Presentation only: the verdict is
// the existing #18/#35 rule (compareChallenge: autonomy first, then time), and
// it is applied only when BOTH performances are terminal and complete. Every
// other case gets an honest state, never an invented winner. All copy goes
// through the duel.* catalogue (FR/EN).
import {compareChallenge} from './social-challenge.js';
import {escapeSocialHtml as esc} from './social-friends.js';

const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));
const status=value=>String(value||'pending').toLowerCase();

// A performance as both screens describe it.
export function duelPerformance({name='',status:state='pending',duration=null,autonomy=null,mastery=false,assistanceUsed=null,firstPlay=null,previouslyPlayed=null}={}){
 return {name:String(name||''),status:status(state),duration:finite(duration)?Math.max(0,Math.round(Number(duration))):null,
  autonomy:autonomy===null||autonomy===undefined?null:!!autonomy,mastery:!!mastery,
  assistanceUsed:assistanceUsed===null||assistanceUsed===undefined?null:!!assistanceUsed,firstPlay,previouslyPlayed};
}

// The sender owns the reference (source); the recipient is a participant.
export function duelOutcome({mine,theirs,role='sender',boardMismatch=false}){
 if(!mine||!theirs)return {state:'unavailable'};
 // #887: a result played on another board than the reference is never compared.
 if(boardMismatch)return {state:'different-board'};
 if(mine.status==='abandoned')return {state:'abandoned-me'};
 if(theirs.status==='abandoned')return {state:'abandoned-them'};
 if(theirs.status!=='completed')return {state:theirs.status==='started'?'playing':'pending'};
 if(mine.status!=='completed')return {state:mine.status==='started'?'playing-me':'pending-me'};
 if(mine.duration===null||theirs.duration===null)return {state:'unavailable'};
 const toRule=p=>({status:'completed',duration_seconds:p.duration,autonomy:p.autonomy,assistance_used:p.assistanceUsed});
 const [source,participant]=role==='sender'?[mine,theirs]:[theirs,mine];
 const cmp=compareChallenge(toRule(source),toRule(participant));
 if(!cmp||!Number.isFinite(cmp.deltaSeconds))return {state:'unavailable'};
 const iWin=cmp.winner==='tie'?null:(cmp.winner==='source')===(role==='sender');
 return {state:iWin===null?'tied':iWin?'won':'lost',reason:cmp.reason,gap:Math.abs(cmp.deltaSeconds)};
}

// Builders from the existing contracts (#18 list rows, #889 get_v2).
export function duelFromSentRow(row,participant){
 return {challengeId:row?.challenge_id,role:'sender',quest:row,boardMismatch:participant?.board_mismatch===true,
  mine:duelPerformance({status:'completed',duration:row?.source_duration_seconds,autonomy:row?.source_autonomy,mastery:row?.source_mastery,firstPlay:row?.source_first_play}),
  theirs:duelPerformance({name:participant?.name,status:participant?.status,duration:participant?.duration_seconds,autonomy:participant?.autonomy,mastery:participant?.mastery,previouslyPlayed:participant?.previously_played})};
}
export function duelFromChallenge(data){
 return {challengeId:data?.challenge_id,role:'participant',quest:data,boardMismatch:data?.participant_board_mismatch===true,
  mine:duelPerformance({name:data?.participant_display_name,status:data?.participant_status,duration:data?.participant_duration_seconds,autonomy:data?.participant_autonomy,mastery:data?.participant_mastery,assistanceUsed:data?.participant_assistance_used,previouslyPlayed:data?.previously_played}),
  theirs:duelPerformance({name:data?.sender_display_name,status:'completed',duration:data?.source_duration_seconds,autonomy:data?.source_autonomy,mastery:data?.source_mastery,assistanceUsed:data?.source_assistance_used,firstPlay:data?.source_first_play})};
}
// A friend-sent row (#35 inbox) joined to the sender's list by challenge id.
// The participant is the one whose name matches the recipient, else the only
// completed one with the same time; anything ambiguous stays unavailable.
export function participantForRecipient(row,listRow){
 const parts=Array.isArray(listRow?.participants)?listRow.participants:[];
 const name=String(row?.recipient||'').trim().toLowerCase();
 const byName=parts.filter(p=>String(p?.name||'').trim().toLowerCase()===name);
 if(byName.length===1)return byName[0];
 const byTime=parts.filter(p=>p?.status===row?.status&&finite(p?.duration_seconds)&&Number(p.duration_seconds)===Number(row?.duration_seconds));
 return byTime.length===1?byTime[0]:null;
}

const VERDICT_ICON={won:'🏆',lost:'✦',tied:'🤝',pending:'⏳','pending-me':'⏳',playing:'⏳','playing-me':'⏳','abandoned-me':'✕','abandoned-them':'✕','different-board':'≠',unavailable:'·'};
function gapText(outcome,theirName,{t,formatDuration}){
 if(outcome.state==='tied')return t('duel.sameTime');
 if(outcome.reason==='assistance')return outcome.state==='won'?t('duel.byAutonomyWon',{name:theirName}):t('duel.byAutonomyLost',{name:theirName});
 if(!['won','lost'].includes(outcome.state))return '';
 if(outcome.gap>=60)return t(outcome.state==='won'?'duel.aheadTime':'duel.behindTime',{time:formatDuration(outcome.gap)});
 return t(outcome.state==='won'?'duel.aheadSeconds':'duel.behindSeconds',{count:outcome.gap});
}
export function duelVerdictText(outcome,theirName,t){
 const name=theirName||t('duel.friend');
 switch(outcome.state){
  case 'won':return t('duel.won');
  case 'lost':return t('duel.lost',{name});
  case 'tied':return t('duel.tied');
  case 'pending':return t('duel.waiting',{name});
  case 'playing':return t('duel.playing',{name});
  case 'pending-me':return t('duel.yourTurn');
  case 'playing-me':return t('duel.yourTurnStarted');
  case 'abandoned-me':return t('duel.abandonedMe');
  case 'abandoned-them':return t('duel.abandonedThem',{name});
  case 'different-board':return t('duel.differentBoard');
  default:return t('duel.unavailable');
 }
}
const timeOf=(p,formatDuration)=>p.status==='completed'&&p.duration!==null?formatDuration(p.duration):'—';
const aidOf=(p,t)=>p.status!=='completed'?'':p.mastery?t('duel.mastery'):p.autonomy===false||p.assistanceUsed===true?t('duel.withHelp'):p.autonomy?t('duel.autonomous'):'';

function notes(duel,{t,currentRevision}){
 const out=[];
 if(duel.role==='sender'&&duel.mine.firstPlay===false)out.push(t('duel.noteReplayReference'));
 if(duel.role==='participant'&&duel.theirs.firstPlay===false)out.push(t('duel.noteReplaySource',{name:duel.theirs.name||t('duel.friend')}));
 const knew=duel.role==='sender'?duel.theirs.previouslyPlayed:duel.mine.previouslyPlayed;
 if(knew===true)out.push(duel.role==='sender'?t('duel.noteKnewGrid',{name:duel.theirs.name||t('duel.friend')}):t('duel.noteYouKnewGrid'));
 if(duel.boardMismatch)out.push(t('duel.noteDifferentBoard'));
 const revision=Number(duel.quest?.grid_revision??0),current=currentRevision?.(duel.quest);
 if(Number.isFinite(current)&&current!==revision)out.push(t('duel.noteOriginalGrid'));
 return out;
}

// Compact row for « Mes défis » and « Amis et défis ».
export function renderDuelRow(duel,{t,formatDuration,questLabel=()=>'',action=null,currentRevision=null}){
 const outcome=duelOutcome(duel),name=duel.theirs.name||t('duel.friend');
 const gap=gapText(outcome,name,{t,formatDuration});
 const extra=notes(duel,{t,currentRevision});
 return '<div class="duel-row duel-'+outcome.state+'" data-duel-state="'+outcome.state+'">'
  +'<div class="duel-row-head"><strong>'+esc(t('duel.against',{name}))+'</strong><span>'+esc(questLabel(duel.quest))+'</span></div>'
  +'<div class="duel-row-times"><span><small>'+esc(t('duel.myTime'))+'</small><b>'+esc(timeOf(duel.mine,formatDuration))+'</b></span>'
  +'<span><small>'+esc(name)+'</small><b>'+esc(timeOf(duel.theirs,formatDuration))+'</b></span></div>'
  +'<div class="duel-row-verdict"><span aria-hidden="true">'+VERDICT_ICON[outcome.state]+'</span><strong>'+esc(duelVerdictText(outcome,name,t))+'</strong>'+(gap?'<small>'+esc(gap)+'</small>':'')+'</div>'
  +(extra.length?'<p class="duel-notes">'+esc(extra.join(' · '))+'</p>':'')
  +(action?'<div class="duel-row-actions">'+action+'</div>':'')
  +'</div>';
}

// Detail card: two balanced players, the winner highlighted, the loser not
// diminished; verdict and both times come first on small screens.
export function renderDuelCard(duel,{t,formatDuration,questLabel=()=>'',currentRevision=null}){
 const outcome=duelOutcome(duel),name=duel.theirs.name||t('duel.friend');
 const gap=gapText(outcome,name,{t,formatDuration});
 const player=(p,label,isMe)=>{
  const win=(outcome.state==='won'&&isMe)||(outcome.state==='lost'&&!isMe);
  return '<div class="duel-player'+(isMe?' duel-me':'')+(win?' duel-winner':'')+'">'
   +'<span class="duel-crown" aria-hidden="true">'+(win?'👑':'')+'</span>'
   +'<span class="duel-name">'+esc(label)+'</span>'
   +'<span class="duel-time">'+esc(timeOf(p,formatDuration))+'</span>'
   +'<span class="duel-aid">'+esc(aidOf(p,t))+'</span>'
   +(win?'<span class="visually-hidden">'+esc(t('duel.winnerLabel'))+'</span>':'')+'</div>';
 };
 const extra=notes(duel,{t,currentRevision});
 return '<div class="duel-card duel-'+outcome.state+'" data-duel-state="'+outcome.state+'">'
  +'<p class="duel-quest">'+esc(questLabel(duel.quest))+'</p>'
  +'<div class="duel-verdict" role="status"><span class="duel-verdict-icon" aria-hidden="true">'+VERDICT_ICON[outcome.state]+'</span><strong>'+esc(duelVerdictText(outcome,name,t))+'</strong>'+(gap?'<small>'+esc(gap)+'</small>':'')+'</div>'
  +'<div class="duel-players">'+player(duel.mine,t('duel.you'),true)+'<span class="duel-vs" aria-hidden="true">'+esc(t('duel.versus'))+'</span>'+player(duel.theirs,name,false)+'</div>'
  +(extra.length?'<p class="duel-notes">'+esc(extra.join(' · '))+'</p>':'')
  +'</div>';
}

const actionButton=(attr,value,label,extra='')=>'<button type="button" '+attr+'="'+esc(value)+'"'+extra+'>'+esc(label)+'</button>';

// #896 (recette 21/11): « Mes défis » is a scannable list. Per challenge: the
// quest once, then one compact line per player (verdict, both times and gap
// when the duel is over), « Voir le duel » as the only main action, sharing
// tucked behind a discreet « Partager ». Context notes stay in the detail card.
const DUEL_DETAIL_STATES=['won','lost','tied','abandoned-them','unavailable'];
// Short gap for one-line reading in the list; the detail card keeps the sentence.
function shortGap(outcome,name,{t,formatDuration}){
 if(outcome.state==='tied'||outcome.reason==='assistance')return gapText(outcome,name,{t,formatDuration});
 if(!['won','lost'].includes(outcome.state))return '';
 const time=outcome.gap>=60?formatDuration(outcome.gap):t('duel.secondsShort',{count:outcome.gap});
 return t(outcome.state==='won'?'duel.aheadTime':'duel.behindTime',{time});
}
function compactDuel(duel,{t,formatDuration,openId}){
 const outcome=duelOutcome(duel),name=duel.theirs.name||t('duel.friend');
 const comparable=['won','lost','tied'].includes(outcome.state);
 const gap=comparable?shortGap(outcome,name,{t,formatDuration}):'';
 const mine=duel.mine.status==='completed'&&duel.mine.duration!==null?formatDuration(duel.mine.duration):null;
 const theirs=comparable?timeOf(duel.theirs,formatDuration):null;
 // Times: both only when comparable; otherwise my own time alone, never a 0:00.
 const times=[mine!==null?'<span class="challenge-duel-time"><small>'+esc(t('duel.you'))+'</small> <b>'+esc(mine)+'</b></span>':'',
  theirs!==null?'<span class="challenge-duel-time"><small>'+esc(name)+'</small> <b>'+esc(theirs)+'</b></span>':'',
  gap?'<span class="challenge-duel-gap">'+esc(gap)+'</span>':''].filter(Boolean).join('<span class="challenge-duel-sep" aria-hidden="true">·</span>');
 const view=openId!==null&&DUEL_DETAIL_STATES.includes(outcome.state)?actionButton('data-duel-open',openId,t('duel.view'),' class="challenge-duel-open"'):'';
 return '<li class="challenge-duel duel-'+outcome.state+'" data-duel-state="'+outcome.state+'">'
  +'<div class="challenge-duel-main"><span class="challenge-duel-icon" aria-hidden="true">'+VERDICT_ICON[outcome.state]+'</span>'
  +'<strong class="challenge-duel-verdict">'+esc(duelVerdictText(outcome,name,t))+'</strong>'+view+'</div>'
  +(times?'<p class="challenge-duel-times">'+times+'</p>':'')
  +'</li>';
}

// « Mes défis »: one card per challenge I created, one compact line per player.
export function renderMyChallenges(rows=[],{t,formatDuration,questLabel=()=>'',canSendFriend=false,currentRevision=null}){
 if(!rows.length)return '<p class="social-note">'+esc(t('duel.noChallenges'))+'</p>';
 return rows.map(row=>{
  const parts=Array.isArray(row.participants)?row.participants:[],quest=questLabel(row);
  const duels=parts.map((p,index)=>compactDuel(duelFromSentRow(row,p),{t,formatDuration,openId:row.challenge_id+'|'+index})).join('');
  const share='<details class="challenge-share"><summary aria-label="'+esc(t('duel.shareChallenge',{quest}))+'">'+esc(t('duel.share'))+'</summary>'
   +'<div class="challenge-share-actions">'+actionButton('data-copy-link',row.challenge_id,t('duel.copyLink'))
   +(canSendFriend?actionButton('data-send-friend',row.challenge_id,t('duel.sendFriend'),' class="challenge-send-friend"'):'')+'</div></details>';
  return '<div class="challenge-list-item challenge-compact" data-challenge-id="'+esc(row.challenge_id)+'">'
   +'<div class="challenge-compact-head"><strong class="challenge-compact-quest">'+esc(quest)+'</strong>'+share+'</div>'
   +(duels?'<ul class="challenge-duels">'+duels+'</ul>':'<p class="challenge-duel-empty">'+esc(t('duel.noParticipant'))+'</p>')
   +'</div>';
 }).join('');
}

// « Amis et défis » · received: play/resume, or the duel once it is over.
export function renderFriendReceived(list=[],{t,formatDuration,questLabel=()=>'',details=new Map(),currentRevision=null}){
 if(!list.length)return '<p class="social-note">'+esc(t('duel.noReceived'))+'</p>';
 return list.map(row=>{
  const id=esc(row.challenge_id),closed=['completed','abandoned'].includes(status(row.status));
  if(!closed){
   const label=status(row.status)==='started'?t('duel.resume'):t('duel.take');
   const duel={role:'participant',quest:row,mine:duelPerformance({status:row.status}),theirs:duelPerformance({name:row.sender,status:'completed',firstPlay:row.source_first_play})};
   return '<div class="friend-challenge" data-challenge-id="'+id+'">'+renderDuelRow(duel,{t,formatDuration,questLabel,action:actionButton('data-challenge-action','play',label),currentRevision})+'</div>';
  }
  const detail=details.get(row.challenge_id);
  if(detail&&typeof detail==='object')
   return '<div class="friend-challenge" data-challenge-id="'+id+'">'+renderDuelRow(duelFromChallenge(detail),{t,formatDuration,questLabel,action:actionButton('data-challenge-action','result',t('duel.view')),currentRevision})+'</div>';
  const state=detail==='error'?t('duel.loadError'):t('duel.loading');
  return '<div class="friend-challenge" data-challenge-id="'+id+'"><div class="duel-row duel-loading" aria-busy="'+(detail==='error'?'false':'true')+'">'
   +'<div class="duel-row-head"><strong>'+esc(t('duel.against',{name:row.sender||t('duel.friend')}))+'</strong><span>'+esc(questLabel(row))+'</span></div>'
   +'<div class="duel-row-verdict"><strong>'+esc(state)+'</strong></div>'
   +'<div class="duel-row-actions">'+actionButton('data-challenge-action','result',t('duel.details'))+'</div></div></div>';
 }).join('');
}

// « Amis et défis » · sent to a friend: joined to « Mes défis » by challenge id.
export function renderFriendSent(list=[],{t,formatDuration,questLabel=()=>'',listRows=[],currentRevision=null}){
 if(!list.length)return '<p class="social-note">'+esc(t('duel.noSent'))+'</p>';
 const byId=new Map(listRows.map(r=>[r.challenge_id,r]));
 return list.map(row=>{
  const own=byId.get(row.challenge_id),match=own?participantForRecipient(row,own):null;
  const participant=match||{name:row.recipient,status:row.status,duration_seconds:status(row.status)==='completed'&&own?row.duration_seconds:null};
  const duel=duelFromSentRow(own||{challenge_id:row.challenge_id,puzzle_id:row.puzzle_id,stable_quest_id:row.stable_quest_id,grid_revision:row.grid_revision},participant);
  if(!own)duel.mine=duelPerformance({status:'completed'});
  if(!match&&status(row.status)==='completed')duel.theirs=duelPerformance({name:row.recipient,status:'completed',duration:row.duration_seconds});
  const index=own&&match?own.participants.indexOf(match):-1;
  const view=index>=0&&['won','lost','tied','abandoned-them'].includes(duelOutcome(duel).state)?actionButton('data-duel-open',row.challenge_id+'|'+index,t('duel.view')):'';
  return '<div class="friend-challenge" data-challenge-id="'+esc(row.challenge_id)+'">'+renderDuelRow(duel,{t,formatDuration,questLabel,action:view+actionButton('data-copy-link',row.challenge_id,t('duel.copyLink')),currentRevision})+'</div>';
 }).join('');
}
