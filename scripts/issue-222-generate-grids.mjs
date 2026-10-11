// Offline-only generator for #222. Run: node scripts/issue-222-generate-grids.mjs
// Never imported by the shipped application and never mutates existing quest IDs.
// Reuses the same generation and audit standards as replace-blocked-grids.mjs.
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import {createGameEngine} from "../src/game/engine.js";
import {CAT} from "../src/campaign/catalogue.js";
import {buildMigrationPlan,migrationLedger} from "./issue-222-migration-plan.mjs";

const plan=buildMigrationPlan();
const pending=plan.records.filter(q=>q.requiresGeneration);
if(pending.length!==104)throw Error("Unexpected migration scope: "+pending.length);
const context={createGameEngine,CAT};
vm.createContext(context);
vm.runInContext('let n=6,puz=CAT["6"][0],state=[];const {proofEngine}=createGameEngine(()=>({n,puz,state}),()=>true);',context);
const replayScript=new vm.Script(`(()=>{
 n=candidate.reg.length;puz=candidate;state=Array.from({length:n},()=>Array(n).fill(0));
 const rules={};let steps=0;
 while(steps<200&&state.flat().filter(v=>v===2).length<n){
  const h=proofEngine(),rule=h.detail?.rule;
  if(h.kind==='place'&&rule==='single'&&candidate.sol[h.cell[0]]===h.cell[1])state[h.cell[0]][h.cell[1]]=2;
  else if(h.kind==='elim'&&['locked','group','diamond','manual'].includes(rule)&&candidate.sol[h.cell[0]]!==h.cell[1])state[h.cell[0]][h.cell[1]]=1;
  else return null;
  rules[rule]=(rules[rule]||0)+1;steps++;
 }
 return state.flat().filter(v=>v===2).length===n?{ok:true,solutions:1,steps,rules,score:steps+n*4}:null;
})()`);
function replay(p){context.candidate=p;return replayScript.runInContext(context,{timeout:1000})}
function solutionCount(p){
 const n=p.reg.length;let count=0;
 function visit(r,cols,regions,prev){
  if(count>1)return;
  if(r===n){count++;return}
  for(let c=0;c<n;c++){
   const bit=1<<c,region=1<<p.reg[r][c];
   if(cols&bit||regions&region||r&&Math.abs(c-prev)<=1)continue;
   visit(r+1,cols|bit,regions|region,c);
  }
 }
 visit(0,0,0,-1);return count;
}
function signature(reg){
 const n=reg.length,variants=[];
 for(let f=0;f<2;f++)for(let turn=0;turn<4;turn++){
  const transformed=Array.from({length:n},()=>Array(n));
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
   let y=r,x=f?n-1-c:c;
   for(let k=0;k<turn;k++)[y,x]=[x,n-1-y];
   transformed[y][x]=reg[r][c];
  }
  const map=new Map();
  variants.push(transformed.flat().map(g=>{if(!map.has(g))map.set(g,map.size);return map.get(g)}).join(","));
 }
 return variants.sort()[0];
}
let seed=20261011;
function random(){seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function generate(n){
 let sol,attempts=0;
 do{sol=shuffle(Array.from({length:n},(_,i)=>i));if(++attempts>10000)throw Error("Cannot generate guardian permutation")}
 while(sol.some((v,i)=>i&&Math.abs(v-sol[i-1])<=1));
 const reg=Array.from({length:n},()=>Array(n).fill(-1)),counts=Array(n).fill(1);
 const weights=Array.from({length:n},()=>Math.exp(random()*5));
 sol.forEach((v,r)=>reg[r][v]=r);
 for(let remaining=n*n-n;remaining>0;remaining--){
  const frontier=[];let total=0;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(reg[r][c]<0){
   const neighbors=new Set();
   for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const g=reg[r+dr]?.[c+dc];if(g!==undefined&&g>=0)neighbors.add(g);
   }
   for(const g of neighbors){total+=counts[g]<2?200:weights[g];frontier.push({r,c,g,total})}
  }
  const choice=random()*total,{r,c,g}=frontier.find(x=>x.total>choice);
  reg[r][c]=g;counts[g]++;
 }
 if(counts.some(c=>c<2))return null;
 const labels=new Map();
 for(const row of reg)for(let c=0;c<n;c++){const g=row[c];if(!labels.has(g))labels.set(g,labels.size);row[c]=labels.get(g)}
 return {reg,sol};
}
const seen=new Set(Object.values(CAT).flat().map(p=>signature(p.reg)));
const added=[],errors=[];
for(const [i,slot] of pending.entries()){
 const size=i%5===0?7:i%3===0?8:7;
 let found=null;
 for(let attempt=0;attempt<100000;attempt++){
  const q=generate(size);if(!q)continue;
  const sig=signature(q.reg);if(seen.has(sig)||solutionCount(q)!==1)continue;
  const audit=replay(q);if(!audit)continue;
  seen.add(sig);
  found={id:slot.proposedQuestId,ordinal:slot.ordinal,adventureId:slot.adventureId,
   constellationId:slot.constellationId,size,reg:q.reg,sol:q.sol,audit,
   fingerprint:crypto.createHash("sha256").update(sig).digest("hex")};
  break;
 }
 if(!found){errors.push(slot.proposedQuestId);break}
 added.push(found);
 console.log("Audited",added.length,"/",pending.length,found.id,found.audit.steps);
}
if(errors.length||added.length!==pending.length)throw Error("Generation incomplete; no partial output: "+errors.join(","));
const artifact={schemaVersion:1,status:"staged-only",seed:20261011,plan:migrationLedger(plan),quests:added};
fs.mkdirSync("content/generated",{recursive:true});
const filename="content/generated/issue-222-additions.json";
fs.writeFileSync(filename,JSON.stringify(artifact,null,2)+"\n");
console.log("Staged "+added.length+" audited grids in "+filename+". NOT published.");
