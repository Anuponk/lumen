// Défi du jour (#882) — weekly summary « Ta semaine dans les étoiles ».
// Pure: input is the lumen_daily_week payload (the player's own days only),
// output never contains another player's data.
import {addDays,DAILY_SCHEDULE_START} from './daily-challenge.js';

const LETTERS=['L','M','M','J','V','S','D'];
const STATES=new Set(['future','missed','started','abandoned','completed']);

export function weekMonday(day){
 const [y,m,d]=String(day).split('-').map(Number);
 const isoDow=(new Date(Date.UTC(y,m-1,d)).getUTCDay()+6)%7;
 return addDays(day,-isoDow);
}
export const FIRST_DAILY_WEEK=weekMonday(DAILY_SCHEDULE_START);

const rankOf=v=>Number.isInteger(v)&&v>0?v:null;
function better(a,b){return !b||a.rank<b.rank||(a.rank===b.rank&&a.day<b.day)}

export function summarizeWeek(week){
 const monday=String(week?.monday||'');
 const source=new Map((Array.isArray(week?.days)?week.days:[]).map(d=>[String(d?.day),d]));
 const days=LETTERS.map((letter,i)=>{
  const day=addDays(monday,i),raw=source.get(day)||{state:'future'};
  const state=STATES.has(raw.state)?raw.state:'missed';
  const score=state==='completed'&&Number.isFinite(Number(raw.run?.score))?Number(raw.run.score):null;
  const generalRank=state==='completed'?rankOf(raw.general_rank):null,friendsTotal=state==='completed'?Number(raw.friends_total)||0:0;
  const friendsRank=state==='completed'?rankOf(raw.friends_rank):null;
  return {day,letter,state,final:raw.final===true,score,generalRank,generalTotal:generalRank?Number(raw.general_total)||null:null,
   friendsRank,friendsTotal,podium:!!generalRank&&generalRank<=3,friendsWin:friendsRank===1&&friendsTotal>=2};
 });
 const played=days.filter(d=>['completed','abandoned','started'].includes(d.state));
 const completed=days.filter(d=>d.state==='completed');
 let bestGeneral=null,bestFriends=null,bestTime=null;
 for(const d of completed){
  if(d.generalRank&&better({rank:d.generalRank,day:d.day},bestGeneral))bestGeneral={rank:d.generalRank,total:d.generalTotal,day:d.day};
  if(d.friendsRank&&d.friendsTotal>=2&&better({rank:d.friendsRank,day:d.day},bestFriends))bestFriends={rank:d.friendsRank,total:d.friendsTotal,day:d.day};
  if(d.score!==null&&(!bestTime||d.score<bestTime.score))bestTime={score:d.score,day:d.day};
 }
 return {monday,sunday:addDays(monday,6),days,
  participations:played.length,completed:completed.length,
  openDays:days.filter(d=>d.state!=='future').length,
  podiums:days.filter(d=>d.podium).length,friendsWins:days.filter(d=>d.friendsWin).length,
  bestGeneral,bestFriends,bestTime,
  provisional:completed.some(d=>!d.final),
  frozen:days.every(d=>d.state!=='future'&&d.final)};
}

// Past-week navigation: never before the first scheduled week, never after
// the current week.
export function weekNavigation(monday,today){
 const current=weekMonday(today);
 return {previous:monday>FIRST_DAILY_WEEK?addDays(monday,-7):null,next:monday<current?addDays(monday,7):null,current:monday===current};
}

// Optional share: own counts only, no nickname, no other player.
export function weekShareText(summary,{formatRank=r=>r+'e'}={}){
 return ['✦ Ma semaine Lumen dans les étoiles : '+summary.participations+'/7 défis du jour',
  summary.podiums?summary.podiums+' podium'+(summary.podiums>1?'s':''):null,
  summary.bestGeneral?'meilleur rang '+formatRank(summary.bestGeneral.rank):null,
  'À toi de jouer !'].filter(Boolean).join(' · ').replace(' · À toi de jouer !','\nÀ toi de jouer !');
}
