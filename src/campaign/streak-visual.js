import {dayDistance,streakFromDates,cycleDay} from './daily-engagement.js';
// Pure presentation model. A grace day is not a qualifying day or a reward.
export function streakVisual(dates,today){
 const active=Object.keys(dates||{}).filter(k=>dates[k]&&dayDistance(k,today)!==null&&dayDistance(k,today)>=0).sort((a,b)=>b.localeCompare(a));
 const last=active[0]||null,gap=last===null?null:dayDistance(last,today);
 const streak=streakFromDates(dates,today);
 const broken=gap!==null&&gap>2;
 const protectedDay=gap===2;
 const relevant=active.slice(0,streak).reverse();
 // Show a missed day within the current, protected series, not only the current grace day.
 const missed=relevant.slice(1).some((d,i)=>dayDistance(relevant[i],d)===2)||protectedDay;
 const slotCount=missed?8:7;
 const completed=cycleDay(streak);
 const slots=Array.from({length:slotCount},(_,i)=>({kind:i<completed?'lit':'future'}));
 if(missed){
  const lastMissIndex=Math.max(0,relevant.findIndex((d,i)=>i>0&&dayDistance(relevant[i-1],d)===2));
  // In the current seven-day cycle, put the missed slot after the completed portion
  // if it is today's grace; otherwise insert it according to calendar ordering.
  let index=protectedDay?completed:Math.max(0,Math.min(completed, lastMissIndex+1));
  if(!protectedDay && relevant.length>1){
   let chronological=0;for(let i=1;i<relevant.length;i++){chronological++;if(dayDistance(relevant[i-1],relevant[i])===2){index=chronological;break}}
   index=Math.min(completed,Math.max(0,index));
  }
  slots.splice(index,0,{kind:'missed'});slots.length=8;
 }
 const focus=protectedDay?Math.min(completed+1,7):missed?Math.min(completed+1,7):Math.min(completed,6);
 return {slots,streak,missed,protectedDay,broken,focus,slotCount};
}
export function lostStreak(dates,today){
 const active=Object.keys(dates||{}).filter(k=>dates[k]&&dayDistance(k,today)!==null&&dayDistance(k,today)>=0).sort((a,b)=>b.localeCompare(a));
 const last=active[0]||null,gap=last?dayDistance(last,today):null;
 if(gap===null||gap<=2)return null;
 const prior=streakFromDates(dates,last);
 return prior>0?{last,prior,gap}:null;
}
