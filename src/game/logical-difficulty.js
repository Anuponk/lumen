// Human-style, solution-blind propagation. This module never enumerates solutions.
// Facts form a dependency DAG; clearing many cells is not itself hard reasoning.
export const LOGICAL_RATING_VERSION='lumen-logic-v1';
const weights={single:1,guardian:0,locked:2,pair:4,triple:6,adjacency:3};
export function rateLogicalDifficulty(reg,{trace=true,basicOnly=false}={}){
 const n=reg.length;
 if(!Number.isInteger(n)||n<2||reg.some(row=>row.length!==n)||new Set(reg.flat()).size!==n||reg.flat().some(g=>!Number.isInteger(g)||g<0||g>=n))throw Error('Invalid territory matrix');
 const cells=Array.from({length:n*n},(_,i)=>i),row=i=>Math.floor(i/n),col=i=>i%n;
 const houses=['row','col','region'].flatMap(axis=>Array.from({length:n},(_,index)=>({axis,index,cells:cells.filter(i=>(axis==='row'?row(i):axis==='col'?col(i):reg[row(i)][col(i)])===index)})));
 const conflicts=(a,b)=>a!==b&&(row(a)===row(b)||col(a)===col(b)||reg[row(a)][col(a)]===reg[row(b)][col(b)]||Math.abs(row(a)-row(b))<=1&&Math.abs(col(a)-col(b))<=1);
 const removed=new Map(),placed=new Map(),facts=[],placements=[],rules={};let stalled=false;
 const candidates=h=>h.cells.filter(i=>!removed.has(i));
 function record(rule,targets,premiseHouses=[],extra=[]){
  const premises=[...new Set([...extra,...premiseHouses.flatMap(h=>h.cells.filter(i=>removed.has(i)).map(i=>removed.get(i)))])].sort((a,b)=>a-b);
  const depth=1+Math.max(0,...premises.map(id=>facts[id].depth));
  const fact={id:facts.length,rule,targets:targets.map(i=>[row(i),col(i)]),premises,depth,
   houses:premiseHouses.map(h=>({axis:h.axis,index:h.index,candidates:candidates(h).map(i=>[row(i),col(i)])})),remainingCandidates:cells.length-removed.size};
  facts.push(fact);rules[rule]=(rules[rule]||0)+1;return fact;
 }
 const initialSingles=new Set(houses.filter(h=>h.cells.length===1).map(h=>h.cells[0])).size;
 while(placed.size<n){
  const active=houses.filter(h=>!h.cells.some(i=>placed.has(i)));
  if(active.some(h=>candidates(h).length===0)){stalled=true;break}
  const singles=active.filter(h=>candidates(h).length===1);
  if(singles.length){
   const h=singles[0],i=candidates(h)[0],f=record('single',[i],[h]);placed.set(i,f.id);placements.push(f);
   const targets=cells.filter(j=>!removed.has(j)&&conflicts(i,j));
   if(targets.length){const e=record('guardian',targets,[],[f.id]);for(const j of targets)removed.set(j,e.id)}
   continue;
  }
  let deduction=null;
  // A house's guardian must lie in its candidate set. Anything conflicting
  // with EVERY member is impossible (includes territory/line intersections
  // and common non-touching consequences, without assuming a guardian).
  for(const h of active){
   const a=candidates(h),targets=cells.filter(j=>!removed.has(j)&&!placed.has(j)&&!a.includes(j)&&a.every(i=>conflicts(i,j)));
   if(targets.length){
    const locked=targets.every(j=>a.every(i=>row(i)===row(j)||col(i)===col(j)||reg[row(i)][col(i)]===reg[row(j)][col(j)]));
    if(basicOnly&&!locked)continue;
    deduction={rule:locked?'locked':'adjacency',targets,houses:[h]};break;
   }
  }
  // Hall sets: k disjoint source houses confined to k target houses reserve
  // those targets. Rows/columns/territories are exact-one partitions in Lumen.
  if(!deduction&&!basicOnly)outer:for(const sourceAxis of ['region','row','col'])for(const targetAxis of ['row','col','region']){
   if(sourceAxis===targetAxis)continue;
   const sources=active.filter(h=>h.axis===sourceAxis),targets=houses.filter(h=>h.axis===targetAxis);
   for(const k of [2,3]){
    const visit=(start,group)=>{
     if(group.length===k){
      const a=group.flatMap(candidates),reserved=targets.filter(h=>h.cells.some(i=>a.includes(i)));
      if(reserved.length!==k)return null;
      const eliminated=reserved.flatMap(h=>h.cells).filter(i=>!removed.has(i)&&!placed.has(i)&&!a.includes(i));
      return eliminated.length?{rule:k===2?'pair':'triple',targets:eliminated,houses:group}:null;
     }
     for(let i=start;i<sources.length;i++){const found=visit(i+1,[...group,sources[i]]);if(found)return found}return null;
    };
    deduction=visit(0,[]);if(deduction)break outer;
   }
  }
  if(!deduction){stalled=true;break}
  const f=record(deduction.rule,deduction.targets,deduction.houses);for(const i of deduction.targets)removed.set(i,f.id);
 }
 const reasoning=facts.filter(f=>f.rule!=='guardian'),advanced=reasoning.filter(f=>['pair','triple','adjacency'].includes(f.rule));
 const first=placements[0],beforeFirst=first?facts.slice(0,first.id).filter(f=>f.rule!=='guardian').length:0;
 const depth=Math.max(0,...placements.map(f=>f.depth));
 const effort=reasoning.reduce((sum,f)=>sum+weights[f.rule],0);
 // Per-guardian normalization removes a direct incentive to inflate board size.
 const score=Number((10*effort/n+2*depth+4*beforeFirst+8*advanced.length/n).toFixed(3));
 return {version:LOGICAL_RATING_VERSION,solved:!stalled&&placed.size===n,score,initialSingles,
  guardians:placed.size,firstPlacementDepth:first?.depth??null,deductionsBeforeFirst:beforeFirst,
  dependencyDepth:depth,meanPlacementDepth:placements.reduce((s,f)=>s+f.depth,0)/(placements.length||1),
  logicalDeductions:reasoning.length,intermediateDeductions:reasoning.length-placements.length,
  advancedDeductions:advanced.length,ruleDiversity:Object.keys(rules).filter(r=>r!=='guardian').length,
  forcedBranches:0,effort,rules,solution:[...placed.keys()].sort((a,b)=>row(a)-row(b)).map(col),...(trace?{trace:facts}:{})};
}
