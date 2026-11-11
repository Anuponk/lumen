// Public competition is independent of badges, rewards and personal raw times.
export const RANKING_VERSION=1;
export const RANKING_COOLDOWN_MS=15*60*1000;
export const RANKING_PENALTIES=Object.freeze({verify:5,hint:15,guided:5});
export function rankedTime(seconds,uses={}){
 if(!Number.isSafeInteger(seconds)||seconds<0)throw Error('Invalid ranking time');
 for(const k of Object.keys(RANKING_PENALTIES))if(!Number.isSafeInteger(uses[k]??0)||(uses[k]??0)<0)throw Error('Invalid aid count');
 const penalty=Object.entries(RANKING_PENALTIES).reduce((total,[kind,cost])=>total+(uses[kind]??0)*cost,0),score=seconds+penalty;
 if(!Number.isSafeInteger(score))throw Error('Invalid ranking total');
 return {seconds,penalty,score};
}
export function rankingWindow(rows,mine){
 const at=rows.findIndex(row=>row.key===mine);
 if(at<10)return rows.slice(0,10);
 const start=Math.max(1,Math.min(at-5,rows.length-10));
 return [rows[0],...rows.slice(start,start+10)];
}
export function rankRows(rows){
 const sorted=[...rows].sort((a,b)=>a.score-b.score||a.key.localeCompare(b.key,'en'));
 return sorted.map((row,i)=>({...row,place:i>0&&row.score===sorted[i-1].score?sorted.findIndex(r=>r.score===row.score)+1:i+1}));
}
