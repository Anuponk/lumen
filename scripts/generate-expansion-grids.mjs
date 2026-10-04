// Offline expansion generator for Star Puzzle. Never imported by the runtime.
// Generates audited candidate puzzles for new real constellations (#90 / #93).
import fs from "node:fs";
import vm from "node:vm";
import {createGameEngine} from "../src/game/engine.js";
import {CAT} from "../src/campaign/catalogue.js";

const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const [k,v="true"]=arg.replace(/^--/,"").split("=");return [k,v]}));
const target=Number(args.count||64);
const sizes=(args.sizes||"6,7,8").split(",").map(Number);
const minScore=Number(args.minScore||55);
const maxScore=Number(args.maxScore||120);
let seed=Number(args.seed||20261004);

const context={createGameEngine,CAT};
vm.createContext(context);
vm.runInContext('let n=6,puz=CAT["6"][0],state=[];const {proofEngine}=createGameEngine(()=>({n,puz,state}),()=>true);',context);
const replayScript=new vm.Script(`(()=>{
 n=candidate.reg.length;puz=candidate;state=Array.from({length:n},()=>Array(n).fill(0));
 const rules={single:0,locked:0,group:0,diamond:0,manual:0};let steps=0;
 while(steps<300&&state.flat().filter(v=>v===2).length<n){
  const h=proofEngine(),rule=h.detail?.rule;
  if(h.kind==='place'&&rule==='single'&&candidate.sol[h.cell[0]]===h.cell[1])state[h.cell[0]][h.cell[1]]=2;
  else if(h.kind==='elim'&&['locked','group','diamond','manual'].includes(rule)&&candidate.sol[h.cell[0]]!==h.cell[1])state[h.cell[0]][h.cell[1]]=1;
  else return null;
  rules[rule]=(rules[rule]||0)+1;steps++;
 }
 if(state.flat().filter(v=>v===2).length!==n)return null;
 const work=Math.max(0,steps-n);
 const score=Math.round((n-5)*6+work*.45+rules.group*1.25+rules.locked*.6);
 return {steps,rules,score,tier:score<40?'accessible':score<55?'intermediate':score<70?'hard':score<90?'expert':'expert+'};
})()`);

function random(){seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function signature(reg){
 const n=reg.length,out=[];
 for(let flip=0;flip<2;flip++)for(let rot=0;rot<4;rot++){
  const x=Array.from({length:n},()=>Array(n));
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){let y=r,z=flip?n-1-c:c;for(let k=0;k<rot;k++)[y,z]=[z,n-1-y];x[y][z]=reg[r][c]}
  const labels=new Map();out.push(x.flat().map(g=>{if(!labels.has(g))labels.set(g,labels.size);return labels.get(g)}).join(","));
 }
 return out.sort()[0];
}
function solutionCount(p){
 const n=p.reg.length;let count=0;
 function visit(r,cols,regions,prev){
  if(count>1)return;if(r===n){count++;return}
  for(let c=0;c<n;c++){const cb=1n<<BigInt(c),rb=1n<<BigInt(p.reg[r][c]);if((cols&cb)||(regions&rb)||(r&&Math.abs(c-prev)<=1))continue;visit(r+1,cols|cb,regions|rb,c)}
 }
 visit(0,0n,0n,-99);return count;
}
function connected(reg){
 const n=reg.length;
 for(const g of new Set(reg.flat())){
  const cells=[];for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(reg[r][c]===g)cells.push([r,c]);
  if(cells.length<2)return false;
  const seen=new Set([cells[0].join(",")]),todo=[cells[0]];
  while(todo.length){const [r,c]=todo.pop();for(const [dy,dx]of [[1,0],[-1,0],[0,1],[0,-1]]){const y=r+dy,x=c+dx,k=y+","+x;if(y>=0&&y<n&&x>=0&&x<n&&reg[y][x]===g&&!seen.has(k)){seen.add(k);todo.push([y,x])}}}
  if(seen.size!==cells.length)return false;
 }
 return true;
}
function generate(n){
 let sol,guard=0;
 do{sol=shuffle(Array.from({length:n},(_,i)=>i));if(++guard>1000)return null}while(sol.some((c,r)=>r&&Math.abs(c-sol[r-1])<=1));
 const reg=Array.from({length:n},()=>Array(n).fill(-1)),counts=Array(n).fill(1),weights=Array.from({length:n},()=>Math.exp(random()*5));
 sol.forEach((c,r)=>reg[r][c]=r);
 for(let remaining=n*n-n;remaining>0;remaining--){
  const frontier=[];let total=0;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(reg[r][c]<0){
   const neighbors=new Set();for(const [dy,dx]of [[1,0],[-1,0],[0,1],[0,-1]]){const g=reg[r+dy]?.[c+dx];if(g!==undefined&&g>=0)neighbors.add(g)}
   for(const g of neighbors){const weight=counts[g]<2?250:weights[g];total+=weight;frontier.push({r,c,g,total})}
  }
  const pick=random()*total,cell=frontier.find(x=>x.total>pick);if(!cell)return null;reg[cell.r][cell.c]=cell.g;counts[cell.g]++;
 }
 if(counts.some(x=>x<2))return null;
 const labels=new Map();for(const row of reg)for(let c=0;c<n;c++){const g=row[c];if(!labels.has(g))labels.set(g,labels.size);row[c]=labels.get(g)}
 return {reg,sol};
}
function replay(p){context.candidate=p;return replayScript.runInContext(context,{timeout:1000})}

const seen=new Set(Object.values(CAT).flat().map(p=>signature(p.reg)));
const accepted=[];let attempts=0;
const maxAttempts=target*150000;
while(accepted.length<target&&attempts<maxAttempts){
 attempts++;const size=sizes[Math.floor(random()*sizes.length)],p=generate(size);if(!p||!connected(p.reg))continue;
 const sig=signature(p.reg);if(seen.has(sig)||solutionCount(p)!==1)continue;
 const audit=replay(p);if(!audit||audit.score<minScore||audit.score>maxScore)continue;
 seen.add(sig);accepted.push({...p,audit:{...audit,solutionCount:1,size}});
 if(accepted.length%10===0||accepted.length===target)console.log("accepted",accepted.length+"/"+target,"attempts",attempts);
}
if(accepted.length<target)throw Error("Generation budget exhausted: "+accepted.length+"/"+target+" accepted after "+attempts+" attempts");
accepted.sort((a,b)=>a.audit.score-b.audit.score||a.reg.length-b.reg.length);
const report={version:1,seed:Number(args.seed||20261004),target,sizes,minScore,maxScore,attempts,generated:accepted.length,tiers:Object.fromEntries(["hard","expert","expert+"].map(t=>[t,accepted.filter(x=>x.audit.tier===t).length])),puzzles:accepted};
const output=args.output||"scripts/generated/expansion-wave-2.json";
fs.mkdirSync(new URL("./generated/",import.meta.url),{recursive:true});
fs.writeFileSync(new URL("../"+output,import.meta.url),JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({output,generated:accepted.length,attempts,tiers:report.tiers,min:accepted[0].audit.score,max:accepted.at(-1).audit.score},null,2));
