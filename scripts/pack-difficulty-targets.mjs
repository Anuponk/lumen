import {DIFFICULTY_TIERS} from "./pack-staging.mjs";

// Largest-remainder apportionment keeps target counts exact for any pack size.
export function difficultyTargets(distribution,count){
 if(!Number.isSafeInteger(count)||count<1)throw Error("Invalid quest count");
 if(!distribution)return null;
 if(typeof distribution!=="object"||Array.isArray(distribution))throw Error("Invalid difficulty distribution");
 const weights=DIFFICULTY_TIERS.map(t=>distribution[t]??0);
 if(Object.keys(distribution).some(t=>!DIFFICULTY_TIERS.includes(t))||
    weights.some(w=>typeof w!=="number"||!Number.isFinite(w)||w<0||w>1)||
    Math.abs(weights.reduce((a,b)=>a+b,0)-1)>1e-8)throw Error("Difficulty distribution must sum to 1");
 const exact=weights.map(w=>w*count);
 const counts=exact.map(Math.floor);
 const remaining=count-counts.reduce((a,b)=>a+b,0);
 const rank=exact.map((n,i)=>({i,remainder:n-counts[i]}))
   .sort((a,b)=>b.remainder-a.remainder||a.i-b.i);
 for(let i=0;i<remaining;i++)counts[rank[i].i]++;
 const targets=counts.flatMap((n,i)=>Array(n).fill(DIFFICULTY_TIERS[i]));
 return {counts:Object.fromEntries(DIFFICULTY_TIERS.map((t,i)=>[t,counts[i]])),targets};
}
