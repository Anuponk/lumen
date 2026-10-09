// Deterministic candidate generator for issue #98. Never modifies published quests.
export function createRandom(seed){
 let state=seed>>>0;
 return ()=>{state=(state+0x6D2B79F5)>>>0;let x=Math.imul(state^(state>>>15),1|state);x^=x+Math.imul(x^(x>>>7),61|x);return ((x^(x>>>14))>>>0)/4294967296};
}
export function countSolutions(reg,limit=2){
 const n=reg.length,usedCols=new Set(),usedRegions=new Set(),solution=[];
 let count=0,first=null;
 function visit(row,previous){
  if(count>=limit)return;
  if(row===n){count++;if(!first)first=[...solution];return}
  for(let col=0;col<n;col++){
   const region=reg[row][col];
   if(usedCols.has(col)||usedRegions.has(region)||(row&&Math.abs(col-previous)<=1))continue;
   usedCols.add(col);usedRegions.add(region);solution.push(col);
   visit(row+1,col);
   solution.pop();usedCols.delete(col);usedRegions.delete(region);
   if(count>=limit)return;
  }
 }
 visit(0,-10);
 return {count,solution:first};
}
function shuffle(items,random){
 const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;
}
function makeCandidate(n,random){
 // One guardian per row and column, no touching across adjacent rows.
 const solution=[];
 function place(row,available){
  if(row===n)return true;
  for(const col of shuffle(available,random)){
   if(row&&Math.abs(col-solution[row-1])<=1)continue;
   solution.push(col);
   if(place(row+1,available.filter(x=>x!==col)))return true;
   solution.pop();
  }
  return false;
 }
 if(!place(0,Array.from({length:n},(_,i)=>i)))throw Error("No valid guardian placement");
 // Grow n orthogonally connected territories from the guardian cells.
 const reg=Array.from({length:n},()=>Array(n).fill(-1));
 const frontier=solution.map((col,row)=>[row,col,row]);
 for(const [row,col,id] of frontier)reg[row][col]=id;
 let remaining=n*n-n;
 while(remaining){
  const choices=[];
  for(let row=0;row<n;row++)for(let col=0;col<n;col++)if(reg[row][col]===-1){
   const neighbors=[[row-1,col],[row+1,col],[row,col-1],[row,col+1]]
    .filter(([r,c])=>r>=0&&r<n&&c>=0&&c<n&&reg[r][c]!==-1);
   for(const [r,c] of neighbors)choices.push([row,col,reg[r][c]]);
  }
  if(!choices.length)throw Error("Territory growth stalled");
  const [row,col,id]=choices[Math.floor(random()*choices.length)];
  if(reg[row][col]!==-1)continue;
  reg[row][col]=id;remaining--;
 }
 return {reg,sol:solution};
}
export function generateUniqueGrid({size,seed=1,maxAttempts=2000}={}){
 if(!Number.isInteger(size)||size<4||size>10)throw Error("size must be between 4 and 10");
 if(!Number.isSafeInteger(seed)||seed<0)throw Error("seed must be a non-negative integer");
 if(!Number.isInteger(maxAttempts)||maxAttempts<1)throw Error("maxAttempts must be positive");
 const random=createRandom(seed);
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const puzzle=makeCandidate(size,random);
  const result=countSolutions(puzzle.reg);
  if(result.count===1&&result.solution.every((c,r)=>c===puzzle.sol[r]))
   return {...puzzle,seed,attempts:attempt,solutionCount:1};
 }
 throw Error("No unique grid found within "+maxAttempts+" attempts; nothing published");
}
