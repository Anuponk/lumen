export function createGameEngine(getBoard,getAutoCrossEnabled){
function key(r,c){return r+","+c}

function solutions(board=getBoard()){
 const {n,puz,state}=board;
 let out=[],a=Array(n).fill(-1);
 function bt(r,cols,regs,prev){
  if(out.length>200)return;
  if(r===n){out.push(a.slice());return}
  let rq=state[r].indexOf(2);
  for(let c=0;c<n;c++){
   if(state[r][c]===1||(rq>=0&&rq!==c)||cols.has(c)||regs.has(puz.reg[r][c])||(prev>=0&&Math.abs(c-prev)<=1))continue;
   let bad=false;
   for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(state[y][x]===2&&y!==r){
    if(x===c||puz.reg[y][x]===puz.reg[r][c]||(Math.abs(y-r)<=1&&Math.abs(x-c)<=1))bad=true;
   }
   if(bad)continue;
   a[r]=c;let nc=new Set(cols);nc.add(c);let ng=new Set(regs);ng.add(puz.reg[r][c]);bt(r+1,nc,ng,c);
  }
 }
 bt(0,new Set(),new Set(),-1);return out
}

function isAutoCross(r,c){
 const {n,puz,state}=getBoard();
 const cb={checked:getAutoCrossEnabled()};
 if(!cb || !cb.checked || state[r][c]!==0)return false;

 for(let qr=0;qr<n;qr++)for(let qc=0;qc<n;qc++)if(state[qr][qc]===2){
   // A diamond automatically excludes its row, column, region and neighbours.
   if(r===qr || c===qc || puz.reg[r][c]===puz.reg[qr][qc] ||
      (Math.abs(r-qr)<=1 && Math.abs(c-qc)<=1)) return true;
 }
 return false;
}

function verificationErrors(){
 const {n,puz,state}=getBoard();
 const errors=[];
 // The campaign grids have a single audited solution. A Guardian must be on it;
 // a manual exclusion is wrong when it removes that required cell.
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  if(state[r][c]===2&&puz.sol[r]!==c)errors.push({r,c,kind:"guardian"});
  else if(state[r][c]===1&&puz.sol[r]===c)errors.push({r,c,kind:"exclude"});
 }
 return errors;
}

function guardianConflicts(){
 const {n,puz,state}=getBoard();
 const placed=[];for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(state[r][c]===2)placed.push([r,c]);
 const bad=new Set(),reasons=new Set();
 for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
  const [r1,c1]=placed[i],[r2,c2]=placed[j];
  if(r1===r2){bad.add(r1+","+c1);bad.add(r2+","+c2);reasons.add("ligne")}
  if(c1===c2){bad.add(r1+","+c1);bad.add(r2+","+c2);reasons.add("colonne")}
  if(puz.reg[r1][c1]===puz.reg[r2][c2]){bad.add(r1+","+c1);bad.add(r2+","+c2);reasons.add("territoire")}
  if(Math.abs(r1-r2)<=1&&Math.abs(c1-c2)<=1){bad.add(r1+","+c1);bad.add(r2+","+c2);reasons.add("voisinage")}
 }
 return {bad,reasons};
}

function conflictMessage(reasons){
 if(reasons.has("voisinage"))return "Conflit : deux Gardiens se touchent, y compris en diagonale.";
 if(reasons.has("territoire"))return "Conflit : deux Gardiens occupent le même territoire.";
 if(reasons.has("ligne"))return "Conflit : deux Gardiens occupent la même ligne.";
 if(reasons.has("colonne"))return "Conflit : deux Gardiens occupent la même colonne.";
 return "";
}

function proofEngine(){
 const {n,puz,state}=getBoard();
 let elim={},why={},meta={};
 function mark(r,c,reason,m=null){let k=key(r,c);if(!elim[k]){elim[k]=true;why[k]=reason;if(m)meta[k]=m;return true}return false}
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(state[r][c]===1)mark(r,c,"Croix déjà validée.",{rule:"manual",source:[[r,c]]});
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(state[r][c]===2){
  let g=puz.reg[r][c];
  for(let x=0;x<n;x++)if(x!==c)mark(r,x,"Même ligne.",{rule:"diamond",source:[[r,c]]});
  for(let y=0;y<n;y++)if(y!==r)mark(y,c,"Même colonne.",{rule:"diamond",source:[[r,c]]});
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   if((y!==r||x!==c)&&puz.reg[y][x]===g)mark(y,x,"Même territoire.",{rule:"diamond",source:[[r,c]]});
   if((y!==r||x!==c)&&Math.abs(y-r)<=1&&Math.abs(x-c)<=1)mark(y,x,"Case voisine.",{rule:"diamond",source:[[r,c]]});
  }
 }
 function candidate(r,c){return state[r][c]!==2&&!elim[key(r,c)]}
 function regPlaced(g){for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(state[r][c]===2&&puz.reg[r][c]===g)return true;return false}
 function rc(g){let a=[];for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(puz.reg[r][c]===g&&candidate(r,c))a.push([r,c]);return a}

 // First return ONE visible local elimination. Do not chain it invisibly.
 for(let g=0;g<n;g++)if(!regPlaced(g)){
  let a=rc(g);if(a.length>=2){
   let rows=[...new Set(a.map(q=>q[0]))],cols=[...new Set(a.map(q=>q[1]))];
   if(rows.length===1){let r=rows[0];for(let c=0;c<n;c++)if(puz.reg[r][c]!==g&&state[r][c]===0&&!isAutoCross(r,c))
    return {kind:"elim",cell:[r,c],text:`Ce territoire réserve la ligne ${r+1}.`,detail:{rule:"locked",region:g,axis:"row",index:r,source:a},elim,why,meta};}
   if(cols.length===1){let c=cols[0];for(let r=0;r<n;r++)if(puz.reg[r][c]!==g&&state[r][c]===0&&!isAutoCross(r,c))
    return {kind:"elim",cell:[r,c],text:`Ce territoire réserve la colonne ${c+1}.`,detail:{rule:"locked",region:g,axis:"col",index:c,source:a},elim,why,meta};}
  }
 }
 let gs=[];for(let g=0;g<n;g++)if(!regPlaced(g))gs.push(g);
 function combos(a,k,s=0,p=[],o=[]){if(p.length===k){o.push(p.slice());return o}for(let i=s;i<a.length;i++){p.push(a[i]);combos(a,k,i+1,p,o);p.pop()}return o}
 for(let k=2;k<=3;k++)for(let group of combos(gs,k)){
  let cells=[];group.forEach(g=>cells.push(...rc(g)));
  let cols=[...new Set(cells.map(q=>q[1]))],rows=[...new Set(cells.map(q=>q[0]))];
  if(cols.length===k)for(let c of cols)for(let r=0;r<n;r++)if(!group.includes(puz.reg[r][c])&&state[r][c]===0&&!isAutoCross(r,c))
   return {kind:"elim",cell:[r,c],text:`${k} territoires réservent exactement ${k} colonnes.`,detail:{rule:"group",axis:"col",indices:cols,regions:group,source:cells},elim,why,meta};
  if(rows.length===k)for(let r of rows)for(let c=0;c<n;c++)if(!group.includes(puz.reg[r][c])&&state[r][c]===0&&!isAutoCross(r,c))
   return {kind:"elim",cell:[r,c],text:`${k} territoires réservent exactement ${k} lignes.`,detail:{rule:"group",axis:"row",indices:rows,regions:group,source:cells},elim,why,meta};
 }

 // Only after every prerequisite elimination is actually on the board may a single be hinted.
 for(let r=0;r<n;r++)if(!state[r].includes(2)){let a=[];for(let c=0;c<n;c++)if(candidate(r,c))a.push([r,c]);
  if(a.length===1)return {kind:"place",cell:a[0],text:`La ligne ${r+1} n'a plus qu'une possibilité.`,detail:{rule:"single",axis:"row",index:r},elim,why,meta};}
 for(let c=0;c<n;c++)if(!state.some(q=>q[c]===2)){let a=[];for(let r=0;r<n;r++)if(candidate(r,c))a.push([r,c]);
  if(a.length===1)return {kind:"place",cell:a[0],text:`La colonne ${c+1} n'a plus qu'une possibilité.`,detail:{rule:"single",axis:"col",index:c},elim,why,meta};}
 for(let g=0;g<n;g++)if(!regPlaced(g)){let a=rc(g);
  if(a.length===1)return {kind:"place",cell:a[0],text:`Ce territoire n'a plus qu'une possibilité.`,detail:{rule:"single",axis:"region",index:g},elim,why,meta};}
 return {kind:"none",reason:"strict",elim,why,meta};
}

function directMissingCross(){
 const {n,puz,state}=getBoard();
 for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(state[r][c]===2){
  let g=puz.reg[r][c], candidates=[];
  for(let x=0;x<n;x++)if(x!==c&&state[r][x]===0&&!isAutoCross(r,x))candidates.push([r,x,`Même ligne que le Gardien L${r+1}C${c+1}.`]);
  for(let y=0;y<n;y++)if(y!==r&&state[y][c]===0&&!isAutoCross(y,c))candidates.push([y,c,`Même colonne que le Gardien L${r+1}C${c+1}.`]);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++)if((y!==r||x!==c)&&state[y][x]===0&&!isAutoCross(y,x)&&puz.reg[y][x]===g)candidates.push([y,x,`Même territoire que le Gardien L${r+1}C${c+1}.`]);
  for(let y=Math.max(0,r-1);y<=Math.min(n-1,r+1);y++)for(let x=Math.max(0,c-1);x<=Math.min(n-1,c+1);x++)
   if((y!==r||x!==c)&&state[y][x]===0&&!isAutoCross(y,x))candidates.push([y,x,`Cette case touche le Gardien L${r+1}C${c+1}.`]);
  if(candidates.length)return candidates[0];
 }
 return null;
}

function playerError(){
 const {n,puz,state}=getBoard();
 // The stored solution is used ONLY as a silent correctness check here.
 // It is never used to manufacture a normal logical hint.
 for(let r=0;r<n;r++)for(let c=0;c<n;c++){
  if(state[r][c]===2 && puz.sol[r]!==c)
   return {cell:[r,c],kind:"diamond",text:`Ce Gardien ne peut pas être correct. Reprends les contraintes autour de L${r+1}C${c+1}.`};
  if(state[r][c]===1 && puz.sol[r]===c)
   return {cell:[r,c],kind:"cross",text:`Cette croix élimine une case nécessaire. Vérifie L${r+1}C${c+1}.`};
 }
 return null;
}

function guardianOnlyState(extraR=-1,extraC=-1){
 const {n,puz,state}=getBoard();
 return state.map((row,r)=>row.map((v,c)=>(v===2||(r===extraR&&c===extraC))?2:0));
}

function guidedConflictForAction(r,c,next){
 let {n,puz,state}=getBoard();
 if(next!==2)return null;
 let direct=null;
 for(let rr=0;rr<n;rr++)for(let cc=0;cc<n;cc++)if(state[rr][cc]===2&&!(rr===r&&cc===c)){
  if(rr===r){direct={type:"row",cause:[rr,cc],title:"Deux Gardiens sur la même ligne",copy:"Une ligne ne peut contenir qu’un seul Gardien."};break}
  if(cc===c){direct={type:"col",cause:[rr,cc],title:"Deux Gardiens dans la même colonne",copy:"Une colonne ne peut contenir qu’un seul Gardien."};break}
  if(puz.reg[rr][cc]===puz.reg[r][c]){direct={type:"region",cause:[rr,cc],title:"Deux Gardiens dans le même territoire",copy:"Chaque territoire ne peut contenir qu’un seul Gardien."};break}
  if(Math.abs(rr-r)<=1&&Math.abs(cc-c)<=1){direct={type:"touch",cause:[rr,cc],title:"Ces deux Gardiens se touchent",copy:"Deux Gardiens ne peuvent jamais être voisins, même en diagonale."};break}
 }
 if(direct)return direct;
 const saved=state;
 state=guardianOnlyState(r,c);
 let possible=false;
 try{possible=solutions({n,puz,state}).length>0}catch(_){possible=puz.sol[r]===c}
 state=saved;
 if(!possible)return {type:"deadend",cause:null,title:"Ce placement mène à une impasse",copy:"Avec ce Gardien ici, il devient impossible de compléter toute la constellation sans violer une règle."};
 return null;
}

function validateGuardians(){
 const {n,puz,state}=getBoard();
   const placed=[];
   for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(state[r][c]===2)placed.push([r,c]);
   const rows=new Set(placed.map(x=>x[0]));
   const cols=new Set(placed.map(x=>x[1]));
   const regs=new Set(placed.map(([r,c])=>puz.reg[r][c]));
   let nonTouching=true,conflicts=[];
   for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
     const [r1,c1]=placed[i],[r2,c2]=placed[j];
     if(Math.abs(r1-r2)<=1&&Math.abs(c1-c2)<=1){nonTouching=false;conflicts.push([r1,c1],[r2,c2])}
   }
 return {placed,rows,cols,regs,nonTouching,conflicts};
}
return {validateGuardians,key,solutions,isAutoCross,verificationErrors,guardianConflicts,conflictMessage,proofEngine,directMissingCross,playerError,guardianOnlyState,guidedConflictForAction};
}
