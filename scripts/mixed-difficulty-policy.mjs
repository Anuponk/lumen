// Offline content policy. Runtime progression continues using catalogue IDs.
export const MIXED_TARGETS=Object.freeze([
 {packId:'real-adventure-05',weights:[.8,.2,0,0]},
 {packId:'real-adventure-06',weights:[.2,.6,.2,0]},
 {packId:'real-adventure-07',weights:[0,.2,.6,.2]},
 {packId:'real-adventure-08',weights:[0,0,.2,.8]},
 {packId:'real-adventure-09',weights:[0,0,0,1]}
]);
const anchors=[[0,0],[.33,.95],[.5,.12],[.78,.72],[1,1]];
export function pacingIntensity(position,count){
 const t=count<=1?1:position/(count-1);
 const end=anchors.findIndex(([x])=>x>=t);
 if(end<=0)return anchors[0][1];
 const [x0,y0]=anchors[end-1],[x1,y1]=anchors[end];
 return y0+(y1-y0)*(t-x0)/(x1-x0);
}
export function mixedTierSchedule(count,weights){
 if(!Number.isSafeInteger(count)||count<1||weights.length!==4||weights.some(x=>x<0)||Math.abs(weights.reduce((s,x)=>s+x,0)-1)>1e-9)throw Error('Invalid pacing policy');
 const quotas=weights.map(w=>Math.floor(w*count));
 const remainders=weights.map((w,tier)=>({tier,value:w*count-quotas[tier]})).sort((a,b)=>b.value-a.value||a.tier-b.tier);
 const remaining=count-quotas.reduce((s,x)=>s+x,0);
 for(let i=0;i<remaining;i++)quotas[remainders[i].tier]++;
 const ranked=Array.from({length:count},(_,i)=>({i,value:pacingIntensity(i,count)})).sort((a,b)=>a.value-b.value||a.i-b.i);
 const levels=quotas.flatMap((n,tier)=>Array(n).fill(tier)),result=[];
 ranked.forEach(({i},rank)=>{result[i]=levels[rank]});return result;
}
